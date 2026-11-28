import type { DrawingObjects, Position } from '@/domain/document/types'
import { distance, ellipseRing, groupVisible, screenPoints, type Projection } from './shapeGeometry'

type Interval = [number, number]
const interpolate = (a: Position, b: Position, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
function disc(a: Position, b: Position, c: Position, r: number): Interval | null {
  const x = a.x - c.x, y = a.y - c.y, dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  if (!length) return x * x + y * y <= r * r ? [0, 1] : null
  const projection = -(x * dx + y * dy) / length
  const half = (r * r - (x * dy - y * dx) ** 2 / length) / length
  return half > 0 ? [projection - Math.sqrt(half), projection + Math.sqrt(half)] : null
}
function slab(origin: number, delta: number, min: number, max: number): Interval | null {
  if (!delta) return origin >= min && origin <= max ? [0, 1] : null
  const a = (min - origin) / delta, b = (max - origin) / delta
  return [Math.min(a, b), Math.max(a, b)]
}
// The swept eraser is a capsule. Its intersection with a line segment is one interval.
function cut(a: Position, b: Position, from: Position, to: Position, radius: number): Interval | null {
  if (Math.max(a.x, b.x) < Math.min(from.x, to.x) - radius || Math.min(a.x, b.x) > Math.max(from.x, to.x) + radius ||
    Math.max(a.y, b.y) < Math.min(from.y, to.y) - radius || Math.min(a.y, b.y) > Math.max(from.y, to.y) + radius) return null
  const intervals = [disc(a, b, from, radius)]
  const length = distance(from, to)
  if (length) {
    intervals.push(disc(a, b, to, radius))
    const ux = (to.x - from.x) / length, uy = (to.y - from.y) / length
    const x = a.x - from.x, y = a.y - from.y, dx = b.x - a.x, dy = b.y - a.y
    const along = slab(x * ux + y * uy, dx * ux + dy * uy, 0, length)
    const across = slab(y * ux - x * uy, dy * ux - dx * uy, -radius, radius)
    if (along && across) {
      const low = Math.max(along[0], across[0]), high = Math.min(along[1], across[1])
      if (low <= high) intervals.push([low, high])
    }
  }
  const hits = intervals.filter((v): v is Interval => !!v && v[1] >= 0 && v[0] <= 1)
  return hits.length ? [Math.max(0, Math.min(...hits.map(v => v[0]))), Math.min(1, Math.max(...hits.map(v => v[1])))] : null
}

export function eraseInk(points: Position[], from: Position, to: Position, radius: number): Position[][] | null {
  if (points.length === 1) return cut(points[0]!, points[0]!, from, to, radius) ? [] : null
  let changed = false, start = 0
  let path: Position[] = []
  const parts: Position[][] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, hit = cut(a, b, from, to, radius)
    if (!hit) continue
    changed = true
    for (let n = start; n < i; n++) path.push(points[n]!)
    if (hit[0] > 0) path.push(interpolate(a, b, hit[0]))
    if (path.length > 1) parts.push(path)
    path = hit[1] < 1 ? [interpolate(a, b, hit[1])] : []
    start = hit[1] < 1 ? i : i + 1
  }
  if (!changed) return null
  for (let n = start; n < points.length; n++) path.push(points[n]!)
  if (path.length > 1) parts.push(path)
  return parts
}


// Ids of the figures whose line the swept eraser touches. The inside of a closed figure does not count.
export function sweptShapes(objects: DrawingObjects, from: Position, to: Position, radius: number, projection: Projection) {
  return (objects.shapes ?? []).filter(shape => {
    if (!groupVisible(objects, shape.id)) return false
    const pts = screenPoints(shape, projection), r = radius + shape.width / 2
    let ring = pts
    if (shape.radii) {
      if (!pts[0]) return false
      ring = ellipseRing(shape, projection)
    }
    if (ring.length === 1) return !!cut(ring[0]!, ring[0]!, from, to, r)
    const closed = shape.kind !== 'line' || !!shape.radii
    for (let i = 0; i < ring.length - (closed ? 0 : 1); i++) if (cut(ring[i]!, ring[(i + 1) % ring.length]!, from, to, r)) return true
    return false
  }).map(shape => shape.id)
}
