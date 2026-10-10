import { describe, expect, it } from 'vitest'
import { initialImageLayout, transformBoardImage } from './boardImageGeometry'

describe('geometría temporal de imagen', () => {
  it('alinea imágenes horizontales y verticales arriba a la izquierda', () => {
    expect(initialImageLayout(800, 400)).toEqual({ x: 0, y: 0, width: 1000, height: 500 })
    expect(initialImageLayout(400, 800)).toEqual({ x: 0, y: 0, width: 500, height: 1000 })
  })
  it('mueve fuera del borde izquierdo y superior sin deformar', () => {
    expect(transformBoardImage({ x: 0, y: 0, width: 200, height: 100 }, 'move', { x: -80, y: -40 }))
      .toEqual({ x: -80, y: -40, width: 200, height: 100 })
  })
  it.each(['nw', 'ne', 'sw', 'se'] as const)('redimensiona desde %s manteniendo el vértice opuesto', corner => {
    const west = corner.includes('w'), north = corner.includes('n')
    const next = transformBoardImage({ x: 20, y: 30, width: 200, height: 100 }, corner, { x: west ? -100 : 100, y: north ? -50 : 50 })
    expect(next).toEqual({ x: west ? -80 : 20, y: north ? -20 : 30, width: 300, height: 150 })
  })
  it('no invierte la imagen al cruzar el vértice opuesto', () => {
    const next = transformBoardImage({ x: 0, y: 0, width: 200, height: 100 }, 'se', { x: -500, y: -500 })
    expect(next.width).toBeGreaterThan(0)
    expect(next.width / next.height).toBe(2)
  })
})
