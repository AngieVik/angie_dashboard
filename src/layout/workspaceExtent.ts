import type { AngieDocument } from '../domain/document/types'
import type { ModuleLayout, Size } from './layoutTypes'

export function growWorkspaceExtent(previous: Size, visible: Size, rectangles: readonly ModuleLayout[]): Size {
  return rectangles.reduce((extent, layout) => ({
    width: Math.max(extent.width, Math.ceil(layout.x + layout.width + 12)),
    height: Math.max(extent.height, Math.ceil(layout.y + layout.height + 12)),
  }), { width: Math.max(1, Math.ceil(previous.width), Math.ceil(visible.width)), height: Math.max(1, Math.ceil(previous.height), Math.ceil(visible.height)) })
}
export function reconstructWorkspaceExtent(visible: Size, saved: AngieDocument['moduleLayouts']): Size {
  const layouts = Object.values(saved)
  const references = layouts.reduce((extent, layout) => ({
    width: Math.max(extent.width, layout.referenceSize.width),
    height: Math.max(extent.height, layout.referenceSize.height),
  }), visible)
  return growWorkspaceExtent(references, visible, layouts)
}
