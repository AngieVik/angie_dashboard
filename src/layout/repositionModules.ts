import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, ModuleLayout } from './layoutTypes'

export function repositionModules(open: readonly { id: ModuleId; layout: ModuleLayout }[], visibleLogicalWidth: number, gap = 12): { id: ModuleId; layout: ModuleLayout }[] {
  if (!Number.isFinite(visibleLogicalWidth) || visibleLogicalWidth <= 0 || !Number.isFinite(gap) || gap < 0) throw new Error('Superficie de recolocación inválida')
  const order = Object.keys(MODULE_REGISTRY) as ModuleId[]
  let x = gap, y = gap, rowHeight = 0
  return [...open].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map(({ id, layout }) => {
    if (x > gap && x + layout.width + gap > visibleLogicalWidth) { x = gap; y += rowHeight + gap; rowHeight = 0 }
    const next = { ...layout, x, y, referenceSize: { width: Math.ceil(Math.max(visibleLogicalWidth, x + layout.width + gap)), height: Math.ceil(y + layout.height + gap) } }
    x += layout.width + gap
    rowHeight = Math.max(rowHeight, layout.height)
    return { id, layout: next }
  })
}
