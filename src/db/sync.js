import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { db, TABELAS_SYNC, transacaoSync, onLocalChange } from './database'

const TAMANHO_LOTE = 500
const SOBREPOSICAO_MS = 5000 // relê um pequeno intervalo para não perder linhas confirmadas "atrasadas"

// ---- estado observável (para o indicador na tela) ----
let estado = { fase: 'ocioso', pendentes: 0, erro: null, ultimoSync: null, online: navigator.onLine }
const assinantes = new Set()
const definir = (parcial) => {
  estado = { ...estado, ...parcial }
  assinantes.forEach((fn) => fn())
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (fn) => {
      assinantes.add(fn)
      return () => assinantes.delete(fn)
    },
    () => estado
  )

export async function contarPendentes() {
  const contagens = await Promise.all(TABELAS_SYNC.map((t) => db[t].where('dirty').equals(1).count()))
  const tombs = await db.tombstones.count()
  return contagens.reduce((a, b) => a + b, 0) + tombs
}

// ---- cursor do pull, por usuário e tabela ----
const chaveCursor = (uid, tabela) => `talhao_pull_${uid}_${tabela}`
const lerCursor = (uid, tabela) => {
  try {
    return localStorage.getItem(chaveCursor(uid, tabela)) || '1970-01-01T00:00:00Z'
  } catch {
    return '1970-01-01T00:00:00Z'
  }
}
const gravarCursor = (uid, tabela, valor) => {
  try {
    localStorage.setItem(chaveCursor(uid, tabela), valor)
  } catch {
    /* sem localStorage: relê tudo na próxima vez */
  }
}

// ---- PULL: traz do servidor o que mudou desde o último sync ----
async function pull(uid) {
  let total = 0
  for (const tabela of TABELAS_SYNC) {
    const cursor = lerCursor(uid, tabela)
    let maior = cursor
    let de = 0
    for (;;) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(de, de + 999)
      if (error) throw error
      if (!data.length) break

      await transacaoSync('rw', [db[tabela]], async () => {
        for (const remoto of data) {
          const local = await db[tabela].get(remoto.id)
          if (local?.dirty === 1) continue // alteração local pendente vence; será enviada no push
          if (remoto.deleted_at) {
            if (local) await db[tabela].delete(remoto.id)
          } else {
            const { user_id, deleted_at, ...campos } = remoto
            await db[tabela].put({ ...campos, dirty: 0, local_rev: 0 })
          }
        }
      })

      total += data.length
      const ultimo = data[data.length - 1].updated_at
      if (ultimo > maior) maior = ultimo
      if (data.length < 1000) break
      de += 1000
    }
    if (maior !== cursor) {
      gravarCursor(uid, tabela, new Date(new Date(maior).getTime() - SOBREPOSICAO_MS).toISOString())
    }
  }
  return total
}

// ---- PUSH: envia alterações locais e exclusões ----
async function push() {
  for (const tabela of TABELAS_SYNC) {
    const sujos = await db[tabela].where('dirty').equals(1).toArray()
    for (let i = 0; i < sujos.length; i += TAMANHO_LOTE) {
      const lote = sujos.slice(i, i + TAMANHO_LOTE)
      const linhas = lote.map(({ dirty, local_rev, user_id, updated_at, deleted_at, ...campos }) => campos)
      const { error } = await supabase.from(tabela).upsert(linhas, { onConflict: 'id' })
      if (error) throw error

      // só limpa "dirty" se o registro não foi alterado de novo durante o envio
      await transacaoSync('rw', [db[tabela]], async () => {
        for (const enviado of lote) {
          const atual = await db[tabela].get(enviado.id)
          if (atual && atual.local_rev === enviado.local_rev) {
            await db[tabela].update(enviado.id, { dirty: 0 })
          }
        }
      })
    }
  }

  // exclusões: o servidor guarda exclusão lógica para os outros aparelhos saberem
  const tombs = await db.tombstones.toArray()
  for (const tabela of TABELAS_SYNC) {
    const ids = tombs.filter((t) => t.tabela === tabela).map((t) => t.id)
    for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
      const lote = ids.slice(i, i + TAMANHO_LOTE)
      const { error } = await supabase
        .from(tabela)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', lote)
      if (error) throw error
      await db.tombstones.bulkDelete(lote.map((id) => `${tabela}:${id}`))
    }
  }
}

// ---- orquestração ----
let emAndamento = null
let reexecutar = false

export async function sincronizar() {
  if (emAndamento) {
    reexecutar = true
    return emAndamento
  }
  if (!navigator.onLine) {
    definir({ online: false, fase: 'offline', pendentes: await contarPendentes() })
    return
  }

  emAndamento = (async () => {
    definir({ fase: 'sincronizando', erro: null, online: true })
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) throw new Error('Sessão expirada. Entre novamente.')
      await pull(uid)
      await push()
      definir({ fase: 'ok', ultimoSync: new Date(), pendentes: await contarPendentes() })
    } catch (e) {
      definir({ fase: 'erro', erro: e?.message || String(e), pendentes: await contarPendentes() })
      throw e
    }
  })()

  try {
    await emAndamento
  } finally {
    emAndamento = null
    if (reexecutar) {
      reexecutar = false
      sincronizar().catch(() => {})
    }
  }
}

// Liga os gatilhos automáticos. Retorna função para desligar.
export function iniciarSyncAutomatico() {
  let timer = null
  const agendar = () => {
    clearTimeout(timer)
    timer = setTimeout(() => sincronizar().catch(() => {}), 1500)
  }
  const aoVoltarOnline = () => {
    definir({ online: true })
    sincronizar().catch(() => {})
  }
  const aoFicarOffline = async () => definir({ online: false, fase: 'offline', pendentes: await contarPendentes() })
  const aoFicarVisivel = () => {
    if (document.visibilityState === 'visible') sincronizar().catch(() => {})
  }

  const desligarLocal = onLocalChange(async () => {
    definir({ pendentes: await contarPendentes() })
    agendar()
  })
  window.addEventListener('online', aoVoltarOnline)
  window.addEventListener('offline', aoFicarOffline)
  document.addEventListener('visibilitychange', aoFicarVisivel)

  return () => {
    clearTimeout(timer)
    desligarLocal()
    window.removeEventListener('online', aoVoltarOnline)
    window.removeEventListener('offline', aoFicarOffline)
    document.removeEventListener('visibilitychange', aoFicarVisivel)
  }
}

// Ao sair da conta: apaga o cache local para outro usuário não ver estes dados
export async function limparDadosLocais() {
  await transacaoSync('rw', [...TABELAS_SYNC.map((t) => db[t]), db.tombstones], async () => {
    await Promise.all([...TABELAS_SYNC.map((t) => db[t].clear()), db.tombstones.clear()])
  })
  try {
    const chaves = []
    for (let i = 0; i < localStorage.length; i++) chaves.push(localStorage.key(i))
    chaves.filter((k) => k && k.startsWith('talhao_pull_')).forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignora */
  }
}
