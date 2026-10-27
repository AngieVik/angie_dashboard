import type { ReportMapProjection } from './reportMapProjection'
import type { AssetId, DocumentElement, PlanPin, PlanStroke } from '../../domain/document/types'
import { getPinBox } from '../elements/iconCatalog'
import { getPinAnchorPoint, getPinNameLayout, getRotatedPinBox, pinNameLines, PIN_BASE_SCALE, PIN_REFERENCE_ZOOM, PIN_NAME_COLORS } from '../elements/pinPresentation'

export interface PlanReportResource { element: DocumentElement; pin: PlanPin }
export interface PlanReportDrawing {
  resources: PlanReportResource[]
  strokes: PlanStroke[]
  images: Map<AssetId, HTMLImageElement>
  fontFamily: string
}
export type PlanReportRow = { name: string; type: string; information: string; latitude: string; longitude: string }

function project(map: ReportMapProjection, latitude: number, longitude: number) {
  return map.latLngToContainerPoint([latitude, longitude + 360 * Math.round((map.getCenter().lng - longitude) / 360)])
}

export function getPlanReportResourceBounds(context: CanvasRenderingContext2D, map: ReportMapProjection, resource: PlanReportResource, labels: boolean, fontFamily: string,
  projection?: { zoom: number; project: (latitude: number, longitude: number) => { x: number; y: number } }) {
  const { element, pin } = resource
  const box = getPinBox(element.visual), rotated = getRotatedPinBox(element.visual)
  const anchor = getPinAnchorPoint(element.visual, element.pinAnchor)
  const factor = PIN_BASE_SCALE * map.getZoomScale(projection?.zoom ?? map.getZoom(), PIN_REFERENCE_ZOOM)
  const point = projection ? projection.project(pin.latitude, pin.longitude) : project(map, pin.latitude, pin.longitude)
  const center = { x: point.x + (box.width / 2 - anchor.x) * factor, y: point.y + (box.height / 2 - anchor.y) * factor }
  let left = center.x - rotated.width * factor / 2, right = center.x + rotated.width * factor / 2
  let top = center.y - rotated.height * factor / 2, bottom = center.y + rotated.height * factor / 2
  const lines = pinNameLines(element.name), fontSize = (element.nameFontSize ?? 16) * factor
  let name: { x: number; y: number; width: number; height: number } | null = null
  if (labels && !element.nameHidden) {
    context.save(); context.font = `${fontSize}px ${fontFamily}`
    const width = Math.max(...lines.map(line => context.measureText(line).width)) + 8 * element.visual.scale * factor
    context.restore()
    const height = fontSize * 1.25 * lines.length + 2 * element.visual.scale * factor
    const offset = getPinNameLayout(element).offset
    name = { x: center.x + offset.x * factor - width / 2, y: center.y + offset.y * factor - height / 2, width, height }
    left = Math.min(left, name.x); right = Math.max(right, name.x + name.width)
    top = Math.min(top, name.y); bottom = Math.max(bottom, name.y + name.height)
  }
  return { left, right, top, bottom, center, factor, box, name, lines, fontSize }
}

export function drawPlanReportStrokes(context: CanvasRenderingContext2D, map: ReportMapProjection, strokes: PlanStroke[]) {
  context.save(); context.lineCap = 'round'; context.lineJoin = 'round'
  for (const stroke of strokes) {
    context.beginPath(); context.strokeStyle = stroke.color; context.lineWidth = stroke.width
    for (let index = 0; index < stroke.points.length; index++) {
      const point = project(map, stroke.points[index]!.latitude, stroke.points[index]!.longitude)
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    }
    context.stroke()
  }
  context.restore()
}

export function drawPlanReportResources(context: CanvasRenderingContext2D, map: ReportMapProjection, plan: PlanReportDrawing, labels: boolean) {
  const size = map.getSize()
  // Leaflet orders pins by their vertical position; keep the same order in the image.
  const resources = [...plan.resources].sort((a, b) => project(map, a.pin.latitude, a.pin.longitude).y - project(map, b.pin.latitude, b.pin.longitude).y)
  for (const resource of resources) {
    const { element } = resource
    const bounds = getPlanReportResourceBounds(context, map, resource, labels, plan.fontFamily)
    if (bounds.right <= 0 || bounds.bottom <= 0 || bounds.left >= size.x || bounds.top >= size.y) continue
    const { center, factor, box, name, lines, fontSize } = bounds
    context.save()
    context.translate(center.x, center.y)
    context.rotate((element.visual.rotation ?? 0) * Math.PI / 180)
    context.scale((element.visual.flipX ? -1 : 1) * factor, (element.visual.flipY ? -1 : 1) * factor)
    if (element.visual.type === 'asset') {
      const image = plan.images.get(element.visual.assetId)
      if (image?.complete && image.naturalWidth) {
        const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale
        context.drawImage(image, -width / 2, -height / 2, width, height)
      }
    } else {
      context.font = `${48 * element.visual.scale}px ${plan.fontFamily}`
      context.textAlign = 'center'; context.textBaseline = 'middle'
      context.fillStyle = '#181818'; context.fillText(element.visual.value, 0, 0)
    }
    context.restore()
    if (name) {
      const theme = PIN_NAME_COLORS[element.nameColor ?? 'dark']
      context.save()
      context.fillStyle = theme.backgroundColor
      context.beginPath(); context.roundRect(name.x, name.y, name.width, name.height, 2 * factor); context.fill()
      context.font = `${fontSize}px ${plan.fontFamily}`; context.fillStyle = theme.color
      context.textAlign = 'center'; context.textBaseline = 'middle'
      const padding = element.visual.scale * factor
      lines.forEach((line, index) => context.fillText(line, name.x + name.width / 2, name.y + padding + fontSize * 1.25 * (index + .5)))
      context.restore()
    }
  }
}
