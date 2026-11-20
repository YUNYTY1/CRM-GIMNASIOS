import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Spinner } from './ui'
import type { Rol } from '../lib/types'

/** Exige sesión iniciada y, opcionalmente, un rol concreto. */
export default function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { session, perfil, loading, signOut } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  if (!perfil) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="mb-4 text-sm text-zinc-300">
          Tu usuario todavía no tiene un perfil asignado. Pídele al administrador que lo active.
        </p>
        <Button variant="outline" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    )
  }

  if (roles && !roles.includes(perfil.rol)) {
    return <Navigate to={perfil.rol === 'admin' ? '/' : '/acceso'} replace />
  }
  return <Outlet />
}
