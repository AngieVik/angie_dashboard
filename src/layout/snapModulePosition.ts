import type { ModuleLayout } from './layoutTypes'

export function snapModulePosition(layout: ModuleLayout, others: readonly ModuleLayout[], scale: number): ModuleLayout {
  const threshold = 10 / scale
  const overlaps = (candidate: ModuleLayout) => others.some(other => candidate.x < other.x + other.width && candidate.x + candidate.width > other.x && candidate.y < other.y + other.height && candidate.y + candidate.height > other.y)
  const horizontal = [0], vertical = [0]
  for (const other of others) {
    if (layout.y <= other.y + other.height + threshold && layout.y + layout.height >= other.y - threshold) {
      horizontal.push(other.x - layout.width, other.x + other.width, other.x, other.x + other.width - layout.width)
    }
    if (layout.x <= other.x + other.width + threshold && layout.x + layout.width >= other.x - threshold) {
      vertical.push(other.y - layout.height, other.y + other.height, other.y, other.y + other.height - layout.height)
    }
  }
  let next = { ...layout }
  for (const [axis, candidates] of [['x', horizontal], ['y', vertical]] as const) {
    const closest = candidates.filter(value => value >= 0 && Math.abs(value - layout[axis]) <= threshold)
      .sort((a, b) => Math.abs(a - layout[axis]) - Math.abs(b - layout[axis]))
      .find(value => !overlaps({ ...next, [axis]: value }))
    if (closest !== undefined) next = { ...next, [axis]: closest }
  }
  return next
}
