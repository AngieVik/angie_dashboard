import { expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { migrateDocument } from '../../domain/document/migrateDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { validateDocument } from '../../domain/document/validateDocument'
import { createElement, updateElement, duplicateElement } from './elementCommands'

it('guarda giro, inversiones y nombre independiente al duplicar y recargar sin romper V3 anterior', () => {
  const document = createEmptyDocument()
  const input = { name: 'Tango', visual: { type: 'asset' as const, assetId: 'ambulance' as const, scale: 1 }, information: '', isUnit: true }
  const element = createElement(document, { ...input, visual: { ...input.visual, rotation: 90, flipX: true, flipY: false } })
  updateElement(document, element.id, { nameOffset: { x: -170, y: 85 }, nameColor: 'yellow' })
  updateElement(document, element.id, { position: { x: 900, y: 1000 } })
  expect(element).toMatchObject({ nameOffset: { x: -170, y: 85 }, nameColor: 'yellow', visual: { rotation: 90, flipX: true, flipY: false } })
  const copy = duplicateElement(document, element.id)
  expect(copy).toMatchObject({ nameOffset: { x: -170, y: 85 }, nameColor: 'yellow', visual: element.visual, position: { x: 924, y: 1024 } })
  copy.nameOffset!.x = 40
  expect(element.nameOffset!.x).toBe(-170)
  const restored = migrateDocument(JSON.parse(serializeDocument(document)))
  expect(restored.success).toBe(true)
  if (restored.success) expect(restored.document.elements[0]).toMatchObject({ nameOffset: { x: -170, y: 85 }, nameColor: 'yellow', visual: element.visual })
  const legacy = createEmptyDocument()
  createElement(legacy, input)
  expect(migrateDocument(JSON.parse(serializeDocument(legacy))).success).toBe(true)
  const before = structuredClone(element)
  for (const rotation of [NaN, Infinity, -1, 361]) expect(() => updateElement(document, element.id, { name: 'No guardar', visual: { ...input.visual, rotation } })).toThrow()
  expect(() => updateElement(document, element.id, { nameOffset: { x: NaN, y: 0 } })).toThrow()
  expect(element).toEqual(before)
  Object.assign(element, { nameColor: 'unknown' })
  expect(validateDocument(document).success).toBe(false)
})

it('límites y notas respetan icono girado y nombre desplazado por separado', async () => {
  const { getBoardBounds } = await import('../board/boardViewport')
  const { getQuickNoteObstacles } = await import('../board/findQuickNotePlacement')
  const d = createEmptyDocument()
  const e = createElement(d, { name: 'Ruta', information: '', isUnit: false, visual: { type: 'asset', assetId: 'ambulance', scale: 1 } })
  Object.assign(e.visual, { rotation: 90 })
  Object.assign(e, { nameOffset: { x: 300, y: 200 } })
  expect(getBoardBounds({ width: 100, height: 100 }, d.board, d.elements)).toEqual({ left: 0, top: 0, right: 900, bottom: 711 })
  expect(getQuickNoteObstacles(d.board, d.elements, () => 200)).toEqual([
    { x: 450, y: 425, width: 100, height: 150 },
    { x: 700, y: 689, width: 200, height: 22 },
  ])
  e.nameHidden = true
  expect(getBoardBounds({ width: 100, height: 100 }, d.board, d.elements)).toEqual({ left: 0, top: 0, right: 550, bottom: 575 })
})

it('paleta mantiene contraste de texto al menos 4.5 a 1', async () => {
  const { PIN_NAME_COLORS } = await import('./pinPresentation')
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722
  }
  expect(Object.keys(PIN_NAME_COLORS)).toHaveLength(6)
  for (const theme of Object.values(PIN_NAME_COLORS)) {
    const bg = luminance(theme.backgroundColor), fg = luminance(theme.color)
    expect((Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05)).toBeGreaterThanOrEqual(4.5)
  }
})
