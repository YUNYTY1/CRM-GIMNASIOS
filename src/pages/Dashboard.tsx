import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, MessageCircle, UserCheck, Users, Wallet } from 'lucide-react'
import { GYM_NAME, supabase } from '../lib/supabase'
import type { ResumenDashboard } from '../lib/types'
import { diaCorto, diasTexto, enlaceWhatsApp, formatFecha, formatSoles, mensajeError, mesCorto } from '../lib/format'
import { Alerta, Card, PageHeader, Spinner, Vacio } from '../components/ui'

const tooltipStyle = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#f4f4f5' }

function Tarjeta({ titulo, valor, icono }: { titulo: string; valor: string; icono: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="rounded-xl bg-lime-400/10 p-3 text-lime-400">{icono}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
        <p className="truncate text-2xl font-extrabold">{valor}</p>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<ResumenDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void supabase.rpc('refrescar_estados_membresias')
    supabase.rpc('resumen_dashboard').then(({ data: d, error: err }) => {
      if (err) setError(mensajeError(err))
      else setData(d as ResumenDashboard)
    })
  }, [])

  if (error) return <Alerta>{error}</Alerta>
  if (!data) return <Spinner />

  return (
    <>
      <PageHeader titulo="Dashboard" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Socios activos" valor={String(data.socios_activos)} icono={<Users className="h-6 w-6" />} />
        <Tarjeta titulo="Ingresos del mes" valor={formatSoles(data.ingresos_mes)} icono={<Wallet className="h-6 w-6" />} />
        <Tarjeta titulo="Asistencias hoy" valor={String(data.asistencias_hoy)} icono={<UserCheck className="h-6 w-6" />} />
        <Tarjeta titulo="Vencen esta semana" valor={String(data.vencen_semana)} icono={<CalendarClock className="h-6 w-6" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Por vencer esta semana</h2>
          {data.por_vencer.length === 0 ? (
            <Vacio texto="Nadie vence en los próximos 7 días." />
          ) : (
            <ul className="divide-y divide-borde">
              {data.por_vencer.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/socios/${s.id}`} className="block truncate text-sm font-medium hover:text-lime-300">{s.nombre}</Link>
                    <p className="text-xs text-zinc-500">{diasTexto(s.dias_restantes)} · {formatFecha(s.fecha_fin)}</p>
                  </div>
                  <a
                    href={enlaceWhatsApp(
                      s.telefono,
                      `Hola ${s.nombre.split(' ')[0]}, te escribimos de ${GYM_NAME}. Tu membresía vence el ${formatFecha(s.fecha_fin)}. ¡Renuévala para seguir entrenando sin interrupciones! 💪`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
                  >
                    <MessageCircle className="h-4 w-4" /> Recordar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Deudores</h2>
          {data.deudores.length === 0 ? (
            <Vacio texto="No hay deudas pendientes." />
          ) : (
            <ul className="divide-y divide-borde">
              {data.deudores.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/socios/${s.id}`} className="block truncate text-sm font-medium hover:text-lime-300">{s.nombre}</Link>
                    <p className="text-sm font-semibold text-red-400">{formatSoles(s.deuda)}</p>
                  </div>
                  <a
                    href={enlaceWhatsApp(
                      s.telefono,
                      `Hola ${s.nombre.split(' ')[0]}, te escribimos de ${GYM_NAME}. Tienes un saldo pendiente de ${formatSoles(s.deuda)}. ¿Cuándo podrías pasar a regularizarlo? ¡Gracias!`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
                  >
                    <MessageCircle className="h-4 w-4" /> Cobrar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Asistencias por día (últimos 30 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.asistencias_30}>
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={diaCorto} stroke="#71717a" fontSize={11} interval={4} />
                <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} width={28} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#27272a' }} labelFormatter={(l) => formatFecha(String(l))} formatter={(v) => [String(v), 'Ingresos']} />
                <Bar dataKey="total" fill="#a3e635" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Ingresos por mes</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ingresos_meses}>
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} width={44} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#27272a' }} labelFormatter={(l) => mesCorto(String(l))} formatter={(v) => [formatSoles(Number(v)), 'Ingresos']} />
                <Bar dataKey="total" fill="#a3e635" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}
