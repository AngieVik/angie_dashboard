import type { BoardImageResult } from './boardTypes'
import { checkFileBytes, checkImageDimensions, InputBudgetError } from '../../domain/input/inputBudgets'
import { readImageDimensions } from './imageDimensions'

export async function loadBoardImage(file: File): Promise<BoardImageResult> {
  try { checkFileBytes(file.size, 'image') }
  catch (error) { return { success: false, message: (error as Error).message } }
  if (!['image/png', 'image/jpeg'].includes(file.type)) return { success: false, message: 'Selecciona una imagen JPG o PNG.' }
  try {
    const { width, height } = await readImageDimensions(file)
    checkImageDimensions(width, height)
  } catch (error) {
    return { success: false, message: error instanceof InputBudgetError ? error.message
      : 'No se pudieron comprobar las dimensiones de la imagen. Se conserva el fondo anterior.' }
  }
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
