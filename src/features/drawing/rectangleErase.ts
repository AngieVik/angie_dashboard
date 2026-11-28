import type { DrawingObjects, DrawingShape, Position } from '@/domain/document/types'
import type { InkPath } from './inkGeometry'
import { groupVisible, screenPoints, shapeScale, type Projection } from './shapeGeometry'

interface Box { left: number; right: number; top: number; bottom: number }
export function eraserBox(a: Position, b: Position): Box {
  return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) }
}
function expand(b: Box, r: number): Box {
  return { left: b.left - r, right: b.right + r, top: b.top - r, bottom: b.bottom + r }
}
// Interval of the segment inside both slabs of the rectangle.
function interval(a: Position, b: Position, box: Box) {
  let enter = 0, exit = 1
  for (const [v, delta, low, high] of [[a.x, b.x - a.x, box.left, box.right], [a.y, b.y - a.y, box.top, box.bottom]] as const) {
    if (delta === 0) { if (v < low || v > high) return null; continue }
    const t = (low - v) / delta, u = (high - v) / delta
    enter = Math.max(enter, Math.min(t, u))
    exit = Math.min(exit, Math.max(t, u))
    if (enter > exit) return null
  }
  return { enter, exit }
}
function cut(points: Position[], box: Box) {
  const first = points[0]
  if (!first) return null
  if (points.length === 1) return interval(first, first, box) ? [] : null
  const parts: Position[][] = []
  let part: Position[] = [first], touched = false
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, hit = interval(a, b, box)
    if (!hit) { part.push(b); continue }
    touched = true
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    if (hit.enter > 0) part.push(at(hit.enter))
    if (part.length > 1) parts.push(part)
    part = hit.exit < 1 ? [at(hit.exit), b] : []
  }
  if (part.length > 1) parts.push(part)
  return touched ? parts : null
}
// With `contour`, only the line counts: a box fully inside a closed figure does not touch it.
function touches(shape: DrawingShape, box: Box, projection: Projection, contour = false) {
  const scale = shapeScale(shape, projection), bounds = expand(box, shape.width / 2)
  const pts = screenPoints(shape, projection), center = pts[0]
  if (!center) return false
  if (shape.radii) {
    const dx = Math.max(bounds.left - center.x, 0, center.x - bounds.right)
    const dy = Math.max(bounds.top - center.y, 0, center.y - bounds.bottom)
    if (Math.hypot(dx / (shape.radii.x * scale), dy / (shape.radii.y * scale)) > 1) return false
    const rx = shape.radii.x * scale - shape.width / 2, ry = shape.radii.y * scale - shape.width / 2
    return !contour || rx <= 0 || ry <= 0 || [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]]
      .some(([x, y]) => Math.hypot((x! - center.x) / rx, (y! - center.y) / ry) >= 1)
  }
  const closed = shape.kind !== 'line'
  let inside = false
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!
    if (interval(a, b, bounds)) return true
    if (closed && (a.y > box.top) !== (b.y > box.top) &&
      box.left < a.x + (box.top - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside
  }
  return inside && !contour
}
// Figures and strokes whose line touches the box.
export function rectangleHits(box: Box, paths: InkPath[], objects: DrawingObjects, projection: Projection) {
  return [...(objects.shapes ?? []).filter(s => groupVisible(objects, s.id) && touches(s, box, projection, true)).map(s => s.id),
    ...paths.filter(path => cut(screenPoints(path, projection), expand(box, path.width / 2))).map(path => path.id)]
}
