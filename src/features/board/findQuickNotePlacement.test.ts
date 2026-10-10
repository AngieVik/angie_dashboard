import { describe, expect, it } from 'vitest'
import { findQuickNotePlacement } from './findQuickNotePlacement'

describe('primer hueco visible para una nota', () => {
  const visible = { x: 0, y: 0, width: 600, height: 400 }, size = { width: 180, height: 58 }
  it('ordena filas y columnas independientemente del orden de obstáculos', () => {
    const occupied = [{ x: 12, y: 12, ...size }, { x: 204, y: 12, ...size }]
    expect(findQuickNotePlacement(visible, size, occupied)).toEqual({ position: { x: 486, y: 41 }, overlapped: false })
    expect(findQuickNotePlacement(visible, size, occupied.toReversed())).toEqual({ position: { x: 486, y: 41 }, overlapped: false })
    expect(findQuickNotePlacement({ ...visible, width: 400 }, size, occupied)).toEqual({ position: { x: 102, y: 111 }, overlapped: false })
  })
  it('usa cámara desplazada y respeta origen y separación', () => {
    expect(findQuickNotePlacement({ x: 1000, y: 700, width: 600, height: 400 }, size, [])).toEqual({ position: { x: 1102, y: 741 }, overlapped: false })
    expect(findQuickNotePlacement(visible, size, [{ x: 12, y: 12, ...size }])).toEqual({ position: { x: 294, y: 41 }, overlapped: false })
  })
  it('superpone sin reducir tamaño y recorta solo padding si no cabe', () => {
    expect(findQuickNotePlacement({ x: 40, y: 20, width: 185, height: 65 }, size, [])).toEqual({ position: { x: 135, y: 56 }, overlapped: true })
    expect(findQuickNotePlacement({ x: 0, y: 0, width: 40, height: 20 }, size, [])).toEqual({ position: { x: 90, y: 29 }, overlapped: true })
    expect(findQuickNotePlacement(visible, size, [visible])).toEqual({ position: { x: 102, y: 41 }, overlapped: true })
  })
})

it('ocupación de nombres de pines visibles; ignora ocultos, trazos y fondo', async () => {
  const { getQuickNoteObstacles } = await import('./findQuickNotePlacement')
  const { createEmptyDocument } = await import('../../domain/document/defaultDocument')
  const { createElement } = await import('../elements/elementCommands')
  const document = createEmptyDocument()
  createElement(document, { name: 'Nombre largo', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 200, y: 100 } })
  const hidden = createElement(document, { name: 'Oculto', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 500, y: 500 } })
  hidden.pinVisible = false
  document.board.strokes.push({ id: crypto.randomUUID(), tool: 'pen', color: '#000000', width: 40, points: [{ x: 12, y: 12 }] })
  expect(getQuickNoteObstacles(document.board, document.elements, () => 200)).toEqual([{ x: 100, y: 68, width: 200, height: 64 }])
})

it('letra grande independiente del icono ocupa toda la altura del pin', async () => {
  const { getQuickNoteObstacles } = await import('./findQuickNotePlacement')
  const { createEmptyDocument } = await import('../../domain/document/defaultDocument')
  const { createElement } = await import('../elements/elementCommands')
  const d = createEmptyDocument()
  createElement(d, { name: 'CP', isUnit: false, information: '', nameFontSize: 72, visual: { type: 'emoji', value: '📍', scale: .25 }, position: { x: 200, y: 100 } })
  expect(getQuickNoteObstacles(d.board, d.elements, () => 50)).toEqual([{ x: 175, y: 18, width: 50, height: 90 }])
})
