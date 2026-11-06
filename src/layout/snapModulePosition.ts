import type { ModuleLayout } from './layoutTypes'

export function snapModulePosition(layout: ModuleLayout, others: readonly ModuleLayout[], scale: number): ModuleLayout {
  const threshold = 18 / scale
  const overlaps = (candidate: ModuleLayout) => others.some(other => candidate.x < other.x + other.width && candidate.x + candidate.width > other.x && candidate.y < other.y + other.height && candidate.y + candidate.height > other.y)
  const horizontal = [0], vertical = [0]
  const isTitleBar = (item: ModuleLayout) => item.height <= 29 && item.width > 29
  const row = isTitleBar(layout) ? others.filter(other => isTitleBar(other) && Math.abs(layout.y - other.y) <= threshold) : []
  for (const other of others) {
    if (layout.y <= other.y + other.height + threshold && layout.y + layout.height >= other.y - threshold) {
      horizontal.push(other.x - layout.width, other.x + other.width, other.x, other.x + other.width - layout.width)
    }
    if (layout.x <= other.x + other.width + threshold && layout.x + layout.width >= other.x - threshold) {
      vertical.push(other.y - layout.height, other.y + other.height, other.y, other.y + other.height - layout.height)
    }
  }
  // Center axes also attract across gaps between modules.
  for (const other of others) {
    horizontal.push(other.x, other.x + other.width - layout.width, other.x + (other.width - layout.width) / 2)
    vertical.push(other.y, other.y + other.height - layout.height, other.y + (other.height - layout.height) / 2)
  }
  const nearest = (axis: 'x' | 'y', candidates: readonly number[]) => [...new Set(candidates)]
    .filter(value => value >= 0 && Math.abs(value - layout[axis]) <= threshold)
    .sort((a, b) => Math.abs(a - layout[axis]) - Math.abs(b - layout[axis]))
  // Compact bars in the same row share a baseline, including saved 29 px bars.
  const aligned = row.map(other => other.y).sort((a, b) => Math.abs(a - layout.y) - Math.abs(b - layout.y))
  const horizontalCandidates = [...new Set([...nearest('x', horizontal), layout.x])]
  const verticalCandidates = [...new Set([...aligned, ...nearest('y', vertical), layout.y])]
  // Validate the complete position: a corner can require both axes to move
  // before it clears the neighbouring modules, regardless of their sizes/states.
  for (const x of horizontalCandidates) {
    for (const y of verticalCandidates) {
      const candidate = { ...layout, x, y }
      if (!overlaps(candidate)) return candidate
    }
  }
  return layout
}

export function snapModuleSize(layout: ModuleLayout, others: readonly ModuleLayout[], scale: number): ModuleLayout {
  const threshold = 18 / scale
  const horizontal = others.flatMap(other => [other.x, other.x + other.width / 2, other.x + other.width])
  const vertical = others.flatMap(other => [other.y, other.y + other.height / 2, other.y + other.height])
  const nearest = (edge: number, origin: number, candidates: number[]) => candidates
    .filter(value => value > origin && Math.abs(value - edge) <= threshold)
    .sort((a, b) => Math.abs(a - edge) - Math.abs(b - edge))[0] ?? edge
  return { ...layout,
    width: nearest(layout.x + layout.width, layout.x, horizontal) - layout.x,
    height: nearest(layout.y + layout.height, layout.y, vertical) - layout.y }
}
