import { describe, expect, it } from 'vitest'
import { adaptModuleLayout, getWorkspaceBounds } from './adaptiveLayout'

describe('geometrías adaptadas sin reescribir su referencia', () => {
  const saved = { x: 440, y: 260, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } }
  it('mantiene tamaño y anclaje y recupera la geometría original al volver', () => {
    const before = structuredClone(saved)
    expect(adaptModuleLayout(saved, { width: 1360, height: 800 }, { width: 320, height: 220 })).toEqual({
      x: 320, y: 160, width: 720, height: 480, referenceSize: { width: 1360, height: 800 },
    })
    expect(adaptModuleLayout(saved, { width: 1600, height: 1000 }, { width: 320, height: 220 })).toEqual(before)
    expect(saved).toEqual(before)
  })
  it('extiende referencia hasta el rectángulo guardado sin recortar su tamaño', () => {
    expect(adaptModuleLayout(saved, { width: 412, height: 871 }, { width: 320, height: 220 })).toEqual({
      x: 220, y: 196, width: 720, height: 480, referenceSize: { width: 1160, height: 871 },
    })
    expect(adaptModuleLayout(saved, { width: 200, height: 150 }, { width: 320, height: 220 })).toEqual({
      x: 220, y: 130, width: 720, height: 480, referenceSize: { width: 1160, height: 740 },
    })
  })
  it('extiende únicamente los ejes que necesitan mínimos de módulos abiertos', () => {
    expect(getWorkspaceBounds({ width: 200, height: 150 }, [])).toEqual({ width: 200, height: 150 })
    expect(getWorkspaceBounds({ width: 200, height: 150 }, ['board', 'calculator'])).toEqual({ width: 200, height: 150 })
    expect(getWorkspaceBounds({ width: 1920, height: 1036 }, ['board', 'clock'])).toEqual({ width: 1920, height: 1036 })
  })
  it('no divide por cero cuando una ventana llena su referencia', () => {
    expect(adaptModuleLayout({ x: 0, y: 0, width: 720, height: 480, referenceSize: { width: 720, height: 480 } },
      { width: 1000, height: 800 }, { width: 320, height: 220 })).toMatchObject({ x: 0, y: 0, width: 720, height: 480 })
  })
})

it('no recorta geometrías guardadas fuera del viewport ni usa extensión ajena como referencia', () => {
  const saved = { x: 900, y: 800, width: 700, height: 500, referenceSize: { width: 1600, height: 1300 } }
  expect(adaptModuleLayout(saved, { width: 412, height: 800 }, { width: 1, height: 1 })).toEqual(saved)
})
