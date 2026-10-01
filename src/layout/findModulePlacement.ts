import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleLayout, PlacementRequest, PlacementResult, Size } from './layoutTypes'

export function overlaps(a: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>, b: Pick<ModuleLayout, 'x' | 'y' | 'width' | 'height'>): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function findModulePlacement(request: PlacementRequest, occupied: readonly ModuleLayout[], bounds: Size): PlacementResult {
  const definition = MODULE_REGISTRY[request.id]
  const [width, height] = request.saved ? [request.saved.width, request.saved.height] : definition.initial
  const origin = request.saved ?? { x: 0, y: 0 }
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
    const distance = request.saved ? ((a.x - origin.x) ** 2 + (a.y - origin.y) ** 2) - ((b.x - origin.x) ** 2 + (b.y - origin.y) ** 2) : 0
    return distance || a.y - b.y || a.x - b.x
  })
  if (candidates[0]) return { layout: candidates[0], exceptional: false, notice: null }
  const [minWidth, minHeight] = definition.minimum
  return {
    layout: { x: Math.floor((bounds.width - minWidth) / 2), y: Math.floor((bounds.height - minHeight) / 2), width: minWidth, height: minHeight, referenceSize: { ...bounds } },
    exceptional: true, notice: 'No hay espacio libre. Recoloca o cierra algún módulo.',
  }
}
