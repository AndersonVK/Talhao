import { createClient } from '@supabase/supabase-js'

// A chave "publishable" é pública por design: a proteção dos dados vem do
// login + RLS no banco (cada usuário só acessa as próprias linhas).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ljjohawqkfrwuwnbbdpj.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_PynZQWXsiIrf3poZkZarQg_Beiwc_77'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
