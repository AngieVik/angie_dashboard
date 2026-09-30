import type { BoardImageResult } from './boardTypes'

export async function loadBoardImage(file: File): Promise<BoardImageResult> {
  if (file.size > 50 * 1024 * 1024) return { success: false, message: 'La imagen supera el límite de 50 MiB.' }
  if (!['image/png', 'image/jpeg'].includes(file.type)) return { success: false, message: 'Selecciona una imagen JPG o PNG.' }
  let source: ImageBitmap | undefined
  try {
    source = await createImageBitmap(file)
    if (source.width <= 0 || source.height <= 0) throw new Error('Dimensiones inválidas')
    let image = source
    const longest = Math.max(source.width, source.height)
    if (longest > 4096) {
      image = await createImageBitmap(source, {
        resizeWidth: Math.max(1, Math.round(source.width * 4096 / longest)),
        resizeHeight: Math.max(1, Math.round(source.height * 4096 / longest)),
        resizeQuality: 'high',
      })
      source.close()
    }
    source = undefined
    let disposed = false
    return { success: true, image, width: image.width, height: image.height,
      dispose() { if (!disposed) { disposed = true; image.close() } },
    }
  } catch {
    source?.close()
    return { success: false, message: 'No se pudo decodificar o procesar la imagen. Se conserva el fondo anterior.' }
  }
}
