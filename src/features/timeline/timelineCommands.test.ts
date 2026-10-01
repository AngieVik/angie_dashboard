import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { validateDocument } from '../../domain/document/validateDocument'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { createElement, deleteElement, updateElement } from '../elements/elementCommands'
import { addManualTimelineEntry, editManualTimelineEntry, deleteManualTimelineEntry, undoAutomaticTimelineEntry, canUndoAutomaticTimelineEntry, formatTimelineTime } from './timelineCommands'

function setup() {
  const document = createEmptyDocument()
  const a = createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
  const b = createElement(document, { name: 'Tango 2', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
  const first = changeElementStatus(document, a.id, 'Asignada', new Date())
  const second = changeElementStatus(first, a.id, 'En camino', new Date())
  return { document: changeElementStatus(second, b.id, 'Inoperativa', new Date()), a, b }
}
describe('Registro cronológico', () => {
  it('crea, edita y elimina entradas manuales conservando UUID y fecha', () => {
    const document = createEmptyDocument(), now = new Date()
    const added = addManualTimelineEntry(document, 'Acceso cerrado 🚧', now)
    expect(document.timeline[0]).toEqual({ id: added.id, type: 'manual', text: 'Acceso cerrado 🚧', occurredAt: now.toISOString() })
    editManualTimelineEntry(document, added.id, 'Acceso abierto')
    expect(document.timeline[0]).toMatchObject({ id: added.id, text: 'Acceso abierto', occurredAt: now.toISOString() })
    expect(validateDocument(document).success).toBe(true)
    deleteManualTimelineEntry(document, added.id)
    expect(document.timeline).toEqual([])
  })
  it('muestra hora española con verano e invierno y conserva fecha UTC completa', () => {
    expect(formatTimelineTime('2026-07-01T12:32:08.000Z')).toBe('14:32:08')
    expect(formatTimelineTime('2026-01-01T12:32:08.000Z')).toBe('13:32:08')
  })
  it('formatea segundos intercalares admitidos por el contrato sin perder la fecha original', () => {
    const document = createEmptyDocument()
    document.timeline = [{ id: crypto.randomUUID(), type: 'manual', text: 'Importada', occurredAt: '2016-12-31T23:59:60Z' }]
    expect(validateDocument(document).success).toBe(true)
    expect(formatTimelineTime(document.timeline[0]!.occurredAt)).toBe('00:59:60')
    expect(document.timeline[0]!.occurredAt).toBe('2016-12-31T23:59:60Z')
  })
  it('resuelve UUID sin distinguir mayúsculas y agrupa el historial de la misma dotación', () => {
    const { document, a } = setup()
    const third = changeElementStatus(document, a.id, 'Disponible', new Date())
    const fourth = changeElementStatus(third, a.id, 'Asignada', new Date())
    for (const entry of fourth.timeline) {
      if (entry.type === 'status-change' && entry.unitId === a.id && entry !== fourth.timeline[0]) entry.unitId = entry.unitId.toUpperCase()
    }
    expect(validateDocument(fourth).success).toBe(true)
    const latest = fourth.timeline.at(-1)!
    expect(canUndoAutomaticTimelineEntry(fourth, latest.id)).toBe(true)
    expect(canUndoAutomaticTimelineEntry(fourth, fourth.timeline[0]!.id)).toBe(false)
    const result = undoAutomaticTimelineEntry(fourth, latest.id)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.document.elements.find(unit => unit.id === a.id)?.operational?.status).toBe('Disponible')
      expect(result.document.timeline).toHaveLength(4)
      expect(validateDocument(result.document).success).toBe(true)
    }
  })
  it('inserta manuales en orden ascendente y no permite editar o eliminar automáticas', () => {
    const { document } = setup(), first = document.timeline[0]!, before = structuredClone(document)
    expect(() => editManualTimelineEntry(document, first.id, 'Otro')).toThrow()
    expect(() => deleteManualTimelineEntry(document, first.id)).toThrow()
    expect(document).toEqual(before)
    addManualTimelineEntry(document, 'Preparación', new Date('2026-01-01T00:00:00.000Z'))
    expect(document.timeline[0]).toMatchObject({ type: 'manual', text: 'Preparación' })
  })
  it('conserva precisión UTC completa al insertar entre entradas importadas', () => {
    const document = createEmptyDocument()
    document.timeline = [{ id: crypto.randomUUID(), type: 'manual', text: 'Importada', occurredAt: '2026-01-01T12:00:00.0009Z' }]
    addManualTimelineEntry(document, 'Anterior', new Date('2026-01-01T12:00:00.000Z'))
    expect(document.timeline.map(entry => entry.type === 'manual' && entry.text)).toEqual(['Anterior', 'Importada'])
    expect(validateDocument(document).success).toBe(true)
  })
  it('deshace por dotación en orden inverso sin interferir con otras ni crear entradas', () => {
    const { document, a, b } = setup(), [old, latest, other] = document.timeline
    expect(canUndoAutomaticTimelineEntry(document, old!.id)).toBe(false)
    expect(canUndoAutomaticTimelineEntry(document, latest!.id)).toBe(true)
    expect(canUndoAutomaticTimelineEntry(document, other!.id)).toBe(true)
    const before = structuredClone(document)
    const undo = undoAutomaticTimelineEntry(document, latest!.id)
    expect(undo.success).toBe(true)
    if (!undo.success) return
    expect(undo.document.elements.find(e => e.id === a.id)?.operational?.status).toBe('Asignada')
    expect(undo.document.elements.find(e => e.id === b.id)?.operational?.status).toBe('Inoperativa')
    expect(undo.document.timeline.map(e => e.id)).toEqual([old!.id, other!.id])
    expect(document).toEqual(before)
    expect(canUndoAutomaticTimelineEntry(undo.document, old!.id)).toBe(true)
    const again = undoAutomaticTimelineEntry(undo.document, old!.id)
    expect(again.success).toBe(true)
    if (again.success) {
      expect(again.document.elements[0]?.operational?.status).toBe('Disponible')
      expect(again.document.timeline.map(e => e.id)).toEqual([other!.id])
      expect(validateDocument(again.document).success).toBe(true)
    }
  })
  it('rechaza entradas antiguas, incoherentes, manuales o ausentes atómicamente', () => {
    const { document } = setup()
    const manual = addManualTimelineEntry(document, 'Revisión', new Date())
    if (document.elements[0]?.isUnit) document.elements[0].operational.status = 'Operativa'
    const before = structuredClone(document)
    for (const id of [document.timeline[0]!.id, document.timeline[1]!.id, manual.id, crypto.randomUUID()]) {
      const result = undoAutomaticTimelineEntry(document, id)
      expect(result.success).toBe(false)
      expect(document).toEqual(before)
      expect(canUndoAutomaticTimelineEntry(document, id)).toBe(false)
    }
  })
  it('conserva el nombre histórico tras renombrar o eliminar la unidad, sin deshacer tras eliminar', () => {
    const { document, a } = setup(), entry = document.timeline[1]!
    updateElement(document, a.id, { name: 'Tango nuevo' })
    expect(entry).toMatchObject({ unitName: 'Tango 1' })
    deleteElement(document, a.id)
    expect(document.timeline).toHaveLength(3)
    expect(canUndoAutomaticTimelineEntry(document, entry.id)).toBe(false)
    expect(undoAutomaticTimelineEntry(document, entry.id).success).toBe(false)
    expect(validateDocument(document).success).toBe(true)
  })
})
