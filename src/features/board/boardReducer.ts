import type { Position } from '../../domain/document/types'
import type { Board, BoardAction, BoardState } from './boardTypes'

export function createBoardState(board: Board): BoardState {
  return { board, mode: 'select', draft: null, selectedNoteId: null }
}

const finitePoint = (point: Position) => Number.isFinite(point.x) && Number.isFinite(point.y)
export const clampBoardPosition = (point: Position): Position => ({ x: Math.max(0, Math.min(1000, point.x)), y: Math.max(0, Math.min(1000, point.y)) })
const colorPattern = /^#[\da-f]{6}$/i

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  const board = state.board
  switch (action.type) {
    case 'mode': return { ...state, mode: action.mode, draft: null, selectedNoteId: null }
    case 'background': return colorPattern.test(action.color) ? { ...state, board: { ...board, backgroundColor: action.color.toUpperCase() } } : state
    case 'start': {
      if ((state.mode !== 'pen' && state.mode !== 'eraser') || !finitePoint(action.point) ||
        !Number.isFinite(action.width) || action.width <= 0 || !colorPattern.test(action.color)) return state
      const common = { id: action.id, width: action.width, points: [clampBoardPosition(action.point)] }
      return { ...state, draft: state.mode === 'pen' ? { ...common, tool: 'pen', color: action.color.toUpperCase() } : { ...common, tool: 'eraser', color: null } }
    }
    case 'point': return state.draft && finitePoint(action.point) ? { ...state, draft: { ...state.draft, points: [...state.draft.points, clampBoardPosition(action.point)] } } : state
    case 'finish': return state.draft ? { ...state, draft: null, board: { ...board, strokes: [...board.strokes, state.draft] } } : state
    case 'cancel': return { ...state, draft: null }
    case 'select-note': return state.mode === 'select' ? { ...state, selectedNoteId: action.id } : state
    case 'add-note': return state.mode === 'note' && finitePoint(action.note.position) ? {
      ...state, mode: 'select', selectedNoteId: action.note.id,
      board: { ...board, quickNotes: [...board.quickNotes, { ...action.note, position: clampBoardPosition(action.note.position) }] },
    } : state
    case 'move-note': return state.mode === 'select' && finitePoint(action.position) ? {
      ...state, board: { ...board, quickNotes: board.quickNotes.map(note => note.id === action.id ? { ...note, position: clampBoardPosition(action.position) } : note) },
    } : state
    case 'edit-note': return state.mode === 'select' ? { ...state, board: { ...board,
      quickNotes: board.quickNotes.map(note => note.id === action.id ? { ...note, text: action.text } : note),
    } } : state
    case 'delete-note': return state.mode === 'select' ? { ...state, selectedNoteId: state.selectedNoteId === action.id ? null : state.selectedNoteId,
      board: { ...board, quickNotes: board.quickNotes.filter(note => note.id !== action.id) },
    } : state
  }
}

export function fitBoard(width: number, height: number) {
  const size = Math.max(0, Math.min(width, height))
  return { size, scale: size / 1000, left: (width - size) / 2, top: (height - size) / 2 }
}

export function toBoardPosition(point: Position, rect: { left: number; top: number; width: number; height: number }): Position | null {
  if (rect.width <= 0 || rect.height <= 0 || !finitePoint(point)) return null
  const x = (point.x - rect.left) * 1000 / rect.width, y = (point.y - rect.top) * 1000 / rect.height
  return x < 0 || y < 0 || x > 1000 || y > 1000 ? null : { x, y }
}
