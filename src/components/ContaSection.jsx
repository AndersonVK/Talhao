import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sincronizar, useSyncStatus, contarPendentes, limparDadosLocais } from '../db/sync'
import { useToast } from './Toast'

export function ContaSection() {
  const toast = useToast()
  const s = useSyncStatus()
  const [email, setEmail] = useState('')
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [])

  async function sincronizarAgora() {
    try {
      await sincronizar()
      toast('✓ Sincronizado.')
    } catch (e) {
      toast('Falha ao sincronizar.')
    }
  }

  async function sair() {
    setSaindo(true)
    try {
      try { await sincronizar() } catch { /* offline ou erro: confere pendências abaixo */ }
      const pend = await contarPendentes()
      if (pend > 0) {
        const seguir = window.confirm(
          `Há ${pend} alteração(ões) que ainda NÃO foram enviadas à nuvem. Se sair agora, elas serão perdidas.\n\nSair mesmo assim?`
        )
        if (!seguir) return
      } else if (!window.confirm('Sair da conta? Os dados continuam salvos na nuvem.')) {
        return
      }
      await limparDadosLocais()
      await supabase.auth.signOut()
    } finally {
      setSaindo(false)
    }
  }

  const status =
    s.fase === 'erro' ? `Erro: ${s.erro}` :
    s.fase === 'sincronizando' ? 'Sincronizando…' :
    !s.online ? 'Offline' :
    s.ultimoSync ? `Última sincronização: ${s.ultimoSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` :
    'Aguardando sincronização'

  return (
    <div style={{ marginTop: 32 }}>
      <div className="divider" />
      <div className="section-title" style={{ marginBottom: 12 }}>Conta e sincronização</div>
      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Conectado como</div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, wordBreak: 'break-all' }}>{email || '…'}</div>
        <div style={{ fontSize: 12, color: s.fase === 'erro' ? 'var(--red)' : 'var(--text-secondary)', marginBottom: 12 }}>
          {status}
          {s.pendentes > 0 && ` · ${s.pendentes} pendente${s.pendentes > 1 ? 's' : ''}`}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={sincronizarAgora} disabled={s.fase === 'sincronizando'}>
            ↻ Sincronizar agora
          </button>
          <button className="btn btn-danger" onClick={sair} disabled={saindo}>Sair</button>
        </div>
      </div>
    </div>
  )
}
