import type { AngieDocumentV1, BoardStroke, Position, QuickNote } from '../../domain/document/types'

export type Board = AngieDocumentV1['board']
export type BoardMode = 'select' | 'pen' | 'eraser' | 'note'
export interface BoardState { board: Board; mode: BoardMode; draft: BoardStroke | null; selectedNoteId: string | null }
export type BoardAction =
  | { type: 'mode'; mode: BoardMode }
  | { type: 'background'; color: string }
  | { type: 'start'; id: string; point: Position; color: string; width: number }
  | { type: 'point'; point: Position }
  | { type: 'finish' | 'cancel' }
  | { type: 'select-note'; id: string | null }
  | { type: 'add-note'; note: QuickNote }
  | { type: 'move-note'; id: string; position: Position }
  | { type: 'edit-note'; id: string; text: string }
  | { type: 'delete-note'; id: string }

export type BoardImageResult =
  | { success: true; image: ImageBitmap; width: number; height: number; dispose: () => void }
  | { success: false; message: string }
export type BoardImage = Extract<BoardImageResult, { success: true }>
