import { describe, expect, it } from 'vitest'
import { snapModulePosition } from './snapModulePosition'
const rect = (x: number, y: number, width = 100, height = 80) => ({ x, y, width, height, referenceSize: { width: 1000, height: 800 } })
describe('imán de módulos', () => {
  it('alinea horizontalmente barras próximas sin solaparlas, incluidas las guardadas con 29 de alto', () => {
    for (const scale of [0.5, 1, 2]) for (const height of [27, 29]) {
      const other = rect(100, 100, 200, height)
      const result = snapModulePosition(rect(303, 101, 200, 27), [other], scale)
      expect(result).toEqual(rect(300, 100, 200, 27))
      expect(result.x).toBeGreaterThanOrEqual(other.x + other.width)
    }
    const overlapping = rect(103, 101, 200, 27)
    expect(snapModulePosition(overlapping, [rect(100, 100, 200, 29)], 1)).toEqual(overlapping)
  })
  it('une bordes próximos y alinea sus extremos sin cambiar el tamaño', () => {
    expect(snapModulePosition(rect(204, 103), [rect(100, 100)], 1)).toEqual(rect(200, 100))
    expect(snapModulePosition(rect(102, 184), [rect(100, 100)], 1)).toEqual(rect(100, 180))
  })
  it('usa una atracción de diez píxeles visibles con cualquier zoom', () => {
    expect(snapModulePosition(rect(211, 100), [rect(100, 100)], .5).x).toBe(200)
    expect(snapModulePosition(rect(209, 100), [rect(100, 100)], 1).x).toBe(200)
    expect(snapModulePosition(rect(204, 100), [rect(100, 100)], 2).x).toBe(200)
    expect(snapModulePosition(rect(206, 100), [rect(100, 100)], 2).x).toBe(206)
  })
  it('no atrae ventanas lejanas en el otro eje ni produce solapes', () => {
    expect(snapModulePosition(rect(204, 500), [rect(100, 100)], 1)).toEqual(rect(204, 500))
    expect(snapModulePosition(rect(103, 103), [rect(100, 100)], 1)).toEqual(rect(103, 103))
  })
  it('atrae al origen y elige el borde más cercano', () => {
    expect(snapModulePosition(rect(4, 3), [], 1)).toEqual(rect(0, 0))
    expect(snapModulePosition(rect(204, 100), [rect(100, 100), rect(306, 100)], 1).x).toBe(206)
  })
})
