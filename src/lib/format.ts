/** Moneda: S/ 1,200.00 */
export function formatSoles(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  return 'S/ ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 'YYYY-MM-DD' -> 'dd/mm/yyyy' (sin pasar por Date para evitar desfases de zona horaria) */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const dtf = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatFechaHora(iso: string): string {
  return dtf.format(new Date(iso)).replace(',', '')
}

export function diasTexto(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return '—'
  if (dias < 0) return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

export function mesCorto(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')
}

export function diaCorto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/51${num}?text=${encodeURIComponent(mensaje)}`
}

/** Traduce errores de Supabase/PostgreSQL a mensajes claros en español. */
export function mensajeError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null
  const msg = err?.message ?? 'Ocurrió un error inesperado'
  if (err?.code === '23505') {
    if (msg.includes('dni')) return 'Ya existe un socio con ese DNI.'
    if (msg.includes('nombre')) return 'Ya existe un registro con ese nombre.'
    return 'Ya existe un registro con esos datos.'
  }
  if (err?.code === '23503') return 'No se puede eliminar: tiene registros asociados (pagos o membresías). Mejor desactívalo.'
  if (err?.code === '23514') return 'Algún dato no cumple las reglas de validación.'
  if (err?.code === '42501' || msg.includes('row-level security')) return 'No tienes permisos para realizar esta acción.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Sin conexión con el servidor. Revisa tu internet.'
  return msg
}
