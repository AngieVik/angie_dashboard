import type { DocumentElement, Position } from '../../domain/document/types'
import type { Size, ViewportState } from '../../layout/layoutTypes'
import type { Board } from './boardTypes'
import { getPinBox } from '../elements/iconCatalog'

export type BoardViewportState = ViewportState
export interface BoardBounds { left: number; top: number; right: number; bottom: number }

function contentBounds(board: Board, elements: DocumentElement[]): BoardBounds | null {
  let bounds: BoardBounds | null = null
  function include(x: number, y: number, halfWidth: number, halfHeight: number) {
    const box = { left: x - halfWidth, top: y - halfHeight, right: x + halfWidth, bottom: y + halfHeight }
    bounds = bounds ? { left: Math.min(bounds.left, box.left), top: Math.min(bounds.top, box.top), right: Math.max(bounds.right, box.right), bottom: Math.max(bounds.bottom, box.bottom) } : box
  }
  for (const stroke of board.strokes) for (const point of stroke.points) include(point.x, point.y, stroke.width / 2, stroke.width / 2)
  for (const note of board.quickNotes) include(note.position.x, note.position.y, note.width / 2, note.height / 2)
  for (const element of elements) if (element.pinVisible && element.position) {
    const box = getPinBox(element.visual)
    // Include the name's scaled CSS maximum so it remains recoverable.
    include(element.position.x, element.position.y, Math.max(box.width, 200 * element.visual.scale) / 2, box.height / 2)
  }
  return bounds
}

export function getBoardBounds(size: Size, board: Board, elements: DocumentElement[], hasImage = false): BoardBounds {
  const content = contentBounds(board, elements)
  return { left: 0, top: 0,
    right: Math.max(size.width, content?.right ?? 0, hasImage ? 1000 : 0), bottom: Math.max(size.height, content?.bottom ?? 0, hasImage ? 1000 : 0) }
}
export function initialBoardView(size: Size, board: Board, elements: DocumentElement[]): BoardViewportState {
  const bounds = contentBounds(board, elements)
  return { scale: 1, offsetX: bounds ? Math.min(0, size.width / 2 - (bounds.left + bounds.right) / 2) : 0,
    offsetY: bounds ? Math.min(0, size.height / 2 - (bounds.top + bounds.bottom) / 2) : 0 }
}
export function toBoardPosition(point: Position, rect: { left: number; top: number; width: number; height: number }, view: BoardViewportState, size: Size): Position | null {
  if (rect.width <= 0 || rect.height <= 0 || size.width <= 0 || size.height <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (point.x < rect.left || point.y < rect.top || point.x > rect.left + rect.width || point.y > rect.top + rect.height) return null
  return { x: ((point.x - rect.left) * size.width / rect.width - view.offsetX) / view.scale,
    y: ((point.y - rect.top) * size.height / rect.height - view.offsetY) / view.scale }
}
export function boardDelta(point: Position, rect: { width: number; height: number }, view: BoardViewportState, size: Size): Position {
  return { x: point.x * size.width / rect.width / view.scale, y: point.y * size.height / rect.height / view.scale }
}
export function panBoard(view: BoardViewportState, dx: number, dy: number, _size: Size, bounds: BoardBounds): BoardViewportState {
  // One visible region of margin permits drawing beyond existing content.
  // Complete object boxes remain reachable at either navigation limit.
  return { ...view, offsetX: Math.max(-bounds.right * view.scale, Math.min(0, view.offsetX + dx)),
    offsetY: Math.max(-bounds.bottom * view.scale, Math.min(0, view.offsetY + dy)) }
}
export function zoomBoardAt(view: BoardViewportState, requestedScale: number, point: Position, size: Size, bounds: BoardBounds): BoardViewportState {
  const scale = Math.max(.25, Math.min(4, requestedScale)), ratio = scale / view.scale
  return panBoard({ scale, offsetX: point.x - (point.x - view.offsetX) * ratio, offsetY: point.y - (point.y - view.offsetY) * ratio }, 0, 0, size, bounds)
}
