import type { AssetId, DocumentElement } from '../../domain/document/types'
import { getPinBox } from '../elements/iconCatalog'
import { getRotatedPinBox } from '../elements/pinPresentation'
import type { ReportMapCrop } from './reportMapFraming'
import type { ReportPageOptions } from './reportPagination'

export interface ReportLegendEntry { label: string; image: string }

export function createReportLegendEntry(label: string, draw: (context: CanvasRenderingContext2D) => void, quality: ReportPageOptions['quality'] = 'normal'): ReportLegendEntry {
  const canvas = document.createElement('canvas')
  const dpi = quality === 'high' ? 300 : 150
  canvas.width = Math.ceil(48 * dpi / 96); canvas.height = Math.ceil(30 * dpi / 96)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear la leyenda del informe.')
  try {
    context.scale(canvas.width / 64, canvas.height / 40)
    context.lineCap = 'round'; context.lineJoin = 'round'
    context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, 64, 40)
    draw(context)
    const image = canvas.toDataURL('image/png')
    if (!image.startsWith('data:image/png;base64,')) throw new Error('No se pudo crear la leyenda del informe.')
    return { label, image }
  } finally { canvas.width = canvas.height = 0 }
}

export function createResourceLegend(elements: DocumentElement[], images: Map<AssetId, HTMLImageElement>, fontFamily: string, quality: ReportPageOptions['quality'] = 'normal'): ReportLegendEntry[] {
  const groups = new Map<string, { element: DocumentElement; names: Set<string> }>()
  for (const element of elements) {
    const visual = element.visual
    const key = JSON.stringify([visual.type, visual.type === 'asset' ? visual.assetId : visual.value, visual.rotation ?? 0, Boolean(visual.flipX), Boolean(visual.flipY)])
    const group = groups.get(key)
    if (group) group.names.add(element.name)
    else groups.set(key, { element, names: new Set([element.name]) })
  }
  return [...groups.values()].map(({ element, names }) => createReportLegendEntry([...names].join(', '), context => {
    const visual = element.visual, box = getPinBox(visual), rotated = getRotatedPinBox(visual)
    const factor = Math.min(56 / rotated.width, 32 / rotated.height)
    context.translate(32, 20); context.rotate((visual.rotation ?? 0) * Math.PI / 180)
    context.scale((visual.flipX ? -1 : 1) * factor, (visual.flipY ? -1 : 1) * factor)
    if (visual.type === 'asset') {
      const image = images.get(visual.assetId)
      if (!image?.naturalWidth) throw new Error('El icono de ' + element.name + ' no está disponible para la leyenda.')
      const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale
      context.drawImage(image, -width / 2, -height / 2, width, height)
    } else {
      context.font = `${48 * visual.scale}px ${fontFamily}`
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#181818'
      context.fillText(visual.value, 0, 0)
    }
  }, quality))
}

export function reportRectIntersects(area: ReportMapCrop, box: { left: number; top: number; right: number; bottom: number }) {
  return box.right > area.left && box.bottom > area.top && box.left < area.left + area.width && box.top < area.top + area.height
}

export function reportLineIntersects(points: { x: number; y: number }[], area: ReportMapCrop, padding = 0) {
  const left = area.left - padding, right = area.left + area.width + padding
  const top = area.top - padding, bottom = area.top + area.height + padding
  if (points.length === 1) {
    const point = points[0]!
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
  }
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!
    const dx = b.x - a.x, dy = b.y - a.y
    let start = 0, end = 1
    const edges: [number, number][] = [[-dx, a.x - left], [dx, right - a.x], [-dy, a.y - top], [dy, bottom - a.y]]
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) { end = -1; break }
        continue
      }
      const ratio = q / p
      if (p < 0) start = Math.max(start, ratio)
      else end = Math.min(end, ratio)
      if (start > end) break
    }
    if (start <= end) return true
  }
  return false
}
