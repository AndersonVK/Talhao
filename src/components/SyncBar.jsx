import { useSyncStatus } from '../db/sync'

// Faixa fina no topo: só aparece quando há algo a avisar (offline, pendências, erro)
export function SyncBar() {
  const s = useSyncStatus()
  const pend = s.pendentes

  let texto = null
  let cor = 'var(--yellow)'
  if (s.fase === 'erro') {
    texto = `⚠ Falha ao sincronizar${pend ? ` · ${pend} pendente${pend > 1 ? 's' : ''}` : ''}`
    cor = 'var(--red)'
  } else if (!s.online || s.fase === 'offline') {
    texto = `Offline${pend ? ` · ${pend} alteraç${pend > 1 ? 'ões' : 'ão'} aguardando envio` : ' · dados salvos no aparelho'}`
  } else if (s.fase === 'sincronizando') {
    texto = '↻ Sincronizando…'
    cor = 'var(--green-bright)'
  } else if (pend > 0) {
    texto = `${pend} alteraç${pend > 1 ? 'ões' : 'ão'} aguardando envio`
  }
  if (!texto) return null

  return (
    <div style={{ fontSize: 11, textAlign: 'center', padding: '3px 8px', color: cor, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
      {texto}
    </div>
  )
}
