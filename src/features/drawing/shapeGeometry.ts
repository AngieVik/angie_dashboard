import type { DrawingShape, DrawingObjects, Position } from '@/domain/document/types'

export interface Projection {
  screen: (p: Position) => Position
  world: (p: Position) => Position
  pixelsPerUnit: (at: Position) => number
}
export const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y)
export const offset = (p: Position, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy })
/** Opacity of the old version of what is being moved, turned or edited (as .ghost in drawing.module.css). */
export const ghostOpacity = .35
export const midpoint = (a: Position, b: Position) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const corners = (a: Position, b: Position) => [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
export function squareEnd(start: Position, end: Position) {
  const side = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return offset(start, side * Math.sign(end.x - start.x || 1), side * Math.sign(end.y - start.y || 1))
}
export function shapeScale(shape: DrawingShape, projection: Projection) {
  return shape.unit === 'screen' ? 1 : projection.pixelsPerUnit(shape.points[0]!)
}
// Screen-pixel lines and strokes keep an anchor in the world (the centre of their box)
// and their points as pixel offsets, so they keep their size when zooming.
export interface Placed { points: Position[]; anchor?: Position }
export function screenPoints(item: Placed, projection: Projection) {
  if (!item.anchor) return item.points.map(projection.screen)
  const c = projection.screen(item.anchor)
  return item.points.map(o => offset(c, o.x, o.y))
}
export function anchorPoints(points: Position[], projection: Projection) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y) }
  const c = { x: (left + right) / 2, y: (top + bottom) / 2 }
  return { anchor: projection.world(c), points: points.map(p => ({ x: p.x - c.x, y: p.y - c.y })) }
}
// Stores new screen points keeping the item in metres or in pixels.
export function placePoints<T extends Placed>(item: T, points: Position[], projection: Projection): T {
  return item.anchor ? { ...item, ...anchorPoints(points, projection) } : { ...item, points: points.map(projection.world) }
}
export function translated<T extends Placed>(item: T, delta: Position, projection: Projection): T {
  return placePoints(item, screenPoints(item, projection).map(p => offset(p, delta.x, delta.y)), projection)
}
// Changes between metres and screen pixels keeping the current visual size.
export function setAnchored<T extends Placed>(item: T, fixed: boolean, projection: Projection): T {
  if (Boolean(item.anchor) === fixed) return item
  const points = screenPoints(item, projection)
  if (fixed) return { ...item, ...anchorPoints(points, projection) }
  const next = { ...item, points: points.map(projection.world) }
  delete next.anchor
  return next
}
export const isFixed = (shape: DrawingShape) => shape.radii ? shape.unit === 'screen' : Boolean(shape.anchor)
export function withUnit(shape: DrawingShape, fixed: boolean, projection: Projection): DrawingShape {
  const unit = fixed ? 'screen' : 'world'
  if (!shape.radii) return { ...setAnchored(shape, fixed, projection), unit }
  if (shape.unit === unit) return shape
  const k = shapeScale(shape, projection) / (fixed ? 1 : projection.pixelsPerUnit(shape.points[0]!))
  return { ...shape, unit, radii: { x: shape.radii.x * k, y: shape.radii.y * k } }
}
export function handles(shape: DrawingShape, projection: Projection) {
  if (!shape.radii) return screenPoints(shape, projection)
  const c = projection.screen(shape.points[0]!), scale = shapeScale(shape, projection)
  const x = shape.radii.x * scale, y = shape.radii.y * scale
  return [offset(c, -x, 0), offset(c, x, 0), offset(c, 0, -y), offset(c, 0, y)].map(p => turn(p, c, shape.rotation ?? 0))
}
/** Turns p around c by deg degrees, clockwise on screen. */
export function turn(p: Position, c: Position, deg: number) {
  if (!deg) return p
  const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}
/** Screen outline of an ellipse, turned with it. */
export function ellipseRing(shape: DrawingShape, projection: Projection, count = 48) {
  const c = projection.screen(shape.points[0]!), scale = shapeScale(shape, projection), rx = (shape.radii?.x ?? 0) * scale, ry = (shape.radii?.y ?? 0) * scale
  return Array.from({ length: count }, (_, i) => turn({ x: c.x + Math.cos(2 * Math.PI * i / count) * rx, y: c.y + Math.sin(2 * Math.PI * i / count) * ry }, c, shape.rotation ?? 0))
}
export function turned<T extends Placed>(item: T, c: Position, deg: number, projection: Projection): T {
  return placePoints(item, screenPoints(item, projection).map(p => turn(p, c, deg)), projection)
}
// Free rotation around c: a circle only moves, an ellipse keeps its turn and a rectangle
// that is no longer square to the screen becomes a polygon.
export function turnedShape(shape: DrawingShape, c: Position, deg: number, projection: Projection): DrawingShape {
  if (shape.radii) {
    const moved = { ...shape, points: [projection.world(turn(projection.screen(shape.points[0]!), c, deg))] }
    if (shape.radii.x === shape.radii.y) return moved
    return { ...moved, rotation: (((shape.rotation ?? 0) + deg) % 360 + 360) % 360 }
  }
  const next = turned(shape, c, deg, projection)
  const square = Math.abs(deg / 90 - Math.round(deg / 90)) < 1e-6
  return shape.kind === 'rectangle' && !square ? { ...next, kind: 'polygon' } : squared(next, projection)
}
/** Mirrors p across the horizontal (x) or vertical (y) axis through c. */
export const mirror = (p: Position, c: Position, axis: 'x' | 'y') => axis === 'x' ? { x: p.x, y: 2 * c.y - p.y } : { x: 2 * c.x - p.x, y: p.y }
export function flipped<T extends Placed>(item: T, c: Position, axis: 'x' | 'y', projection: Projection): T {
  return placePoints(item, screenPoints(item, projection).map(p => mirror(p, c, axis)), projection)
}
// A mirrored ellipse turns the other way; rectangles stay square to the screen.
export function flippedShape(shape: DrawingShape, c: Position, axis: 'x' | 'y', projection: Projection): DrawingShape {
  if (!shape.radii) return flipped(shape, c, axis, projection)
  const moved = { ...shape, points: [projection.world(mirror(projection.screen(shape.points[0]!), c, axis))] }
  return shape.rotation ? { ...moved, rotation: (360 - shape.rotation) % 360 } : moved
}
/** Direction in degrees of the first side (or from the first to the last point of a stroke). */
export function direction(points: Position[], ends = false) {
  const a = points[0], b = ends ? points.at(-1) : points.find(q => a && (q.x !== a.x || q.y !== a.y))
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI : 0
}
/** Shift: the point keeps its distance along the nearest direction in steps of 30° from the screen axes. */
export function angleSnap(from: Position, p: Position, step = 30) {
  const a = Math.round(Math.atan2(p.y - from.y, p.x - from.x) * 180 / Math.PI / step) * step * Math.PI / 180
  const length = Math.max(0, (p.x - from.x) * Math.cos(a) + (p.y - from.y) * Math.sin(a))
  return { x: from.x + Math.cos(a) * length, y: from.y + Math.sin(a) * length }
}
// A polygon with four sides on the screen axes is a rectangle again.
export function squared(shape: DrawingShape, projection: Projection): DrawingShape {
  if (shape.kind !== 'polygon' || shape.points.length !== 4) return shape
  const points = screenPoints(shape, projection)
  const flat = (a: Position, b: Position) => Math.abs(a.y - b.y) <= .5, upright = (a: Position, b: Position) => Math.abs(a.x - b.x) <= .5
  const sides = points.map((a, i) => [a, points[(i + 1) % 4]!] as const)
  const alternate = (even: typeof flat, odd: typeof flat) => sides.every(([a, b], i) => (i % 2 ? odd : even)(a, b))
  if (!alternate(flat, upright) && !alternate(upright, flat)) return shape
  const xs = points.map(q => q.x), ys = points.map(q => q.y)
  return placePoints({ ...shape, kind: 'rectangle' }, corners({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }), projection)
}
export function groupVisible(objects: DrawingObjects, id: string) {
  let member = false
  for (const group of objects.groups ?? []) if (group.members.includes(id)) {
    if (group.visible) return true
    member = true
  }
  return !member
}
export type ShapeMode = 'polyline' | 'circle' | 'label'


const shapeNames = { line: 'Polilínea', polygon: 'Polígono', rectangle: 'Rectángulo', ellipse: 'Circunferencia u óvalo' }
export function drawingMembers(objects: DrawingObjects & { strokes: { id: string; tool?: string }[] }) {
  return [...(objects.shapes ?? []).map((s, i) => ({ id: s.id, name: shapeNames[s.kind] + ' ' + (i + 1) })),
    ...objects.strokes.filter(s => s.tool !== 'eraser').map((s, i) => ({ id: s.id, name: 'Trazo ' + (i + 1) }))]
}
