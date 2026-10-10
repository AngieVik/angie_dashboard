import { describe, expect, it } from 'vitest'
import { repositionModules } from './repositionModules'
import type { ModuleId } from './layoutTypes'
const module = (id: ModuleId, width = 300, height = 200) => ({ id, layout: { x: 80, y: 60, width, height, referenceSize: { width: 2000, height: 1200 } } })
describe('Puzzle compacto', () => {
  it('junta módulos sin separación, conserva tamaños cuando caben y no muta la entrada', () => {
    const input = [module('information'), module('elements'), module('board')]
    const before = structuredClone(input)
    const result = repositionModules(input, { width: 900, height: 200 })
    expect(result.map(item => item.id)).toEqual(['board', 'elements', 'information'])
    expect(result.map(item => [item.layout.x, item.layout.y, item.layout.width, item.layout.height])).toEqual([[0, 0, 300, 200], [300, 0, 300, 200], [600, 0, 300, 200]])
    expect(input).toEqual(before)
  })
  it.each([{ width: 700, height: 500 }, { width: 240, height: 160 }, { width: 1200, height: 300 }])('ajusta módulos a ambos límites visibles %o sin superposición', size => {
    const result = repositionModules([module('board', 900, 400), module('elements', 300, 90), module('information', 300, 240)], size)
    for (const { layout: a } of result) {
      expect([a.x, a.y, a.width, a.height].every(Number.isInteger)).toBe(true)
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.x + a.width).toBeLessThanOrEqual(size.width + .001)
      expect(a.y + a.height).toBeLessThanOrEqual(size.height + .001)
      for (const { layout: b } of result) if (a !== b) expect(a.x + a.width <= b.x + .001 || b.x + b.width <= a.x + .001 || a.y + a.height <= b.y + .001 || b.y + b.height <= a.y + .001).toBe(true)
    }
  })
  it('rellena el hueco de una fila con un ajuste moderado de altura', () => {
    const result = repositionModules([module('board', 300, 200), module('elements', 300, 180)], { width: 600, height: 200 })
    expect(result.map(item => item.layout.height)).toEqual([200, 200])
  })
  it('aprovecha el hueco bajo un módulo corto antes de reducir tamaños', () => {
    const result = repositionModules([module('board', 300, 400), module('elements', 300, 180), module('information', 300, 180)], { width: 600, height: 400 })
    expect(result.map(item => [item.layout.x, item.layout.y, item.layout.width, item.layout.height])).toEqual([[0, 0, 300, 400], [300, 0, 300, 180], [300, 180, 300, 180]])
  })
  it('mantiene el mínimo técnico al combinar módulos diminutos y grandes', () => {
    const result = repositionModules([module('board', 2000, 1000), module('information', 1, 1)], { width: 400, height: 300 })
    for (const { layout } of result) {
      expect(layout.width).toBeGreaterThanOrEqual(1); expect(layout.height).toBeGreaterThanOrEqual(1)
      expect(layout.x + layout.width).toBeLessThanOrEqual(400)
      expect(layout.y + layout.height).toBeLessThanOrEqual(300)
    }
  })
  it('cero abiertos no genera geometrías', () => expect(repositionModules([], { width: 400, height: 300 })).toEqual([]))
  it('rechaza superficies inválidas', () => expect(() => repositionModules([module('board')], { width: 400, height: 0 })).toThrow())
})
