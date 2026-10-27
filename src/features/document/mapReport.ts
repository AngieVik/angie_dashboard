import type { Map as LeafletMap, TileLayer } from 'leaflet'
import type { MapMarker } from '../../domain/document/types'
import type { LoadedGpx } from '../map/gpx'
import { getKilometerMarks } from '../map/gpxMetrics'
import type { MapBackground } from '../map/mapBackgrounds'
import { drawPlanReportResources, drawPlanReportStrokes, getPlanReportResourceBounds } from './planReport'
import type { PlanReportDrawing, PlanReportRow } from './planReport'
import type { ReportMapCrop } from './reportMapFraming'
import { createReportLegendEntry, createResourceLegend, reportLineIntersects, reportRectIntersects } from './reportLegend'
import type { ReportLegendEntry } from './reportLegend'
import { ReportResourceError } from './reportIssues'
import type { ReportIssue, ReportRecovery } from './reportIssues'
import type { ReportMapProjection } from './reportMapProjection'
import { renderReportRaster } from './reportImages'
import { DEFAULT_REPORT_PAGE } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'

export interface MapReportContent {
  documentId: string
  image?: { dataUrl: string; background: MapBackground | null; pnoaInformation: boolean; legend: ReportLegendEntry[] }
  markers: Pick<MapMarker, 'name' | 'latitude' | 'longitude'>[]
  gpx: { name: string; distance: string; points: string; availability: string }[]
  resources?: PlanReportRow[]
  issues?: ReportIssue[]
  recovery?: ReportRecovery<MapReportContent>
  omittedImage?: boolean
  omittedSection?: boolean
}

export interface ReportMapHandle { capture: (page?: ReportPageOptions) => MapReportContent }

function drawMarker(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.beginPath(); context.moveTo(x, y); context.lineTo(x, y - 28)
  context.strokeStyle = '#181818'; context.lineWidth = 5; context.stroke()
  context.strokeStyle = '#F2F2F2'; context.lineWidth = 3; context.stroke()
  context.beginPath(); context.moveTo(x + 1, y - 27); context.lineTo(x + 19, y - 27)
  context.lineTo(x + 14, y - 20); context.lineTo(x + 19, y - 13); context.lineTo(x + 1, y - 13); context.closePath()
  context.fillStyle = color; context.fill()
  context.strokeStyle = '#181818'; context.lineWidth = 1.5; context.stroke()
}

// The framing view and the saved image use the same drawing instructions.
export function drawReportMap(context: CanvasRenderingContext2D, map: ReportMapProjection, markers: MapMarker[], files: LoadedGpx[], labels: boolean, plan?: PlanReportDrawing) {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif'
  const size = map.getSize()
  const centerLongitude = map.getCenter().lng
  const project = (latitude: number, longitude: number) => {
    const wrapped = longitude + 360 * Math.round((centerLongitude - longitude) / 360)
    return map.latLngToContainerPoint([latitude, wrapped])
  }
  function label(value: string, x: number, y: number, color: string) {
    if (!labels || !value || x < -200 || y < -30 || x > size.x + 200 || y > size.y + 30) return
    context.font = `12px ${fontFamily}`
    const width = Math.min(240, context.measureText(value).width + 10)
    context.fillStyle = '#FFFFFF'
    context.fillRect(x, y - 16, width, 20)
    context.strokeStyle = color; context.lineWidth = 1
    context.strokeRect(x, y - 16, width, 20)
    context.fillStyle = '#181818'
    context.fillText(value, x + 5, y - 2, width - 10)
  }
  function dot(latitude: number, longitude: number, color: string, radius: number) {
    const point = project(latitude, longitude)
    context.beginPath(); context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fillStyle = color; context.fill()
    return point
  }
  context.save()
  context.lineCap = 'round'; context.lineJoin = 'round'
  for (const file of files) {
    context.strokeStyle = file.color; context.lineWidth = 3
    for (const line of file.data.lines) {
      context.beginPath()
      for (let index = 0; index < line.length; index++) {
        const point = project(line[index]!.latitude, line[index]!.longitude)
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      }
      context.stroke()
      if (line.length === 1) dot(line[0]!.latitude, line[0]!.longitude, file.color, 4)
    }
    for (const point of file.data.waypoints) {
      const position = dot(point.latitude, point.longitude, file.color, 5)
      label(point.name ?? '', position.x + 8, position.y, file.color)
    }
    const first = file.data.lines[0]?.[0]
    if (first) {
      const point = project(first.latitude, first.longitude)
      label(file.name, point.x + 8, point.y - 8, file.color)
    }
    if (labels && file.kilometers) for (const mark of getKilometerMarks(file.data, Math.max(file.kilometerInterval, 2 ** (13 - map.getZoom())))) {
      const point = project(mark.point.latitude, mark.point.longitude)
      label('PK ' + mark.kilometer.toLocaleString('es-ES'), point.x + 5, point.y, file.color)
    }
  }
  if (plan) drawPlanReportStrokes(context, map, plan.strokes)
  for (const marker of markers) {
    const point = project(marker.latitude, marker.longitude)
    const x = point.x, y = point.y
    if (x < -40 || y < -40 || x > size.x + 40 || y > size.y + 40) continue
    drawMarker(context, x, y, marker.color)
    label(marker.name || 'Marcador', x + 24, y - 20, marker.color)
  }
  if (plan) drawPlanReportResources(context, map, plan, labels)
  context.restore()
}

export function drawReportMapScale(context: CanvasRenderingContext2D, map: ReportMapProjection, crop?: ReportMapCrop) {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif'
  const size = map.getSize(), area = crop ?? { left: 0, top: 0, width: size.x, height: size.y }
  const factor = Math.min(1, area.width / 140, area.height / 40)
  if (factor <= 0) throw new Error('No se pudo calcular la escala del informe.')
  const maximum = 100 * factor, x = area.left + area.width / 2, y = area.top + area.height / 2
  const distance = (width: number) => map.distance(map.containerPointToLatLng([x - width / 2, y]), map.containerPointToLatLng([x + width / 2, y]))
  const meters = distance(maximum)
  if (!Number.isFinite(meters) || meters <= 0) throw new Error('No se pudo calcular la escala del informe.')
  const power = 10 ** Math.floor(Math.log10(meters)), value = meters / power
  const rounded = (value >= 5 ? 5 : value >= 2 ? 2 : 1) * power
  let low = 0, high = maximum
  for (let iteration = 0; iteration < 24; iteration++) {
    const middle = (low + high) / 2
    if (distance(middle) < rounded) low = middle
    else high = middle
  }
  const width = (low + high) / 2 / factor
  const label = (rounded < 1000 ? rounded : rounded / 1000).toLocaleString('es-ES', { maximumSignificantDigits: 3 }) + (rounded < 1000 ? ' m' : ' km')
  context.save()
  context.translate(area.left + 6 * factor, area.top + area.height - 34 * factor); context.scale(factor, factor)
  context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, 116, 30)
  context.fillStyle = context.strokeStyle = '#181818'; context.lineWidth = 1.5
  context.font = `11px ${fontFamily}`; context.textBaseline = 'top'
  context.textAlign = 'left'; context.fillText('0', 6, 3)
  context.textAlign = 'right'; context.fillText(label, 6 + width, 3)
  context.beginPath(); context.moveTo(6, 19); context.lineTo(6, 25); context.lineTo(6 + width, 25); context.lineTo(6 + width, 19); context.stroke()
  context.restore()
}

export function createMapReportLegend(map: ReportMapProjection, markers: MapMarker[], files: LoadedGpx[], labels: boolean, plan: PlanReportDrawing | undefined, area: ReportMapCrop, quality: ReportPageOptions['quality'] = 'normal'): ReportLegendEntry[] {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif'
  const project = (latitude: number, longitude: number) => map.latLngToContainerPoint([latitude, longitude + 360 * Math.round((map.getCenter().lng - longitude) / 360)])
  const entries: ReportLegendEntry[] = []
  const entry = (label: string, draw: (context: CanvasRenderingContext2D) => void) => createReportLegendEntry(label, draw, quality)
  for (const marker of markers) {
    const point = project(marker.latitude, marker.longitude)
    if (reportRectIntersects(area, { left: point.x - 3, right: point.x + 20, top: point.y - 31, bottom: point.y + 3 })) {
      entries.push(entry(marker.name || 'Marcador', context => drawMarker(context, 24, 35, marker.color)))
    }
  }
  for (const file of files) {
    if (file.data.lines.some(line => line.length > 1 && reportLineIntersects(line.map(point => project(point.latitude, point.longitude)), area, 1.5))) {
      entries.push(entry(file.name, context => {
        context.strokeStyle = context.fillStyle = file.color; context.lineWidth = 3
        context.beginPath(); context.moveTo(6, 28); context.lineTo(28, 12); context.lineTo(58, 22); context.stroke()
      }))
    }
    if (file.data.waypoints.some(point => reportLineIntersects([project(point.latitude, point.longitude)], area, 5)) ||
      file.data.lines.some(line => line.length === 1 && reportLineIntersects([project(line[0]!.latitude, line[0]!.longitude)], area, 4))) {
      entries.push(entry('Puntos GPX · ' + file.name, context => {
        context.fillStyle = file.color; context.beginPath(); context.arc(32, 20, 5, 0, Math.PI * 2); context.fill()
      }))
    }
    if (labels && file.kilometers) {
      const canvas = document.createElement('canvas'), metrics = canvas.getContext('2d')
      if (!metrics) throw new Error('No se pudo crear la leyenda de los PK.')
      try {
        metrics.font = `12px ${fontFamily}`
        if (getKilometerMarks(file.data, Math.max(file.kilometerInterval, 2 ** (13 - map.getZoom()))).some(mark => {
          const point = project(mark.point.latitude, mark.point.longitude)
          const width = Math.min(240, metrics.measureText('PK ' + mark.kilometer.toLocaleString('es-ES')).width + 10)
          return point.x + 5 >= -200 && point.y >= -30 && point.x + 5 <= map.getSize().x + 200 && point.y <= map.getSize().y + 30 &&
            reportRectIntersects(area, { left: point.x + 5, right: point.x + 5 + width, top: point.y - 16, bottom: point.y + 4 })
        })) entries.push(entry('PK · ' + file.name, context => {
          context.strokeStyle = file.color; context.strokeRect(10, 10, 44, 20)
          context.fillStyle = '#181818'; context.font = `12px ${fontFamily}`; context.fillText('PK', 23, 24)
        }))
      } finally { canvas.width = canvas.height = 0 }
    }
  }
  if (plan) {
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo crear la leyenda del plano.')
    try {
      const represented = plan.resources.filter(resource => reportRectIntersects(area, getPlanReportResourceBounds(context, map, resource, false, plan.fontFamily)))
      entries.push(...createResourceLegend(represented.map(resource => resource.element), plan.images, plan.fontFamily, quality))
    } finally { canvas.width = canvas.height = 0 }
    const styles = new Set<string>()
    for (const stroke of plan.strokes) {
      const key = stroke.color + ':' + stroke.width
      if (styles.has(key) || stroke.points.length < 2 || !reportLineIntersects(stroke.points.map(point => project(point.latitude, point.longitude)), area, stroke.width / 2)) continue
      styles.add(key)
      entries.push(entry('Trazos', context => {
        context.strokeStyle = stroke.color; context.lineWidth = Math.min(20, stroke.width)
        context.beginPath(); context.moveTo(6, 28); context.lineTo(28, 12); context.lineTo(58, 22); context.stroke()
      }))
    }
  }
  return entries
}

export function coversReportArea(rectangles: ReportMapCrop[], area: ReportMapCrop) {
  if (!rectangles.length) return false
  const right = area.left + area.width, bottom = area.top + area.height
  const edges = [...new Set([area.left, right, ...rectangles.flatMap(rect => [Math.max(area.left, rect.left), Math.min(right, rect.left + rect.width)])])].sort((a, b) => a - b)
  for (let index = 1; index < edges.length; index++) {
    const left = edges[index - 1]!, end = edges[index]!
    if (end - left <= .01) continue
    const middle = (left + end) / 2
    const intervals = rectangles.filter(rect => rect.left <= middle && rect.left + rect.width >= middle).sort((a, b) => a.top - b.top)
    let covered = area.top
    for (const rect of intervals) {
      if (rect.top > covered + .01) break
      covered = Math.max(covered, rect.top + rect.height)
    }
    if (covered < bottom - .01) return false
  }
  return edges.length > 1
}

export function captureReportMap(map: LeafletMap, layers: TileLayer[], markers: MapMarker[], files: LoadedGpx[], labels: boolean, plan?: PlanReportDrawing, crop?: ReportMapCrop, background = true, page: ReportPageOptions = DEFAULT_REPORT_PAGE): string {
  const size = map.getSize(), bounds = map.getContainer().getBoundingClientRect()
  if (!size.x || !size.y || !bounds.width || !bounds.height) throw new Error('El visor del informe no está visible.')
  const area = crop ?? { left: 0, top: 0, width: size.x, height: size.y }
  if (area.width <= 0 || area.height <= 0) throw new Error('El área del informe no es válida.')
  try {
    return renderReportRaster(area.width, area.height, page, 1, ([context], encode) => {
      if (!context) throw new Error('No se pudo crear la imagen del mapa.')
      context.translate(-area.left, -area.top)
      context.fillStyle = '#FFFFFF'; context.fillRect(area.left, area.top, area.width, area.height)
      for (const [index, layer] of (background ? layers : []).entries()) {
        const resource = { kind: 'background' as const, resourceId: index === 0 ? 'background' : 'pnoaInformation', label: index === 0 ? 'Fondo cartográfico' : 'Callejero IGN' }
        const rectangles: ReportMapCrop[] = []
        for (const tile of layer.getContainer()?.querySelectorAll<HTMLImageElement>('img.leaflet-tile') ?? []) {
          const rect = tile.getBoundingClientRect()
          const left = (rect.left - bounds.left) * size.x / bounds.width, top = (rect.top - bounds.top) * size.y / bounds.height
          const width = rect.width * size.x / bounds.width, height = rect.height * size.y / bounds.height
          if (!width || !height || left + width <= area.left || left >= area.left + area.width || top + height <= area.top || top >= area.top + area.height) continue
          if (!tile.complete || !tile.naturalWidth || !tile.classList.contains('leaflet-tile-loaded')) {
            throw new ReportResourceError('Cartografía incompleta o no disponible.', resource)
          }
          context.drawImage(tile, left, top, width, height)
          rectangles.push({ left, top, width, height })
        }
        if (!coversReportArea(rectangles, area)) throw new ReportResourceError('Cartografía incompleta o no disponible.', resource)
      }
      if (background && !layers.length) throw new ReportResourceError('Cartografía no disponible.', { kind: 'background', resourceId: 'background', label: 'Fondo cartográfico' })
      drawReportMap(context, map, markers, files, labels, plan)
      drawReportMapScale(context, map, area)
      return encode()
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new ReportResourceError('El fondo no permite exportar sus imágenes.', { kind: 'background', resourceId: 'background', label: 'Fondo cartográfico' })
    }
    throw error
  }
}
