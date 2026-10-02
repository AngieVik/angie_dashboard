import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_CATALOG, ICON_BOXES, getPinBox } from './iconCatalog'

describe('catálogo aprobado', () => {
  it.each([[.5, 32], [2, 128], [3, 192]])('emoji escala %s conserva caja proporcional', (scale, side) => {
    expect(getPinBox({ type: 'emoji', value: '📍', scale })).toEqual({ width: side, height: side })
  })
  const entries = [
    ['ambulance', 'Ambulancia', 'icon_medical.png', 'Horizontal', 150, 100],
    ['pathfinder', 'Pathfinder', 'icon_vir.png', 'Horizontal', 150, 100],
    ['quad', 'Quad', 'icon_quad.png', 'Horizontal', 150, 100],
    ['checkpoint', 'CP', 'icon_cp.png', 'Cuadrado', 100, 100],
    ['hydration', 'EH', 'icon_eh.png', 'Vertical', 100, 150],
    ['start', 'START', 'icon_start.png', 'Cuadrado', 100, 100],
    ['finish', 'FINISH', 'icon_finish.png', 'Horizontal', 150, 100],
    ['warning', 'Advertencia', 'icon_peligro.png', 'Cuadrado', 100, 100],
    ['pushpin', 'Chincheta', 'icon_chincheta.png', 'Cuadrado', 100, 100],
  ] as const
  it('solo ofrece las tres cajas comunes y nueve IDs', () => {
    expect(ICON_BOXES).toEqual({ Horizontal: { width: 150, height: 100 }, Vertical: { width: 100, height: 150 }, Cuadrado: { width: 100, height: 100 } })
    expect(Object.keys(ICON_CATALOG)).toEqual(entries.map(entry => entry[0]))
  })
  it.each(entries)('%s resuelve archivo, nombre, clase y caja', (id, name, file, visualClass, width, height) => {
    expect(ICON_CATALOG[id]).toEqual({ id, name, path: `/assets/elements/${file}`, visualClass })
    expect(existsSync(resolve('public', ICON_CATALOG[id].path.slice(1)))).toBe(true)
    expect(getPinBox({ type: 'asset', assetId: id, scale: 1 })).toEqual({ width, height })
    expect(getPinBox({ type: 'asset', assetId: id, scale: 2 })).toEqual({ width: width * 2, height: height * 2 })
  })
})
