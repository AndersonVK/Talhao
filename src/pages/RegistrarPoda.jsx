import { useLiveQuery } from 'dexie-react-hooks'
import { db, registrarPoda, calcularSemanaAtual } from '../db/database'
import { useState } from 'react'
import { useToast } from '../components/Toast'
import { format } from 'date-fns'

export function RegistrarPoda({ onNavigate, preAreaId }) {
  const toast = useToast()
  const areas = useLiveQuery(() => db.areas.orderBy('nome').toArray())
  const ciclosAtivos = useLiveQuery(() => db.ciclos.where('status').equals('ativo').toArray())

  const hoje = new Date().toISOString().split('T')[0]
  const [areaId, setAreaId] = useState(preAreaId ? String(preAreaId) : '')
  const [dataPoda, setDataPoda] = useState(hoje)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const cicloAtivoDaArea = ciclosAtivos?.find((c) => c.area_id === Number(areaId))

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!areaId) { setErro('Selecione uma área.'); return }
    if (!dataPoda) { setErro('Informe a data da poda.'); return }

    if (cicloAtivoDaArea) {
      const semana = calcularSemanaAtual(cicloAtivoDaArea.data_poda)
      if (semana < 34) {
        setErro(`Esta área está na semana ${semana}. Encerre o ciclo atual antes de registrar nova poda.`)
        return
      }
      const confirmar = window.confirm(
        `A área está na semana ${semana}. Deseja encerrar o ciclo atual e iniciar um novo?`
      )
      if (!confirmar) return
      await db.ciclos.update(cicloAtivoDaArea.id, { status: 'encerrado' })
    }

    setLoading(true)
    try {
      await registrarPoda(Number(areaId), dataPoda)
      toast('✓ Poda registrada! Agenda gerada com sucesso.')
      onNavigate('painel')
    } catch (err) {
      setErro('Erro ao registrar poda: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const modelos = useLiveQuery(() => db.tarefas_modelo.orderBy('semana_inicio').toArray())

  if (!areas || !ciclosAtivos) {
    return <div className="page"><div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>Carregando…</div></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Registrar poda</div>
          <div className="page-subtitle">Gera automaticamente a agenda de 36 semanas</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Área</label>
            <select
              className="form-control"
              value={areaId}
              onChange={(e) => { setAreaId(e.target.value); setErro('') }}
            >
              <option value="">Selecione…</option>
              {areas.map((a) => {
                const ciclo = ciclosAtivos.find((c) => c.area_id === a.id)
                const semana = ciclo ? calcularSemanaAtual(ciclo.data_poda) : null
                return (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.qtd_plantas} plantas)
                    {semana ? ` — sem. ${semana}/36` : ' — sem ciclo'}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Data da poda</label>
            <input
              type="date"
              className="form-control"
              value={dataPoda}
              max={hoje}
              onChange={(e) => setDataPoda(e.target.value)}
            />
          </div>

          {cicloAtivoDaArea && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <span>⚠</span>
              <div>
                Área com ciclo ativo (semana {calcularSemanaAtual(cicloAtivoDaArea.data_poda)}/36).
                {calcularSemanaAtual(cicloAtivoDaArea.data_poda) >= 34
                  ? ' Pronta para novo ciclo.'
                  : ' Confirme antes de encerrar o ciclo atual.'}
              </div>
            </div>
          )}

          {erro && (
            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              <span>✗</span> {erro}
            </div>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Gerando agenda…' : '✓ Registrar poda e gerar agenda'}
          </button>
        </div>
      </form>

      {modelos && modelos.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 20 }}>
            Calendário-mestre ({modelos.length} tarefas)
          </div>
          <div className="card">
            {modelos.map((m, i) => (
              <div
                key={m.id}
                style={{
                  padding: '10px 0',
                  borderBottom: i < modelos.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    background: 'var(--bg-card2)',
                    borderRadius: 6,
                    padding: '2px 7px',
                    fontSize: 11,
                    color: 'var(--green-bright)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {m.semana_inicio === m.semana_fim
                      ? `S${m.semana_inicio}`
                      : `S${m.semana_inicio}–${m.semana_fim}`}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.titulo}</div>
                    {m.descricao && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.descricao}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 20 }}
            onClick={() => onNavigate('calendario')}
          >
            Editar calendário-mestre →
          </button>
        </>
      )}
    </div>
  )
}
