import { useState, useRef } from 'react'
import { exportarDados, importarDados } from '../db/database'
import { useToast } from './Toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function BackupSection() {
  const toast = useToast()
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)

  async function handleExport() {
    setLoadingExport(true)
    try {
      const dados = await exportarDados()
      const json = JSON.stringify(dados, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const data = new Date().toISOString().split('T')[0]
      const a = document.createElement('a')
      a.href = url
      a.download = `talhao-backup-${data}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('✓ Backup exportado com sucesso.')
    } catch (err) {
      toast('Erro ao exportar: ' + err.message)
    } finally {
      setLoadingExport(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result)
        if (!dados?.versao || !dados?.areas) {
          toast('Arquivo inválido ou incompatível.')
          return
        }
        setPreview(dados)
      } catch {
        toast('Não foi possível ler o arquivo.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function confirmarImport() {
    if (!preview) return
    setLoadingImport(true)
    try {
      await importarDados(preview)
      toast('✓ Dados restaurados com sucesso. Recarregando…')
      setPreview(null)
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      toast('Erro ao importar: ' + err.message)
    } finally {
      setLoadingImport(false)
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div className="divider" />
      <div className="section-title" style={{ marginBottom: 12 }}>Backup e restauração</div>

      {/* Export */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Exportar dados</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Salva todas as áreas, ciclos e tarefas num arquivo JSON no seu dispositivo. Use como backup antes de trocar de celular.
        </div>
        <button
          className="btn btn-ghost btn-full"
          onClick={handleExport}
          disabled={loadingExport}
        >
          {loadingExport ? 'Exportando…' : '↓ Exportar backup (.json)'}
        </button>
      </div>

      {/* Import */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Restaurar dados</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Importa um backup exportado anteriormente. <strong style={{ color: 'var(--red)' }}>Atenção: substitui todos os dados atuais.</strong>
        </div>

        {!preview ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-ghost btn-full"
              onClick={() => fileRef.current?.click()}
            >
              ↑ Selecionar arquivo de backup
            </button>
          </>
        ) : (
          <div className="fade-in">
            <div style={{
              background: 'var(--bg-card2)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Arquivo de {format(parseISO(preview.exportado_em), "d 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <ResumoItem label="Áreas" valor={preview.areas?.length ?? 0} />
                <ResumoItem label="Tarefas-modelo" valor={preview.tarefas_modelo?.length ?? 0} />
                <ResumoItem label="Ciclos" valor={preview.ciclos?.length ?? 0} />
                <ResumoItem label="Tarefas geradas" valor={preview.tarefas_geradas?.length ?? 0} />
              </div>
            </div>

            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              <span>⚠</span>
              <span>Os dados atuais serão substituídos. Esta ação não pode ser desfeita.</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--red)', color: '#fff' }}
                onClick={confirmarImport}
                disabled={loadingImport}
              >
                {loadingImport ? 'Restaurando…' : 'Confirmar restauração'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setPreview(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResumoItem({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--green-bright)', fontWeight: 700 }}>{valor}</span>
    </div>
  )
}
