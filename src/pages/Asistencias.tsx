import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Clock, Filter, RotateCcw, Search, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Plan, Socio } from '../lib/types'
import { mensajeError } from '../lib/format'
import { Alerta, Avatar, Card, PageHeader, Spinner, Vacio } from '../components/ui'

interface MembresiaConPlan {
  id: number
  socio_id: number
  plan_id: number
  fecha_inicio: string
  fecha_fin: string
  planes: { nombre: string } | { nombre: string }[] | null
}

interface AsistenciaRow {
  id: number
  socio_id: number
  fecha_hora: string
  socio_nombre: string
  socio_dni: string
  socio_foto: string | null
  plan_id: number | null
  plan_nombre: string
}

function hoyLimaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function fechaLimaISO(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoTimestamp))
}

function formatHoraLima(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoTimestamp))
}

function formatFechaCortaLima(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoTimestamp))
}

function extraerNombrePlan(planes: MembresiaConPlan['planes']): string | null {
  if (!planes) return null
  if (Array.isArray(planes)) return planes[0]?.nombre ?? null
  return planes.nombre ?? null
}

function resolverPlanParaAsistencia(
  socioId: number,
  fechaHora: string,
  membresiasPorSocio: Map<number, MembresiaConPlan[]>
): { plan_id: number | null; plan_nombre: string } {
  const lista = membresiasPorSocio.get(socioId) ?? []
  if (lista.length === 0) return { plan_id: null, plan_nombre: 'Sin plan' }

  const diaAsis = fechaLimaISO(fechaHora)
  const vigenteEnFecha = lista.find((m) => m.fecha_inicio <= diaAsis && diaAsis <= m.fecha_fin)
  if (vigenteEnFecha) {
    return {
      plan_id: vigenteEnFecha.plan_id,
      plan_nombre: extraerNombrePlan(vigenteEnFecha.planes) ?? 'Sin plan',
    }
  }

  const reciente = lista[0]
  return {
    plan_id: reciente.plan_id,
    plan_nombre: extraerNombrePlan(reciente.planes) ?? 'Sin plan',
  }
}

export default function Asistencias() {
  const [searchParams, setSearchParams] = useSearchParams()
  const hoy = useMemo(() => hoyLimaISO(), [])

  const fechaInicial = useMemo(() => {
    const paramFecha = searchParams.get('fecha')
    if (!paramFecha || paramFecha === 'hoy') return hoy
    if (paramFecha === 'todas') return ''
    return paramFecha
  }, [searchParams, hoy])

  const [fecha, setFecha] = useState<string>(fechaInicial)
  const [socioId, setSocioId] = useState<string>(searchParams.get('socio') ?? '')
  const [planId, setPlanId] = useState<string>(searchParams.get('plan') ?? '')
  const [busqueda, setBusqueda] = useState<string>('')

  const [registros, setRegistros] = useState<AsistenciaRow[]>([])
  const [socios, setSocios] = useState<Pick<Socio, 'id' | 'nombre' | 'dni'>[]>([])
  const [planes, setPlanes] = useState<Pick<Plan, 'id' | 'nombre'>[]>([])
  const [cargando, setCargando] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargarTodo() {
      setCargando(true)
      setError(null)

      const [resAsis, resSocios, resPlanes, resMembresias] = await Promise.all([
        supabase
          .from('asistencias')
          .select('id, socio_id, fecha_hora')
          .order('fecha_hora', { ascending: false })
          .limit(1000),
        supabase.from('socios').select('id, nombre, dni, foto_url').order('nombre'),
        supabase.from('planes').select('id, nombre').order('nombre'),
        supabase
          .from('membresias')
          .select('id, socio_id, plan_id, fecha_inicio, fecha_fin, planes(nombre)')
          .order('fecha_fin', { ascending: false }),
      ])

      if (!activo) return

      const primerError = resAsis.error || resSocios.error || resPlanes.error || resMembresias.error
      if (primerError) {
        setError(mensajeError(primerError))
        setCargando(false)
        return
      }

      const listaSocios = (resSocios.data ?? []) as Pick<Socio, 'id' | 'nombre' | 'dni' | 'foto_url'>[]
      const mapaSocios = new Map<number, Pick<Socio, 'id' | 'nombre' | 'dni' | 'foto_url'>>()
      for (const s of listaSocios) mapaSocios.set(s.id, s)

      const mapaMembresias = new Map<number, MembresiaConPlan[]>()
      for (const m of (resMembresias.data ?? []) as MembresiaConPlan[]) {
        const arr = mapaMembresias.get(m.socio_id) ?? []
        arr.push(m)
        mapaMembresias.set(m.socio_id, arr)
      }

      const filas: AsistenciaRow[] = ((resAsis.data ?? []) as { id: number; socio_id: number; fecha_hora: string }[]).map(
        (a) => {
          const socio = mapaSocios.get(a.socio_id)
          const planInfo = resolverPlanParaAsistencia(a.socio_id, a.fecha_hora, mapaMembresias)
          return {
            id: a.id,
            socio_id: a.socio_id,
            fecha_hora: a.fecha_hora,
            socio_nombre: socio?.nombre ?? `Socio #${a.socio_id}`,
            socio_dni: socio?.dni ?? '',
            socio_foto: socio?.foto_url ?? null,
            plan_id: planInfo.plan_id,
            plan_nombre: planInfo.plan_nombre,
          }
        }
      )

      setSocios(listaSocios.map(({ id, nombre, dni }) => ({ id, nombre, dni })))
      setPlanes((resPlanes.data ?? []) as Pick<Plan, 'id' | 'nombre'>[])
      setRegistros(filas)
      setCargando(false)
    }

    void cargarTodo()
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return registros.filter((r) => {
      if (fecha && fechaLimaISO(r.fecha_hora) !== fecha) return false
      if (socioId && String(r.socio_id) !== socioId) return false
      if (planId) {
        if (planId === 'sin_plan') {
          if (r.plan_id !== null) return false
        } else if (String(r.plan_id) !== planId) {
          return false
        }
      }
      if (q) {
        const coincideNombre = r.socio_nombre.toLowerCase().includes(q)
        const coincideDni = r.socio_dni.toLowerCase().includes(q)
        const coincidePlan = r.plan_nombre.toLowerCase().includes(q)
        if (!coincideNombre && !coincideDni && !coincidePlan) return false
      }
      return true
    })
  }, [registros, fecha, socioId, planId, busqueda])

  const sociosUnicosEnVista = useMemo(() => {
    return new Set(filtrados.map((r) => r.socio_id)).size
  }, [filtrados])

  function limpiarFiltros() {
    setFecha('')
    setSocioId('')
    setPlanId('')
    setBusqueda('')
    setSearchParams({})
  }

  function verHoy() {
    setFecha(hoy)
    setSearchParams({ fecha: 'hoy' })
  }

  if (cargando) return <Spinner />
  if (error) return <Alerta>{error}</Alerta>

  return (
    <>
      <PageHeader titulo="Asistencias">
        <button
          type="button"
          onClick={verHoy}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            fecha === hoy
              ? 'border-lime-400/50 bg-lime-400/15 text-lime-300'
              : 'border-borde bg-panel text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Hoy ({hoy})
        </button>
        <button
          type="button"
          onClick={limpiarFiltros}
          className="flex items-center gap-1.5 rounded-lg border border-borde bg-panel px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Todas las fechas
        </button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-lime-400/10 p-3 text-lime-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Asistencias encontradas</p>
            <p className="text-2xl font-extrabold">{filtrados.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-lime-400/10 p-3 text-lime-400">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Socios distintos</p>
            <p className="text-2xl font-extrabold">{sociosUnicosEnVista}</p>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          <Filter className="h-3.5 w-3.5 text-lime-400" /> Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Día / Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-borde bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Socio</label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className="w-full rounded-lg border border-borde bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">Todos los socios</option>
              {socios.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre} ({s.dni})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-borde bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">Todos los planes</option>
              {planes.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre}
                </option>
              ))}
              <option value="sin_plan">Sin plan</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Buscar rápido</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, DNI o plan..."
                className="w-full rounded-lg border border-borde bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {filtrados.length === 0 ? (
          <Vacio texto="No hay asistencias que coincidan con los filtros seleccionados." />
        ) : (
          <ul className="divide-y divide-borde">
            {filtrados.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar nombre={item.socio_nombre} url={item.socio_foto} />
                  <div>
                    <Link
                      to={`/socios/${item.socio_id}`}
                      className="font-semibold text-zinc-100 transition hover:text-lime-400"
                    >
                      {item.socio_nombre}
                    </Link>
                    <p className="text-xs text-zinc-400">
                      {item.socio_dni ? `DNI ${item.socio_dni} · ` : ''}
                      {formatFechaCortaLima(item.fecha_hora)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      item.plan_id
                        ? 'border-lime-400/30 bg-lime-400/15 text-lime-300'
                        : 'border-zinc-600 bg-zinc-700/40 text-zinc-300'
                    }`}
                  >
                    {item.plan_nombre}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-zinc-300">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    {formatHoraLima(item.fecha_hora)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}