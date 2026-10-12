import { describe, expect, it } from 'vitest'
import v1 from './fixtures/complete.json'
import v2 from './fixtures/v2-complete.json'
import v3 from './fixtures/v3-complete.json'
import { createEmptyDocument } from './defaultDocument'
import { migrateDocument } from './migrateDocument'
import { serializeDocument } from './serializeDocument'
import { validateDocument } from './validateDocument'
import { changeElementStatus } from '../operations/changeStatus'
import { reviseTimelineText } from '../../features/timeline/timelineCommands'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX9sAAAAASUVORK5CYII='
function load(source: unknown) {
  const result = migrateDocument(source)
  if (!result.success) throw new Error(JSON.stringify(result.errors))
  return result.document
}
describe('documento portable V4', () => {
  it('exporta V4 con imagen y geometría sin sesión, permisos ni temporizadores', () => {
    const document = createEmptyDocument('Servicio')
    Object.assign(document.board, { backgroundImage: { dataUrl: png, layout: { x: -10, y: 20, width: 800, height: 600 } } })
    const exported = JSON.parse(serializeDocument(document))
    expect(exported.formatVersion).toBe(4)
    expect(exported.board.backgroundImage).toEqual({ dataUrl: png, layout: { x: -10, y: 20, width: 800, height: 600 } })
    expect(Object.keys(exported)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
    expect(load(exported)).toEqual(document)
  })
  it.each([v1, v2, v3])('migra originales reconocidos a V4 conservando identidad y horas exactas', source => {
    const original = structuredClone(source)
    const document = load(source)
    expect(document.formatVersion).toBe(4)
    expect(document.document).toEqual(source.document)
    expect(document.timeline.map(entry => entry.occurredAt)).toEqual(source.timeline.map(entry => entry.occurredAt))
    expect(source).toEqual(original)
  })
  it('conserva los campos de la V3 ampliada y rechaza versiones futuras', () => {
    const source = structuredClone(v3)
    Object.assign(source.elements[0]!.visual, { rotation: 180, flipX: true })
    Object.assign(source.elements[0]!, { nameColor: 'yellow', nameOffset: { x: 3, y: 4 } })
    const document = load(source)
    expect(document.elements[0]).toMatchObject({ visual: { rotation: 180, flipX: true }, nameColor: 'yellow', nameOffset: { x: 3, y: 4 } })
    expect(migrateDocument({ ...document, formatVersion: 5 })).toMatchObject({ success: false, code: 'future-version' })
  })
  it.each([
    { dataUrl: 'data:image/svg+xml;base64,AAAA', layout: { x: 0, y: 0, width: 1, height: 1 } },
    { dataUrl: 'data:image/png;base64,AAAA', layout: { x: 0, y: 0, width: 1, height: 1 } },
    { dataUrl: png, layout: { x: 0, y: 0, width: 0, height: 1 } },
  ])('rechaza imágenes embebidas inválidas sin corregir el origen', image => {
    const document = createEmptyDocument()
    Object.assign(document.board, { backgroundImage: image })
    const original = structuredClone(document)
    expect(validateDocument(document).success).toBe(false)
    expect(document).toEqual(original)
  })
  it('preserva cada hora de entrada y las revisiones al exportar y volver a abrir', () => {
    let document = load(v3)
    const unit = document.elements.find(element => element.isUnit)!
    document = changeElementStatus(document, unit.id, 'Activada', new Date('2026-10-12T06:10:23.000Z'))
    document = changeElementStatus(document, unit.id, 'Interviniendo', new Date('2026-10-12T06:12:05.000Z'))
    document = changeElementStatus(document, unit.id, 'Activada', new Date('2026-10-12T06:18:41.000Z'))
    const current = document.elements.find(element => element.id === unit.id)!.operational!.currentEntryId!
    reviseTimelineText(document, current, 'Aviso confirmado', '2026-10-12T06:20:00.000Z')
    const same = changeElementStatus(document, unit.id, 'Activada', new Date('2026-10-12T06:25:00.000Z'))
    const restored = load(JSON.parse(serializeDocument(same)))
    expect(restored.timeline.slice(-3).map(entry => entry.occurredAt)).toEqual(['2026-10-12T06:10:23.000Z', '2026-10-12T06:12:05.000Z', '2026-10-12T06:18:41.000Z'])
    expect(restored.elements.find(element => element.id === unit.id)!.operational!.currentEntryId).toBe(current)
    expect(restored.timeline.at(-1)?.revisions[0]?.recordedAt).toBe('2026-10-12T06:20:00.000Z')
  })
})
