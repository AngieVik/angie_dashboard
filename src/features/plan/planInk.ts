import type { GeographicPosition, PlanStroke, Position } from '../../domain/document/types'
import type { Placed } from '../drawing/shapeGeometry'

const toPoint = (p: GeographicPosition): Position => ({ x: p.longitude, y: p.latitude })
const toGeographic = (p: Position): GeographicPosition => ({ longitude: p.x, latitude: p.y })
// Plan strokes in the drawing coordinates (x = longitude, y = latitude) and back.
export function planInk(stroke: PlanStroke): Placed {
  return stroke.anchor ? { anchor: toPoint(stroke.anchor), points: stroke.points } : { points: stroke.points.map(toPoint) }
}
export function fromPlanInk(stroke: PlanStroke, ink: Placed): PlanStroke {
  const style = { id: stroke.id, color: stroke.color, width: stroke.width }
  return ink.anchor ? { ...style, anchor: toGeographic(ink.anchor), points: ink.points } : { ...style, points: ink.points.map(toGeographic) }
}
