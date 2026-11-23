import Dexie from 'dexie'

// Banco local (cache offline). IDs são UUIDs gerados no aparelho, para que
// registros criados sem internet possam ser sincronizados depois com o Supabase.
export const db = new Dexie('TalhaoGoiabaV2')

db.version(1).stores({
  areas: 'id, ordem, dirty',
  tarefas_modelo: 'id, semana_inicio, dirty',
  ciclos: 'id, area_id, status, dirty',
  tarefas_geradas: 'id, ciclo_id, tarefa_modelo_id, status, data_prevista_inicio, dirty',
  tombstones: 'key, tabela',
})

// Tabelas sincronizadas, em ordem de dependência (pais antes dos filhos)
export const TABELAS_SYNC = ['areas', 'tarefas_modelo', 'ciclos', 'tarefas_geradas']

export const novoId = () => crypto.randomUUID()

// Duração do ciclo produtivo (poda → colheita), em semanas
export const CICLO_SEMANAS = 37

const emSync = (trans) => trans?.source === 'sync'

// Hooks: toda escrita local marca o registro como pendente de envio (dirty),
// e toda exclusão local gera um "tombstone" para propagar a exclusão ao servidor.
// Escritas feitas pelo próprio sync (trans.source === 'sync') são ignoradas.
const listeners = new Set()
export const onLocalChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const avisarMudanca = () => listeners.forEach((fn) => fn())

for (const nome of TABELAS_SYNC) {
  const tabela = db[nome]

  tabela.hook('creating', function (primKey, obj, trans) {
    if (emSync(trans)) return
    obj.dirty = 1
    obj.local_rev = 1
    trans.on('complete', avisarMudanca)
    if (primKey === undefined) return novoId()
  })

  tabela.hook('updating', function (mods, primKey, obj, trans) {
    if (emSync(trans)) return
    trans.on('complete', avisarMudanca)
    return { dirty: 1, local_rev: (obj.local_rev || 0) + 1 }
  })

  tabela.hook('deleting', function (primKey, obj, trans) {
    if (emSync(trans)) return
    trans.on('complete', () => {
      db.tombstones.put({ key: `${nome}:${primKey}`, tabela: nome, id: primKey }).then(avisarMudanca)
    })
  })
}

// Executa escritas sem marcar como pendentes (usado pelo sync ao aplicar dados do servidor)
export function transacaoSync(modo, tabelas, fn) {
  return db.transaction(modo, tabelas, async () => {
    Dexie.currentTransaction.source = 'sync'
    return fn()
  })
}

export const TIPOS_TAREFA = {
  poda: { label: 'Poda', cor: '#86efac' },
  adubacao_organica: { label: 'Adubação Orgânica', cor: '#fde68a' },
  adubacao_quimica: { label: 'Adubação Química', cor: '#fcd34d' },
  aplicacao_defensivo: { label: 'Defensivo', cor: '#f9a8d4' },
  monitoramento_praga: { label: 'Monitoramento de Praga', cor: '#fb923c' },
  colheita: { label: 'Colheita', cor: '#4ade80' },
  outro: { label: 'Outro', cor: '#94a3b8' },
}

export const AREAS_INICIAIS = [
  { nome: 'Área A', qtd_plantas: 392 },
  { nome: 'Área B', qtd_plantas: 388 },
  { nome: 'Área C', qtd_plantas: 390 },
  { nome: 'Área D', qtd_plantas: 391 },
  { nome: 'Área E', qtd_plantas: 389 },
  { nome: 'Área F', qtd_plantas: 392 },
  { nome: 'Área G', qtd_plantas: 388 },
  { nome: 'Área H', qtd_plantas: 390 },
  { nome: 'Área I', qtd_plantas: 380 },
].map((a, i) => ({ ...a, ordem: i + 1 }))

export const TAREFAS_MODELO_SEED = [
  {
    semana_inicio: 1,
    semana_fim: 1,
    titulo: 'Poda de produção',
    tipo: 'poda',
    descricao: 'Poda de frutificação para iniciar novo ciclo produtivo.',
  },
  {
    semana_inicio: 2,
    semana_fim: 2,
    titulo: 'Calda sulfocálcica + Adubação orgânica',
    tipo: 'aplicacao_defensivo',
    descricao: 'Aplicação de calda sulfocálcica para controle de pragas. Incorporar matéria orgânica (esterco/composto) ao redor das plantas.',
  },
  {
    semana_inicio: 14,
    semana_fim: 16,
    titulo: 'Monitoramento intensivo — Gorgulho',
    tipo: 'monitoramento_praga',
    descricao: 'Período crítico de infestação do gorgulho da goiaba (Conotrachelus psidii). Inspecionar frutos e aplicar controle se necessário.',
  },
  {
    semana_inicio: 18,
    semana_fim: 18,
    titulo: 'Adubação química NPK 10-05-30',
    tipo: 'adubacao_quimica',
    descricao: 'Aplicar NPK 10-05-30 conforme análise de solo. Importante para enchimento dos frutos.',
  },
]

// Só deve ser chamada DEPOIS da primeira sincronização: se o servidor já tem
// dados, eles chegam pelo pull; só semeia quando tudo está realmente vazio.
export async function semearDadosIniciais() {
  if ((await db.areas.count()) > 0) return false
  await db.areas.bulkAdd(AREAS_INICIAIS)
  await db.tarefas_modelo.bulkAdd(TAREFAS_MODELO_SEED)
  return true
}

function calcularDatas(dataPoda, modelo) {
  const diasInicio = (modelo.semana_inicio - 1) * 7
  const diasFim = (modelo.semana_fim - 1) * 7 + 6
  const dataInicio = new Date(dataPoda)
  dataInicio.setDate(dataInicio.getDate() + diasInicio)
  const dataFim = new Date(dataPoda)
  dataFim.setDate(dataFim.getDate() + diasFim)
  return {
    data_prevista_inicio: dataInicio.toISOString().split('T')[0],
    data_prevista_fim: dataFim.toISOString().split('T')[0],
  }
}

export async function gerarTarefas(cicloId, dataPoda, modelosTarefa) {
  const tarefas = modelosTarefa.map((modelo) => ({
    ciclo_id: cicloId,
    tarefa_modelo_id: modelo.id,
    ...calcularDatas(dataPoda, modelo),
    data_realizada: null,
    status: 'pendente',
    observacao: '',
  }))

  await db.tarefas_geradas.bulkAdd(tarefas)
}

export async function sincronizarModeloComCiclosAtivos(modelo) {
  const ciclosAtivos = await db.ciclos.where('status').equals('ativo').toArray()

  for (const ciclo of ciclosAtivos) {
    const datas = calcularDatas(ciclo.data_poda, modelo)

    const existente = await db.tarefas_geradas
      .where({ ciclo_id: ciclo.id, tarefa_modelo_id: modelo.id })
      .first()

    if (!existente) {
      // Nova tarefa no calendário — adiciona ao ciclo
      await db.tarefas_geradas.add({
        ciclo_id: ciclo.id,
        tarefa_modelo_id: modelo.id,
        ...datas,
        data_realizada: null,
        status: 'pendente',
        observacao: '',
      })
    } else if (existente.status !== 'feito') {
      // Tarefa editada e ainda não feita — atualiza as datas
      await db.tarefas_geradas.update(existente.id, { ...datas, status: 'pendente' })
    }
    // Se já está 'feito', não mexe
  }

  return ciclosAtivos.length
}

export async function registrarPoda(areaId, dataPoda) {
  const modelos = await db.tarefas_modelo.toArray()
  const cicloId = await db.ciclos.add({
    area_id: areaId,
    data_poda: dataPoda,
    status: 'ativo',
  })
  await gerarTarefas(cicloId, dataPoda, modelos)
  return cicloId
}

export function calcularSemanaAtual(dataPoda) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const poda = new Date(dataPoda + 'T00:00:00')
  const diffMs = hoje - poda
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.min(Math.floor(diffDias / 7) + 1, CICLO_SEMANAS)
}

export const BACKUP_VERSION = 1

export async function exportarDados() {
  const [areas, tarefas_modelo, ciclos, tarefas_geradas] = await Promise.all(
    TABELAS_SYNC.map((t) => db[t].toArray())
  )
  const limpar = ({ dirty, local_rev, ...resto }) => resto
  return {
    versao: BACKUP_VERSION,
    exportado_em: new Date().toISOString(),
    areas: areas.map(limpar),
    tarefas_modelo: tarefas_modelo.map(limpar),
    ciclos: ciclos.map(limpar),
    tarefas_geradas: tarefas_geradas.map(limpar),
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Restaura um backup, SUBSTITUINDO os dados atuais. Aceita backups antigos
// (IDs numéricos): converte todos os IDs para UUID e refaz as referências.
export async function importarDados(backup) {
  if (!backup?.versao || !backup?.areas) {
    throw new Error('Arquivo inválido ou incompatível.')
  }

  const mapas = { areas: new Map(), tarefas_modelo: new Map(), ciclos: new Map() }
  const idNovo = (tabela, antigo) => {
    if (UUID_RE.test(String(antigo))) return String(antigo)
    const m = mapas[tabela]
    if (!m.has(antigo)) m.set(antigo, novoId())
    return m.get(antigo)
  }
  const sem = ({ dirty, local_rev, user_id, updated_at, deleted_at, ...r }) => r

  const areas = (backup.areas || []).map((a, i) => ({
    ...sem(a),
    id: idNovo('areas', a.id),
    ordem: a.ordem ?? i + 1,
  }))
  const tarefas_modelo = (backup.tarefas_modelo || []).map((m) => ({
    ...sem(m),
    id: idNovo('tarefas_modelo', m.id),
  }))
  const ciclos = (backup.ciclos || []).map((c) => ({
    ...sem(c),
    id: idNovo('ciclos', c.id),
    area_id: idNovo('areas', c.area_id),
  }))
  const idsCiclos = new Set(ciclos.map((c) => c.id))
  const idsModelos = new Set(tarefas_modelo.map((m) => m.id))
  const tarefas_geradas = (backup.tarefas_geradas || [])
    .map((t) => ({
      ...sem(t),
      id: novoIdSeNaoUuid(t.id),
      ciclo_id: idNovo('ciclos', t.ciclo_id),
      tarefa_modelo_id:
        t.tarefa_modelo_id == null ? null : idNovo('tarefas_modelo', t.tarefa_modelo_id),
    }))
    .filter((t) => idsCiclos.has(t.ciclo_id))
    .map((t) => ({ ...t, tarefa_modelo_id: idsModelos.has(t.tarefa_modelo_id) ? t.tarefa_modelo_id : null }))

  await db.transaction('rw', [db.areas, db.tarefas_modelo, db.ciclos, db.tarefas_geradas], async () => {
    await Promise.all(TABELAS_SYNC.map((t) => db[t].clear()))
    if (areas.length) await db.areas.bulkAdd(areas)
    if (tarefas_modelo.length) await db.tarefas_modelo.bulkAdd(tarefas_modelo)
    if (ciclos.length) await db.ciclos.bulkAdd(ciclos)
    if (tarefas_geradas.length) await db.tarefas_geradas.bulkAdd(tarefas_geradas)
  })
}

function novoIdSeNaoUuid(id) {
  return UUID_RE.test(String(id)) ? String(id) : novoId()
}

// Banco da versão anterior (IDs numéricos, só local). Se existir e o banco novo
// estiver vazio, traz os dados para ele (serão enviados ao Supabase no sync).
const NOME_BANCO_LEGADO = 'TalhaoGoiaba'

export async function legadoDisponivel() {
  try {
    return await Dexie.exists(NOME_BANCO_LEGADO)
  } catch {
    return false
  }
}

export async function migrarLegado() {
  const legado = new Dexie(NOME_BANCO_LEGADO)
  try {
    await legado.open()
    const ler = (t) => (legado.tables.some((x) => x.name === t) ? legado.table(t).toArray() : [])
    const [areas, tarefas_modelo, ciclos, tarefas_geradas] = await Promise.all(
      TABELAS_SYNC.map(ler)
    )
    if (!areas.length) return false
    await importarDados({ versao: BACKUP_VERSION, areas, tarefas_modelo, ciclos, tarefas_geradas })
    return true
  } finally {
    legado.close()
  }
}

export async function atualizarStatusAtrasadas() {
  const hoje = new Date().toISOString().split('T')[0]
  const pendentes = await db.tarefas_geradas
    .where('status')
    .equals('pendente')
    .toArray()

  const atrasadas = pendentes.filter((t) => t.data_prevista_fim < hoje)
  for (const t of atrasadas) {
    await db.tarefas_geradas.update(t.id, { status: 'atrasado' })
  }
}
