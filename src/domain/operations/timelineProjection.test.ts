import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/defaultDocument'
import { serializeDocument } from '../document/serializeDocument'
import { migrateDocument } from '../document/migrateDocument'
import { createElement, duplicateElement, deleteElement } from '../../features/elements/elementCommands'
import { changeElementStatus } from './changeStatus'
import { addManualTimelineEntry, editManualTimelineEntry, deleteManualTimelineEntry, deleteTimelineEntry, undoAutomaticTimelineEntry, canUndoAutomaticTimelineEntry } from '../../features/timeline/timelineCommands'
import { getCurrentEntryId, getTimelineEntryText, projectUnitStatus } from './timelineProjection'

function setup() {
  const document = createEmptyDocument()
  const unit = createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
  return { document, unit }
}
describe('selección explícita e historial V3', () => {
  it('proyección null nunca recupera historial; referencia de otra unidad no resuelve', () => {
    const { document, unit } = setup()
    const selected = changeElementStatus(document, unit.id, 'Disponible', new Date())
    const entry = selected.timeline[0]!
    expect(projectUnitStatus(selected.timeline, unit.id, null)).toBeNull()
    expect(projectUnitStatus(selected.timeline, crypto.randomUUID(), entry.id)).toBeNull()
    expect(projectUnitStatus(selected.timeline, unit.id, entry.id.toUpperCase())).toBe('Disponible')
    expect(getCurrentEntryId(selected, unit.id.toUpperCase())).toBe(entry.id)
  })
  it('borrar antigua conserva Actual; borrar Actual deja sin estado aunque haya historial', () => {
    const { document, unit } = setup()
    const first = changeElementStatus(document, unit.id, 'Disponible', new Date())
    const second = changeElementStatus(first, unit.id, 'Activada', new Date())
    const third = changeElementStatus(second, unit.id, 'Aproximandose', new Date())
    deleteTimelineEntry(third, second.timeline[1]!.id)
    expect(third.elements[0]?.operational).toMatchObject({ status: 'Aproximandose', currentEntryId: third.timeline[2]!.id })
    deleteTimelineEntry(third, third.timeline[2]!.id)
    expect(third.elements[0]?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(third.timeline).toHaveLength(3)
    expect(migrateDocument(JSON.parse(serializeDocument(third)))).toMatchObject({ success: true, document: third })
    const next = changeElementStatus(third, unit.id, 'Aproximandose', new Date())
    expect(next.timeline[3]).toMatchObject({ previousStatus: null, nextStatus: 'Aproximandose' })
  })
  it('crear y duplicar no asignan estado, referencia ni entradas', () => {
    const { document, unit } = setup()
    const copy = duplicateElement(document, unit.id)
    expect(unit.operational).toEqual({ status: null, currentEntryId: null, notes: '', tags: [] })
    expect(copy.operational).toEqual(unit.operational)
    expect(copy.id).not.toBe(unit.id)
    expect(document.timeline).toEqual([])
  })
  it('cada selección válida asigna Actual; repetir actual no modifica nada', () => {
    const { document, unit } = setup()
    const first = changeElementStatus(document, unit.id, 'Disponible', new Date())
    expect(first.timeline[0]).toMatchObject({ previousStatus: null, nextStatus: 'Disponible', revisions: [] })
    expect(first.elements[0]?.operational).toMatchObject({ status: 'Disponible', currentEntryId: first.timeline[0]!.id })
    expect(changeElementStatus(first, unit.id, 'Disponible', new Date(Date.now() + 1000))).toBe(first)
    const second = changeElementStatus(first, unit.id, 'Activada', new Date())
    const third = changeElementStatus(second, unit.id, 'Disponible', new Date())
    expect(third.timeline).toHaveLength(3)
    expect(new Set(third.timeline.map(e => e.id)).size).toBe(3)
    expect(third.elements[0]?.operational?.currentEntryId).toBe(third.timeline[2]!.id)
  })
  it('corrección provisional de Actual conserva historial y deja sin estado sin recuperar anterior', () => {
    const { document, unit } = setup()
    const first = changeElementStatus(document, unit.id, 'Disponible', new Date())
    const second = changeElementStatus(first, unit.id, 'Activada', new Date())
    const before = structuredClone(second)
    const result = undoAutomaticTimelineEntry(second, second.timeline[1]!.id)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.message)
    expect(result.document.elements[0]?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(result.document.timeline).toHaveLength(2)
    expect(result.document.timeline[1]).toMatchObject({ revisions: [{ kind: 'correction' }] })
    expect(canUndoAutomaticTimelineEntry(result.document, first.timeline[0]!.id)).toBe(false)
    expect(second).toEqual(before)
    const loaded = migrateDocument(JSON.parse(serializeDocument(result.document)))
    expect(loaded).toMatchObject({ success: true, document: result.document })
    const next = changeElementStatus(result.document, unit.id, 'Activada', new Date())
    expect(next.timeline[2]).toMatchObject({ previousStatus: null, nextStatus: 'Activada' })
  })
  it('editar/eliminar manual conserva el original, UUID, fechas y revisiones', () => {
    const { document } = setup()
    const entry = addManualTimelineEntry(document, 'Acceso cerrado', new Date())
    const original = structuredClone(entry)
    editManualTimelineEntry(document, entry.id, 'Acceso abierto')
    expect(getTimelineEntryText(document.timeline[0]!)).toBe('Acceso abierto')
    deleteManualTimelineEntry(document, entry.id)
    expect(document.timeline[0]).toMatchObject({ ...original, revisions: [{ kind: 'text', text: 'Acceso abierto' }, { kind: 'delete' }] })
    expect(document.timeline).toHaveLength(1)
    expect(() => editManualTimelineEntry(document, entry.id, 'Oculta')).toThrow()
  })
  it('unidad eliminada conserva sus entradas históricas y no puede corregirse', () => {
    const { document, unit } = setup()
    const selected = changeElementStatus(document, unit.id, 'Disponible', new Date())
    deleteElement(selected, unit.id)
    expect(selected.timeline).toHaveLength(1)
    expect(canUndoAutomaticTimelineEntry(selected, selected.timeline[0]!.id)).toBe(false)
    expect(migrateDocument(JSON.parse(serializeDocument(selected))).success).toBe(true)
  })
})
