import { describe, expect, it } from 'vitest'
import { correctCurrentStatusEntry, reviseTimelineText } from './timelineCommands'
import { getTimelineEntryText } from '../../domain/operations/timelineProjection'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { migrateDocument } from '../../domain/document/migrateDocument'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { validateDocument } from '../../domain/document/validateDocument'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { createElement } from '../elements/elementCommands'
import { addManualTimelineEntry, editManualTimelineEntry, deleteManualTimelineEntry, formatTimelineTime } from './timelineCommands'

function setup() {
  const document = createEmptyDocument()
  const a = createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
  const b = createElement(document, { name: 'Tango 2', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
  const first = changeElementStatus(document, a.id, 'Activada', new Date())
  const second = changeElementStatus(first, a.id, 'Aproximandose', new Date())
  return { document: changeElementStatus(second, b.id, 'Inoperativa', new Date()), a, b }
}
describe('Registro cronológico', () => {
  it('crea, edita y elimina entradas manuales conservando UUID y fecha', () => {
    const document = createEmptyDocument(), now = new Date()
    const added = addManualTimelineEntry(document, 'Acceso cerrado 🚧', now)
    expect(document.timeline[0]).toEqual({ id: added.id, type: 'manual', revisions: [], text: 'Acceso cerrado 🚧', occurredAt: now.toISOString() })
    editManualTimelineEntry(document, added.id, 'Acceso abierto')
    expect(document.timeline[0]).toMatchObject({ id: added.id, text: 'Acceso cerrado 🚧', occurredAt: now.toISOString(), revisions: [{ kind: 'text', text: 'Acceso abierto' }] })
    expect(validateDocument(document).success).toBe(true)
    deleteManualTimelineEntry(document, added.id)
    expect(document.timeline[0]?.revisions).toMatchObject([{ kind: 'text' }, { kind: 'delete' }])
  })
  it('muestra hora española con verano e invierno y conserva fecha UTC completa', () => {
    expect(formatTimelineTime('2026-07-01T12:32:08.000Z')).toBe('14:32:08')
    expect(formatTimelineTime('2026-01-01T12:32:08.000Z')).toBe('13:32:08')
  })
  it('formatea segundos intercalares admitidos por el contrato sin perder la fecha original', () => {
    const document = createEmptyDocument()
    document.timeline = [{ id: crypto.randomUUID(), type: 'manual', revisions: [], text: 'Importada', occurredAt: '2016-12-31T23:59:60Z' }]
    expect(validateDocument(document).success).toBe(true)
    expect(formatTimelineTime(document.timeline[0]!.occurredAt)).toBe('00:59:60')
    expect(document.timeline[0]!.occurredAt).toBe('2016-12-31T23:59:60Z')
  })
  it('conserva precisión UTC completa al insertar entre entradas importadas', () => {
    const document = createEmptyDocument()
    document.timeline = [{ id: crypto.randomUUID(), type: 'manual', revisions: [], text: 'Importada', occurredAt: '2026-01-01T12:00:00.0009Z' }]
    addManualTimelineEntry(document, 'Anterior', new Date('2026-01-01T12:00:00.000Z'))
    expect(document.timeline.map(entry => entry.type === 'manual' && entry.text)).toEqual(['Anterior', 'Importada'])
    expect(validateDocument(document).success).toBe(true)
  })
})

describe('entrega 9: revisiones y guardia operativa', () => {
  it('revisa texto automático actual y antiguo sin modificar estados, originales ni orden', () => {
    const { document } = setup(), before = structuredClone(document)
    const now = new Date().toISOString()
    for (const entry of document.timeline) reviseTimelineText(document, entry.id.toUpperCase(), 'Rótulo revisado', now)
    expect(document.elements).toEqual(before.elements)
    expect(document.timeline.map(entry => entry.occurredAt)).toEqual(before.timeline.map(entry => entry.occurredAt))
    for (const [index, entry] of document.timeline.entries()) {
      expect(entry).toMatchObject({ ...before.timeline[index], revisions: [{ kind: 'text', recordedAt: now, text: 'Rótulo revisado' }] })
      expect(getTimelineEntryText(entry)).toBe('Rótulo revisado')
    }
    expect(migrateDocument(JSON.parse(serializeDocument(document)))).toMatchObject({ success: true, document })
  })
  it('corrige solo Actual con guardia y conserva texto revisado e independencia entre unidades', () => {
    const { document, a, b } = setup(), entry = document.timeline[1]!
    const now = new Date().toISOString()
    reviseTimelineText(document, entry.id, 'Confirmación de radio', now)
    correctCurrentStatusEntry(document, entry.id, { currentEntryId: entry.id.toUpperCase(), status: 'Aproximandose', revisionCount: 1 }, now)
    expect(document.elements.find(unit => unit.id === a.id)?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(document.elements.find(unit => unit.id === b.id)?.operational?.status).toBe('Inoperativa')
    expect(entry.revisions).toMatchObject([{ kind: 'text' }, { kind: 'correction', recordedAt: now }])
    expect(getTimelineEntryText(entry)).toBe('Confirmación de radio')
    expect(migrateDocument(JSON.parse(serializeDocument(document)))).toMatchObject({ success: true, document })
    reviseTimelineText(document, entry.id, 'Texto corregido', now)
    expect(getTimelineEntryText(entry)).toBe('Texto corregido')
  })
  it.each(['reference', 'status', 'revision', 'deleted', 'unit', 'manual', 'repeated'] as const)('rechaza guardia obsoleta %s antes de mutar la copia', scenario => {
    const { document, a } = setup(), entry = document.timeline[1]!
    const expected = { currentEntryId: entry.id, status: 'Aproximandose' as const, revisionCount: 0 }
    const now = new Date().toISOString()
    if (scenario === 'reference') Object.assign(document, changeElementStatus(document, a.id, 'Interviniendo', new Date()))
    if (scenario === 'status' && document.elements[0]?.isUnit) document.elements[0].operational.status = 'Disponible'
    if (scenario === 'revision') entry.revisions.push({ id: crypto.randomUUID(), kind: 'text', recordedAt: now, text: 'Concurrente' })
    if (scenario === 'deleted') entry.revisions.push({ id: crypto.randomUUID(), kind: 'delete', recordedAt: now })
    if (scenario === 'unit') document.elements = []
    if (scenario === 'manual') expected.currentEntryId = addManualTimelineEntry(document, 'Manual', new Date()).id
    if (scenario === 'repeated') correctCurrentStatusEntry(document, entry.id, expected, now)
    const before = structuredClone(document)
    expect(() => correctCurrentStatusEntry(document, scenario === 'manual' ? expected.currentEntryId : entry.id, expected, now)).toThrow(/cambió|vigente|Actual|disponible/)
    expect(document).toEqual(before)
  })
})
