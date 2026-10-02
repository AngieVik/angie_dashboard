import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { boardReducer, createBoardState } from './boardReducer'

const strokeId = '00000000-0000-4000-8000-000000000001'
const noteId = '00000000-0000-4000-8000-000000000002'
const initial = () => createBoardState(createEmptyDocument().board)

describe('pizarra: modos y documento', () => {
  it('seleccionar es el modo inicial y cambiar de modo cancela el gesto pendiente', () => {
    let state = initial()
    expect(state.mode).toBe('select')
    state = boardReducer(state, { type: 'start', id: strokeId, point: { x: 1, y: 2 }, color: '#D63A3A', width: 4 })
    expect(state.draft).toBeNull()
    state = boardReducer(state, { type: 'mode', mode: 'pen' })
    state = boardReducer(state, { type: 'start', id: strokeId, point: { x: 1, y: 2 }, color: '#d63a3a', width: 4 })
    expect(state.board.strokes).toHaveLength(0)
    expect(state.draft?.tool).toBe('pen')
    state = boardReducer(state, { type: 'mode', mode: 'eraser' })
    expect(state.draft).toBeNull()
    expect(state.mode).toBe('eraser')
    expect(boardReducer(state, { type: 'finish' }).board.strokes).toHaveLength(0)
  })

  it('finaliza trazos en coordenadas lógicas y conserva orden, color opaco y puntos dentro del lienzo', () => {
    let state = boardReducer(initial(), { type: 'mode', mode: 'pen' })
    state = boardReducer(state, { type: 'start', id: strokeId, point: { x: 120.5, y: 340.25 }, color: '#d63a3a', width: 4 })
    state = boardReducer(state, { type: 'point', point: { x: 1100, y: -30 } })
    state = boardReducer(state, { type: 'finish' })
    expect(state.board.strokes).toEqual([{ id: strokeId, tool: 'pen', color: '#D63A3A', width: 4,
      points: [{ x: 120.5, y: 340.25 }, { x: 1100, y: 0 }] }])
    expect(state.draft).toBeNull()
    const document = createEmptyDocument(); document.board = state.board
    expect(JSON.parse(serializeDocument(document)).board).toEqual(state.board)
  })

  it('goma registra solo una máscara de trazos sin alterar fondo ni notas', () => {
    let state = boardReducer(initial(), { type: 'background', color: '#ffffff' })
    state = boardReducer(state, { type: 'mode', mode: 'note' })
    state = boardReducer(state, { type: 'add-note', note: { id: noteId, text: 'Acceso norte', position: { x: 500, y: 350 }, width: 220, height: 96 } })
    const notes = state.board.quickNotes
    state = boardReducer(state, { type: 'mode', mode: 'eraser' })
    state = boardReducer(state, { type: 'start', id: strokeId, point: { x: 500, y: 350 }, color: '#D63A3A', width: 20 })
    state = boardReducer(state, { type: 'finish' })
    expect(state.board.strokes[0]).toEqual({ id: strokeId, tool: 'eraser', color: null, width: 20, points: [{ x: 500, y: 350 }] })
    expect(state.board.backgroundColor).toBe('#FFFFFF')
    expect(state.board.quickNotes).toBe(notes)
  })

  it('crea una nota y vuelve a seleccionar; solo seleccionar permite moverla, editarla y eliminarla', () => {
    let state = boardReducer(initial(), { type: 'mode', mode: 'note' })
    state = boardReducer(state, { type: 'add-note', note: { id: noteId, text: 'Acceso norte', position: { x: 500, y: 350 }, width: 220, height: 96 } })
    expect(state.mode).toBe('select')
    state = boardReducer(state, { type: 'move-note', id: noteId, position: { x: -10, y: 1100 } })
    expect(state.board.quickNotes[0]?.position).toEqual({ x: 0, y: 1100 })
    state = boardReducer(state, { type: 'edit-note', id: noteId, text: 'Acceso sur' })
    expect(state.board.quickNotes[0]?.text).toBe('Acceso sur')
    const before = state.board
    state = boardReducer(state, { type: 'mode', mode: 'pen' })
    expect(boardReducer(state, { type: 'move-note', id: noteId, position: { x: 100, y: 100 } }).board).toBe(before)
    expect(boardReducer(state, { type: 'delete-note', id: noteId }).board).toBe(before)
    state = boardReducer(state, { type: 'mode', mode: 'select' })
    state = boardReducer(state, { type: 'delete-note', id: noteId })
    expect(state.board.quickNotes).toEqual([])
  })

  it('ignora puntos no finitos y grosores inválidos sin producir un documento inválido', () => {
    const state = boardReducer(initial(), { type: 'mode', mode: 'pen' })
    expect(boardReducer(state, { type: 'start', id: strokeId, point: { x: NaN, y: 0 }, color: '#D63A3A', width: 4 }).draft).toBeNull()
    expect(boardReducer(state, { type: 'start', id: strokeId, point: { x: 0, y: 0 }, color: '#D63A3A', width: 0 }).draft).toBeNull()
  })
  it('redimensiona solo la caja de una nota seleccionable, conserva centro y texto y serializa sus dimensiones', () => {
    let state = boardReducer(initial(), { type: 'mode', mode: 'note' })
    state = boardReducer(state, { type: 'add-note', note: { id: noteId, text: 'Ruta', position: { x: 1500, y: 1200 }, width: 220, height: 96 } })
    state = boardReducer(state, { type: 'resize-note', id: noteId, size: { width: 80, height: 40 } })
    expect(state.board.quickNotes[0]).toEqual({ id: noteId, text: 'Ruta', position: { x: 1500, y: 1200 }, width: 120, height: 64 })
    const document = createEmptyDocument(); document.board = state.board
    expect(JSON.parse(serializeDocument(document)).board.quickNotes).toEqual(state.board.quickNotes)
    expect(boardReducer(state, { type: 'resize-note', id: noteId, size: { width: NaN, height: 100 } })).toBe(state)
    state = boardReducer(state, { type: 'mode', mode: 'pen' })
    expect(boardReducer(state, { type: 'resize-note', id: noteId, size: { width: 300, height: 100 } }).board).toBe(state.board)
  })
})
