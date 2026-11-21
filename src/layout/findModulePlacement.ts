import { moduleBaseSize } from './moduleRegistry'
import type { ModuleLayout, PlacementRequest, PlacementResult, Size } from './layoutTypes'

function overlaps(a: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>, b: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function findModulePlacement(request: PlacementRequest, occupied: readonly ModuleLayout[], bounds: Size): PlacementResult {
  const { width, height } = request.size ?? moduleBaseSize(request.id)
  const origin = request.origin ?? { x: 0, y: 0 }
  const right = origin.x + Math.max(bounds.width, width)
  const bottom = origin.y + bounds.height
  const xs = new Set([origin.x, ...occupied.map(item => item.x + item.width)])
  const ys = new Set([origin.y, ...occupied.map(item => item.y + item.height)])
  // Keep equal widths together while the complete window still fits on screen.
  const columns = [...new Set(occupied.filter(item => item.width === width).map(item => item.x))].sort((a, b) => a - b)
  for (const x of columns) {
    const y = Math.max(origin.y, ...occupied.filter(item => item.x === x && item.width === width).map(item => item.y + item.height))
    if (x < origin.x || x + width > right || y + height > bottom) continue
    const layout = { x, y, width, height, referenceSize: { width: right, height: Math.max(origin.y + bounds.height, y + height) } }
    if (!occupied.some(item => overlaps(layout, item))) return { layout }
  }
  // Fill visible space before extending the desktop below it.
  for (const visibleOnly of [true, false]) {
    for (const y of [...ys].sort((a, b) => a - b)) for (const x of [...xs].sort((a, b) => a - b)) {
      if (x < origin.x || y < origin.y || x + width > right || (visibleOnly && y + height > bottom)) continue
      const layout = { x, y, width, height, referenceSize: { width: right, height: Math.max(bottom, y + height) } }
      if (!occupied.some(item => overlaps(layout, item))) return { layout }
    }
  }
  const y = Math.max(origin.y, ...occupied.map(item => item.y + item.height))
  return { layout: { ...origin, y, width, height, referenceSize: { width: right, height: Math.max(origin.y + bounds.height, y + height) } } }
}
