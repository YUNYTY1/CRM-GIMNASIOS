import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { ArrowLeft, Check, Keyboard, Maximize, ScanLine, TriangleAlert, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ResultadoAcceso } from '../lib/types'
import { diasTexto, formatSoles, mensajeError } from '../lib/format'
import { desbloquearAudio, sonidoAviso, sonidoDenegado, sonidoPermitido } from '../lib/sound'
import { Avatar, Button, inputCls } from '../components/ui'

const MS_RESULTADO = 4000 // vuelve solo al modo escaneo
const MS_ENFRIAMIENTO = 8000 // mismo QR no se reprocesa en este lapso desde que se leyó

type Vista = { tipo: 'resultado'; r: ResultadoAcceso } | { tipo: 'error'; mensaje: string }

function textoMinutos(m: number): string {
  if (m <= 0) return 'menos de 1 minuto'
  return m === 1 ? '1 minuto' : `${m} minutos`
}

export default function Acceso() {
  const [iniciado, setIniciado] = useState(false)
  const [vista, setVista] = useState<Vista | null>(null)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [mostrarDni, setMostrarDni] = useState(false)
  const [dni, setDni] = useState('')
  const [dniError, setDniError] = useState<string | null>(null)

  const ocupado = useRef(false)
  const timer = useRef<number | null>(null)
  const ultimo = useRef<{ codigo: string; t: number } | null>(null)

  const cerrarVista = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setVista(null)
    ocupado.current = false
  }, [])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  // Mantiene la pantalla encendida mientras se usa el control de acceso
  useEffect(() => {
    if (!iniciado) return
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => {
      void lock?.release()
    }
  }, [iniciado])

  const procesar = useCallback(
    async (args: { codigo?: string; dni?: string }) => {
      if (ocupado.current) return
      ocupado.current = true
      try {
        const { data, error } = await supabase.rpc('registrar_acceso', {
          p_codigo: args.codigo ?? null,
          p_dni: args.dni ?? null,
        })
        if (error) throw error
        const r = data as ResultadoAcceso
        if (r.duplicado) sonidoAviso()
        else if (r.acceso) sonidoPermitido()
        else sonidoDenegado()
        setVista({ tipo: 'resultado', r })
      } catch (e) {
        sonidoDenegado()
        setVista({ tipo: 'error', mensaje: mensajeError(e) })
      }
      timer.current = window.setTimeout(cerrarVista, MS_RESULTADO)
    },
    [cerrarVista],
  )

  const onScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const raw = codes[0]?.rawValue?.trim()
      if (!raw || ocupado.current) return
      const ahora = Date.now()
      if (ultimo.current && ultimo.current.codigo === raw && ahora - ultimo.current.t < MS_ENFRIAMIENTO) return
      ultimo.current = { codigo: raw, t: ahora }
      void procesar({ codigo: raw })
    },
    [procesar],
  )

  function iniciar() {
    desbloquearAudio()
    document.documentElement.requestFullscreen?.().catch(() => undefined)
    setIniciado(true)
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  function enviarDni(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{8}$/.test(dni)) return setDniError('El DNI debe tener 8 dígitos.')
    setDniError(null)
    setMostrarDni(false)
    const valor = dni
    setDni('')
    void procesar({ dni: valor })
  }

  if (!iniciado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-fondo p-6 text-center">
        <div className="rounded-3xl bg-lime-400/10 p-6">
          <ScanLine className="h-16 w-16 text-lime-400" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">Control de acceso</h1>
          <p className="mt-2 max-w-xs text-sm text-zinc-400">
            Se activará la cámara y el sonido. Deja esta pantalla fija en la puerta.
          </p>
        </div>
        <Button onClick={iniciar} className="px-10 py-4 text-lg">
          Iniciar escaneo
        </Button>
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          Volver al panel
        </Link>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black">
      <Scanner
        onScan={onScan}
        onError={(err) => setErrorCamara(err.message || 'No se pudo acceder a la cámara.')}
        constraints={{ facingMode: 'environment' }}
        formats={['qr_code']}
        allowMultiple
        scanDelay={600}
        sound={false}
        components={{ finder: true, torch: true }}
        styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
      />

      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <Link to="/" className="flex items-center gap-1 rounded-lg bg-black/50 px-3 py-2 text-sm text-white">
          <ArrowLeft className="h-4 w-4" /> Salir
        </Link>
        <div className="flex gap-2">
          <button onClick={() => setMostrarDni(true)} className="flex items-center gap-1 rounded-lg bg-black/50 px-3 py-2 text-sm text-white">
            <Keyboard className="h-4 w-4" /> Ingresar DNI
          </button>
          <button onClick={pantallaCompleta} className="rounded-lg bg-black/50 p-2 text-white" aria-label="Pantalla completa">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-6 text-center" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <p className="text-lg font-semibold text-white">Muestra tu código QR frente a la cámara</p>
      </div>

      {errorCamara && (
        <div className="absolute inset-x-4 top-20 z-10 flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-950/90 p-3 text-sm text-red-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {errorCamara} Revisa el permiso de cámara del navegador (se requiere HTTPS). Mientras tanto puedes usar “Ingresar DNI”.
          </span>
        </div>
      )}

      {vista && <Resultado vista={vista} onClose={cerrarVista} />}

      {mostrarDni && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center" onMouseDown={() => setMostrarDni(false)}>
          <form onSubmit={enviarDni} onMouseDown={(e) => e.stopPropagation()} className="animate-pop w-full max-w-sm space-y-3 rounded-2xl border border-borde bg-panel p-5">
            <h2 className="text-lg font-bold">Ingreso manual por DNI</h2>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="8 dígitos"
              className={`${inputCls} text-center text-2xl tracking-widest`}
            />
            {dniError && <p className="text-sm text-red-400">{dniError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMostrarDni(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Verificar
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Resultado({ vista, onClose }: { vista: Vista; onClose: () => void }) {
  let fondo = 'bg-green-600 text-white'
  let icono = <Check className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={3} />
  let titulo = 'ACCESO PERMITIDO'
  let nombre: string | undefined
  let foto: string | null | undefined
  let lineas: string[] = []
  let deuda = 0

  if (vista.tipo === 'error') {
    fondo = 'bg-zinc-800 text-white'
    icono = <TriangleAlert className="h-24 w-24" />
    titulo = 'ERROR'
    lineas = [vista.mensaje]
  } else {
    const r = vista.r
    nombre = r.nombre
    foto = r.foto_url
    deuda = r.deuda
    if (r.duplicado) {
      fondo = 'bg-sky-600 text-white'
      titulo = 'YA INGRESÓ'
      lineas = [`Ya ingresó hace ${textoMinutos(r.minutos ?? 0)}`]
    } else if (!r.acceso) {
      fondo = 'bg-red-600 text-white'
      icono = <X className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={3} />
      titulo = 'ACCESO DENEGADO'
      lineas = r.motivos
    } else if (r.nivel === 'aviso') {
      fondo = 'bg-yellow-400 text-zinc-950'
      lineas = ['Tu membresía vence pronto', diasTexto(r.dias_restantes)]
    } else {
      lineas = [diasTexto(r.dias_restantes)]
    }
  }

  return (
    <div onClick={onClose} className={`animate-pop absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center ${fondo}`}>
      {icono}
      <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{titulo}</h1>
      {nombre && (
        <div className="flex flex-col items-center gap-3">
          {foto ? (
            <img src={foto} alt={nombre} className="h-32 w-32 rounded-full border-4 border-white/70 object-cover sm:h-44 sm:w-44" />
          ) : (
            vista.tipo === 'resultado' && vista.r.acceso && <Avatar nombre={nombre} size="h-24 w-24 text-3xl" />
          )}
          <p className="text-2xl font-bold sm:text-4xl">{nombre}</p>
        </div>
      )}
      <div className="space-y-1">
        {lineas.map((l) => (
          <p key={l} className="text-2xl font-semibold sm:text-3xl">
            {l}
          </p>
        ))}
        {deuda > 0 && <p className="mt-2 rounded-xl bg-black/25 px-4 py-2 text-3xl font-black">Debe {formatSoles(deuda)}</p>}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 bg-black/25">
        <div className="h-full bg-white/80" style={{ animation: `encoger ${MS_RESULTADO}ms linear forwards` }} />
      </div>
    </div>
  )
}
