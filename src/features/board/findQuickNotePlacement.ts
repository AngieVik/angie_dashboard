import type { DocumentElement, Position } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import type { Board } from './boardTypes'
import { getPinNameLayout, getRotatedPinBox } from '../elements/pinPresentation'

export interface NotePlacementBox extends Size { x: number; y: number }
export function getQuickNoteObstacles(board: Board, elements: readonly DocumentElement[], nameWidth: (element: DocumentElement) => number): NotePlacementBox[] {
  const boxes = board.quickNotes.map(note => ({ x: note.position.x - note.width / 2, y: note.position.y - note.height / 2, width: note.width, height: note.height }))
  for (const element of elements) if (element.pinVisible && element.position) {
    const icon = getRotatedPinBox(element.visual)
    boxes.push({ x: element.position.x - icon.width / 2, y: element.position.y - icon.height / 2, ...icon })
    if (!element.nameHidden) {
      const name = getPinNameLayout(element, nameWidth(element))
      boxes.push({ x: element.position.x + name.offset.x - name.width / 2, y: element.position.y + name.offset.y - name.height / 2, width: name.width, height: name.height })
    }
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
