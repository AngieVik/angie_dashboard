import type { DrawingObjects, DrawingShape, Position } from '@/domain/document/types'
import type { InkPath } from './inkGeometry'
import { ellipseRing, groupVisible, screenPoints, type Projection } from './shapeGeometry'

export interface Box { left: number; top: number; right: number; bottom: number }
/** Gap, in screen pixels, at which a label still touches a figure or stroke. */
export const labelMargin = 8

// The line of a figure, closed when the figure is, in screen pixels.
function outline(shape: DrawingShape, projection: Projection): Position[] {
  const points = screenPoints(shape, projection)
  if (shape.radii) {
    const ring = ellipseRing(shape, projection)
    return [...ring, ring[0]!]
  }
  return shape.kind === 'line' || points.length < 2 ? points : [...points, points[0]!]
}
function boxDistance(box: Box, q: Position) {
  return Math.hypot(Math.max(box.left - q.x, 0, q.x - box.right), Math.max(box.top - q.y, 0, q.y - box.bottom))
}
// The point of a line nearest to the box, looked for from the box centre.
function nearest(line: Position[], box: Box) {
  const c = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
  let point = line[0], distance = point ? boxDistance(box, point) : Infinity
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!, dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    const q = { x: a.x + t * dx, y: a.y + t * dy }, d = boxDistance(box, q)
    if (d < distance) { point = q; distance = d }
  }
  return point && { point, distance }
}
function lines(objects: DrawingObjects, ink: InkPath[], projection: Projection) {
  return [...(objects.shapes ?? []).filter(s => groupVisible(objects, s.id)).map(s => ({ id: s.id, line: outline(s, projection) })),
    ...ink.map(path => ({ id: path.id, line: screenPoints(path, projection) }))]
}
/** The figure or stroke the box touches, nearest first. */
export function touchedOwner(box: Box, objects: DrawingObjects, ink: InkPath[], projection: Projection) {
  let best: { id: string; point: Position; distance: number } | null = null
  for (const { id, line } of lines(objects, ink, projection)) {
    const hit = nearest(line, box)
    if (hit && hit.distance <= labelMargin && (!best || hit.distance < best.distance)) best = { id, ...hit }
  }
  return best
}
/** How far the box must move to keep touching its owner, and where it touches. Null when the owner has no line here. */
export function keepTouching(owner: string, box: Box, objects: DrawingObjects, ink: InkPath[], projection: Projection) {
  const line = lines(objects, ink, projection).find(item => item.id === owner)?.line
  const hit = line && nearest(line, box)
  if (!hit) return null
  if (hit.distance <= labelMargin) return { shift: { x: 0, y: 0 }, point: hit.point }
  const q = hit.point, b = { x: Math.max(box.left, Math.min(box.right, q.x)), y: Math.max(box.top, Math.min(box.bottom, q.y)) }
  const k = (hit.distance - labelMargin) / hit.distance
  return { shift: { x: (q.x - b.x) * k, y: (q.y - b.y) * k }, point: q }
}
