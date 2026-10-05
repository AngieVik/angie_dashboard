import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './defaultDocument'
import { validateDocumentV1 as validateDocument } from './validateDocumentV1'
import { validateDocument as validateDocumentV3 } from './validateDocument'
import v3Complete from './fixtures/v3-complete.json'
import v2Valid from './fixtures/v2-valid.json'
import { migrateDocument } from './migrateDocument'
import { serializeDocument } from './serializeDocument'
import valid from './fixtures/valid.json'
import complete from './fixtures/complete.json'
import foreign from './fixtures/foreign.json'
import future from './fixtures/future.json'
import unrecognizedOld from './fixtures/unrecognized-old.json'

const statuses = ['Disponible', 'Asignada', 'En camino', 'En el lugar', 'En traslado', 'En destino', 'Operativa', 'Inoperativa']

// Alter fixtures without weakening production types to represent invalid inputs.
function altered(path: string, value: unknown): unknown {
  const input = structuredClone(complete)
  const parts = path.split('.')
  const key = parts.pop()!
  let target: unknown = input
  for (const part of parts) target = (target as Record<string, unknown>)[part]
  ;(target as Record<string, unknown>)[key] = value
  return input
}

function expectRejected(input: unknown, path: string) {
  const before = structuredClone(input)
  const result = validateDocument(input)
  expect(result.success).toBe(false)
  expect(result).not.toHaveProperty('document')
  if (result.success) throw new Error('Se aceptó un documento inválido')
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ path, message: expect.any(String) }),
  ]))
  expect(input).toEqual(before)
}

describe('documento vacío V3', () => {
  it('crea las ocho raíces con estructura completa y valores iniciales', () => {
    const before = Date.now()
    const document = createEmptyDocument()
    expect(document).toEqual({
      ...v2Valid, formatVersion: 3,
      document: { id: expect.any(String), title: '', createdAt: expect.any(String), updatedAt: expect.any(String) },
    })
    expect(document.document.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(document.document.updatedAt).toBe(document.document.createdAt)
    expect(Date.parse(document.document.createdAt)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(document.document.createdAt)).toBeLessThanOrEqual(Date.now())
    expect(validateDocumentV3(document).success).toBe(true)
  })

  it('conserva exactamente el título y genera documentos independientes', () => {
    const first = createEmptyDocument('  Servicio ágil 🚩.json  ')
    const second = createEmptyDocument()
    expect(first.document.title).toBe('  Servicio ágil 🚩.json  ')
    expect(first.document.id).not.toBe(second.document.id)
    first.board.quickNotes.push({ id: crypto.randomUUID(), title: '', scale: 1, text: '', position: { x: 0, y: 0 }, width: 220, height: 96 })
    expect(second.board.quickNotes).toEqual([])
  })
})

describe('validación estricta del contrato V1', () => {
  it.each([['vacío', valid], ['completo', complete]])('acepta el fixture %s sin modificarlo', (_, input) => {
    const before = structuredClone(input)
    const result = validateDocument(input)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(JSON.stringify(result.errors))
    expect(result.document).toEqual(before)
    expect(input).toEqual(before)
  })

  it.each([null, [], false, 1, 'texto'])('rechaza una raíz inválida %j', input => {
    expectRejected(input, '$')
  })

  it.each(Object.keys(valid))('exige la propiedad raíz %s', key => {
    const input: Record<string, unknown> = structuredClone(valid)
    delete input[key]
    expectRejected(input, key)
  })

  it('exige todos los campos de cada objeto presente salvo claves de moduleLayouts', () => {
    const walk = (node: unknown, parts: string[]) => {
      if (Array.isArray(node)) {
        node.forEach((value, index) => walk(value, [...parts, String(index)]))
      } else if (node !== null && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (parts.join('.') !== 'moduleLayouts') {
            const input = altered([...parts, key].join('.'), undefined)
            const path = [...parts, key].join('.').replace(/\.(\d+)/g, '[$1]')
            expectRejected(input, path)
          }
          walk(value, [...parts, key])
        }
      }
    }
    // Root requirements have their own test above.
    Object.entries(complete).forEach(([key, value]) => walk(value, [key]))
  })

  it.each([
    ['document.id', 'UUID', 'document.id'],
    ['document.createdAt', '2026-09-30T18:42:15+00:00', 'document.createdAt'],
    ['document.createdAt', '2026-02-30T18:42:15.000Z', 'document.createdAt'],
    ['document.updatedAt', '2026-09-30', 'document.updatedAt'],
    ['document.updatedAt', '2026-09-30T18:42:14.999Z', 'document.updatedAt'],
    ['document.title', null, 'document.title'],
    ['board.backgroundColor', '#25282b', 'board.backgroundColor'],
    ['board.backgroundColor', '#FFF', 'board.backgroundColor'],
    ['board.backgroundColor', '#25282BFF', 'board.backgroundColor'],
    ['board.strokes.0.id', 'trazo', 'board.strokes[0].id'],
    ['board.strokes.0.tool', 'brush', 'board.strokes[0].tool'],
    ['board.strokes.0.color', null, 'board.strokes[0].color'],
    ['board.strokes.1.color', '#D63A3A', 'board.strokes[1].color'],
    ['board.strokes.0.width', 0, 'board.strokes[0].width'],
    ['board.strokes.0.width', -1, 'board.strokes[0].width'],
    ['board.strokes.0.width', NaN, 'board.strokes[0].width'],
    ['board.strokes.0.width', Infinity, 'board.strokes[0].width'],
    ['board.strokes.0.points', [], 'board.strokes[0].points'],
    ['board.strokes.0.points.0.x', -0.01, 'board.strokes[0].points[0].x'],
    ['board.strokes.0.points.0.y', 1000.01, 'board.strokes[0].points[0].y'],
    ['board.quickNotes.0.id', '', 'board.quickNotes[0].id'],
    ['board.quickNotes.0.position.x', Infinity, 'board.quickNotes[0].position.x'],
    ['board.quickNotes.0.position.y', -1, 'board.quickNotes[0].position.y'],
    ['elements.0.id', 'elemento', 'elements[0].id'],
    ['elements.0.name', ' \t\n', 'elements[0].name'],
    ['elements.0.visual.type', 'image', 'elements[0].visual.type'],
    ['elements.0.visual.assetId', 'unknown', 'elements[0].visual.assetId'],
    ['elements.0.visual.scale', 0.249, 'elements[0].visual.scale'],
    ['elements.0.visual.scale', 3.001, 'elements[0].visual.scale'],
    ['elements.0.visual.scale', '1', 'elements[0].visual.scale'],
    ['elements.0.visual.value', '🚑', 'elements[0].visual.value'],
    ['elements.1.visual.assetId', 'ambulance', 'elements[1].visual.assetId'],
    ['elements.1.visual.value', '', 'elements[1].visual.value'],
    ['elements.0.position.x', -1, 'elements[0].position.x'],
    ['elements.0.position.y', 1001, 'elements[0].position.y'],
    ['elements.0.operational', null, 'elements[0].operational'],
    ['elements.1.operational', { status: 'Disponible', notes: '', tags: [] }, 'elements[1].operational'],
    ['elements.0.operational.status', 'disponible', 'elements[0].operational.status'],
    ['elements.0.operational.notes', null, 'elements[0].operational.notes'],
    ['elements.0.operational.tags', [''], 'elements[0].operational.tags[0]'],
    ['elements.0.operational.tags', ['  '], 'elements[0].operational.tags[0]'],
    ['elements.0.operational.tags', [' Apoyo'], 'elements[0].operational.tags[0]'],
    ['elements.0.operational.tags', ['Apoyo '], 'elements[0].operational.tags[0]'],
    ['elements.0.operational.tags', ['Apoyo', 'apoyo'], 'elements[0].operational.tags[1]'],
    ['elements.0.operational.tags', ['Apoyo', 'Apoyo'], 'elements[0].operational.tags[1]'],
    ['notebook.0.id', 'bloque', 'notebook[0].id'],
    ['notebook.0.type', 'heading', 'notebook[0].type'],
    ['notebook.0.items', [], 'notebook[0].items'],
    ['notebook.1.text', '', 'notebook[1].text'],
    ['notebook.1.items.0.id', 'item', 'notebook[1].items[0].id'],
    ['notebook.1.items.0.checked', 1, 'notebook[1].items[0].checked'],
    ['timeline.0.id', 'entrada', 'timeline[0].id'],
    ['timeline.0.type', 'event', 'timeline[0].type'],
    ['timeline.0.unitId', '00000000-0000-4000-8000-000000000005', 'timeline[0].unitId'],
    ['timeline.1.text', '', 'timeline[1].text'],
    ['timeline.1.unitId', 'unidad', 'timeline[1].unitId'],
    ['timeline.1.previousStatus', 'En asistencia', 'timeline[1].previousStatus'],
    ['timeline.1.nextStatus', 'Disponible ', 'timeline[1].nextStatus'],
    ['timeline.1.occurredAt', '2026-09-30T18:42:14.999Z', 'timeline[1].occurredAt'],
    ['timeline.1.occurredAt', '2026-09-30T18:45:10.000+02:00', 'timeline[1].occurredAt'],
    ['moduleLayouts.board.x', -1, 'moduleLayouts.board.x'],
    ['moduleLayouts.board.x', 0.5, 'moduleLayouts.board.x'],
    ['moduleLayouts.board.y', -1, 'moduleLayouts.board.y'],
    ['moduleLayouts.board.width', 1601, 'moduleLayouts.board.width'],
    ['moduleLayouts.board.height', 1001, 'moduleLayouts.board.height'],
    ['moduleLayouts.board.x', 881, 'moduleLayouts.board.x'],
    ['moduleLayouts.board.y', 521, 'moduleLayouts.board.y'],
    ['moduleLayouts.board.visible', true, 'moduleLayouts.board.visible'],
    ['moduleLayouts.unknown', { x: 0, y: 0, width: 300, height: 300 }, 'moduleLayouts.unknown'],
    ['filters.visibleStatuses', ['Disponible', 'Disponible'], 'filters.visibleStatuses'],
    ['filters.visibleStatuses', ['Unknown'], 'filters.visibleStatuses[0]'],
    ['board.image', '/fondo.png', 'board.image'],
    ['elements.0.visual.png', 'base64', 'elements[0].visual.png'],
    ['elements.0.operational.phase', 'Aproximación', 'elements[0].operational.phase'],
    ['notebook.0.title', 'Título', 'notebook[0].title'],
    ['notebook.0.order', 0, 'notebook[0].order'],
  ])('rechaza %s = %j con ruta', (path, value, expectedPath) => {
    expectRejected(altered(path as string, value), expectedPath as string)
  })

  it.each(['clock', 'timers', 'tzero', 'tminus', 'advisories', 'calculator', 'coordinates', 'selection', 'viewport', 'moduleVisibility', 'menus', 'backgroundImage'])('rechaza el estado temporal raíz %s', key => {
    expectRejected({ ...complete, [key]: {} }, key)
  })

  it.each([
    ['board', 320, 220], ['elements', 220, 240], ['information', 220, 140],
    ['operations', 240, 200], ['coordinates', 260, 180], ['clock', 320, 260],
    ['calculator', 220, 280], ['notebook', 260, 220], ['timeline', 280, 180],
  ] as const)('respeta tamaño mínimo, enteros y límites de %s', (id, width, height) => {
    expect(validateDocument(altered(`moduleLayouts.${id}`, { x: 1600 - width, y: 1000 - height, width, height })).success).toBe(true)
    expect(validateDocument(altered(`moduleLayouts.${id}`, { x: 0, y: 0, width: 1600, height: 1000 })).success).toBe(true)
    expectRejected(altered(`moduleLayouts.${id}.width`, width - 1), `moduleLayouts.${id}.width`)
    expectRejected(altered(`moduleLayouts.${id}.height`, height - 1), `moduleLayouts.${id}.height`)
    expectRejected(altered(`moduleLayouts.${id}.height`, height + 0.5), `moduleLayouts.${id}.height`)
  })

  it.each(statuses)('admite el estado exacto %s', status => {
    expect(validateDocument(altered('elements.0.operational.status', status)).success).toBe(true)
  })

  it.each(['ambulance', 'pathfinder', 'quad', 'checkpoint', 'hydration', 'start', 'finish', 'warning', 'pushpin'])('admite el icono %s', assetId => {
    expect(validateDocument(altered('elements.0.visual.assetId', assetId)).success).toBe(true)
  })

  it.each([0.25, 3])('admite la escala límite %s', scale => {
    expect(validateDocument(altered('elements.0.visual.scale', scale)).success).toBe(true)
  })

  it('admite textos vacíos, filtros vacíos, etiquetas distintas e historial de una unidad eliminada', () => {
    const input = structuredClone(complete)
    input.document.title = ''
    input.board.quickNotes[0]!.text = ''
    input.notebook[0]!.text = ''
    input.timeline[0]!.text = ''
    input.elements.splice(0, 1)
    input.filters.visibleStatuses = []
    expect(validateDocument(input).success).toBe(true)
    expect(validateDocument(altered('elements.0.operational.tags', ['Ágil', 'Canal 2'])).success).toBe(true)
  })

  it('admite fechas UTC válidas sin milisegundos y ordena instantes con fracciones', () => {
    expect(validateDocument(altered('document.createdAt', '2024-02-29T00:00:00Z')).success).toBe(true)
    const input = structuredClone(complete)
    input.timeline[0]!.occurredAt = '2026-09-30T18:42:15.1Z'
    input.timeline[1]!.occurredAt = '2026-09-30T18:42:15.10Z'
    expect(validateDocument(input).success).toBe(true)
    input.timeline[0]!.occurredAt = '2026-09-30T18:42:15.1002Z'
    input.timeline[1]!.occurredAt = '2026-09-30T18:42:15.1001Z'
    expectRejected(input, 'timeline[1].occurredAt')
  })

  it.each([
    ['elements.1.id', complete.elements[0]!.id, 'elements[1].id'],
    ['board.strokes.1.id', complete.board.strokes[0]!.id, 'board.strokes[1].id'],
    ['notebook.1.id', complete.notebook[0]!.id, 'notebook[1].id'],
    ['notebook.1.items.1.id', complete.notebook[1]!.items![0]!.id, 'notebook[1].items[1].id'],
    ['timeline.1.id', complete.timeline[0]!.id, 'timeline[1].id'],
    ['board.quickNotes.0.id', complete.document.id, 'board.quickNotes[0].id'],
    ['elements.1.id', complete.board.quickNotes[0]!.id, 'elements[1].id'],
  ])('rechaza identidades repetidas en %s sin alterar el original', (path, id, errorPath) => {
    const input = altered(path, id)
    expectRejected(input, errorPath)
    const result = migrateDocument(input)
    expect(result.success).toBe(false)
    expect(result).not.toHaveProperty('document')
  })

  it('no confunde las referencias unitId con identificadores propios duplicados', () => {
    const input = structuredClone(complete)
    input.timeline.push({ ...input.timeline[1]!, id: '00000000-0000-4000-8000-000000000013' })
    expect(validateDocument(input).success).toBe(true)
  })
})

describe('infraestructura de migración', () => {
  it('convierte V1 a V3 sin tocar el original', () => {
    const input = structuredClone(complete)
    const result = migrateDocument(input)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(JSON.stringify(result.errors))
    expect(result.migrated).toBe(true)
    expect(result.document).toEqual(v3Complete)
    result.document.document.title = 'Copia'
    expect(input).toEqual(complete)
  })

  it.each([['ajeno', foreign, 'format'], ['futuro', { ...future, formatVersion: 4 }, 'formatVersion'], ['antiguo no reconocido', unrecognizedOld, 'formatVersion'], ['V1 incoherente', altered('elements.0.operational', null), 'elements[0].operational']])('rechaza %s sin documento sustituto', (_, input, path) => {
    const before = structuredClone(input)
    const result = migrateDocument(input)
    expect(result.success).toBe(false)
    expect(result).not.toHaveProperty('document')
    if (result.success) throw new Error('Se aceptó un documento inválido')
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
    expect(input).toEqual(before)
  })

  it.each([
    [unrecognizedOld, 'unsupported-old-version'], [{ ...future, formatVersion: 4 }, 'future-version'],
    [foreign, 'invalid-format'], [{}, 'invalid-format'],
    [{ format: 'angie-dashboard', formatVersion: '1' }, 'invalid-version'],
    [{ format: 'angie-dashboard', formatVersion: 1.5 }, 'invalid-version'],
  ])('distingue el motivo de rechazo de versión/formato %j', (input, code) => {
    const result = migrateDocument(input)
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Se aceptó un documento inválido')
    expect(result.code).toBe(code)
    expect(result).not.toHaveProperty('document')
  })

  it('no acepta como documento un archivo JSON dañado ni una cadena sin analizar', () => {
    const damaged = readFileSync('src/domain/document/fixtures/damaged.json', 'utf8')
    expect(() => JSON.parse(damaged)).toThrow(SyntaxError)
    expectRejected(damaged, '$')
    expect(migrateDocument(damaged).success).toBe(false)
  })
})

describe('serialización segura', () => {
  it('exporta dos espacios y un salto final conservando todos los arrays y el título', () => {
    const result = validateDocumentV3(v3Complete)
    if (!result.success) throw new Error(JSON.stringify(result.errors))
    const before = structuredClone(result.document)
    const json = serializeDocument(result.document)
    expect(json.startsWith('{\n  "format": "angie-dashboard",\n  "formatVersion": 3,\n')).toBe(true)
    expect(json.endsWith('}\n')).toBe(true)
    expect(JSON.parse(json)).toEqual(v3Complete)
    expect(result.document).toEqual(before)
    expect(validateDocumentV3(JSON.parse(json)).success).toBe(true)
  })

  it('rechaza un documento inválido antes de serializar sin corregirlo', () => {
    const result = validateDocumentV3(v3Complete)
    if (!result.success) throw new Error(JSON.stringify(result.errors))
    result.document.board.strokes[0]!.width = Infinity
    expect(() => serializeDocument(result.document)).toThrow(/board\.strokes\[0\]\.width/)
    expect(result.document.board.strokes[0]!.width).toBe(Infinity)
  })
})
