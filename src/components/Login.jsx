import { useState } from 'react'
import { supabase } from '../lib/supabase'

function traduzir(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered')) return 'Este e-mail já tem conta. Use "Entrar".'
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail (link enviado) antes de entrar.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Criação de contas está desativada.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão. O primeiro acesso precisa de internet.'
  return msg
}

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setAviso('')
    setCarregando(true)
    try {
      if (criando) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha })
        if (error) throw error
        if (!data.session) {
          setAviso('Conta criada. Enviamos um link de confirmação para o seu e-mail; confirme e depois toque em "Entrar".')
          setCriando(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (error) throw error
      }
    } catch (err) {
      setErro(traduzir(err.message))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 44 }}>🌿</div>
        <div className="page-title" style={{ marginTop: 6 }}>Talhão</div>
        <div className="page-subtitle">Ciclo produtivo do pomar de goiaba</div>
      </div>

      <form className="card" onSubmit={enviar}>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input
            className="form-control"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Senha</label>
          <input
            className="form-control"
            type="password"
            autoComplete={criando ? 'new-password' : 'current-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {erro && <div className="alert alert-danger"><span>✗</span> {erro}</div>}
        {aviso && <div className="alert alert-warning"><span>✉</span> {aviso}</div>}

        <button className="btn btn-primary btn-full" type="submit" disabled={carregando}>
          {carregando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-full"
          style={{ marginTop: 10 }}
          onClick={() => { setCriando((v) => !v); setErro(''); setAviso('') }}
        >
          {criando ? 'Já tenho conta' : 'Criar conta'}
        </button>
      </form>
    </div>
  )
}
