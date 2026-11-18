import { moduleCollapsedWidth, MODULE_REGISTRY } from './moduleRegistry'
import { findModulePlacement } from './findModulePlacement'
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'

type Module = { id: ModuleId; layout: ModuleLayout; resetSizeOnMount?: boolean }

const barColumns = [
  ['board', 'map', 'plan', 'reports'],
  ['elements', 'dotations', 'information', 'timeline'],
  ['clock', 'calculator', 'calendar', 'notebook', 'coordinates'],
  ['operations'],
] as const satisfies readonly (readonly ModuleId[])[]

export function collectModuleBars(open: readonly Module[], visible: Size): Module[] {
  const barHeight = 27
  const placed: Module[] = []
  let x = 0, y = 0, rowHeight = 0
  for (const ids of barColumns) {
    const column = ids.flatMap(id => {
      const module = open.find(module => module.id === id)
      return module ? [module] : []
    })
    if (!column.length) continue
    const width = Math.max(...column.map(module => moduleCollapsedWidth(module.id)))
    if (x > 0 && x + width > visible.width) {
      x = 0; y += rowHeight; rowHeight = 0
    }
    column.forEach((module, index) => placed.push({ ...module, resetSizeOnMount: false,
      layout: { ...module.layout, x, y: y + index * barHeight, width, height: barHeight,
        referenceSize: { width: Math.max(visible.width, x + width), height: Math.max(visible.height, y + column.length * barHeight) } } }))
    x += width
    rowHeight = Math.max(rowHeight, column.length * barHeight)
  }
  return placed
}

export function repositionModules(open: readonly Module[], visible: Size): Module[] {
  const order = Object.keys(MODULE_REGISTRY) as ModuleId[]
  const placed: Module[] = []
  for (const module of [...open].sort((a, b) => b.layout.width - a.layout.width || order.indexOf(a.id) - order.indexOf(b.id))) {
    const layout = findModulePlacement({ id: module.id, size: module.layout }, placed.map(item => item.layout), visible).layout
    placed.push({ ...module, layout })
  }
  return placed
}
