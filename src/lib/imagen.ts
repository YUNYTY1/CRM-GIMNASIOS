/** Reduce una imagen a un máximo de 480 px y la devuelve como JPEG liviano. */
export async function reducirImagen(file: File, max = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')
  if (!c) throw new Error('No se pudo procesar la imagen')
  c.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82),
  )
}
