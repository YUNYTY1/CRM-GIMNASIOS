import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/types'

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async (userId: string | null) => {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('perfiles').select('id, nombre, rol').eq('id', userId).maybeSingle()
    setPerfil((data as Perfil | null) ?? null)
  }, [])

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSession(data.session)
      await cargarPerfil(data.session?.user.id ?? null)
      if (activo) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      // Se difiere para no bloquear el callback interno de Supabase
      setTimeout(() => void cargarPerfil(s?.user.id ?? null), 0)
    })
    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!error) return null
    if (error.message.toLowerCase().includes('invalid login')) return 'Correo o contraseña incorrectos.'
    return error.message
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
  }, [])

  const value = useMemo(() => ({ session, perfil, loading, signIn, signOut }), [session, perfil, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
