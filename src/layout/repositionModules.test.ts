import { describe, expect, it } from 'vitest'
import { repositionModules } from './repositionModules'
import type { ModuleId } from './layoutTypes'
const module = (id: ModuleId, width = 300, height = 200) => ({ id, layout: { x: 80, y: 60, width, height, referenceSize: { width: 2000, height: 1200 } } })
describe('Puzzle por ancho visible', () => {
  it.each([.25, 1, 2, 4])('ordena estable con separación 12 a zoom %s sin mutar entrada', scale => {
    const input = [module('information'), module('elements'), module('board')]
    const before = structuredClone(input), width = 960 / scale
    const result = repositionModules(input, width)
    expect(result.map(item => item.id)).toEqual(['board', 'elements', 'information'])
    expect(result[0]!.layout).toMatchObject({ x: 12, y: 12, width: 300, height: 200 })
    expect(result[1]!.layout).toMatchObject(width >= 624 ? { x: 324, y: 12 } : { x: 12, y: 224 })
    for (const item of result) {
      expect(item.layout.x + item.layout.width).toBeLessThanOrEqual(item.layout.referenceSize.width)
      expect(item.layout.y + item.layout.height).toBeLessThanOrEqual(item.layout.referenceSize.height)
    }
    expect(input).toEqual(before)
  })
  it('aisla oversized y usa altura máxima anterior para la fila siguiente', () => {
    const result = repositionModules([module('elements', 300, 90), module('board', 900, 400), module('information', 300, 240)], 700)
    expect(result.map(item => [item.layout.x, item.layout.y])).toEqual([[12, 12], [12, 424], [324, 424]])
  })
  it('cero abiertos no genera geometrías', () => expect(repositionModules([], 400)).toEqual([]))
})