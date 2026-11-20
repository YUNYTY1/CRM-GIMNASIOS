import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GYM_NAME } from '../lib/supabase'
import { Alerta, Button, Campo, inputCls } from '../components/ui'

export default function Login() {
  const { session, perfil, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session && perfil) return <Navigate to={perfil.rol === 'admin' ? '/' : '/acceso'} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Ingresa un correo válido.')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setLoading(true)
    const msg = await signIn(email, password)
    setLoading(false)
    if (msg) setError(msg)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="animate-pop w-full max-w-sm space-y-4 rounded-2xl border border-borde bg-panel p-6">
        <div className="mb-2 flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-lime-400/10 p-3">
            <Dumbbell className="h-8 w-8 text-lime-400" />
          </div>
          <h1 className="text-xl font-extrabold">{GYM_NAME}</h1>
          <p className="text-sm text-zinc-400">Inicia sesión para continuar</p>
        </div>
        {error && <Alerta>{error}</Alerta>}
        <Campo label="Correo">
          <input type="email" autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </Campo>
        <Campo label="Contraseña">
          <input type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Campo>
        <Button type="submit" loading={loading} className="w-full">
          Ingresar
        </Button>
      </form>
    </div>
  )
}
