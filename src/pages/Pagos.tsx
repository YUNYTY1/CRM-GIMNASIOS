import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { METODOS, type MetodoPago, type Pago, type Plan, type SocioResumen } from '../lib/types'
import { formatFecha, formatFechaHora, formatSoles, mensajeError } from '../lib/format'
import { Alerta, Avatar, BadgeMembresia, Button, Campo, Card, Modal, PageHeader, Spinner, Vacio, inputCls } from '../components/ui'

export default function Pagos() {
  const [params] = useSearchParams()
  const socioParam = params.get('socio')

  const [planes, setPlanes] = useState<Plan[]>([])
  const [recientes, setRecientes] = useState<Pago[]>([])
  const [deudores, setDeudores] = useState<SocioResumen[]>([])
  const [loading, setLoading] = useState(true)

  const [socio, setSocio] = useState<SocioResumen | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<SocioResumen[]>([])

  const [planId, setPlanId] = useState('')
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [abonar, setAbonar] = useState<SocioResumen | null>(null)

  const plan = planes.find((p) => String(p.id) === planId)

  const cargarListas = useCallback(async () => {
    const [pl, rc, dd] = await Promise.all([
      supabase.from('planes').select('*').eq('activo', true).order('duracion_dias'),
      supabase.from('pagos').select('*, socios(nombre)').order('fecha', { ascending: false }).limit(15),
      supabase.from('v_socios_resumen').select('*').gt('deuda', 0).order('deuda', { ascending: false }),
    ])
    const fallo = pl.error ?? rc.error ?? dd.error
    if (fallo) setError(mensajeError(fallo))
    setPlanes((pl.data ?? []) as Plan[])
    setRecientes((rc.data ?? []) as unknown as Pago[])
    setDeudores((dd.data ?? []) as SocioResumen[])
    setLoading(false)
  }, [])

  const recargarSocio = useCallback(async (id: number) => {
    const { data } = await supabase.from('v_socios_resumen').select('*').eq('id', id).maybeSingle()
    if (data) setSocio(data as SocioResumen)
  }, [])

  useEffect(() => {
    void cargarListas()
  }, [cargarListas])

  useEffect(() => {
    if (socioParam && Number.isInteger(Number(socioParam))) void recargarSocio(Number(socioParam))
  }, [socioParam, recargarSocio])

  // Buscador de socio
  useEffect(() => {
    const term = busqueda.trim().replace(/[,()%*\\]/g, ' ')
    if (term.length < 2) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('v_socios_resumen')
        .select('*')
        .or(`nombre.ilike.%${term}%,dni.ilike.%${term}%,telefono.ilike.%${term}%`)
        .order('nombre')
        .limit(6)
      setResultados((data ?? []) as SocioResumen[])
    }, 250)
    return () => clearTimeout(t)
  }, [busqueda])

  function elegirPlan(id: string) {
    setPlanId(id)
    const p = planes.find((x) => String(x.id) === id)
    setMonto(p ? String(p.precio) : '')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!socio) return setError('Elige un socio.')
    if (!plan) return setError('Elige un plan.')
    const m = Number(monto)
    if (!Number.isFinite(m) || m < 0 || m > plan.precio) return setError(`El monto debe estar entre S/ 0.00 y ${formatSoles(plan.precio)}.`)
    setEnviando(true)
    const { data, error: err } = await supabase.rpc('registrar_pago', {
      p_socio_id: socio.id,
      p_plan_id: plan.id,
      p_monto: m,
      p_metodo: metodo,
    })
    setEnviando(false)
    if (err) return setError(mensajeError(err))
    const r = data as { fecha_fin: string; monto_pendiente: number }
    setOk(
      `Pago registrado. Membresía de ${socio.nombre} vigente hasta el ${formatFecha(r.fecha_fin)}.` +
        (r.monto_pendiente > 0 ? ` Queda pendiente ${formatSoles(r.monto_pendiente)}.` : ''),
    )
    setPlanId('')
    setMonto('')
    await Promise.all([recargarSocio(socio.id), cargarListas()])
  }

  const vigente = socio && socio.fecha_fin && socio.dias_restantes !== null && socio.dias_restantes >= 0
  const pendiente = plan && monto !== '' ? Math.max(0, plan.precio - Number(monto)) : 0

  return (
    <>
      <PageHeader titulo="Pagos y membresías" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Registrar pago</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <Alerta>{error}</Alerta>}
            {ok && <Alerta tipo="ok">{ok}</Alerta>}

            {socio ? (
              <div className="flex items-center gap-3 rounded-lg border border-borde p-3">
                <Avatar nombre={socio.nombre} url={socio.foto_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{socio.nombre}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <BadgeMembresia estado={socio.estado_membresia} />
                    {socio.fecha_fin && <span>hasta {formatFecha(socio.fecha_fin)}</span>}
                    {socio.deuda > 0 && <span className="font-semibold text-red-400">Debe {formatSoles(socio.deuda)}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setSocio(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800" aria-label="Quitar socio">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Campo label="Socio">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input className={`${inputCls} pl-9`} placeholder="Buscar por nombre, DNI o teléfono" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                {resultados.length > 0 && (
                  <ul className="mt-1 divide-y divide-borde overflow-hidden rounded-lg border border-borde">
                    {resultados.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-zinc-800"
                          onClick={() => {
                            setSocio(s)
                            setBusqueda('')
                            setResultados([])
                          }}
                        >
                          <Avatar nombre={s.nombre} url={s.foto_url} size="h-8 w-8" />
                          <span className="text-sm">{s.nombre} <span className="text-xs text-zinc-500">· {s.dni}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Campo>
            )}

            <Campo label="Plan">
              <select className={inputCls} value={planId} onChange={(e) => elegirPlan(e.target.value)}>
                <option value="">Selecciona un plan</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.duracion_dias} {p.duracion_dias === 1 ? 'día' : 'días'} · {formatSoles(p.precio)}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Monto cobrado (S/)">
                <input className={inputCls} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" />
              </Campo>
              <Campo label="Método">
                <select className={inputCls} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {METODOS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Campo>
            </div>

            {plan && socio && (
              <p className="text-xs text-zinc-400">
                {vigente
                  ? `La membresía sigue vigente: se sumarán ${plan.duracion_dias} días al vencimiento actual (${formatFecha(socio.fecha_fin)}).`
                  : `La membresía comenzará hoy y durará ${plan.duracion_dias} ${plan.duracion_dias === 1 ? 'día' : 'días'}.`}
                {pendiente > 0 && <span className="font-semibold text-amber-300"> Quedará una deuda de {formatSoles(pendiente)}.</span>}
              </p>
            )}
            <Button type="submit" loading={enviando} className="w-full">
              Registrar pago
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold">Deudores</h2>
            {loading ? (
              <Spinner />
            ) : deudores.length === 0 ? (
              <Vacio texto="No hay deudas pendientes." />
            ) : (
              <ul className="divide-y divide-borde">
                {deudores.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.nombre}</p>
                      <p className="text-sm font-semibold text-red-400">{formatSoles(d.deuda)}</p>
                    </div>
                    <Button variant="outline" onClick={() => setAbonar(d)}>Abonar</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">Últimos pagos</h2>
            {loading ? (
              <Spinner />
            ) : recientes.length === 0 ? (
              <Vacio texto="Todavía no hay pagos." />
            ) : (
              <ul className="divide-y divide-borde">
                {recientes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.socios?.nombre ?? 'Socio'}</p>
                      <p className="text-xs capitalize text-zinc-500">{p.concepto} · {p.metodo} · {formatFechaHora(p.fecha)}</p>
                    </div>
                    <span className="font-semibold">{formatSoles(p.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {abonar && (
        <AbonoModal
          socio={abonar}
          onClose={() => setAbonar(null)}
          onSaved={async () => {
            const id = abonar.id
            setAbonar(null)
            await cargarListas()
            if (socio?.id === id) await recargarSocio(id)
          }}
        />
      )}
    </>
  )
}

function AbonoModal({ socio, onSaved, onClose }: { socio: SocioResumen; onSaved: () => void; onClose: () => void }) {
  const [monto, setMonto] = useState(String(socio.deuda))
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!Number.isFinite(m) || m <= 0 || m > socio.deuda) return setError(`El abono debe ser mayor que 0 y no superar ${formatSoles(socio.deuda)}.`)
    setEnviando(true)
    const { error: err } = await supabase.rpc('abonar_deuda', { p_socio_id: socio.id, p_monto: m, p_metodo: metodo })
    setEnviando(false)
    if (err) return setError(mensajeError(err))
    onSaved()
  }

  return (
    <Modal titulo={`Abono · ${socio.nombre}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <Alerta>{error}</Alerta>}
        <p className="text-sm text-zinc-400">Deuda actual: <span className="font-semibold text-red-400">{formatSoles(socio.deuda)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Monto (S/)">
            <input className={inputCls} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} />
          </Campo>
          <Campo label="Método">
            <select className={inputCls} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Registrar abono</Button>
        </div>
      </form>
    </Modal>
  )
}
