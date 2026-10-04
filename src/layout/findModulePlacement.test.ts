import { describe, expect, it } from 'vitest'
import { MODULE_REGISTRY } from './moduleRegistry'
import { findModulePlacement, overlaps } from './findModulePlacement'

const bounds = { width: 1600, height: 1000 }
describe('colocación de los nueve módulos', () => {
  it('declara exactamente nombres, tamaños iniciales y mínimos aprobados', () => {
    expect(Object.values(MODULE_REGISTRY).map(m => m.minimum)).toEqual(Array.from({ length: 9 }, () => [1, 1]))
    expect(Object.values(MODULE_REGISTRY).map(m => [m.name, m.initial, m.contentMinimum])).toEqual([
      ['Pizarra', [720, 480], [320, 220]], ['Elementos', [300, 420], [220, 240]],
      ['Información', [320, 240], [220, 140]], ['Operativo', [340, 320], [240, 200]],
      ['Coordenadas', [360, 280], [260, 180]], ['Reloj', [440, 480], [360, 260]],
      ['Calculadora', [280, 360], [220, 280]], ['Cuaderno', [360, 420], [260, 220]],
      ['Registro cronológico', [420, 320], [280, 180]],
    ])
  })
  it('recupera exactamente una distribución guardada libre, incluso fuera de múltiplos de 20', () => {
    const saved = { x: 37, y: 53, width: 723, height: 487, referenceSize: { width: 1600, height: 1000 } }
    expect(findModulePlacement({ id: 'board', saved }, [], bounds)).toEqual({ layout: saved })
  })
  it('busca de izquierda a derecha y luego abajo sin mutar los ocupados', () => {
    const occupied = [{ x: 0, y: 0, width: 1300, height: 480, referenceSize: { width: 1600, height: 1000 } }]
    const before = structuredClone(occupied)
    expect(findModulePlacement({ id: 'elements' }, occupied, bounds).layout).toEqual({ x: 1300, y: 0, width: 300, height: 420, referenceSize: { width: 1600, height: 1000 } })
    expect(findModulePlacement({ id: 'board' }, occupied, bounds).layout).toEqual({ x: 0, y: 480, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } })
    expect(occupied).toEqual(before)
  })
  it('restaura la posición guardada incluso cuando está ocupada', () => {
    const saved = { x: 500, y: 400, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }
    const occupied = [{ x: 490, y: 390, width: 340, height: 260, referenceSize: { width: 1600, height: 1000 } }]
    expect(findModulePlacement({ id: 'information', saved }, occupied, bounds).layout).toEqual(saved)
  })
  it('sin hueco abre al tamaño inicial adaptado y sin excepción ni aviso', () => {
    const occupied = [{ x: 0, y: 0, ...bounds, referenceSize: { ...bounds } }]
    const result = findModulePlacement({ id: 'board' }, occupied, bounds)
    expect(result).toEqual({ layout: { x: 440, y: 260, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } } })
    expect(overlaps(result.layout, occupied[0]!)).toBe(true)
    expect(overlaps({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 })).toBe(false)
  })
  it('una colisión no reduce el tamaño inicial y una pantalla estrecha sí lo adapta', () => {
    expect(findModulePlacement({ id: 'board' }, [{ x: 0, y: 0, width: 1250, height: 1000, referenceSize: { width: 1600, height: 1000 } }], bounds).layout.width).toBe(720)
    expect(findModulePlacement({ id: 'board' }, [], { width: 412, height: 871 }).layout).toEqual({
      x: 0, y: 0, width: 412, height: 480, referenceSize: { width: 412, height: 871 },
    })
  })
})
