import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, QrCode, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { METODOS, type MetodoPago, type Plan, type Socio } from '../lib/types'
import { formatSoles, mensajeError } from '../lib/format'
import { reducirImagen } from '../lib/imagen'
import { Alerta, Avatar, Button, Campo, Modal, inputCls } from './ui'

interface Props {
  socio?: Socio | null
  onSaved: () => void
  onClose: () => void
}

interface SocioCreadoInfo {
  id: number
  nombre: string
  dni: string
  planNombre: string | null
  montoCobrado: number | null
}

type Errores = Partial<Record<'nombre' | 'dni' | 'telefono' | 'correo' | 'monto', string>>

export default function SocioForm({ socio, onSaved, onClose }: Props) {
  const navigate = useNavigate()
  const esEdicion = Boolean(socio)

  const [nombre, setNombre] = useState(socio?.nombre ?? '')
  const [dni, setDni] = useState(socio?.dni ?? '')
  const [telefono, setTelefono] = useState(socio?.telefono ?? '')
  const [correo, setCorreo] = useState(socio?.correo ?? '')
  const [estado, setEstado] = useState<'activo' | 'inactivo'>(socio?.estado ?? 'activo')
  const [fotoUrl, setFotoUrl] = useState<string | null>(socio?.foto_url ?? null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Membresía y pago inicial (solo al crear nuevo socio)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [planId, setPlanId] = useState<string>('')
  const [monto, setMonto] = useState<string>('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')

  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [creado, setCreado] = useState<SocioCreadoInfo | null>(null)

  useEffect(() => {
    if (esEdicion) return
    let activo = true
    supabase
      .from('planes')
      .select('id, nombre, duracion_dias, precio, activo')
      .eq('activo', true)
      .order('duracion_dias')
      .then(({ data, error: err }) => {
        if (!activo) return
        if (err) {
          setError(mensajeError(err))
          return
        }
        const lista = (data ?? []) as Plan[]
        setPlanes(lista)
        if (lista.length > 0) {
          setPlanId(String(lista[0].id))
          setMonto(String(lista[0].precio))
        }
      })
    return () => {
      activo = false
    }
  }, [esEdicion])

  const planSeleccionado = planes.find((p) => String(p.id) === planId) ?? null

  function alCambiarPlan(nuevoPlanId: string) {
    setPlanId(nuevoPlanId)
    setErrores((prev) => ({ ...prev, monto: undefined }))
    if (!nuevoPlanId) {
      setMonto('')
      return
    }
    const elegido = planes.find((p) => String(p.id) === nuevoPlanId)
    setMonto(elegido ? String(elegido.precio) : '')
  }

  function validar(): Errores {
    const e: Errores = {}
    if (nombre.trim().length < 3) e.nombre = 'Ingresa el nombre completo (mínimo 3 letras).'
    if (!/^\d{8}$/.test(dni)) e.dni = 'El DNI debe tener exactamente 8 dígitos.'
    if (!/^9\d{8}$/.test(telefono)) e.telefono = 'El celular debe tener 9 dígitos y empezar con 9.'
    if (correo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) e.correo = 'Correo no válido.'

    if (!esEdicion && planSeleccionado) {
      const valorMonto = Number(monto)
      if (monto.trim() === '' || Number.isNaN(valorMonto) || valorMonto < 0 || valorMonto > planSeleccionado.precio) {
        e.monto = `El monto debe estar entre 0 y ${formatSoles(planSeleccionado.precio)}.`
      }
    }
    return e
  }

  function elegirFoto(f: File | undefined) {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Elige un archivo de imagen.')
    if (f.size > 10 * 1024 * 1024) return setError('La imagen es muy pesada (máximo 10 MB).')
    setError(null)
    setArchivo(f)
    setPreview(URL.createObjectURL(f))
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    setError(null)

    let socioCreadoId: number | null = null

    try {
      let foto = fotoUrl
      if (archivo) {
        const blob = await reducirImagen(archivo)
        const ruta = `${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage.from('fotos-socios').upload(ruta, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        foto = supabase.storage.from('fotos-socios').getPublicUrl(ruta).data.publicUrl
      }

      const datos = {
        nombre: nombre.trim(),
        dni,
        telefono,
        correo: correo.trim() || null,
        foto_url: foto,
        estado,
      }

      if (socio) {
        const { error: dbErr } = await supabase.from('socios').update(datos).eq('id', socio.id)
        if (dbErr) throw dbErr
        onSaved()
      } else {
        const { data: insertado, error: dbErr } = await supabase
          .from('socios')
          .insert(datos)
          .select('id')
          .single()
        if (dbErr) throw dbErr
        socioCreadoId = (insertado as { id: number }).id

        let montoRegistrado: number | null = null
        if (planSeleccionado) {
          const montoNum = Number(monto)
          const { error: pagoErr } = await supabase.rpc('registrar_pago', {
            p_socio_id: socioCreadoId,
            p_plan_id: planSeleccionado.id,
            p_monto: montoNum,
            p_metodo: metodo,
          })
          if (pagoErr) throw pagoErr
          montoRegistrado = montoNum
        }

        // Refresca la lista atrás y mantiene el modal abierto con confirmación
        onSaved()
        setCreado({
          id: socioCreadoId,
          nombre: datos.nombre,
          dni: datos.dni,
          planNombre: planSeleccionado ? planSeleccionado.nombre : null,
          montoCobrado: montoRegistrado,
        })
      }
    } catch (err) {
      if (socioCreadoId !== null) {
        await supabase.from('socios').delete().eq('id', socioCreadoId)
      }
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (creado) {
    return (
      <Modal titulo="Socio registrado" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-lime-500/40 bg-lime-500/10 p-4 text-lime-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
            <div className="space-y-1 text-sm">
              <p className="font-bold text-zinc-100">{creado.nombre}</p>
              <p className="text-xs text-zinc-300">DNI {creado.dni}</p>
              <p className="pt-1 text-xs">
                {creado.planNombre && creado.montoCobrado !== null
                  ? `Membresía ${creado.planNombre} activada · Pago registrado por ${formatSoles(creado.montoCobrado)}.`
                  : 'Registrado sin membresía por ahora.'}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            Esta ventana permanecerá abierta hasta que elijas ver el perfil del socio o cerrarla manualmente.
          </p>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="button" onClick={() => navigate(`/socios/${creado.id}`)}>
              <QrCode className="h-4 w-4" /> Ver perfil y QR
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const fotoMostrada = preview ?? fotoUrl

  return (
    <Modal titulo={socio ? 'Editar socio' : 'Nuevo socio'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <Alerta>{error}</Alerta>}

        <div className="flex items-center gap-3">
          <Avatar nombre={nombre || 'S'} url={fotoMostrada} size="h-16 w-16" />
          <label className="cursor-pointer rounded-lg border border-borde px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
            <Camera className="mr-1.5 inline h-4 w-4" /> {fotoMostrada ? 'Cambiar foto' : 'Agregar foto (opcional)'}
            <input type="file" accept="image/*" className="hidden" onChange={(ev) => elegirFoto(ev.target.files?.[0])} />
          </label>
          {fotoMostrada && (
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
              aria-label="Quitar foto"
              onClick={() => {
                setFotoUrl(null)
                setArchivo(null)
                setPreview(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <Campo label="Nombre completo" error={errores.nombre}>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Carlos Mendoza Quispe" />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="DNI" error={errores.dni}>
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
            />
          </Campo>
          <Campo label="Celular" error={errores.telefono}>
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={9}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
              placeholder="987654321"
            />
          </Campo>
        </div>

        <Campo label="Correo (opcional)" error={errores.correo}>
          <input type="email" className={inputCls} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
        </Campo>

        <Campo label="Estado">
          <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as 'activo' | 'inactivo')}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </Campo>

        {!esEdicion && (
          <div className="space-y-3 rounded-xl border border-borde bg-zinc-900/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-lime-400">Membresía y pago inicial</p>

            <Campo label="Plan">
              <select className={inputCls} value={planId} onChange={(e) => alCambiarPlan(e.target.value)}>
                {planes.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nombre} ({p.duracion_dias} días · {formatSoles(p.precio)})
                  </option>
                ))}
                <option value="">Sin membresía por ahora</option>
              </select>
            </Campo>

            {planSeleccionado && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Monto cobrado (S/)" error={errores.monto}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={planSeleccionado.precio}
                    className={inputCls}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </Campo>
                <Campo label="Método">
                  <select className={inputCls} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {socio ? 'Guardar cambios' : planSeleccionado ? 'Crear socio y registrar pago' : 'Crear socio'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}