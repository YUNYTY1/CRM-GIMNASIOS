import { NavLink, Outlet } from 'react-router-dom'
import { Dumbbell, LayoutDashboard, LogOut, Receipt, ScanLine, Tags, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GYM_NAME } from '../lib/supabase'
import type { Rol } from '../lib/types'

const items: { to: string; label: string; icon: typeof Users; roles: Rol[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/acceso', label: 'Acceso', icon: ScanLine, roles: ['admin', 'recepcion'] },
  { to: '/socios', label: 'Socios', icon: Users, roles: ['admin', 'recepcion'] },
  { to: '/pagos', label: 'Pagos', icon: Receipt, roles: ['admin', 'recepcion'] },
  { to: '/planes', label: 'Planes', icon: Tags, roles: ['admin'] },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const visibles = items.filter((i) => perfil && i.roles.includes(perfil.rol))

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-borde bg-panel p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Dumbbell className="h-6 w-6 text-lime-400" />
          <span className="truncate text-lg font-extrabold tracking-tight">{GYM_NAME}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {visibles.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-lime-400/10 text-lime-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`
              }
            >
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-borde pt-4">
          <p className="truncate px-2 text-sm font-medium">{perfil?.nombre}</p>
          <p className="mb-3 px-2 text-xs capitalize text-zinc-500">{perfil?.rol === 'admin' ? 'Administrador' : 'Recepción'}</p>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 md:ml-60 md:pb-8">
        {/* Barra superior móvil */}
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="flex items-center gap-2 font-extrabold">
            <Dumbbell className="h-5 w-5 text-lime-400" /> {GYM_NAME}
          </span>
          <button onClick={() => void signOut()} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Menú inferior móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-borde bg-panel/95 px-1 pt-1 backdrop-blur md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
      >
        {visibles.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium ${
                isActive ? 'text-lime-400' : 'text-zinc-500'
              }`
            }
          >
            <Icon className="h-5 w-5" /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
