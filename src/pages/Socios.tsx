import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { EstadoMembresia, Plan, SocioResumen } from '../lib/types'
import { diasTexto, formatSoles, mensajeError } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Alerta, Avatar, BadgeMembresia, Button, Card, PageHeader, Spinner, Vacio, inputCls } from '../components/ui'
import SocioForm from '../components/SocioForm'

type FiltroEstadoOMembresia = 'todos' | 'activo' | 'inactivo' | EstadoMembresia

export default function Socios() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'admin'
  const [q, setQ] = useState('')
  const [filtroEstadoMem, setFiltroEstadoMem] = useState<FiltroEstadoOMembresia>('todos')
  const [filtroPlan, setFiltroPlan] = useState<string>('todos')
  const [planes, setPlanes] = useState<Pick<Plan, 'id' | 'nombre' | 'duracion_dias'>[]>([])
  const [lista, setLista] = useState<SocioResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)

  useEffect(() => {
    let activo = true
    supabase
      .from('planes')
      .select('id, nombre, duracion_dias')
      .order('duracion_dias')
      .then(({ data }) => {
        if (activo && data) setPlanes(data as Pick<Plan, 'id' | 'nombre' | 'duracion_dias'>[])
      })
    return () => {
      activo = false
    }
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('v_socios_resumen').select('*').order('nombre').limit(300)
    const term = q.trim().replace(/[,()%*\\]/g, ' ')
    if (term) query = query.or(`nombre.ilike.%${term}%,dni.ilike.%${term}%,telefono.ilike.%${term}%`)

    if (filtroEstadoMem === 'activo' || filtroEstadoMem === 'inactivo') {
      query = query.eq('estado', filtroEstadoMem)
    } else if (filtroEstadoMem !== 'todos') {
      query = query.eq('estado_membresia', filtroEstadoMem)
    }

    if (filtroPlan === 'sin_plan') {
      query = query.is('plan_id', null)
    } else if (filtroPlan !== 'todos') {
      query = query.eq('plan_id', Number(filtroPlan))
    }

    const { data, error: err } = await query
    if (err) setError(mensajeError(err))
    else setLista((data ?? []) as SocioResumen[])
    setLoading(false)
  }, [q, filtroEstadoMem, filtroPlan])

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 300)
    return () => clearTimeout(t)
  }, [cargar])

  return (
    <>
      <PageHeader titulo="Socios">
        {esAdmin && (
          <Button onClick={() => setNuevo(true)}>
            <Plus className="h-4 w-4" /> Nuevo socio
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Buscar por nombre, DNI o teléfono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          aria-label="Filtrar por estado o membresía"
          className={`${inputCls} sm:w-48`}
          value={filtroEstadoMem}
          onChange={(e) => setFiltroEstadoMem(e.target.value as FiltroEstadoOMembresia)}
        >
          <option value="todos">Todos (estado / memb.)</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="por_vencer">Por vencer</option>
          <option value="vencida">Vencida</option>
          <option value="sin_membresia">Sin membresía</option>
        </select>

        <select
          aria-label="Filtrar por plan"
          className={`${inputCls} sm:w-48`}
          value={filtroPlan}
          onChange={(e) => setFiltroPlan(e.target.value)}
        >
          <option value="todos">Todos los planes</option>
          {planes.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nombre} ({p.duracion_dias} {p.duracion_dias === 1 ? 'día' : 'días'})
            </option>
          ))}
          <option value="sin_plan">Sin plan</option>
        </select>
      </div>

      {error && <Alerta>{error}</Alerta>}
      {loading ? (
        <Spinner />
      ) : lista.length === 0 ? (
        <Vacio texto="No se encontraron socios con esos filtros." />
      ) : (
        <Card className="divide-y divide-borde !p-0">
          {lista.map((s) => (
            <Link key={s.id} to={`/socios/${s.id}`} className="flex items-center gap-3 p-3 transition hover:bg-zinc-900 sm:p-4">
              <Avatar nombre={s.nombre} url={s.foto_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {s.nombre} {s.estado === 'inactivo' && <span className="ml-1 text-xs text-zinc-500">(inactivo)</span>}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  DNI {s.dni} · {s.telefono}
                  {s.plan_nombre ? ` · ${s.plan_nombre}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <BadgeMembresia estado={s.estado_membresia} />
                <span className="text-xs text-zinc-500">{s.estado_membresia !== 'sin_membresia' && diasTexto(s.dias_restantes)}</span>
                {s.deuda > 0 && <span className="text-xs font-semibold text-red-400">Debe {formatSoles(s.deuda)}</span>}
              </div>
            </Link>
          ))}
        </Card>
      )}

      {nuevo && (
        <SocioForm
          onClose={() => setNuevo(false)}
          onSaved={() => {
            void cargar()
          }}
        />
      )}
    </>
  )
}