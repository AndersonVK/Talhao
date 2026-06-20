import { TIPOS_TAREFA } from '../db/database'

export function TipoDot({ tipo }) {
  const info = TIPOS_TAREFA[tipo] || TIPOS_TAREFA.outro
  return <span className="tipo-dot" style={{ background: info.cor }} title={info.label} />
}

export function TipoBadge({ tipo }) {
  const info = TIPOS_TAREFA[tipo] || TIPOS_TAREFA.outro
  return (
    <span
      className="badge"
      style={{ background: info.cor + '22', color: info.cor, border: `1px solid ${info.cor}44` }}
    >
      {info.label}
    </span>
  )
}
