import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, TriangleAlert, X } from 'lucide-react'
import type { EstadoMembresia } from '../lib/types'

export const inputCls =
  'w-full rounded-lg border border-borde bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-lime-400 focus:ring-1 focus:ring-lime-400 disabled:opacity-50'

type Variante = 'primary' | 'ghost' | 'danger' | 'outline'
const variantes: Record<Variante, string> = {
  primary: 'bg-lime-400 text-zinc-950 hover:bg-lime-300 font-semibold',
  ghost: 'text-zinc-300 hover:bg-zinc-800',
  outline: 'border border-borde text-zinc-200 hover:bg-zinc-800',
  danger: 'bg-red-600 text-white hover:bg-red-500 font-semibold',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante
  loading?: boolean
}

export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-borde bg-panel p-4 sm:p-5 ${className}`}>{children}</div>
}

export function PageHeader({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Spinner({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin text-lime-400" /> {texto}
    </div>
  )
}

export function Alerta({ children, tipo = 'error' }: { children: ReactNode; tipo?: 'error' | 'ok' | 'info' }) {
  const colores = {
    error: 'border-red-500/40 bg-red-500/10 text-red-300',
    ok: 'border-lime-500/40 bg-lime-500/10 text-lime-300',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  }
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${colores[tipo]}`}>
      {tipo === 'error' && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>{children}</div>
    </div>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-zinc-500">{texto}</p>
}

export function Campo({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  )
}

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className="animate-pop max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-borde bg-panel p-5 sm:max-w-lg sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirmar({
  titulo,
  mensaje,
  textoBoton = 'Eliminar',
  loading,
  onConfirm,
  onCancel,
}: {
  titulo: string
  mensaje: string
  textoBoton?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal titulo={titulo} onClose={onCancel}>
      <p className="mb-5 text-sm text-zinc-300">{mensaje}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {textoBoton}
        </Button>
      </div>
    </Modal>
  )
}

const badgeEstado: Record<EstadoMembresia, { txt: string; cls: string }> = {
  activa: { txt: 'Activa', cls: 'bg-lime-400/15 text-lime-300 border-lime-400/30' },
  por_vencer: { txt: 'Por vencer', cls: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  vencida: { txt: 'Vencida', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  sin_membresia: { txt: 'Sin membresía', cls: 'bg-zinc-700/40 text-zinc-300 border-zinc-600' },
}

export function BadgeMembresia({ estado }: { estado: EstadoMembresia }) {
  const b = badgeEstado[estado]
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.txt}</span>
}

export function Avatar({ nombre, url, size = 'h-10 w-10' }: { nombre: string; url?: string | null; size?: string }) {
  if (url) return <img src={url} alt={nombre} className={`${size} shrink-0 rounded-full object-cover`} />
  const ini = nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-lime-400`}>
      {ini}
    </div>
  )
}
