import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'

export function getWorkspaceBounds(available: Size, modules: readonly ModuleId[]): Size {
  return modules.reduce((bounds, id) => ({
    width: Math.max(bounds.width, MODULE_REGISTRY[id].minimum[0]),
    height: Math.max(bounds.height, MODULE_REGISTRY[id].minimum[1]),
  }), { width: Math.max(1, Math.round(available.width)), height: Math.max(1, Math.round(available.height)) })
}

export function adaptModuleLayout(saved: ModuleLayout, available: Size, minimum: Size): ModuleLayout {
  const bounds = { width: Math.max(available.width, minimum.width), height: Math.max(available.height, minimum.height) }
  const width = Math.min(bounds.width, Math.max(minimum.width, saved.width))
  const height = Math.min(bounds.height, Math.max(minimum.height, saved.height))
  const anchor = (position: number, reference: number, original: number, extent: number, displayed: number) => {
    const fraction = reference > original ? position / (reference - original) : 0
    return Math.round(Math.max(0, Math.min(1, fraction)) * (extent - displayed))
  }
  return { x: anchor(saved.x, saved.referenceSize.width, saved.width, bounds.width, width),
    y: anchor(saved.y, saved.referenceSize.height, saved.height, bounds.height, height),
    width, height, referenceSize: { ...bounds } }
}
