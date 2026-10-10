import type { DocumentElement, Position } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import type { Board } from './boardTypes'
import { getPinBox } from '../elements/iconCatalog'

export interface NotePlacementBox extends Size { x: number; y: number }
export function getQuickNoteObstacles(board: Board, elements: readonly DocumentElement[], nameWidth: (element: DocumentElement) => number): NotePlacementBox[] {
  const boxes = board.quickNotes.map(note => ({ x: note.position.x - note.width / 2, y: note.position.y - note.height / 2, width: note.width, height: note.height }))
  for (const element of elements) if (element.pinVisible && element.position) {
    const icon = getPinBox(element.visual), width = Math.max(icon.width, nameWidth(element))
    const height = Math.max(icon.height, (element.nameFontSize ?? 16) * 1.25)
    boxes.push({ x: element.position.x - width / 2, y: element.position.y + icon.height / 2 - height, width, height })
  }
  return boxes
}
export function findQuickNotePlacement(visible: NotePlacementBox, size: Size, occupied: readonly NotePlacementBox[], gap = 12): { position: Position; overlapped: boolean } {
  const left = Math.max(0, visible.x) + gap, top = Math.max(0, visible.y) + gap
  const right = visible.x + visible.width - gap, bottom = visible.y + visible.height - gap
  const xs = [...new Set([left, ...occupied.map(box => box.x + box.width + gap)])].filter(x => x >= left).sort((a, b) => a - b)
  const ys = [...new Set([top, ...occupied.map(box => box.y + box.height + gap)])].filter(y => y >= top).sort((a, b) => a - b)
  for (const y of ys) for (const x of xs) {
    if (x + size.width > right || y + size.height > bottom) continue
    if (occupied.every(box => x + size.width + gap <= box.x || box.x + box.width + gap <= x || y + size.height + gap <= box.y || box.y + box.height + gap <= y)) {
      return { position: { x: x + size.width / 2, y: y + size.height / 2 }, overlapped: false }
    }
  }
  return { position: { x: Math.max(0, visible.x) + Math.max(0, Math.min(gap, visible.width - size.width)) + size.width / 2,
    y: Math.max(0, visible.y) + Math.max(0, Math.min(gap, visible.height - size.height)) + size.height / 2 }, overlapped: true }
}
