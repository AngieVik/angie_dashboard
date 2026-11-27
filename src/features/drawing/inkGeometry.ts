import type { DrawingObjects, Position } from '@/domain/document/types'
import { distance, offset, type Projection } from './shapeGeometry'

export interface InkPath { id: string; points: Position[]; width: number }
export interface InkPiece { id: string; points: Position[] }
export type InkChanges = Map<string, InkPiece[]>
export function replaceInk<T extends { id: string; points: P[] }, P>(strokes: T[], changes: InkChanges, convert: (p: Position) => P): T[] {
  return strokes.flatMap(s => changes.get(s.id)?.map(piece => ({ ...s, id: piece.id, points: piece.points.map(convert) })) ?? [s])
}


export function inkReferences(objects: DrawingObjects, changes: InkChanges, projection: Projection, delta?: Position): DrawingObjects {
  const groups = objects.groups?.map(group => group.members.some(id => changes.has(id))
    ? { ...group, members: group.members.flatMap(id => changes.get(id)?.map(piece => piece.id) ?? [id]) } : group)
  const labels = objects.labels?.flatMap(label => {
    const parts = label.owner ? changes.get(label.owner) : undefined
    if (!parts) return [label]
    if (!parts.length) return []
    const p = projection.screen(label.point)
    if (delta) return [{ ...label, point: projection.world(offset(p, delta.x, delta.y)) }]
    let nearest = parts[0]!.id, best = Infinity
    for (const part of parts) for (const q of part.points) {
      const d = distance(p, projection.screen(q))
      if (d < best) { best = d; nearest = part.id }
    }
    return [{ ...label, owner: nearest }]
  })
  const removedShape = objects.shapes?.some(shape => changes.get(shape.id)?.length === 0)
  return { groups, labels, ...(removedShape ? { shapes: objects.shapes!.filter(shape => !changes.has(shape.id)) } : {}) }
}

export function inkAt(paths: InkPath[], projection: Projection, world: Position) {
  const p = projection.screen(world)
  return paths.findLast(path => {
    let previous: Position | undefined
    for (const value of path.points) {
      const q = projection.screen(value), a = previous ?? q
      const dx = q.x - a.x, dy = q.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      if (distance(p, offset(a, t * dx, t * dy)) <= Math.max(4, path.width / 2)) return true
      previous = q
    }
    return false
  })?.id
}
