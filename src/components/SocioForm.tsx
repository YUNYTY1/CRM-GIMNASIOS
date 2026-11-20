import { useState, type FormEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Socio } from '../lib/types'
import { mensajeError } from '../lib/format'
import { reducirImagen } from '../lib/imagen'
import { Alerta, Avatar, Button, Campo, Modal, inputCls } from './ui'

interface Props {
  socio?: Socio | null
  onSaved: () => void
  onClose: () => void
}

type Errores = Partial<Record<'nombre' | 'dni' | 'telefono' | 'correo', string>>

export default function SocioForm({ socio, onSaved, onClose }: Props) {
  const [nombre, setNombre] = useState(socio?.nombre ?? '')
  const [dni, setDni] = useState(socio?.dni ?? '')
  const [telefono, setTelefono] = useState(socio?.telefono ?? '')
  const [correo, setCorreo] = useState(socio?.correo ?? '')
  const [estado, setEstado] = useState<'activo' | 'inactivo'>(socio?.estado ?? 'activo')
  const [fotoUrl, setFotoUrl] = useState<string | null>(socio?.foto_url ?? null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function validar(): Errores {
    const e: Errores = {}
    if (nombre.trim().length < 3) e.nombre = 'Ingresa el nombre completo (mínimo 3 letras).'
    if (!/^\d{8}$/.test(dni)) e.dni = 'El DNI debe tener exactamente 8 dígitos.'
    if (!/^9\d{8}$/.test(telefono)) e.telefono = 'El celular debe tener 9 dígitos y empezar con 9.'
    if (correo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) e.correo = 'Correo no válido.'
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
    try {
      let foto = fotoUrl
      if (archivo) {
        const blob = await reducirImagen(archivo)
        const ruta = `${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage.from('fotos-socios').upload(ruta, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        foto = supabase.storage.from('fotos-socios').getPublicUrl(ruta).data.publicUrl
      }
      const datos = { nombre: nombre.trim(), dni, telefono, correo: correo.trim() || null, foto_url: foto, estado }
      const { error: dbErr } = socio
        ? await supabase.from('socios').update(datos).eq('id', socio.id)
        : await supabase.from('socios').insert(datos)
      if (dbErr) throw dbErr
      onSaved()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
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
            <input className={inputCls} inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))} placeholder="12345678" />
          </Campo>
          <Campo label="Celular" error={errores.telefono}>
            <input className={inputCls} inputMode="numeric" maxLength={9} value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} placeholder="987654321" />
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {socio ? 'Guardar cambios' : 'Crear socio'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
