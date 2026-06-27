import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcularSemanaAtual } from '../db/database'
import { TaskItem } from '../components/TaskItem'
import { useToast } from '../components/Toast'
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
  const toast = useToast()
  const [refresh, setRefresh] = useState(0)
  const [editando, setEditando] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editQtd, setEditQtd] = useState('')
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

  function abrirEdicao() {
    setEditNome(area.nome)
    setEditQtd(String(area.qtd_plantas))
    setEditando(true)
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    const nome = editNome.trim()
    const qtd = Number(editQtd)
    if (!nome) return
    await db.areas.update(areaId, { nome, qtd_plantas: qtd || area.qtd_plantas })
    toast('✓ Área atualizada.')
    setEditando(false)
  }

  async function removerCicloAtivo() {
    if (!cicloAtivo) return
    const confirmar = window.confirm(
      `Remover o ciclo ativo de ${area.nome}?\n\nIsso apaga a poda registrada e todas as tarefas geradas. A área voltará sem ciclo para você recomeçar.\n\nEsta ação não pode ser desfeita.`
    )
    if (!confirmar) return
    await db.tarefas_geradas.where('ciclo_id').equals(cicloAtivo.id).delete()
    await db.ciclos.delete(cicloAtivo.id)
    toast('Ciclo removido. Registre uma nova poda para recomeçar.')
  }

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
          {editando ? (
            <form onSubmit={salvarEdicao} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <input
                className="form-control"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Nome da área"
                autoFocus
                style={{ fontSize: 17, fontWeight: 700, padding: '8px 10px' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-control"
                  type="number"
                  value={editQtd}
                  onChange={(e) => setEditQtd(e.target.value)}
                  placeholder="Qtd. plantas"
                  min="1"
                  style={{ width: 130 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>plantas</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="submit">Salvar</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="page-title">{area.nome}</div>
                <button
                  onClick={abrirEdicao}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}
                  title="Editar área"
                >
                  ✎
                </button>
              </div>
              <div className="page-subtitle">{area.qtd_plantas} plantas</div>
            </>
          )}
        </div>
        {!editando && cicloAtivo && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progresso}% do ciclo</div>
              <button
                className="btn btn-danger btn-sm"
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={removerCicloAtivo}
              >
                Remover ciclo
              </button>
            </div>
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
