import type { Map as LeafletMap } from 'leaflet'
import type { MapMarker } from '../../domain/document/types'
import type { LoadedGpx } from '../map/gpx'
import { getKilometerMarks } from '../map/gpxMetrics'
import { getPlanReportResourceBounds } from './planReport'
import type { PlanReportDrawing } from './planReport'

export type ReportMapFraming = 'content' | 'area' | 'current'
export interface ReportMapArea { x: number; y: number; width: number; height: number }
export interface ReportMapCrop { left: number; top: number; width: number; height: number }

export function getReportMapCrop(size: { x: number; y: number }, area?: ReportMapArea): ReportMapCrop {
  return area ? { left: area.x * size.x, top: area.y * size.y, width: area.width * size.x, height: area.height * size.y }
    : { left: 0, top: 0, width: size.x, height: size.y }
}

export function getReportMapContentFrame(context: CanvasRenderingContext2D, map: LeafletMap, markers: MapMarker[], files: LoadedGpx[], labels: boolean,
  plan?: PlanReportDrawing, area?: ReportMapArea) {
  const first = markers[0] ?? files[0]?.data.lines[0]?.[0] ?? files[0]?.data.waypoints[0] ?? plan?.resources[0]?.pin ?? plan?.strokes[0]?.points[0]
  if (!first) return null
  const project = (latitude: number, longitude: number) => map.project([latitude, longitude + 360 * Math.round((first.longitude - longitude) / 360)], 0)
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, radius = 0
  const boxes: { x: number; y: number; left: number; top: number; right: number; bottom: number }[] = []
  function include(x: number, y: number) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
  function anchor(latitude: number, longitude: number, padding: number) {
    const point = project(latitude, longitude); include(point.x, point.y); radius = Math.max(radius, padding)
    return point
  }
  function label(value: string, point: { x: number; y: number }, x: number, y: number) {
    if (!labels || !value) return
    const width = Math.min(240, context.measureText(value).width + 10)
    boxes.push({ ...point, left: x, top: y - 16, right: x + width, bottom: y + 4 })
  }
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif'
  context.save(); context.font = `12px ${fontFamily}`
  for (const marker of markers) {
    const point = anchor(marker.latitude, marker.longitude, 0)
    boxes.push({ ...point, left: -3, top: -31, right: 25, bottom: 3 })
    label(marker.name || 'Marcador', point, 24, -20)
  }
  for (const file of files) {
    for (const line of file.data.lines) for (const point of line) anchor(point.latitude, point.longitude, line.length === 1 ? 4 : 1.5)
    for (const point of file.data.waypoints) label(point.name ?? '', anchor(point.latitude, point.longitude, 5), 8, 0)
    const start = file.data.lines[0]?.[0]
    if (start) label(file.name, project(start.latitude, start.longitude), 8, -8)
    if (labels && file.kilometers) for (const mark of getKilometerMarks(file.data, file.kilometerInterval)) {
      label('PK ' + mark.kilometer.toLocaleString('es-ES'), project(mark.point.latitude, mark.point.longitude), 5, 0)
    }
  }
  if (plan) {
    for (const stroke of plan.strokes) for (const point of stroke.points) anchor(point.latitude, point.longitude, stroke.width / 2)
    for (const resource of plan.resources) {
      const factor = 2 ** 16
      const box = getPlanReportResourceBounds(context, map, resource, labels, plan.fontFamily, { zoom: 16, project(latitude, longitude) {
        const point = project(latitude, longitude)
        return { x: point.x * factor, y: point.y * factor }
      } })
      include(box.left / factor, box.top / factor); include(box.right / factor, box.bottom / factor)
    }
  }
  context.restore()
  if (!Number.isFinite(left)) return null
  const size = map.getSize(), crop = getReportMapCrop(size, area)
  const margin = Math.min(16, Math.min(crop.width, crop.height) * .05)
  function atZoom(zoom: number) {
    const factor = 2 ** zoom
    let x1 = left * factor - radius, y1 = top * factor - radius, x2 = right * factor + radius, y2 = bottom * factor + radius
    for (const box of boxes) {
      x1 = Math.min(x1, box.x * factor + box.left); y1 = Math.min(y1, box.y * factor + box.top)
      x2 = Math.max(x2, box.x * factor + box.right); y2 = Math.max(y2, box.y * factor + box.bottom)
    }
    return { left: x1, top: y1, right: x2, bottom: y2 }
  }
  const fits = (box: ReturnType<typeof atZoom>) => box.right - box.left <= crop.width - 2 * margin && box.bottom - box.top <= crop.height - 2 * margin
  let minimum = 0, maximum = 16
  for (let iteration = 0; iteration < 24; iteration++) {
    const middle = (minimum + maximum) / 2, box = atZoom(middle)
    if (fits(box)) minimum = middle
    else maximum = middle
  }
  const zoom = fits(atZoom(16)) ? 16 : Math.floor(minimum * 4) / 4, box = atZoom(zoom)
  const center = map.unproject([(box.left + box.right) / 2 - (crop.left + crop.width / 2 - size.x / 2),
    (box.top + box.bottom) / 2 - (crop.top + crop.height / 2 - size.y / 2)], zoom)
  return { center, zoom }
}
