import { REPORT_PAGE_MARGIN_MM, reportPageDimensions } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'

class ReportRasterLimitError extends Error {}

export function renderReportRaster<T>(width: number, height: number, page: ReportPageOptions | undefined, buffers: number,
  draw: (contexts: CanvasRenderingContext2D[], encode: () => string) => T): T {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('El área del informe no es válida.')
  const paper = page ? reportPageDimensions(page) : undefined
  const dpi = page?.quality === 'high' ? 300 : 150
  // The image cannot exceed the printable page; headings and legends may reduce it further.
  const target = paper ? Math.min((paper.width - 2 * REPORT_PAGE_MARGIN_MM) * dpi / 25.4 / width, (paper.height - 2 * REPORT_PAGE_MARGIN_MM) * dpi / 25.4 / height) : 2
  const memory = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  // Bound simultaneous RGBA surfaces, including Pizarra's separate ink layer.
  const pixelBudget = memory && memory <= 1 ? 4_000_000 : memory && memory <= 2 ? 8_000_000 : 16_000_000
  const ratio = Math.min(target, 4096 / Math.max(width, height), Math.sqrt(Math.min(8_000_000, pixelBudget / buffers) / width / height))
  for (let reduction = 1; reduction >= .125; reduction /= 2) {
    const canvases: HTMLCanvasElement[] = []
    try {
      const contexts: CanvasRenderingContext2D[] = []
      for (let index = 0; index < buffers; index++) {
        const canvas = document.createElement('canvas'); canvases.push(canvas)
        try {
          canvas.width = Math.max(1, Math.floor(width * ratio * reduction)); canvas.height = Math.max(1, Math.floor(height * ratio * reduction))
          const context = canvas.getContext('2d')
          if (!context) throw new ReportRasterLimitError()
          context.fillRect(canvas.width - 1, canvas.height - 1, 1, 1)
          if (context.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data[3] !== 255) throw new ReportRasterLimitError()
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.scale(canvas.width / width, canvas.height / height)
          contexts.push(context)
        } catch { throw new ReportRasterLimitError() }
      }
      return draw(contexts, () => {
        let pixels: string
        try { pixels = canvases[0]!.toDataURL('image/png') }
        catch (error) {
          if (error instanceof DOMException && error.name === 'SecurityError') throw error
          throw new ReportRasterLimitError()
        }
        if (!pixels.startsWith('data:image/png;base64,')) throw new ReportRasterLimitError()
        return pixels
      })
    } catch (error) { if (!(error instanceof ReportRasterLimitError)) throw error }
    finally { for (const canvas of canvases) canvas.width = canvas.height = 0 }
  }
  throw new Error('No se pudo crear la imagen con los límites del dispositivo.')
}

export function freezeReportImage(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  try {
    const context = canvas.getContext('2d')
    if (!context || !canvas.width || !canvas.height) throw new Error('Imagen no disponible.')
    context.drawImage(image, 0, 0)
    const pixels = canvas.toDataURL('image/png')
    if (!pixels.startsWith('data:image/png;base64,')) throw new Error('Imagen no disponible.')
    return pixels
  } finally { canvas.width = canvas.height = 0 }
}

export function loadReportImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const timeout = setTimeout(() => finish(new Error('Imagen no disponible.')), 30_000)
    function finish(error?: Error) {
      if (settled) return
      settled = true
      clearTimeout(timeout); image.onload = null; image.onerror = null
      if (error) { image.removeAttribute('src'); reject(error) } else resolve(image)
    }
    image.crossOrigin = 'anonymous'
    image.onload = () => finish(image.naturalWidth ? undefined : new Error('Imagen no disponible.'))
    image.onerror = () => finish(new Error('Imagen no disponible.'))
    image.src = source
  })
}
