export function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la imagen.'))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onabort = () => reject(new Error('Lectura de imagen cancelada.'))
    reader.readAsDataURL(file)
  })
}
export function embeddedImageFile(dataUrl: string): File {
  const separator = dataUrl.indexOf(',')
  const type = dataUrl.slice(5, dataUrl.indexOf(';'))
  const binary = atob(dataUrl.slice(separator + 1))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new File([bytes], type === 'image/png' ? 'fondo.png' : 'fondo.jpg', { type })
}
export async function validateEmbeddedImage(dataUrl: string): Promise<void> {
  const bitmap = await createImageBitmap(embeddedImageFile(dataUrl))
  try { if (bitmap.width <= 0 || bitmap.height <= 0) throw new Error('La imagen del documento tiene dimensiones inválidas.') }
  finally { bitmap.close() }
}
