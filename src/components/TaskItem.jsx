import { db } from '../db/database'
import { TipoDot } from './TipoDot'
import { useToast } from './Toast'
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function formatarData(str) {
  if (!str) return ''
  const d = parseISO(str)
  if (isToday(d)) return 'Hoje'
  if (isTomorrow(d)) return 'Amanhã'
  const diff = differenceInDays(d, new Date())
  if (diff > 0 && diff <= 6) return `em ${diff}d`
  return format(d, "d 'de' MMM", { locale: ptBR })
}

export function TaskItem({ tarefa, modelo, onDone, showArea, areaNome }) {
  const toast = useToast()
  const isDone = tarefa.status === 'feito'
  const isAtrasado = tarefa.status === 'atrasado'
  const isUrgente = !isDone && !isAtrasado && (() => {
    const diff = differenceInDays(parseISO(tarefa.data_prevista_inicio), new Date())
    return diff <= 1 && diff >= 0
  })()

  const janela = modelo.semana_inicio !== modelo.semana_fim

  async function marcarFeito() {
    if (isDone) return
    await db.tarefas_geradas.update(tarefa.id, {
      status: 'feito',
      data_realizada: new Date().toISOString().split('T')[0],
    })
    toast('✓ Tarefa concluída')
    onDone?.()
  }

  return (
    <div className="task-item fade-in">
      <button
        className={`task-check-btn ${isDone ? 'done' : ''} ${isAtrasado ? 'atrasado' : ''}`}
        onClick={marcarFeito}
        aria-label="Marcar como feito"
      >
        {isDone && (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <polyline points="2,8 6,12 14,4" />
          </svg>
        )}
      </button>

      <div className="task-info">
        <div className={`task-title ${isDone ? 'done' : ''}`}>{modelo?.titulo || '—'}</div>
        <div className="task-meta">
          <TipoDot tipo={modelo?.tipo} />
          {showArea && areaNome && (
            <span style={{ fontSize: 12, color: 'var(--green-bright)', fontWeight: 600 }}>
              {areaNome}
            </span>
          )}
          {janela ? (
            <span className={`task-date ${isAtrasado ? 'atrasado' : isUrgente ? 'urgente' : ''}`}>
              {formatarData(tarefa.data_prevista_inicio)} – {formatarData(tarefa.data_prevista_fim)}
            </span>
          ) : (
            <span className={`task-date ${isAtrasado ? 'atrasado' : isUrgente ? 'urgente' : ''}`}>
              {isAtrasado ? '⚠ ' : isUrgente ? '! ' : ''}{formatarData(tarefa.data_prevista_inicio)}
            </span>
          )}
          {isDone && tarefa.data_realizada && (
            <span style={{ fontSize: 11, color: 'var(--green-mid)' }}>
              ✓ {formatarData(tarefa.data_realizada)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
