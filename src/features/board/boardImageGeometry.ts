import type { Position } from '../../domain/document/types'

export interface BoardImageLayout { x: number; y: number; width: number; height: number }
export type ImageAction = 'move' | 'nw' | 'ne' | 'sw' | 'se'

export function initialImageLayout(width: number, height: number): BoardImageLayout {
  const scale = 1000 / Math.max(width, height)
  return { x: 0, y: 0, width: width * scale, height: height * scale }
}

export function clampBoardImagePosition(layout: BoardImageLayout): BoardImageLayout {
  return layout.x >= 0 && layout.y >= 0 ? layout : { ...layout, x: Math.max(0, layout.x), y: Math.max(0, layout.y) }
}

export function transformBoardImage(layout: BoardImageLayout, action: ImageAction, delta: Position): BoardImageLayout {
  layout = clampBoardImagePosition(layout)
  if (action === 'move') return clampBoardImagePosition({ ...layout, x: layout.x + delta.x, y: layout.y + delta.y })
  const west = action.includes('w'), north = action.includes('n')
  const dx = west ? -delta.x : delta.x, dy = north ? -delta.y : delta.y
  // Stop at the canvas origin without moving the opposite corner or changing the aspect ratio.
  const maximum = Math.min(west ? 1 + layout.x / layout.width : Infinity, north ? 1 + layout.y / layout.height : Infinity)
  const factor = Math.min(maximum, Math.max(16 / Math.min(layout.width, layout.height),
    1 + (dx * layout.width + dy * layout.height) / (layout.width ** 2 + layout.height ** 2)))
  const width = layout.width * factor, height = layout.height * factor
  return clampBoardImagePosition({ x: west ? layout.x + layout.width - width : layout.x,
    y: north ? layout.y + layout.height - height : layout.y, width, height })
}
