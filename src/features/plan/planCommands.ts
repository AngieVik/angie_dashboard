import type { AngieDocument, GeographicPosition, PlanStroke } from '../../domain/document/types'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'

function position(point: GeographicPosition): GeographicPosition {
  if (![point.latitude, point.longitude].every(Number.isFinite) || Math.abs(point.latitude) > MAX_MAP_LATITUDE || Math.abs(point.longitude) > 180) {
    throw new Error('La ubicación queda fuera de los límites del mapa.')
  }
  return { latitude: point.latitude, longitude: point.longitude }
}

export function placePlanPin(document: AngieDocument, elementId: string, point: GeographicPosition) {
  const element = document.elements.find(element => element.id.toLowerCase() === elementId.toLowerCase())
  if (!element) throw new Error('El recurso ya no existe.')
  const location = position(point)
  const plan = document.plan ??= { pins: [], strokes: [] }
  const pin = plan.pins.find(pin => pin.elementId.toLowerCase() === element.id.toLowerCase())
  if (pin) Object.assign(pin, location, { visible: true })
  else plan.pins.push({ elementId: element.id, ...location, visible: true })
}

export function removePlanPin(document: AngieDocument, elementId: string) {
  if (document.plan) document.plan.pins = document.plan.pins.filter(pin => pin.elementId.toLowerCase() !== elementId.toLowerCase())
}

export function togglePlanPin(document: AngieDocument, elementId: string) {
  const pin = document.plan?.pins.find(pin => pin.elementId.toLowerCase() === elementId.toLowerCase())
  if (pin) pin.visible = !pin.visible
}

export function addPlanStroke(document: AngieDocument, stroke: PlanStroke) {
  if (!/^#[0-9A-F]{6}$/.test(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 40 || stroke.points.length < 2 || stroke.points.length > 50000) {
    throw new Error('El trazo no tiene un color, grosor o número de puntos válido.')
  }
  const points = stroke.points.map(position)
  const plan = document.plan ??= { pins: [], strokes: [] }
  plan.strokes.push({ ...stroke, points })
}

export function removePlanStroke(document: AngieDocument, id: string) {
  if (document.plan) document.plan.strokes = document.plan.strokes.filter(stroke => stroke.id !== id)
}
