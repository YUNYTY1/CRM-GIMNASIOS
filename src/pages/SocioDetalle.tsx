import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { ArrowLeft, Download, MessageCircle, Pencil, Receipt, Trash2 } from 'lucide-react'
import { GYM_NAME, supabase } from '../lib/supabase'
import type { Asistencia, Pago, SocioResumen } from '../lib/types'
import { diasTexto, enlaceWhatsApp, formatFecha, formatFechaHora, formatSoles, mensajeError } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Alerta, Avatar, BadgeMembresia, Button, Card, Confirmar, Spinner, Vacio } from '../components/ui'
import SocioForm from '../components/SocioForm'

export default function SocioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'admin'
  const qrRef = useRef<HTMLCanvasElement>(null)

  const [socio, setSocio] = useState<SocioResumen | null>(null)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [borrando, setBorrando] = useState(false)

  const cargar = useCallback(async () => {
    const socioId = Number(id)
    if (!Number.isInteger(socioId)) {
      setError('Socio no válido.')
      setLoading(false)
      return
    }
    setError(null)
    const [s, p, a] = await Promise.all([
      supabase.from('v_socios_resumen').select('*').eq('id', socioId).maybeSingle(),
      supabase.from('pagos').select('*').eq('socio_id', socioId).order('fecha', { ascending: false }).limit(50),
      supabase.from('asistencias').select('*').eq('socio_id', socioId).order('fecha_hora', { ascending: false }).limit(50),
    ])
    if (s.error || p.error || a.error) setError(mensajeError(s.error ?? p.error ?? a.error))
    else if (!s.data) setError('No se encontró el socio.')
    else {
      setSocio(s.data as SocioResumen)
      setPagos((p.data ?? []) as Pago[])
      setAsistencias((a.data ?? []) as Asistencia[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  function descargarQr() {
    if (!socio || !qrRef.current) return
    const a = document.createElement('a')
    a.href = qrRef.current.toDataURL('image/png')
    a.download = `qr-${socio.dni}.png`
    a.click()
  }

  async function eliminar() {
    if (!socio) return
    setBorrando(true)
    const { error: err } = await supabase.from('socios').delete().eq('id', socio.id)
    setBorrando(false)
    if (err) {
      setEliminando(false)
      setError(mensajeError(err))
      return
    }
    navigate('/socios', { replace: true })
  }

  if (loading) return <Spinner />
  if (!socio) {
    return (
      <div className="space-y-4">
        <Alerta>{error ?? 'No se encontró el socio.'}</Alerta>
        <Link to="/socios" className="text-sm text-lime-400">← Volver a socios</Link>
      </div>
    )
  }

  const mensajeQr = `Hola ${socio.nombre.split(' ')[0]}, bienvenido/a a ${GYM_NAME}. Te envío tu código QR personal para ingresar al gimnasio: preséntalo desde tu celular en la puerta. Por favor no lo compartas con nadie.`

  return (
    <div className="space-y-4">
      <Link to="/socios" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Socios
      </Link>
      {error && <Alerta>{error}</Alerta>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-4 text-center lg:col-span-1">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeCanvas ref={qrRef} value={socio.codigo_qr} size={600} marginSize={1} level="M" style={{ width: 240, height: 240 }} />
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button variant="outline" onClick={descargarQr}>
              <Download className="h-4 w-4" /> Descargar QR
            </Button>
            <a
              href={enlaceWhatsApp(socio.telefono, mensajeQr)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
            >
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </a>
            <p className="text-xs text-zinc-500">Descarga el QR y adjúntalo en el chat de WhatsApp que se abre.</p>
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex items-start gap-4">
            <Avatar nombre={socio.nombre} url={socio.foto_url} size="h-20 w-20" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{socio.nombre}</h1>
              <p className="text-sm text-zinc-400">DNI {socio.dni} · {socio.telefono}</p>
              {socio.correo && <p className="truncate text-sm text-zinc-400">{socio.correo}</p>}
              <p className="mt-1 text-xs text-zinc-500">Socio {socio.estado}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-borde p-3">
              <p className="text-xs uppercase text-zinc-500">Membresía</p>
              <div className="mt-1"><BadgeMembresia estado={socio.estado_membresia} /></div>
              <p className="mt-1 text-sm">{socio.plan_nombre ?? 'Sin plan'}</p>
            </div>
            <div className="rounded-lg border border-borde p-3">
              <p className="text-xs uppercase text-zinc-500">Vencimiento</p>
              <p className="mt-1 font-semibold">{formatFecha(socio.fecha_fin)}</p>
              <p className="text-sm text-zinc-400">{socio.fecha_fin ? diasTexto(socio.dias_restantes) : '—'}</p>
            </div>
            <div className="rounded-lg border border-borde p-3">
              <p className="text-xs uppercase text-zinc-500">Deuda</p>
              <p className={`mt-1 text-lg font-bold ${socio.deuda > 0 ? 'text-red-400' : 'text-lime-400'}`}>{formatSoles(socio.deuda)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/pagos?socio=${socio.id}`} className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300">
              <Receipt className="h-4 w-4" /> Registrar pago
            </Link>
            {esAdmin && (
              <>
                <Button variant="outline" onClick={() => setEditando(true)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button variant="outline" className="!text-red-400" onClick={() => setEliminando(true)}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Historial de pagos</h2>
          {pagos.length === 0 ? (
            <Vacio texto="Sin pagos registrados." />
          ) : (
            <ul className="divide-y divide-borde">
              {pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.concepto ?? 'Pago'}</p>
                    <p className="text-xs capitalize text-zinc-500">{formatFechaHora(p.fecha)} · {p.metodo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatSoles(p.monto)}</p>
                    {p.monto_pendiente > 0 && <p className="text-xs text-red-400">Pendiente {formatSoles(p.monto_pendiente)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Historial de asistencias</h2>
          {asistencias.length === 0 ? (
            <Vacio texto="Aún no registra ingresos." />
          ) : (
            <ul className="max-h-96 divide-y divide-borde overflow-y-auto">
              {asistencias.map((a) => (
                <li key={a.id} className="py-2.5 text-sm text-zinc-300">{formatFechaHora(a.fecha_hora)}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editando && (
        <SocioForm
          socio={socio}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false)
            void cargar()
          }}
        />
      )}
      {eliminando && (
        <Confirmar
          titulo="Eliminar socio"
          mensaje={`¿Seguro que quieres eliminar a ${socio.nombre}? Se borrarán sus membresías y asistencias. Si tiene pagos registrados no se podrá eliminar: en ese caso márcalo como inactivo.`}
          loading={borrando}
          onConfirm={() => void eliminar()}
          onCancel={() => setEliminando(false)}
        />
      )}
    </div>
  )
}
