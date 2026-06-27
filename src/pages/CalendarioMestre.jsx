import { useLiveQuery } from 'dexie-react-hooks'
import { db, TIPOS_TAREFA } from '../db/database'
import { useState, useRef } from 'react'
import { useToast } from '../components/Toast'
import { TipoBadge } from '../components/TipoDot'
import { BackupSection } from '../components/BackupSection'

const EMPTY_FORM = {
  semana_inicio: '',
  semana_fim: '',
  titulo: '',
  tipo: 'outro',
  descricao: '',
}

export function CalendarioMestre() {
  const toast = useToast()
  const modelos = useLiveQuery(() => db.tarefas_modelo.orderBy('semana_inicio').toArray())
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const formRef = useRef(null)

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(false)
    setErro('')
  }

  function iniciarEdicao(m) {
    setForm({
      semana_inicio: String(m.semana_inicio),
      semana_fim: String(m.semana_fim),
      titulo: m.titulo,
      tipo: m.tipo,
      descricao: m.descricao || '',
    })
    setEditId(m.id)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const si = Number(form.semana_inicio)
    const sf = Number(form.semana_fim)
    if (!form.titulo.trim()) { setErro('Informe o título.'); return }
    if (!si || si < 1 || si > 36) { setErro('Semana de início deve ser entre 1 e 36.'); return }
    const sfFinal = sf >= si ? sf : si
    const data = {
      semana_inicio: si,
      semana_fim: sfFinal,
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
    }

    if (editId) {
      await db.tarefas_modelo.update(editId, data)
      toast('✓ Tarefa atualizada.')
    } else {
      await db.tarefas_modelo.add(data)
      toast('✓ Tarefa adicionada ao calendário.')
    }
    resetForm()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta tarefa do calendário-mestre? As tarefas já geradas não serão afetadas.')) return
    await db.tarefas_modelo.delete(id)
    toast('Tarefa removida.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Calendário-mestre</div>
          <div className="page-subtitle">Base para geração de todas as agendas</div>
        </div>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            + Nova
          </button>
        )}
      </div>

      {showForm && (
        <div ref={formRef} className="card card-elevated fade-in" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--green-bright)' }}>
            {editId ? 'Editar tarefa' : 'Nova tarefa no calendário'}
          </div>
          <form onSubmit={salvar}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Semana início</label>
                <input
                  type="number"
                  className="form-control"
                  min="1" max="36"
                  value={form.semana_inicio}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    semana_inicio: e.target.value,
                    semana_fim: f.semana_fim === f.semana_inicio ? e.target.value : f.semana_fim,
                  }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Semana fim</label>
                <input
                  type="number"
                  className="form-control"
                  min="1" max="36"
                  value={form.semana_fim}
                  onChange={(e) => setForm((f) => ({ ...f, semana_fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Título</label>
              <input
                type="text"
                className="form-control"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Adubação NPK"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select
                className="form-control"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {Object.entries(TIPOS_TAREFA).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição (opcional)</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes, dosagem, instruções…"
                style={{ resize: 'vertical' }}
              />
            </div>

            {erro && (
              <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                <span>✗</span> {erro}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                {editId ? 'Salvar alterações' : 'Adicionar'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {!modelos || modelos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">Nenhuma tarefa no calendário-mestre.</div>
        </div>
      ) : (
        modelos.map((m) => (
          <div key={m.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--bg-card2)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--green-bright)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 44,
                textAlign: 'center',
              }}>
                {m.semana_inicio === m.semana_fim
                  ? `S${m.semana_inicio}`
                  : `S${m.semana_inicio}–${m.semana_fim}`}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {m.titulo}
                </div>
                <div style={{ marginBottom: m.descricao ? 6 : 0 }}>
                  <TipoBadge tipo={m.tipo} />
                </div>
                {m.descricao && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {m.descricao}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => iniciarEdicao(m)}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => excluir(m.id)}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      <BackupSection />
    </div>
  )
}
