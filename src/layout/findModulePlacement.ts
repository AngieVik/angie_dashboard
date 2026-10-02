import { MODULE_REGISTRY } from './moduleRegistry'
import { adaptModuleLayout } from './adaptiveLayout'
import type { ModuleLayout, PlacementRequest, PlacementResult, Size } from './layoutTypes'

export function overlaps(a: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>, b: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function findModulePlacement(request: PlacementRequest, occupied: readonly ModuleLayout[], bounds: Size): PlacementResult {
  const definition = MODULE_REGISTRY[request.id]
  const minimum = { width: definition.minimum[0], height: definition.minimum[1] }
  if (request.saved) return { layout: adaptModuleLayout(request.saved, bounds, minimum) }
  const initial = adaptModuleLayout({ x: 0, y: 0, width: definition.initial[0], height: definition.initial[1], referenceSize: bounds }, bounds, minimum)
  const { width, height, referenceSize } = initial
  bounds = referenceSize
  const origin = { x: 0, y: 0 }
  // A first or closest free rectangle touches a boundary, an occupied edge,
  // or the requested coordinate. These candidates preserve a one-unit grid
  // without scanning every one of the 1.6 million logical points.
  const xs = new Set([0, bounds.width - width, origin.x])
  const ys = new Set([0, bounds.height - height, origin.y])
  for (const item of occupied) {
    xs.add(item.x - width); xs.add(item.x + item.width)
    ys.add(item.y - height); ys.add(item.y + item.height)
  }
  const candidates: ModuleLayout[] = []
  for (const y of ys) for (const x of xs) {
    const layout = { x, y, width, height, referenceSize: { ...bounds } }
    if (x >= 0 && y >= 0 && x + width <= bounds.width && y + height <= bounds.height && !occupied.some(item => overlaps(layout, item))) {
      candidates.push(layout)
    }
  }
  candidates.sort((a, b) => {
    return a.y - b.y || a.x - b.x
  })
  if (candidates[0]) return { layout: candidates[0] }
  return {
    layout: { x: Math.floor((bounds.width - width) / 2), y: Math.floor((bounds.height - height) / 2), width, height, referenceSize: { ...bounds } },
  }
}
