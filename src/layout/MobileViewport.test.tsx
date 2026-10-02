import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fit, pan, zoomAt, clamp, resizeViewport } from './viewportMath'
import { MobileViewport } from './MobileViewport'
import { useLayoutEffect } from 'react'
import { useViewportInteraction } from './ViewportContext'

function BoardNavigationProbe({ change }: { change: () => void }) {
  const { boardNavigationRef } = useViewportInteraction()
  useLayoutEffect(() => {
    if (!boardNavigationRef) return
    const element = screen.getByTestId('board-probe')
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 } as DOMRect)
    boardNavigationRef.current = { element, gesture: points => { if (points) change() } }
    return () => { boardNavigationRef.current = null }
  }, [boardNavigationRef, change])
  return <div data-testid="board-probe">Pizarra</div>
}

describe('viewport lógico bajo la cabecera', () => {
  it('dos dedos sobre otro módulo superpuesto a la pizarra pertenecen al dashboard', () => {
    const main = vi.fn(), board = vi.fn()
    render(<MobileViewport state={{ scale: 1, offsetX: 0, offsetY: 0 }} size={{ width: 800, height: 500 }} onChange={main}>
      <BoardNavigationProbe change={board} /><button>Módulo al frente</button>
    </MobileViewport>)
    const front = screen.getByRole('button'), descriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => front })
    try {
      fireEvent.pointerDown(front, { pointerId: 1, clientX: 200, clientY: 200 })
      fireEvent.pointerDown(front, { pointerId: 2, clientX: 300, clientY: 200 })
      fireEvent.pointerMove(screen.getByTestId('mobile-viewport'), { pointerId: 2, clientX: 350, clientY: 200 })
      expect(main).toHaveBeenCalled()
      expect(board).not.toHaveBeenCalled()
    } finally {
      if (descriptor) Object.defineProperty(document, 'elementFromPoint', descriptor)
      else delete (document as Partial<Document>).elementFromPoint
    }
  })
  it('dos dedos en pizarra navegan solo su cámara; cruzar superficies cancela hasta levantar todos', () => {
    const main = vi.fn(), board = vi.fn()
    render(<MobileViewport state={{ scale: 1, offsetX: 0, offsetY: 0 }} size={{ width: 800, height: 500 }} onChange={main}>
      <BoardNavigationProbe change={board} /><button>Fuera</button>
    </MobileViewport>)
    const surface = screen.getByTestId('board-probe'), viewport = screen.getByTestId('mobile-viewport')
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 200, clientY: 200 })
    fireEvent.pointerDown(surface, { pointerId: 2, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 350, clientY: 200 })
    expect(board).toHaveBeenCalled()
    expect(main).not.toHaveBeenCalled()
    const calls = board.mock.calls.length
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 550, clientY: 200 })
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 300, clientY: 200 })
    expect(board).toHaveBeenCalledTimes(calls)
    fireEvent.pointerUp(viewport, { pointerId: 2 }); fireEvent.pointerUp(viewport, { pointerId: 1 })
    board.mockClear()
    fireEvent.pointerDown(surface, { pointerId: 3, clientX: 200, clientY: 200 })
    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 4, clientX: 600, clientY: 200 })
    fireEvent.pointerMove(viewport, { pointerId: 4, clientX: 650, clientY: 200 })
    expect(board).not.toHaveBeenCalled()
    expect(main).not.toHaveBeenCalled()
    fireEvent.pointerUp(viewport, { pointerId: 4 }); fireEvent.pointerUp(viewport, { pointerId: 3 })
    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 5, clientX: 600, clientY: 200 })
    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 6, clientX: 700, clientY: 200 })
    fireEvent.pointerMove(viewport, { pointerId: 6, clientX: 750, clientY: 200 })
    expect(main).toHaveBeenCalled()
    expect(board).not.toHaveBeenCalled()
  })
  it('encaja al 100 % y centra solo la extensión virtual de mínimos', () => {
    expect(fit({ width: 800, height: 700 }, { width: 800, height: 700 })).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(fit({ width: 200, height: 150 }, { width: 320, height: 220 })).toEqual({ scale: 1, offsetX: -60, offsetY: -35 })
  })
  it('limita el zoom a 1–4 también en una pantalla enorme', () => {
    const size = { width: 800, height: 700 }
    expect(zoomAt(fit(size, size), 0.01, { x: 400, y: 350 }, size, size).scale).toBe(1)
    expect(zoomAt(fit(size), 10, { x: 400, y: 350 }, size).scale).toBe(4)
    const huge = { width: 9600, height: 6000 }
    expect(fit(huge, huge).scale).toBe(1)
    expect(zoomAt(fit(huge, huge), 10, { x: 4800, y: 3000 }, huge, huge).scale).toBe(4)
  })
  it('mantiene el punto lógico bajo el centro del pellizco', () => {
    const size = { width: 800, height: 500 }
    expect(zoomAt(fit(size, size), 2, { x: 200, y: 200 }, size, size)).toEqual({ scale: 2, offsetX: -200, offsetY: -200 })
  })
  it('limita cada borde al margen elástico del 10% visible', () => {
    const size = { width: 400, height: 300 }
    expect(pan({ scale: 1, offsetX: 0, offsetY: 0 }, 9999, 9999, size)).toEqual({ scale: 1, offsetX: 40, offsetY: 30 })
    expect(clamp({ scale: 1, offsetX: -9999, offsetY: -9999 }, size, size)).toEqual({ scale: 1, offsetX: -40, offsetY: -30 })
    expect(clamp({ scale: 1, offsetX: -9999, offsetY: -9999 }, size, { width: 720, height: 480 })).toEqual({ scale: 1, offsetX: -360, offsetY: -210 })
  })
  it('conserva el centro lógico al rotar y reajusta solo límites y escala si hace falta', () => {
    const old = { width: 400, height: 800 }, next = { width: 800, height: 400 }
    const rotated = resizeViewport({ scale: 2, offsetX: -200, offsetY: -100 }, old, next, { width: 1600, height: 1000 })
    expect(rotated).toEqual({ scale: 2, offsetX: 0, offsetY: -300 })
    expect(resizeViewport(fit(old, old), old, next, next).scale).toBe(1)
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
    render(<MobileViewport state={{ scale: 1, offsetX: 0, offsetY: 0 }} size={{ width: 800, height: 500 }} onChange={change}>
      <button>Pizarra</button>
    </MobileViewport>)
    const content = screen.getByRole('button')
    fireEvent.pointerDown(content, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerDown(content, { pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.lostPointerCapture(content, { pointerId: 1 })
    fireEvent.pointerMove(screen.getByTestId('mobile-viewport'), { pointerId: 2, clientX: 300, clientY: 100 })
    expect(change).toHaveBeenCalledWith({ scale: 2, offsetX: -100, offsetY: -100 })
  })
  it('tras levantar dos dedos permite activar Cuaderno con teclado y sigue rechazando el clic residual táctil', () => {
    const click = vi.fn()
    render(<MobileViewport state={{ scale: 1, offsetX: 0, offsetY: 0 }} size={{ width: 800, height: 500 }} onChange={vi.fn()}>
      <button onClick={click}>Añadir bloque</button>
    </MobileViewport>)
    const button = screen.getByRole('button')
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerDown(button, { pointerId: 2, clientX: 200, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerUp(button, { pointerId: 2 })
    fireEvent.pointerUp(button, { pointerId: 1 })
    fireEvent.click(button, { detail: 1 })
    expect(click).not.toHaveBeenCalled()
    // Keyboard activation and Radix's keyboard selection synthesize detail=0.
    fireEvent.click(button, { detail: 0 })
    expect(click).toHaveBeenCalledTimes(1)
  })
})
