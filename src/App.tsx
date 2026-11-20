import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { configOk } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Socios from './pages/Socios'
import SocioDetalle from './pages/SocioDetalle'
import Planes from './pages/Planes'
import Pagos from './pages/Pagos'
import Acceso from './pages/Acceso'
import Asistencias from './pages/Asistencias'

function Inicio() {
  const { perfil } = useAuth()
  return perfil?.rol === 'admin' ? <Dashboard /> : <Navigate to="/acceso" replace />
}

export default function App() {
  if (!configOk) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
        <p className="mb-2 font-bold">Falta configurar Supabase</p>
        <p>
          Crea el archivo <code>.env</code> a partir de <code>.env.example</code> con <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, y vuelve a iniciar la app (en Vercel: Settings → Environment Variables).
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Pantalla de puerta: sin sidebar, pantalla completa */}
      <Route element={<ProtectedRoute />}>
        <Route path="/acceso" element={<Acceso />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/asistencias" element={<Asistencias />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/socios/:id" element={<SocioDetalle />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/planes" element={<Planes />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
