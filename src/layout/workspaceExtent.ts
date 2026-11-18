import type { ModuleLayout, Size } from './layoutTypes'

// Only mounted windows determine the desk size; closing them releases space.
export function measureWorkspaceExtent(visible: Size, rectangles: readonly ModuleLayout[]): Size {
  return rectangles.reduce((extent, layout) => ({
    width: Math.max(extent.width, Math.ceil(layout.x + layout.width)),
    height: Math.max(extent.height, Math.ceil(layout.y + layout.height)),
  }), { width: Math.max(1, Math.ceil(visible.width)), height: Math.max(1, Math.ceil(visible.height)) })
}
