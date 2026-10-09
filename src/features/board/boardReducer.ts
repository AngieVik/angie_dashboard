import type { Position } from '../../domain/document/types'
import type { Board, BoardAction, BoardState } from './boardTypes'
import { growQuickNote, scaleQuickNote } from './noteGeometry'

export function createBoardState(board: Board): BoardState {
  return { board, mode: 'select', draft: null, selectedNoteId: null }
}

const finitePoint = (point: Position) => Number.isFinite(point.x) && Number.isFinite(point.y)
export const clampBoardPosition = (point: Position): Position => ({ x: Math.max(0, point.x), y: Math.max(0, point.y) })
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
    case 'add-note': return finitePoint(action.note.position) && [action.note.width, action.note.height, action.note.scale].every(value => Number.isFinite(value) && value > 0) ? {
      ...state, mode: 'select', selectedNoteId: action.note.id,
      board: { ...board, quickNotes: [...board.quickNotes, { ...action.note, position: { x: Math.max(action.note.width / 2, action.note.position.x), y: Math.max(action.note.height / 2, action.note.position.y) } }] },
    } : state
    case 'move-note': return state.mode === 'select' && finitePoint(action.position) ? {
      ...state, board: { ...board, quickNotes: board.quickNotes.map(note => note.id === action.id ? { ...note, position: clampBoardPosition(action.position) } : note) },
    } : state
    case 'resize-note': return state.mode === 'select' && Number.isFinite(action.factor) && action.factor > 0 ? { ...state, board: { ...board,
      quickNotes: board.quickNotes.map(note => note.id === action.id ? scaleQuickNote(note, action.factor) : note),
    } } : state
    case 'edit-note': return state.mode === 'select' ? { ...state, board: { ...board,
      quickNotes: board.quickNotes.map(note => note.id === action.id ? { ...(action.height === undefined ? note : growQuickNote(note, action.height)),
        ...(action.title === undefined ? {} : { title: action.title }), ...(action.text === undefined ? {} : { text: action.text }) } : note),
    } } : state
    case 'delete-note': return state.mode === 'select' ? { ...state, selectedNoteId: state.selectedNoteId === action.id ? null : state.selectedNoteId,
      board: { ...board, quickNotes: board.quickNotes.filter(note => note.id !== action.id) },
    } : state
  }
}
