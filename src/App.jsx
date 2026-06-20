import { useEffect, useState } from 'react'
import { inicializarDados } from './db/database'
import { ToastProvider } from './components/Toast'
import { Painel } from './pages/Painel'
import { Trilho } from './pages/Trilho'
import { RegistrarPoda } from './pages/RegistrarPoda'
import { DetalheArea } from './pages/DetalheArea'
import { CalendarioMestre } from './pages/CalendarioMestre'

const TABS = ['painel', 'trilho', 'poda', 'calendario']

function NavIcon({ tab, active }) {
  const color = active ? 'var(--green-bright)' : 'var(--text-muted)'
  if (tab === 'painel') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
  if (tab === 'trilho') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      <line x1="7" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="17" y2="12" />
      <path d="M5 6v-2M12 6v-2M19 6v-2M5 20v-2M12 20v-2M19 20v-2" />
    </svg>
  )
  if (tab === 'poda') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <line x1="12" y1="12" x2="12" y2="12" /><circle cx="12" cy="12" r="1.5" fill={color} />
      <path d="M12 7V5m0 14v-2" />
    </svg>
  )
  if (tab === 'calendario') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="8" y2="18" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  )
  return null
}

const NAV_LABELS = {
  painel: 'Painel',
  trilho: 'Áreas',
  poda: 'Poda',
  calendario: 'Calendário',
}

export default function App() {
  const [tab, setTab] = useState('painel')
  const [areaDetalhe, setAreaDetalhe] = useState(null)
  const [podaPreArea, setPodaPreArea] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    inicializarDados().then(() => setReady(true))
  }, [])

  function navigate(dest, param) {
    if (dest === 'poda') {
      setPodaPreArea(param || null)
      setTab('poda')
    } else if (dest === 'trilho') {
      setAreaDetalhe(null)
      setTab('trilho')
    } else {
      setTab(dest)
    }
  }

  function onAreaSelect(areaId) {
    setAreaDetalhe(areaId)
  }

  if (!ready) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ fontSize: 40 }}>🌿</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Talhão</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Iniciando banco de dados…</div>
      </div>
    )
  }

  const showDetalhe = tab === 'trilho' && areaDetalhe !== null

  return (
    <ToastProvider>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {showDetalhe ? (
            <DetalheArea key={areaDetalhe} areaId={areaDetalhe} onNavigate={navigate} />
          ) : (
            <>
              <div style={{ display: tab === 'painel' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <Painel onNavigate={navigate} />
              </div>
              <div style={{ display: tab === 'trilho' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <Trilho onNavigate={navigate} onAreaSelect={onAreaSelect} />
              </div>
              <div style={{ display: tab === 'poda' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <RegistrarPoda onNavigate={navigate} preAreaId={podaPreArea} />
              </div>
              <div style={{ display: tab === 'calendario' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <CalendarioMestre />
              </div>
            </>
          )}
        </div>

        {/* Bottom nav */}
        <nav className="nav-bar">
          {TABS.map((t) => (
            <button
              key={t}
              className={`nav-btn ${(showDetalhe ? 'trilho' : tab) === t ? 'active' : ''}`}
              onClick={() => {
                if (t === 'trilho') setAreaDetalhe(null)
                if (t === 'poda') setPodaPreArea(null)
                setTab(t)
              }}
            >
              <NavIcon tab={t} active={(showDetalhe ? 'trilho' : tab) === t} />
              {NAV_LABELS[t]}
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  )
}
