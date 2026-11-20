import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configOk = Boolean(url && anonKey)
export const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

// Solo se usa la anon key en el frontend. La seguridad real la dan las políticas RLS.
export const supabase = createClient(url || 'http://localhost', anonKey || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
})
