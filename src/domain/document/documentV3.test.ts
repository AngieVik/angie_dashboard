import { describe, expect, it } from 'vitest'
import v1 from './fixtures/complete.json'
import v2 from './fixtures/v2-complete.json'
import { createEmptyDocument } from './defaultDocument'
import { migrateDocument } from './migrateDocument'
import { validateDocument } from './validateDocument'
import { serializeDocument } from './serializeDocument'
import { validateDocumentV2 } from './validateDocumentV2'

function migrated(source: unknown) {
  const result = migrateDocument(source)
  if (!result.success) throw new Error(JSON.stringify(result.errors))
  return result.document
}
describe('lectura y exportación V3', () => {
  it('congela V2 sin endurecer estado guardado ni relaciones nuevas', () => {
    const source = structuredClone(v2)
    source.elements[0]!.operational!.status = 'Inoperativa'
    expect(validateDocumentV2(source)).toEqual({ success: true, document: source })
    expect(() => serializeDocument(source as unknown as ReturnType<typeof createEmptyDocument>)).toThrow()
  })
  it('conserva precisión y valida fechas e IDs de revisiones sin coerción', () => {
    const document = migrated(v2)
    document.timeline[0]!.revisions = [
      { id: crypto.randomUUID(), kind: 'text', recordedAt: '2026-09-30T18:45:10.0001Z', text: 'En camino' },
      { id: crypto.randomUUID(), kind: 'text', recordedAt: '2026-09-30T18:45:10.0002Z', text: 'Asignada' },
    ]
    expect(migrated(JSON.parse(serializeDocument(document)))).toEqual(document)
    document.timeline[0]!.revisions[1]!.recordedAt = '2026-09-30T18:45:10.00009Z'
    expect(validateDocument(document).success).toBe(false)
  })
  it('rechaza referencias a unidad ajena o a una selección anterior aunque coincida el estado', () => {
    const document = migrated(v2)
    const entry = document.timeline[1]!
    document.timeline.push({ ...entry, id: crypto.randomUUID(), revisions: [] })
    expect(validateDocument(document).success).toBe(false)
    if (entry.type === 'status-change') entry.unitId = document.elements[1]!.id
    document.timeline.pop()
    expect(validateDocument(document).success).toBe(false)
  })
  it('fecha real de primera revisión es independiente de la fecha original importada', () => {
    const document = createEmptyDocument()
    document.timeline.push({ id: crypto.randomUUID(), type: 'manual', text: 'Importada', occurredAt: '2099-01-01T00:00:00Z', revisions: [
      { id: crypto.randomUUID(), kind: 'text', recordedAt: '2026-10-05T00:00:00Z', text: 'Revisada hoy' },
    ] })
    expect(validateDocument(document).success).toBe(true)
    document.timeline[0]!.revisions.push({ id: crypto.randomUUID(), kind: 'delete', recordedAt: '2026-10-04T00:00:00Z' })
    expect(validateDocument(document).success).toBe(false)
  })
  it('exporta ocho raíces V3 y no incluye estado temporal ni temporizadores', () => {
    const document = JSON.parse(serializeDocument(createEmptyDocument()))
    expect(document.formatVersion).toBe(3)
    expect(Object.keys(document)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
  })
  it.each([v1, v2])('conserva origen, identidad, texto libre, fechas, iconos y geometrías al convertir', source => {
    const input = structuredClone(source)
    input.document.updatedAt = '2026-09-30T18:45:10.000123Z'
    input.elements[0]!.information = 'Asignada / En camino / En destino'
    const before = structuredClone(input)
    const converted = migrated(input)
    expect(converted.formatVersion).toBe(3)
    expect(converted.document).toEqual(input.document)
    expect(converted.board.quickNotes[0]).toEqual({ ...v2.board.quickNotes[0], title: '', scale: 1 })
    expect(converted.elements[0]).toMatchObject({ information: input.elements[0]!.information, pinVisible: true, visual: input.elements[0]!.visual,
      operational: { status: 'Aproximandose', currentEntryId: '00000000-0000-4000-8000-000000000012' } })
    expect(converted.timeline[1]).toMatchObject({ previousStatus: 'Activada', nextStatus: 'Aproximandose', revisions: [] })
    expect(converted.moduleLayouts).toEqual(v2.moduleLayouts)
    expect(converted.moduleLayouts).not.toHaveProperty('dotations')
    expect(input).toEqual(before)
    expect(migrateDocument(converted)).toMatchObject({ success: true, migrated: false, document: converted })
  })
  it.each([
    ['Disponible', 'Disponible'], ['Asignada', 'Activada'], ['En camino', 'Aproximandose'], ['En el lugar', 'Interviniendo'],
    ['En traslado', 'Trasladando'], ['En destino', 'Transfiriendo'], ['Operativa', 'Operativa'], ['Inoperativa', 'Inoperativa'],
  ])('convierte %s solo en campos estructurados a %s; prevalece Registro', (oldStatus, nextStatus) => {
    const input = structuredClone(v2)
    input.elements[0]!.operational!.status = 'Disponible'
    Object.assign(input.timeline[1]!, { previousStatus: oldStatus, nextStatus: oldStatus })
    input.elements[0]!.operational!.notes = oldStatus
    const document = migrated(input)
    expect(document.elements[0]?.operational?.status).toBe(nextStatus)
    expect(document.elements[0]?.operational?.notes).toBe(oldStatus)
    expect(document.timeline[1]).toMatchObject({ previousStatus: nextStatus, nextStatus })
  })
  it('importa unidad sin cambios reales como sin estado, sin inventar entradas', () => {
    const source = structuredClone(v2)
    source.timeline = source.timeline.slice(0, 1)
    const document = migrated(source)
    expect(document.elements[0]?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(document.timeline).toHaveLength(1)
  })
  it('admite diez layouts y nuevos campos; conserva ausencia de estado con historial al recargar', () => {
    const document = migrated(v2)
    document.moduleLayouts.dotations = { x: 2800, y: 1800, width: 300, height: 420, referenceSize: { width: 3200, height: 2400 } }
    Object.assign(document.elements[0]!.operational!, { status: null, currentEntryId: null })
    Object.assign(document.elements[0]!, { pinVisible: false })
    Object.assign(document.board.quickNotes[0]!, { title: 'Accesos', scale: 0.1, width: 18, height: 8 })
    expect(migrated(JSON.parse(serializeDocument(document)))).toEqual(document)
  })
  it.each([
    (d: ReturnType<typeof migrated>) => Object.assign(d, { filters: {} }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.elements[0]!, { pinVisible: 'true' }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.elements[0]!.operational!, { currentEntryId: null }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.elements[0]!.operational!, { status: 'Asignada' }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.board.quickNotes[0]!, { scale: 0 }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.board.quickNotes[0]!, { scale: Infinity }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.board.quickNotes[0]!, { title: null }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.moduleLayouts.elements!, { x: 1600 }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.timeline[1]!, { revisions: [{ id: d.document.id, kind: 'delete', recordedAt: d.document.updatedAt }] }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.timeline[1]!, { revisions: [{ id: crypto.randomUUID(), kind: 'correction', recordedAt: d.document.updatedAt }] }),
    (d: ReturnType<typeof migrated>) => Object.assign(d.timeline[0]!, { revisions: [{ id: crypto.randomUUID(), kind: 'correction', recordedAt: d.document.updatedAt }] }),
  ])('rechaza V3 incoherente sin corregirlo', damage => {
    const document = migrated(v2)
    damage(document)
    const before = structuredClone(document)
    expect(validateDocument(document).success).toBe(false)
    expect(migrateDocument(document)).toMatchObject({ success: false, code: 'invalid-document' })
    expect(document).toEqual(before)
  })
  it.each([v1, v2])('valida cada contrato antiguo antes de convertir', source => {
    const damaged = structuredClone(source)
    Object.assign(damaged.elements[0]!, { pinVisible: true })
    expect(migrateDocument(damaged)).toMatchObject({ success: false, code: 'invalid-document' })
  })
})
