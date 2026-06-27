import Dexie from 'dexie'

export const db = new Dexie('TalhaoGoiaba')

db.version(1).stores({
  areas: '++id, nome',
  tarefas_modelo: '++id, semana_inicio, semana_fim, tipo',
  ciclos: '++id, area_id, status, data_poda',
  tarefas_geradas: '++id, ciclo_id, tarefa_modelo_id, status, data_prevista_inicio',
})

export const TIPOS_TAREFA = {
  poda: { label: 'Poda', cor: '#86efac' },
  adubacao_organica: { label: 'Adubação Orgânica', cor: '#fde68a' },
  adubacao_quimica: { label: 'Adubação Química', cor: '#fcd34d' },
  aplicacao_defensivo: { label: 'Defensivo', cor: '#f9a8d4' },
  monitoramento_praga: { label: 'Monitoramento de Praga', cor: '#fb923c' },
  colheita: { label: 'Colheita', cor: '#4ade80' },
  outro: { label: 'Outro', cor: '#94a3b8' },
}

export const AREAS_INICIAIS = [
  { nome: 'Área A', qtd_plantas: 392 },
  { nome: 'Área B', qtd_plantas: 388 },
  { nome: 'Área C', qtd_plantas: 390 },
  { nome: 'Área D', qtd_plantas: 391 },
  { nome: 'Área E', qtd_plantas: 389 },
  { nome: 'Área F', qtd_plantas: 392 },
  { nome: 'Área G', qtd_plantas: 388 },
  { nome: 'Área H', qtd_plantas: 390 },
  { nome: 'Área I', qtd_plantas: 380 },
]

export const TAREFAS_MODELO_SEED = [
  {
    semana_inicio: 1,
    semana_fim: 1,
    titulo: 'Poda de produção',
    tipo: 'poda',
    descricao: 'Poda de frutificação para iniciar novo ciclo produtivo.',
  },
  {
    semana_inicio: 2,
    semana_fim: 2,
    titulo: 'Calda sulfocálcica + Adubação orgânica',
    tipo: 'aplicacao_defensivo',
    descricao: 'Aplicação de calda sulfocálcica para controle de pragas. Incorporar matéria orgânica (esterco/composto) ao redor das plantas.',
  },
  {
    semana_inicio: 14,
    semana_fim: 16,
    titulo: 'Monitoramento intensivo — Gorgulho',
    tipo: 'monitoramento_praga',
    descricao: 'Período crítico de infestação do gorgulho da goiaba (Conotrachelus psidii). Inspecionar frutos e aplicar controle se necessário.',
  },
  {
    semana_inicio: 18,
    semana_fim: 18,
    titulo: 'Adubação química NPK 10-05-30',
    tipo: 'adubacao_quimica',
    descricao: 'Aplicar NPK 10-05-30 conforme análise de solo. Importante para enchimento dos frutos.',
  },
]

export async function inicializarDados() {
  const qtdAreas = await db.areas.count()
  if (qtdAreas > 0) return

  await db.areas.bulkAdd(AREAS_INICIAIS)
  await db.tarefas_modelo.bulkAdd(TAREFAS_MODELO_SEED)
}

export async function gerarTarefas(cicloId, dataPoda, modelosTarefa) {
  const tarefas = modelosTarefa.map((modelo) => {
    const diasInicio = (modelo.semana_inicio - 1) * 7
    const diasFim = (modelo.semana_fim - 1) * 7 + 6
    const dataInicio = new Date(dataPoda)
    dataInicio.setDate(dataInicio.getDate() + diasInicio)
    const dataFim = new Date(dataPoda)
    dataFim.setDate(dataFim.getDate() + diasFim)

    return {
      ciclo_id: cicloId,
      tarefa_modelo_id: modelo.id,
      data_prevista_inicio: dataInicio.toISOString().split('T')[0],
      data_prevista_fim: dataFim.toISOString().split('T')[0],
      data_realizada: null,
      status: 'pendente',
      observacao: '',
    }
  })

  await db.tarefas_geradas.bulkAdd(tarefas)
}

export async function sincronizarModeloComCiclosAtivos(modelo) {
  const ciclosAtivos = await db.ciclos.where('status').equals('ativo').toArray()

  for (const ciclo of ciclosAtivos) {
    const diasInicio = (modelo.semana_inicio - 1) * 7
    const diasFim = (modelo.semana_fim - 1) * 7 + 6
    const dataInicio = new Date(ciclo.data_poda)
    dataInicio.setDate(dataInicio.getDate() + diasInicio)
    const dataFim = new Date(ciclo.data_poda)
    dataFim.setDate(dataFim.getDate() + diasFim)

    const dataInicioStr = dataInicio.toISOString().split('T')[0]
    const dataFimStr = dataFim.toISOString().split('T')[0]

    const existente = await db.tarefas_geradas
      .where({ ciclo_id: ciclo.id, tarefa_modelo_id: modelo.id })
      .first()

    if (!existente) {
      // Nova tarefa no calendário — adiciona ao ciclo
      await db.tarefas_geradas.add({
        ciclo_id: ciclo.id,
        tarefa_modelo_id: modelo.id,
        data_prevista_inicio: dataInicioStr,
        data_prevista_fim: dataFimStr,
        data_realizada: null,
        status: 'pendente',
        observacao: '',
      })
    } else if (existente.status !== 'feito') {
      // Tarefa editada e ainda não feita — atualiza as datas
      await db.tarefas_geradas.update(existente.id, {
        data_prevista_inicio: dataInicioStr,
        data_prevista_fim: dataFimStr,
        status: 'pendente',
      })
    }
    // Se já está 'feito', não mexe
  }

  return ciclosAtivos.length
}

export async function registrarPoda(areaId, dataPoda) {
  const modelos = await db.tarefas_modelo.toArray()
  const cicloId = await db.ciclos.add({
    area_id: areaId,
    data_poda: dataPoda,
    status: 'ativo',
  })
  await gerarTarefas(cicloId, dataPoda, modelos)
  return cicloId
}

export function calcularSemanaAtual(dataPoda) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const poda = new Date(dataPoda + 'T00:00:00')
  const diffMs = hoje - poda
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.min(Math.floor(diffDias / 7) + 1, 36)
}

export const BACKUP_VERSION = 1

export async function exportarDados() {
  const [areas, tarefas_modelo, ciclos, tarefas_geradas] = await Promise.all([
    db.areas.toArray(),
    db.tarefas_modelo.toArray(),
    db.ciclos.toArray(),
    db.tarefas_geradas.toArray(),
  ])
  return {
    versao: BACKUP_VERSION,
    exportado_em: new Date().toISOString(),
    areas,
    tarefas_modelo,
    ciclos,
    tarefas_geradas,
  }
}

export async function importarDados(backup) {
  if (!backup?.versao || !backup?.areas) {
    throw new Error('Arquivo inválido ou incompatível.')
  }

  await db.transaction('rw', [db.areas, db.tarefas_modelo, db.ciclos, db.tarefas_geradas], async () => {
    await db.areas.clear()
    await db.tarefas_modelo.clear()
    await db.ciclos.clear()
    await db.tarefas_geradas.clear()

    if (backup.areas?.length) await db.areas.bulkAdd(backup.areas)
    if (backup.tarefas_modelo?.length) await db.tarefas_modelo.bulkAdd(backup.tarefas_modelo)
    if (backup.ciclos?.length) await db.ciclos.bulkAdd(backup.ciclos)
    if (backup.tarefas_geradas?.length) await db.tarefas_geradas.bulkAdd(backup.tarefas_geradas)
  })
}

export async function atualizarStatusAtrasadas() {
  const hoje = new Date().toISOString().split('T')[0]
  const pendentes = await db.tarefas_geradas
    .where('status')
    .equals('pendente')
    .toArray()

  const atrasadas = pendentes.filter((t) => t.data_prevista_fim < hoje)
  for (const t of atrasadas) {
    await db.tarefas_geradas.update(t.id, { status: 'atrasado' })
  }
}
