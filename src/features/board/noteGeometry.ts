import type { QuickNote } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'

export function resizeQuickNote(note: QuickNote, size: Size): QuickNote {
  if (![size.width, size.height].every(Number.isFinite)) return note
  const width = Math.max(48, size.width), height = Math.max(32, size.height)
  const position = { x: note.position.x + (width - note.width) / 2, y: note.position.y + (height - note.height) / 2 }
  if (![position.x, position.y].every(Number.isFinite) || position.x < 0 || position.y < 0) return note
  return { ...note, width, height, position }
}
