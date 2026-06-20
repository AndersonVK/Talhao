import { useLiveQuery } from 'dexie-react-hooks'
import { db, atualizarStatusAtrasadas } from '../db/database'
import { TaskItem } from '../components/TaskItem'
import { addDays, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

export function Painel({ onNavigate }) {
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    atualizarStatusAtrasadas()
  }, [])

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite = addDays(hoje, 7).toISOString().split('T')[0]
  const hojeStr = hoje.toISOString().split('T')[0]

  const tarefas = useLiveQuery(async () => {
    const tfs = await db.tarefas_geradas
      .where('status').anyOf(['pendente', 'atrasado'])
      .toArray()

    const relevantes = tfs.filter(
      (t) => t.data_prevista_inicio <= limite || t.data_prevista_fim >= hojeStr
    ).filter(
      (t) => t.data_prevista_fim >= hojeStr || t.status === 'atrasado'
    ).filter(
      (t) => t.data_prevista_inicio <= limite
    )

    return relevantes.sort((a, b) => {
      if (a.status === 'atrasado' && b.status !== 'atrasado') return -1
      if (b.status === 'atrasado' && a.status !== 'atrasado') return 1
      return a.data_prevista_inicio.localeCompare(b.data_prevista_inicio)
    })
  }, [refresh])

  const modelos = useLiveQuery(() => db.tarefas_modelo.toArray())
  const ciclos = useLiveQuery(() => db.ciclos.where('status').equals('ativo').toArray())
  const areas = useLiveQuery(() => db.areas.toArray())

  const modeloMap = useMemo(() => {
    const m = {}
    modelos?.forEach((x) => (m[x.id] = x))
    return m
  }, [modelos])

  const cicloMap = useMemo(() => {
    const m = {}
    ciclos?.forEach((x) => (m[x.id] = x))
    return m
  }, [ciclos])

  const areaMap = useMemo(() => {
    const m = {}
    areas?.forEach((x) => (m[x.id] = x))
    return m
  }, [areas])

  const grupos = useMemo(() => {
    if (!tarefas || !ciclos) return []
    const g = {}
    for (const t of tarefas) {
      const ciclo = cicloMap[t.ciclo_id]
      if (!ciclo) continue
      const areaId = ciclo.area_id
      if (!g[areaId]) g[areaId] = []
      g[areaId].push(t)
    }
    return Object.entries(g)
  }, [tarefas, cicloMap])

  const totalAtrasadas = tarefas?.filter((t) => t.status === 'atrasado').length ?? 0
  const totalPendentes = tarefas?.filter((t) => t.status === 'pendente').length ?? 0

  if (!tarefas || !modelos || !ciclos) {
    return <div className="page"><div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>Carregando…</div></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Próximas tarefas</div>
          <div className="page-subtitle">Próximos 7 dias</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {totalAtrasadas > 0 && (
            <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {totalAtrasadas} atrasada{totalAtrasadas > 1 ? 's' : ''}
            </span>
          )}
          {totalPendentes > 0 && (
            <span className="badge" style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--green-bright)', border: '1px solid rgba(74,222,128,0.25)' }}>
              {totalPendentes} pend.
            </span>
          )}
        </div>
      </div>

      {totalAtrasadas > 0 && (
        <div className="alert alert-danger">
          <span>⚠</span>
          <span>Você tem {totalAtrasadas} tarefa{totalAtrasadas > 1 ? 's' : ''} atrasada{totalAtrasadas > 1 ? 's' : ''}. Verifique e registre se já foi realizada.</span>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌿</div>
          <div className="empty-text">
            Nenhuma tarefa pendente nos próximos 7 dias.<br />
            {ciclos.length === 0 && (
              <span>
                Comece registrando uma poda para gerar a agenda de uma área.
              </span>
            )}
          </div>
          {ciclos.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('poda')}>
              + Registrar poda
            </button>
          )}
        </div>
      ) : (
        grupos.map(([areaId, tfs]) => {
          const area = areaMap[Number(areaId)]
          const cicloAtivo = Object.values(cicloMap).find((c) => c.area_id === Number(areaId))
          const temPraga = tfs.some((t) => modeloMap[t.tarefa_modelo_id]?.tipo === 'monitoramento_praga')

          return (
            <div key={areaId} className="card" style={temPraga ? { borderColor: 'var(--orange)' } : {}}>
              <div className="group-header">
                <div className="group-area-name">
                  {temPraga && <span title="Janela crítica de praga">🐛</span>}
                  {area?.nome || `Área ${areaId}`}
                </div>
                {cicloAtivo && (
                  <span className="group-semana">
                    Semana {calcSemana(cicloAtivo.data_poda)}/36
                  </span>
                )}
              </div>

              {tfs.map((t) => (
                <TaskItem
                  key={t.id}
                  tarefa={t}
                  modelo={modeloMap[t.tarefa_modelo_id]}
                  onDone={() => setRefresh((r) => r + 1)}
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

function calcSemana(dataPoda) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const poda = new Date(dataPoda + 'T00:00:00')
  const diff = Math.floor((hoje - poda) / (1000 * 60 * 60 * 24))
  return Math.min(Math.floor(diff / 7) + 1, 36)
}
