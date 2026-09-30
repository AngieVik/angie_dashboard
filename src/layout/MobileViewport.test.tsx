import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fit, pan, zoomAt, clamp, resizeViewport } from './viewportMath'
import { MobileViewport } from './MobileViewport'

describe('viewport lógico bajo la cabecera', () => {
  it('encaja completo y centrado con la menor escala disponible', () => {
    expect(fit({ width: 800, height: 700 })).toEqual({ scale: 0.5, offsetX: 0, offsetY: 100 })
    expect(fit({ width: 400, height: 200 })).toEqual({ scale: 0.2, offsetX: 40, offsetY: 0 })
  })
  it('limita el zoom a fit…max(4, fit), incluso en una pantalla enorme', () => {
    const size = { width: 800, height: 700 }
    expect(zoomAt(fit(size), 0.01, { x: 400, y: 350 }, size).scale).toBe(0.5)
    expect(zoomAt(fit(size), 10, { x: 400, y: 350 }, size).scale).toBe(4)
    const huge = { width: 9600, height: 6000 }
    expect(fit(huge).scale).toBe(6)
    expect(zoomAt(fit(huge), 10, { x: 4800, y: 3000 }, huge)).toEqual(fit(huge))
  })
  it('mantiene el punto lógico bajo el centro del pellizco', () => {
    const size = { width: 800, height: 500 }
    expect(zoomAt(fit(size), 1, { x: 200, y: 200 }, size)).toEqual({ scale: 1, offsetX: -200, offsetY: -200 })
  })
  it('limita cada borde al margen elástico del 10% visible', () => {
    const size = { width: 400, height: 300 }
    expect(pan({ scale: 1, offsetX: 0, offsetY: 0 }, 9999, 9999, size)).toEqual({ scale: 1, offsetX: 40, offsetY: 30 })
    expect(clamp({ scale: 1, offsetX: -9999, offsetY: -9999 }, size)).toEqual({ scale: 1, offsetX: -1240, offsetY: -730 })
    // 50 px of letterbox space plus the 30 px elastic allowance.
    expect(clamp({ scale: 0.25, offsetX: 0, offsetY: 9999 }, size).offsetY).toBe(80)
  })
  it('conserva el centro lógico al rotar y reajusta solo límites y escala si hace falta', () => {
    const old = { width: 400, height: 800 }, next = { width: 800, height: 400 }
    const rotated = resizeViewport({ scale: 1, offsetX: -600, offsetY: -100 }, old, next)
    expect(rotated).toEqual({ scale: 1, offsetX: -400, offsetY: -300 })
    expect(resizeViewport(fit(old), old, next).scale).toBe(0.4)
  })
  it('reserva un dedo al contenido y bloquea acciones hasta levantar todos los dedos', () => {
    const click = vi.fn(), pointer = vi.fn()
    render(<MobileViewport state={fit({ width: 800, height: 500 })} size={{ width: 800, height: 500 }} onChange={vi.fn()}>
      <button onPointerDown={pointer} onClick={click}>Contenido</button>
    </MobileViewport>)
    const button = screen.getByRole('button')
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 10, clientY: 10, pointerType: 'touch' })
    expect(pointer).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(button, { pointerId: 2, clientX: 30, clientY: 30, pointerType: 'touch' })
    expect(pointer).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
    fireEvent.pointerUp(button, { pointerId: 2 })
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
    fireEvent.pointerUp(button, { pointerId: 1 })
    expect(screen.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'false')
    fireEvent.pointerDown(button, { pointerId: 3, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(button, { pointerId: 3 })
    fireEvent.click(button)
    expect(click).toHaveBeenCalledTimes(1)
  })
  it('transferir captura desde el contenido conserva ambos dedos para hacer zoom', () => {
    const change = vi.fn()
    render(<MobileViewport state={{ scale: 0.5, offsetX: 0, offsetY: 0 }} size={{ width: 800, height: 500 }} onChange={change}>
      <button>Pizarra</button>
    </MobileViewport>)
    const content = screen.getByRole('button')
    fireEvent.pointerDown(content, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerDown(content, { pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.lostPointerCapture(content, { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('mobile-viewport'), { pointerId: 2, clientX: 300, clientY: 100 })
    expect(change).toHaveBeenCalledWith({ scale: 1, offsetX: -100, offsetY: -100 })
  })
})
