import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcularSemanaAtual } from '../db/database'
import { TaskItem } from '../components/TaskItem'
import { TipoBadge } from '../components/TipoDot'
import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function SemanaTimeline({ semanaAtual, tarefas, modelos, onDone }) {
  const modeloMap = useMemo(() => {
    const m = {}
    modelos?.forEach((x) => (m[x.id] = x))
    return m
  }, [modelos])

  const porSemana = useMemo(() => {
    const m = {}
    for (const t of tarefas) {
      const s = modeloMap[t.tarefa_modelo_id]?.semana_inicio
      if (s) {
        if (!m[s]) m[s] = []
        m[s].push(t)
      }
    }
    return m
  }, [tarefas, modeloMap])

  const semanasComTarefa = Object.keys(porSemana).map(Number).sort((a, b) => a - b)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: 20,
        top: 0,
        bottom: 0,
        width: 2,
        background: 'var(--border)',
      }} />
      {semanasComTarefa.map((s) => {
        const isPast = s < semanaAtual
        const isCurrent = s === semanaAtual
        const isFuture = s > semanaAtual
        const tfs = porSemana[s]
        const allDone = tfs.every((t) => t.status === 'feito')
        const hasAtrasado = tfs.some((t) => t.status === 'atrasado')

        const dotColor = allDone
          ? 'var(--green-mid)'
          : hasAtrasado
          ? 'var(--red)'
          : isCurrent
          ? 'var(--yellow)'
          : isPast
          ? 'var(--border-light)'
          : 'var(--border)'

        return (
          <div key={s} style={{ display: 'flex', gap: 16, paddingLeft: 40, marginBottom: 4, position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 14,
              top: 14,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: dotColor,
              border: isCurrent ? '2px solid var(--yellow)' : '2px solid var(--border)',
              zIndex: 1,
            }} />

            <div className="card" style={{
              flex: 1,
              marginBottom: 8,
              opacity: isFuture && !isCurrent ? 0.7 : 1,
              borderColor: isCurrent ? 'var(--yellow)' : hasAtrasado ? 'var(--red)' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isCurrent ? 'var(--yellow)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Semana {s} {isCurrent && '← atual'}
                </span>
                {allDone && <span style={{ fontSize: 11, color: 'var(--green-mid)' }}>✓ concluído</span>}
              </div>
              {tfs.map((t) => (
                <TaskItem
                  key={t.id}
                  tarefa={t}
                  modelo={modeloMap[t.tarefa_modelo_id]}
                  onDone={onDone}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DetalheArea({ areaId, onNavigate }) {
  const [refresh, setRefresh] = useState(0)
  const area = useLiveQuery(() => db.areas.get(areaId), [areaId])
  const cicloAtivo = useLiveQuery(
    () => db.ciclos.where({ area_id: areaId, status: 'ativo' }).first(),
    [areaId]
  )
  const ciclosAnteriores = useLiveQuery(
    () => db.ciclos.where({ area_id: areaId, status: 'encerrado' }).reverse().toArray(),
    [areaId]
  )
  const tarefas = useLiveQuery(
    () => cicloAtivo ? db.tarefas_geradas.where('ciclo_id').equals(cicloAtivo.id).toArray() : [],
    [cicloAtivo, refresh]
  )
  const modelos = useLiveQuery(() => db.tarefas_modelo.toArray())

  if (!area) return <div className="page"><div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>Carregando…</div></div>

  const semanaAtual = cicloAtivo ? calcularSemanaAtual(cicloAtivo.data_poda) : 0
  const progresso = Math.round((semanaAtual / 36) * 100)
  const tarefasFeitas = tarefas?.filter((t) => t.status === 'feito').length ?? 0
  const tarefasTotal = tarefas?.length ?? 0

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <button
            onClick={() => onNavigate('trilho')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 4, paddingLeft: 0 }}
          >
            ← Voltar
          </button>
          <div className="page-title">{area.nome}</div>
          <div className="page-subtitle">{area.qtd_plantas} plantas</div>
        </div>
        {cicloAtivo && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green-bright)', lineHeight: 1 }}>
              {semanaAtual}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>de 36 semanas</div>
          </div>
        )}
      </div>

      {cicloAtivo ? (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Poda: {format(parseISO(cicloAtivo.data_poda + 'T00:00:00'), "d MMM yyyy", { locale: ptBR })}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {tarefasFeitas}/{tarefasTotal} tarefas feitas
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progresso}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{progresso}% do ciclo</div>
          </div>

          {semanaAtual >= 35 && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <span>🌿</span>
              <span>Esta área está pronta para uma nova poda.</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => onNavigate('poda', areaId)}
              >
                Registrar
              </button>
            </div>
          )}

          <div className="section-title" style={{ marginTop: 8, marginBottom: 12 }}>Timeline do ciclo</div>

          {tarefas && modelos && (
            <SemanaTimeline
              semanaAtual={semanaAtual}
              tarefas={tarefas}
              modelos={modelos}
              onDone={() => setRefresh((r) => r + 1)}
            />
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🌱</div>
          <div className="empty-text">Nenhum ciclo ativo para esta área.</div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('poda', areaId)}>
            Registrar poda
          </button>
        </div>
      )}

      {ciclosAnteriores && ciclosAnteriores.length > 0 && (
        <>
          <div className="divider" style={{ marginTop: 24 }} />
          <div className="section-title">Ciclos anteriores</div>
          {ciclosAnteriores.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 8, opacity: 0.75 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Poda em {format(parseISO(c.data_poda + 'T00:00:00'), "d MMM yyyy", { locale: ptBR })} — encerrado
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
