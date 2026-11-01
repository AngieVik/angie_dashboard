import type { AngieDocument, GeographicPosition, PlanStroke } from '../../domain/document/types'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'
import { INPUT_BUDGETS, budgetIssue, InputBudgetError } from '../../domain/input/inputBudgets'
import { commandResult } from '../../domain/document/documentCommand'

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
  const plan = document.plan ?? { pins: [], strokes: [] }
  const pin = plan.pins.find(pin => pin.elementId.toLowerCase() === element.id.toLowerCase())
  if (pin?.visible && pin.latitude === location.latitude && pin.longitude === location.longitude) return commandResult(document, document)
  const nextPin = { elementId: element.id, ...location, visible: true }
  return commandResult(document, { ...document, plan: { ...plan, pins: pin ? plan.pins.map(item => item === pin ? nextPin : item) : [...plan.pins, nextPin] } })
}

export function removePlanPin(document: AngieDocument, elementId: string) {
  const plan = document.plan
  const pins = plan?.pins.filter(pin => pin.elementId.toLowerCase() !== elementId.toLowerCase())
  return commandResult(document, plan && pins && pins.length !== plan.pins.length ? { ...document, plan: { ...plan, pins } } : document)
}

export function togglePlanPin(document: AngieDocument, elementId: string) {
  const pin = document.plan?.pins.find(pin => pin.elementId.toLowerCase() === elementId.toLowerCase())
  return commandResult(document, pin ? { ...document, plan: { ...document.plan!, pins: document.plan!.pins.map(item => item === pin ? { ...pin, visible: !pin.visible } : item) } } : document)
}

export function addPlanStroke(document: AngieDocument, stroke: PlanStroke) {
  if (stroke.points.length > INPUT_BUDGETS.strokePoints) throw new InputBudgetError(budgetIssue(`plan.strokes[${document.plan?.strokes.length ?? 0}].points`, INPUT_BUDGETS.strokePoints, 'puntos'))
  if (!/^#[0-9A-F]{6}$/.test(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 40 || stroke.points.length < 2) {
    throw new Error('El trazo no tiene un color, grosor o número de puntos válido.')
  }
  const points = stroke.points.map(position)
  const plan = document.plan ?? { pins: [], strokes: [] }
  return commandResult(document, { ...document, plan: { ...plan, strokes: [...plan.strokes, { ...stroke, points }] } })
}

export function removePlanStroke(document: AngieDocument, id: string) {
  const plan = document.plan
  const strokes = plan?.strokes.filter(stroke => stroke.id !== id)
  return commandResult(document, plan && strokes && strokes.length !== plan.strokes.length ? { ...document, plan: { ...plan, strokes } } : document)
}

export function clearPlanStrokes(document: AngieDocument) {
  const plan = document.plan
  return commandResult(document, plan?.strokes.length ? { ...document, plan: { ...plan, strokes: [] } } : document)
}
