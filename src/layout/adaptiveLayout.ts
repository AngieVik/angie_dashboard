import { moduleExpandedMinimumSize } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'

export function getWorkspaceBounds(available: Size, modules: readonly ModuleId[]): Size {
  return modules.reduce((bounds, id) => {
    const minimum = moduleExpandedMinimumSize(id)
    return { width: Math.max(bounds.width, minimum.width), height: Math.max(bounds.height, minimum.height) }
  }, { width: Math.max(1, Math.round(available.width)), height: Math.max(1, Math.round(available.height)) })
}
