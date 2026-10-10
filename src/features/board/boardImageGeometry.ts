import type { Position } from '../../domain/document/types'

export interface BoardImageLayout { x: number; y: number; width: number; height: number }
export type ImageAction = 'move' | 'nw' | 'ne' | 'sw' | 'se'

export function initialImageLayout(width: number, height: number): BoardImageLayout {
  const scale = 1000 / Math.max(width, height)
  return { x: 0, y: 0, width: width * scale, height: height * scale }
}

export function transformBoardImage(layout: BoardImageLayout, action: ImageAction, delta: Position): BoardImageLayout {
  if (action === 'move') return { ...layout, x: layout.x + delta.x, y: layout.y + delta.y }
  const west = action.includes('w'), north = action.includes('n')
  const dx = west ? -delta.x : delta.x, dy = north ? -delta.y : delta.y
  const factor = Math.max(16 / Math.min(layout.width, layout.height),
    1 + (dx * layout.width + dy * layout.height) / (layout.width ** 2 + layout.height ** 2))
  const width = layout.width * factor, height = layout.height * factor
  return { x: west ? layout.x + layout.width - width : layout.x,
    y: north ? layout.y + layout.height - height : layout.y, width, height }
}
