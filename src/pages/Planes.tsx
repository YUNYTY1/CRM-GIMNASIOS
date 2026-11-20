import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Plan } from '../lib/types'
import { formatSoles, mensajeError } from '../lib/format'
import { Alerta, Button, Campo, Card, Confirmar, Modal, PageHeader, Spinner, Vacio, inputCls } from '../components/ui'

export default function Planes() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editar, setEditar] = useState<Plan | 'nuevo' | null>(null)
  const [borrar, setBorrar] = useState<Plan | null>(null)
  const [borrando, setBorrando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.from('planes').select('*').order('duracion_dias')
    if (err) setError(mensajeError(err))
    else setPlanes((data ?? []) as Plan[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function eliminar() {
    if (!borrar) return
    setBorrando(true)
    const { error: err } = await supabase.from('planes').delete().eq('id', borrar.id)
    setBorrando(false)
    setBorrar(null)
    if (err) {
      setError(err.code === '23503' ? 'Este plan ya tiene membresías asociadas. Desactívalo en lugar de eliminarlo.' : mensajeError(err))
      return
    }
    setError(null)
    void cargar()
  }

  return (
    <>
      <PageHeader titulo="Planes">
        <Button onClick={() => setEditar('nuevo')}>
          <Plus className="h-4 w-4" /> Nuevo plan
        </Button>
      </PageHeader>
      {error && <div className="mb-4"><Alerta>{error}</Alerta></div>}
      {loading ? (
        <Spinner />
      ) : planes.length === 0 ? (
        <Vacio texto="Aún no hay planes. Crea el primero (ej. Mensual, Trimestral, Anual, Pase diario)." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {planes.map((p) => (
            <Card key={p.id} className={p.activo ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{p.nombre}</h3>
                  <p className="text-sm text-zinc-400">{p.duracion_dias} {p.duracion_dias === 1 ? 'día' : 'días'}</p>
                </div>
                {!p.activo && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Inactivo</span>}
              </div>
              <p className="mt-3 text-2xl font-extrabold text-lime-400">{formatSoles(p.precio)}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditar(p)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button variant="outline" className="!text-red-400" aria-label="Eliminar plan" onClick={() => setBorrar(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editar && (
        <PlanForm
          plan={editar === 'nuevo' ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null)
            setError(null)
            void cargar()
          }}
        />
      )}
      {borrar && (
        <Confirmar
          titulo="Eliminar plan"
          mensaje={`¿Eliminar el plan "${borrar.nombre}"? Esta acción no se puede deshacer.`}
          loading={borrando}
          onConfirm={() => void eliminar()}
          onCancel={() => setBorrar(null)}
        />
      )}
    </>
  )
}

function PlanForm({ plan, onSaved, onClose }: { plan: Plan | null; onSaved: () => void; onClose: () => void }) {
  const [nombre, setNombre] = useState(plan?.nombre ?? '')
  const [dias, setDias] = useState(plan ? String(plan.duracion_dias) : '')
  const [precio, setPrecio] = useState(plan ? String(plan.precio) : '')
  const [activo, setActivo] = useState(plan?.activo ?? true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const d = Number(dias)
    const p = Number(precio)
    if (nombre.trim().length < 2) return setError('Ingresa un nombre para el plan.')
    if (!Number.isInteger(d) || d < 1 || d > 3650) return setError('La duración debe ser un número entero de días (1 a 3650).')
    if (!Number.isFinite(p) || p < 0) return setError('Ingresa un precio válido en soles.')
    setGuardando(true)
    const datos = { nombre: nombre.trim(), duracion_dias: d, precio: Math.round(p * 100) / 100, activo }
    const { error: err } = plan ? await supabase.from('planes').update(datos).eq('id', plan.id) : await supabase.from('planes').insert(datos)
    setGuardando(false)
    if (err) return setError(mensajeError(err))
    onSaved()
  }

  return (
    <Modal titulo={plan ? 'Editar plan' : 'Nuevo plan'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <Alerta>{error}</Alerta>}
        <Campo label="Nombre">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Mensual, Trimestral, Anual, Pase diario" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Duración (días)">
            <input className={inputCls} inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} placeholder="30" />
          </Campo>
          <Campo label="Precio (S/)">
            <input className={inputCls} inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ''))} placeholder="90.00" />
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4 accent-lime-400" />
          Plan activo (disponible para nuevos pagos)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={guardando}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
