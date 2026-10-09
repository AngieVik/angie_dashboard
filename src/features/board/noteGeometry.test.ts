import { describe, expect, it } from 'vitest'
import { scaleQuickNote, growQuickNote } from './noteGeometry'
import type { QuickNote } from '../../domain/document/types'
const note: QuickNote = { id: 'note', title: 'Accesos', text: 'Norte', scale: 1, width: 180, height: 58, position: { x: 102, y: 41 } }
describe('geometría de nota rápida', () => {
  it('escala caja y contenido conservando esquina y original sin límite de zoom', () => {
    expect(scaleQuickNote(note, 2)).toEqual({ ...note, scale: 2, width: 360, height: 116, position: { x: 192, y: 70 } })
    expect(note).toMatchObject({ scale: 1, width: 180, height: 58, position: { x: 102, y: 41 } })
    expect(scaleQuickNote(note, 5).scale).toBe(5)
    expect(scaleQuickNote(note, .1).scale).toBe(.1)
  })
  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])('rechaza factor o resultado no finito: %s', factor => {
    expect(scaleQuickNote(note, factor)).toBe(note)
  })
  it('autogrowth conserva ancho, escala y esquina; acepta reducir líneas', () => {
    const grown = growQuickNote(note, 98)
    expect(grown).toEqual({ ...note, height: 98, position: { x: 102, y: 61 } })
    expect(growQuickNote(grown, 58)).toEqual(note)
    expect(growQuickNote(note, NaN)).toBe(note)
  })
})
