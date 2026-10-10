import { describe, expect, it } from 'vitest'
import { resizeQuickNote } from './noteGeometry'
import type { QuickNote } from '../../domain/document/types'
const note: QuickNote = { id: 'note', title: 'Accesos', text: 'Norte', scale: 1, width: 180, height: 58, position: { x: 102, y: 41 } }
describe('redimensionamiento convencional de nota rápida', () => {
  it('cambia ancho y alto por separado conservando esquina, texto y escala', () => {
    expect(resizeQuickNote(note, { width: 300, height: 58 })).toEqual({ ...note, width: 300, position: { x: 162, y: 41 } })
    expect(resizeQuickNote(note, { width: 180, height: 120 })).toEqual({ ...note, height: 120, position: { x: 102, y: 72 } })
    expect(note.width).toBe(180)
  })
  it('limita la reducción para conservar una línea y los controles', () => {
    expect(resizeQuickNote(note, { width: -100, height: 0 })).toMatchObject({ width: 48, height: 32, position: { x: 36, y: 28 }, scale: 1 })
  })
  it.each([NaN, Infinity])('rechaza tamaños o resultados no finitos: %s', width => {
    expect(resizeQuickNote(note, { width, height: 50 })).toBe(note)
  })
})
