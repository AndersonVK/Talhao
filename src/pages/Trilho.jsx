import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcularSemanaAtual } from '../db/database'
import { useMemo } from 'react'

const TOTAL_SEMANAS = 36

function SemanaArc({ semana, total = TOTAL_SEMANAS }) {
  const pct = Math.min(semana / total, 1)
  const r = 19
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  const cor =
    semana >= 34 ? 'var(--green-bright)' :
    semana >= 28 ? 'var(--yellow)' :
    'var(--green-mid)'

  return (
    <div className="semana-arc">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke={cor}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <div className="semana-arc-num" style={{ color: cor, fontSize: semana >= 10 ? 13 : 15 }}>
        {semana}
      </div>
    </div>
  )
}

export function Trilho({ onNavigate, onAreaSelect }) {
  const areas = useLiveQuery(() => db.areas.orderBy('id').toArray())
  const ciclosAtivos = useLiveQuery(() => db.ciclos.where('status').equals('ativo').toArray())
  const tarefasGeradas = useLiveQuery(() =>
    db.tarefas_geradas.where('status').anyOf(['pendente', 'atrasado']).toArray()
  )

  const cicloMap = useMemo(() => {
    const m = {}
    ciclosAtivos?.forEach((c) => (m[c.area_id] = c))
    return m
  }, [ciclosAtivos])

  const atrasadasPorCiclo = useMemo(() => {
    const m = {}
    tarefasGeradas?.forEach((t) => {
      if (t.status === 'atrasado') {
        m[t.ciclo_id] = (m[t.ciclo_id] || 0) + 1
      }
    })
    return m
  }, [tarefasGeradas])

  const pendentesHoje = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const m = {}
    tarefasGeradas?.forEach((t) => {
      if (t.status === 'pendente' && t.data_prevista_inicio <= hoje && t.data_prevista_fim >= hoje) {
        m[t.ciclo_id] = (m[t.ciclo_id] || 0) + 1
      }
    })
    return m
  }, [tarefasGeradas])

  if (!areas || !ciclosAtivos) {
    return <div className="page"><div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>Carregando…</div></div>
  }

  const semanas = areas.map((area) => {
    const ciclo = cicloMap[area.id]
    if (!ciclo) return { area, semana: null, ciclo: null }
    return { area, semana: calcularSemanaAtual(ciclo.data_poda), ciclo }
  })

  const comCiclo = semanas.filter((x) => x.ciclo)
  const semCiclo = semanas.filter((x) => !x.ciclo)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Estado do pomar</div>
          <div className="page-subtitle">{comCiclo.length} áreas com ciclo ativo</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('poda')}
        >
          + Poda
        </button>
      </div>

      {comCiclo.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🌳</div>
          <div className="empty-text">Nenhum ciclo ativo.<br />Registre a primeira poda para começar.</div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('poda')}>
            Registrar poda
          </button>
        </div>
      )}

      {comCiclo.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {semanas.map(({ area, semana, ciclo }) => {
              if (!ciclo) return null
              const atrasadas = atrasadasPorCiclo[ciclo.id] || 0
              const hoje = pendentesHoje[ciclo.id] || 0
              const pronta = semana >= 35
              const classe = atrasadas > 0 ? 'atrasada' : pronta ? 'pronta' : hoje > 0 ? 'urgente' : ''

              return (
                <button
                  key={area.id}
                  className={`area-pill ${classe}`}
                  onClick={() => onAreaSelect(area.id)}
                >
                  <div className="area-nome">{area.nome}</div>
                  <SemanaArc semana={semana} />
                  <div className="area-semana-label">
                    {pronta ? '🌿 pronta p/ poda' : `sem. ${semana}/36`}
                  </div>
                  {atrasadas > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', fontSize: 10 }}>
                        {atrasadas} atr.
                      </span>
                    </div>
                  )}
                  {atrasadas === 0 && hoje > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <span className="badge" style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--yellow)', fontSize: 10 }}>
                        {hoje} hoje
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <LegendaCores />
        </>
      )}

      {semCiclo.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title">Áreas sem ciclo ativo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {semCiclo.map(({ area }) => (
              <button
                key={area.id}
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('poda', area.id)}
              >
                {area.nome} — iniciar ciclo
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LegendaCores() {
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div className="section-title" style={{ marginBottom: 6 }}>Legenda</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <LegItem cor="var(--green-bright)" label="Pronta p/ nova poda" />
        <LegItem cor="var(--red)" label="Tem tarefas atrasadas" />
        <LegItem cor="var(--yellow)" label="Tarefa vence hoje" />
      </div>
    </div>
  )
}

function LegItem({ cor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} />
      {label}
    </div>
  )
}
