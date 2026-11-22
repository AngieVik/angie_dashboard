import type { DrawingShape, DrawingObjects, Position } from '@/domain/document/types'

export interface Projection {
  screen: (p: Position) => Position
  world: (p: Position) => Position
  pixelsPerUnit: (at: Position) => number
}
export const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y)
export const offset = (p: Position, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy })
export const midpoint = (a: Position, b: Position) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const corners = (a: Position, b: Position) => [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
export function squareEnd(start: Position, end: Position) {
  const side = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return offset(start, side * Math.sign(end.x - start.x || 1), side * Math.sign(end.y - start.y || 1))
}
export function shapeScale(shape: DrawingShape, projection: Projection) {
  return shape.unit === 'screen' ? 1 : projection.pixelsPerUnit(shape.points[0]!)
}
export function handles(shape: DrawingShape, projection: Projection) {
  if (!shape.radii) return shape.points.map(projection.screen)
  const c = projection.screen(shape.points[0]!), scale = shapeScale(shape, projection)
  const x = shape.radii.x * scale, y = shape.radii.y * scale
  return [offset(c, -x, 0), offset(c, x, 0), offset(c, 0, -y), offset(c, 0, y)]
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
