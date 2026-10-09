import { describe, expect, it } from 'vitest'
import { growWorkspaceExtent, reconstructWorkspaceExtent } from './workspaceExtent'
describe('extensión temporal del dashboard', () => {
  const visible = { width: 400, height: 300 }
  const saved = { x: 800, y: 700, width: 300, height: 200, referenceSize: { width: 1200, height: 1000 } }
  it('reconstruye también referencias de módulos cerrados', () => {
    expect(reconstructWorkspaceExtent(visible, { information: saved })).toEqual({ width: 1200, height: 1000 })
  })
  it('crece con margen 12 y nunca compacta por cierre o cambio de pantalla', () => {
    const grown = growWorkspaceExtent(visible, visible, [{ ...saved, referenceSize: visible }])
    expect(grown).toEqual({ width: 1112, height: 912 })
    expect(growWorkspaceExtent(grown, { width: 200, height: 100 }, [])).toEqual(grown)
    expect(reconstructWorkspaceExtent(visible, {})).toEqual(visible)
  })
})