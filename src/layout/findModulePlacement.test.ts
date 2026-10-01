import { describe, expect, it } from 'vitest'
import { MODULE_REGISTRY } from './moduleRegistry'
import { findModulePlacement, overlaps } from './findModulePlacement'

const bounds = { width: 1600, height: 1000 }
describe('colocación de los nueve módulos', () => {
  it('declara exactamente nombres, tamaños iniciales y mínimos aprobados', () => {
    expect(Object.values(MODULE_REGISTRY).map(m => [m.name, m.initial, m.minimum])).toEqual([
      ['Pizarra', [720, 480], [320, 220]], ['Elementos', [300, 420], [220, 240]],
      ['Información', [320, 240], [220, 140]], ['Operativo', [340, 320], [240, 200]],
      ['Coordenadas', [360, 280], [260, 180]], ['Reloj', [440, 480], [320, 260]],
      ['Calculadora', [280, 360], [220, 280]], ['Cuaderno', [360, 420], [260, 220]],
      ['Registro cronológico', [420, 320], [280, 180]],
    ])
  })
  it('recupera exactamente una distribución guardada libre, incluso fuera de múltiplos de 20', () => {
    const saved = { x: 37, y: 53, width: 723, height: 487, referenceSize: { width: 1600, height: 1000 } }
    expect(findModulePlacement({ id: 'board', saved }, [], bounds)).toEqual({ layout: saved, exceptional: false, notice: null })
  })
  it('busca de izquierda a derecha y luego abajo sin mutar los ocupados', () => {
    const occupied = [{ x: 0, y: 0, width: 1300, height: 480, referenceSize: { width: 1600, height: 1000 } }]
    const before = structuredClone(occupied)
    expect(findModulePlacement({ id: 'elements' }, occupied, bounds).layout).toEqual({ x: 1300, y: 0, width: 300, height: 420, referenceSize: { width: 1600, height: 1000 } })
    expect(findModulePlacement({ id: 'board' }, occupied, bounds).layout).toEqual({ x: 0, y: 480, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } })
    expect(occupied).toEqual(before)
  })
  it('elige el hueco más cercano manteniendo el tamaño guardado', () => {
    const saved = { x: 500, y: 400, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }
    const occupied = [{ x: 490, y: 390, width: 340, height: 260, referenceSize: { width: 1600, height: 1000 } }]
    expect(findModulePlacement({ id: 'information', saved }, occupied, bounds).layout).toEqual({ ...saved, y: 150 })
  })
  it('solo sin hueco abre al mínimo centrado, con el aviso exacto', () => {
    const occupied = [{ x: 0, y: 0, ...bounds, referenceSize: { ...bounds } }]
    const result = findModulePlacement({ id: 'board' }, occupied, bounds)
    expect(result).toEqual({ layout: { x: 640, y: 390, width: 320, height: 220, referenceSize: { width: 1600, height: 1000 } }, exceptional: true,
      notice: 'No hay espacio libre. Recoloca o cierra algún módulo.' })
    expect(overlaps(result.layout, occupied[0]!)).toBe(true)
    expect(overlaps({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 })).toBe(false)
  })
  it('mantiene el tamaño solicitado: un hueco solo apto para el mínimo no evita la excepción', () => {
    expect(findModulePlacement({ id: 'board' }, [{ x: 0, y: 0, width: 1250, height: 1000, referenceSize: { width: 1600, height: 1000 } }], bounds).exceptional).toBe(true)
  })
})
