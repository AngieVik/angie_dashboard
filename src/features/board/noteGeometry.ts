import type { QuickNote } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'

// The note keeps its centre: `position` is the middle of the note.
export function resizeQuickNote(note: QuickNote, size: Size): QuickNote {
  if (![size.width, size.height].every(Number.isFinite)) return note
  return { ...note, width: Math.max(48, size.width), height: Math.max(32, size.height) }
}
