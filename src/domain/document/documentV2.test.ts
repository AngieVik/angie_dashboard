import { describe, expect, it } from 'vitest'
import legacy from './fixtures/complete.json'
import { createEmptyDocument } from './defaultDocument'
import { migrateDocument } from './migrateDocument'
import { validateDocumentV2 as validateDocument } from './validateDocumentV2'
import v3 from './fixtures/v3-complete.json'

// Expected V2 assembled from the approved contract, independently of migration.
function expectedV2() {
  const source = structuredClone(legacy)
  const { filters: _filters, ...rest } = source
  void _filters
  return {
    ...rest, formatVersion: 2,
    board: { ...rest.board, quickNotes: rest.board.quickNotes.map(note => ({ ...note, width: 180, height: 80 })) },
    elements: rest.elements.map(element => ({ ...element, visual: { ...element.visual, scale: element.visual.scale ?? 1 } })),
    notebook: rest.notebook.map(block => ({ ...block, title: block.type === 'note' ? 'Nota' : 'Checklist' })),
    moduleLayouts: Object.fromEntries(Object.entries(rest.moduleLayouts).map(([id, layout]) => [id, { ...layout, referenceSize: { width: 1600, height: 1000 } }])),
  }
}

describe('contrato histórico V2', () => {
  it('crea ocho raíces vigentes sin filtros', () => {
    const document = createEmptyDocument()
    expect(document.formatVersion).toBe(3)
    expect(Object.keys(document)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
  })

  it('migra V1 íntegro conservando todos los datos y sin mutar su origen', () => {
    const source = structuredClone(legacy)
    source.filters.visibleStatuses = []
    const before = structuredClone(source)
    const result = migrateDocument(source)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(JSON.stringify(result.errors))
    expect(result.migrated).toBe(true)
    expect(result.document).toEqual(v3)
    result.document.document.title = 'Copia independiente'
    expect(source).toEqual(before)
  })

  it('valida V2 y admite escena superior a 1000 y referencias grandes', () => {
    const input = expectedV2()
    input.board.strokes[0]!.points[0] = { x: 2400.5, y: 1600.5 }
    input.board.quickNotes[0]!.position = { x: 2400, y: 1200 }
    input.elements[0]!.position = { x: 3200, y: 1800 }
    input.notebook[0]!.title = ''
    input.moduleLayouts.board = { x: 1800, y: 1000, width: 720, height: 480, referenceSize: { width: 3000, height: 2000 } }
    expect(validateDocument(input)).toEqual({ success: true, document: input })
    const result = migrateDocument(input)
    expect(result.success && result.migrated).toBe(true)
  })

  it.each([
    ['filters', {}], ['board.quickNotes.0.width', 119], ['board.quickNotes.0.height', 63],
    ['board.quickNotes.0.width', Infinity], ['elements.1.visual.scale', 0.249], ['elements.1.visual.scale', 3.001],
    ['notebook.0.title', null], ['moduleLayouts.board.referenceSize.width', 759],
    ['moduleLayouts.board.referenceSize.height', 509], ['moduleLayouts.board.referenceSize.width', 1600.5],
    ['board.strokes.0.points.0.x', -1], ['elements.0.position.x', NaN],
    ['moduleLayouts.board.referenceSize.extra', true],
  ])('rechaza V2 inválido en %s sin modificarlo', (path, value) => {
    const input = expectedV2()
    const parts = path.split('.')
    const key = parts.pop()!
    let target: unknown = input
    for (const part of parts) target = (target as Record<string, unknown>)[part]
    ;(target as Record<string, unknown>)[key] = value
    const before = structuredClone(input)
    expect(validateDocument(input).success).toBe(false)
    expect(input).toEqual(before)
  })

  it.each(['board.quickNotes.0.width', 'elements.1.visual.scale', 'notebook.0.title', 'moduleLayouts.board.referenceSize'])('exige el campo nuevo %s', path => {
    const input = expectedV2()
    const parts = path.split('.')
    const key = parts.pop()!
    let target: unknown = input
    for (const part of parts) target = (target as Record<string, unknown>)[part]
    delete (target as Record<string, unknown>)[key]
    expect(validateDocument(input).success).toBe(false)
  })

  it.each([
    (input: typeof legacy) => { input.board.quickNotes[0]!.position.x = 1001 },
    (input: typeof legacy) => { input.elements[1]!.id = input.elements[0]!.id },
    (input: typeof legacy) => { input.filters.visibleStatuses = ['unknown'] },
  ])('rechaza V1 dañado antes de convertirlo', damage => {
    const source = structuredClone(legacy)
    damage(source)
    const before = structuredClone(source)
    expect(migrateDocument(source)).toMatchObject({ success: false, code: 'invalid-document' })
    expect(source).toEqual(before)
  })
})
