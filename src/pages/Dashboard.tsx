import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarClock, MessageCircle, UserCheck, Users, Wallet } from 'lucide-react'
import { GYM_NAME, supabase } from '../lib/supabase'
import type { ResumenDashboard } from '../lib/types'
import { diaCorto, diasTexto, enlaceWhatsApp, formatFecha, formatSoles, mensajeError, mesCorto } from '../lib/format'
import { Alerta, Card, PageHeader, Spinner, Vacio } from '../components/ui'

type RangoDias = 7 | 14 | 30
type RangoMeses = 3 | 6 | 0

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 10,
  color: '#f4f4f5',
  fontSize: 13,
}

const selectFiltroCls =
  'rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-lime-400 focus:outline-none'

function Tarjeta({ titulo, valor, icono, to }: { titulo: string; valor: string; icono: React.ReactNode; to?: string }) {
  const contenido = (
    <Card className={`flex items-center gap-4 ${to ? 'transition hover:border-lime-400/50 hover:bg-zinc-900/80' : ''}`}>
      <div className="rounded-xl bg-lime-400/10 p-3 text-lime-400">{icono}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
        <p className="truncate text-2xl font-extrabold">{valor}</p>
      </div>
    </Card>
  )

  return to ? (
    <Link to={to} className="block">
      {contenido}
    </Link>
  ) : (
    contenido
  )
}

export default function Dashboard() {
  const [data, setData] = useState<ResumenDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rangoDias, setRangoDias] = useState<RangoDias>(30)
  const [rangoMeses, setRangoMeses] = useState<RangoMeses>(6)

  useEffect(() => {
    void supabase.rpc('refrescar_estados_membresias')
    supabase.rpc('resumen_dashboard').then(({ data: d, error: err }) => {
      if (err) setError(mensajeError(err))
      else setData(d as ResumenDashboard)
    })
  }, [])

  if (error) return <Alerta>{error}</Alerta>
  if (!data) return <Spinner />

  const asistenciasFiltradas = data.asistencias_30.slice(-rangoDias)
  const totalDias = asistenciasFiltradas.reduce((acc, item) => acc + item.total, 0)
  const promedioDiario = asistenciasFiltradas.length > 0 ? totalDias / asistenciasFiltradas.length : 0

  const mesesFiltrados = rangoMeses === 0 ? data.ingresos_meses : data.ingresos_meses.slice(-rangoMeses)
  const ultimoMes = mesesFiltrados.length > 0 ? mesesFiltrados[mesesFiltrados.length - 1]?.total ?? 0 : 0
  const mesAnterior = mesesFiltrados.length > 1 ? mesesFiltrados[mesesFiltrados.length - 2]?.total ?? 0 : null
  const diffMes = mesAnterior !== null ? ultimoMes - mesAnterior : null
  const pctMes =
    mesAnterior !== null && mesAnterior > 0 && diffMes !== null
      ? Math.round((diffMes / mesAnterior) * 100)
      : null

  return (
    <>
      <PageHeader titulo="Dashboard" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Socios activos" valor={String(data.socios_activos)} icono={<Users className="h-6 w-6" />} to="/socios" />
        <Tarjeta titulo="Ingresos del mes" valor={formatSoles(data.ingresos_mes)} icono={<Wallet className="h-6 w-6" />} />
        <Tarjeta
          titulo="Asistencias hoy"
          valor={String(data.asistencias_hoy)}
          icono={<UserCheck className="h-6 w-6" />}
          to="/asistencias?fecha=hoy"
        />
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
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/socios/${s.id}`} className="block truncate font-medium hover:text-lime-400">
                      {s.nombre}
                    </Link>
                    <p className="text-xs text-zinc-400">
                      {diasTexto(s.dias_restantes)} · {formatFecha(s.fecha_fin)}
                    </p>
                  </div>
                  <a
                    href={enlaceWhatsApp(
                      s.telefono,
                      `Hola ${s.nombre}, te recordamos que tu membresía en ${GYM_NAME} ${diasTexto(s.dias_restantes).toLowerCase()} (${formatFecha(s.fecha_fin)}).`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Recordar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Deudores</h2>
          {data.deudores.length === 0 ? (
            <Vacio texto="Sin deudas pendientes." />
          ) : (
            <ul className="divide-y divide-borde">
              {data.deudores.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/socios/${d.id}`} className="block truncate font-medium hover:text-lime-400">
                      {d.nombre}
                    </Link>
                    <p className="text-xs font-semibold text-red-400">{formatSoles(d.deuda)}</p>
                  </div>
                  <a
                    href={enlaceWhatsApp(
                      d.telefono,
                      `Hola ${d.nombre}, tienes un saldo pendiente de ${formatSoles(d.deuda)} en ${GYM_NAME}.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Cobrar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-bold">Tendencia de asistencias</h2>
              <p className="text-xs text-zinc-400">
                {totalDias} ingresos · Prom. {promedioDiario.toFixed(1)} / día
              </p>
            </div>
            <select
              aria-label="Filtrar asistencias por días"
              value={rangoDias}
              onChange={(e) => setRangoDias(Number(e.target.value) as RangoDias)}
              className={selectFiltroCls}
            >
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={asistenciasFiltradas}>
                <defs>
                  <linearGradient id="asistenciasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3e635" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#a3e635" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tickFormatter={diaCorto}
                  stroke="#71717a"
                  fontSize={12}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${Number(v)} asistencias`, 'Total']}
                  labelFormatter={(v) => formatFecha(String(v))}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#a3e635"
                  strokeWidth={2.5}
                  fill="url(#asistenciasGrad)"
                  activeDot={{ r: 5, fill: '#a3e635', stroke: '#18181b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-bold">Ingresos por mes</h2>
              {diffMes !== null ? (
                <p
                  className={`text-xs font-medium ${
                    diffMes >= 0 ? 'text-lime-400' : 'text-red-400'
                  }`}
                >
                  {diffMes >= 0 ? '+' : ''}
                  {formatSoles(diffMes)} vs mes ant.
                  {pctMes !== null ? ` (${pctMes >= 0 ? '+' : ''}${pctMes}%)` : ''}
                </p>
              ) : (
                <p className="text-xs text-zinc-400">Comparativa mensual</p>
              )}
            </div>
            <select
              aria-label="Filtrar ingresos por meses"
              value={rangoMeses}
              onChange={(e) => setRangoMeses(Number(e.target.value) as RangoMeses)}
              className={selectFiltroCls}
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={0}>Todos</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mesesFiltrados}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="#71717a" fontSize={12} />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  width={56}
                  tickFormatter={(v) => `S/ ${Number(v)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatSoles(Number(v)), 'Ingresos']}
                  labelFormatter={(v) => mesCorto(String(v))}
                />
                <Bar dataKey="total" name="Ingresos" fill="#a3e635" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}