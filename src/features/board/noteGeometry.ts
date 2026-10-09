import type { QuickNote } from '../../domain/document/types'

export function scaleQuickNote(note: QuickNote, factor: number): QuickNote {
  if (!Number.isFinite(factor) || factor <= 0) return note
  const width = note.width * factor, height = note.height * factor, scale = note.scale * factor
  const position = { x: note.position.x + (width - note.width) / 2, y: note.position.y + (height - note.height) / 2 }
  if (![width, height, scale, position.x, position.y].every(Number.isFinite) || Math.min(width, height, scale) <= 0 || position.x < 0 || position.y < 0) return note
  return { ...note, width, height, scale, position }
}
export function growQuickNote(note: QuickNote, height: number): QuickNote {
  const y = note.position.y + (height - note.height) / 2
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(y) || y < 0) return note
  return { ...note, height, position: { ...note.position, y } }
}
