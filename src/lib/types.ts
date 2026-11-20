export type Rol = 'admin' | 'recepcion'
export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta'
export type EstadoMembresia = 'activa' | 'por_vencer' | 'vencida' | 'sin_membresia'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
}

export interface Socio {
  id: number
  nombre: string
  dni: string
  telefono: string
  correo: string | null
  foto_url: string | null
  codigo_qr: string
  estado: 'activo' | 'inactivo'
  creado_en: string
}

export interface SocioResumen extends Socio {
  membresia_id: number | null
  plan_id: number | null
  plan_nombre: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  dias_restantes: number | null
  estado_membresia: EstadoMembresia
  deuda: number
}

export interface Plan {
  id: number
  nombre: string
  duracion_dias: number
  precio: number
  activo: boolean
}

export interface Pago {
  id: number
  socio_id: number
  monto: number
  monto_pendiente: number
  metodo: MetodoPago
  concepto: string | null
  fecha: string
  socios?: { nombre: string } | null
}

export interface Asistencia {
  id: number
  socio_id: number
  fecha_hora: string
}

export interface ResultadoAcceso {
  encontrado: boolean
  socio_id?: number
  nombre?: string
  dni?: string
  foto_url?: string | null
  estado_socio?: string
  estado_membresia?: EstadoMembresia
  fecha_fin?: string | null
  dias_restantes?: number | null
  deuda: number
  acceso: boolean
  nivel: 'permitido' | 'aviso' | 'denegado'
  motivos: string[]
  duplicado?: boolean
  registrado?: boolean
  minutos?: number
}

export interface ResumenDashboard {
  socios_activos: number
  ingresos_mes: number
  asistencias_hoy: number
  vencen_semana: number
  por_vencer: { id: number; nombre: string; telefono: string; fecha_fin: string; dias_restantes: number }[]
  deudores: { id: number; nombre: string; telefono: string; deuda: number }[]
  asistencias_30: { dia: string; total: number }[]
  ingresos_meses: { mes: string; total: number }[]
}

export const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
]
