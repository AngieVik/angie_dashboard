import { useContext, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fit, zoomAt } from './viewportMath'
import { MobileViewport } from './MobileViewport'
import { ModuleFrame } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import { TooltipProvider } from '../components/ui/tooltip'
import { ModuleSizeContext } from './ModuleSizeContext'
import { readNavigation, writeNavigation } from './navigationStorage'
import { zoomBoardAt } from '../features/board/boardViewport'

beforeEach(() => localStorage.clear())
const size = { width: 800, height: 500 }, bounds = { width: 4000, height: 3000 }

function RequestContent() {
  const request = useContext(ModuleSizeContext)
  return <><button onClick={() => request({ width: 300, height: 200 })}>Añadir contenido</button><button onClick={() => request({ width: 0, height: 100 }, { fitHeight: true })}>Quitar contenido</button></>
}
function Frame() {
  const [box, setBox] = useState({ width: 440, height: 260 })
  return <TooltipProvider><div style={box}><ModuleFrame id="clock" active height={box.height} onFit={setBox} onClose={() => {}}>Contenido</ModuleFrame></div></TooltipProvider>
}
function measureFrame() {
  const frame = screen.getByRole('region')
  Object.defineProperties(frame, {
    offsetWidth: { get: () => parseFloat(frame.parentElement!.style.width) },
    offsetHeight: { get: () => parseFloat(frame.parentElement!.style.height) },
  })
  return frame
}

describe('modelo unificado de navegación', () => {
  it('zoom conserva la esquina visible independientemente del puntero y limita 25–200', () => {
    const initial = { scale: 1, offsetX: -100, offsetY: -200 }
    expect(zoomAt(initial, 2, { x: 300, y: 250 }, size, bounds)).toEqual({ scale: 2, offsetX: -200, offsetY: -400 })
    expect(zoomAt(initial, .01, { x: 0, y: 0 }, size, bounds).scale).toBe(.25)
    expect(zoomAt(initial, 10, { x: 0, y: 0 }, size, bounds).scale).toBe(2)
    expect(fit(size).scale).toBe(1)
  })
  it('reducir zoom no pierde la esquina visible junto al borde derecho o inferior', () => {
    const result = zoomAt({ scale: 2, offsetX: -2000, offsetY: -1200 }, .25, { x: 700, y: 400 }, size, { width: 1400, height: 900 })
    expect(result).toEqual({ scale: .25, offsetX: -250, offsetY: -150 })
  })
  it('pellizco solo escala sin acompañar la traslación de los dedos ni de la cabecera', () => {
    const change = vi.fn()
    render(<MobileViewport state={{ scale: 1, offsetX: -100, offsetY: -200 }} size={size} bounds={bounds} headerHeight={36} onChange={change}>Fondo</MobileViewport>)
    const viewport = screen.getByTestId('mobile-viewport')
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 200, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 300, clientY: 100, pointerType: 'touch' })
    expect(change).toHaveBeenLastCalledWith({ scale: 2, offsetX: -200, offsetY: -400 })
  })
  it('Ctrl+rueda comparte el anclaje superior izquierdo', () => {
    const change = vi.fn()
    render(<MobileViewport state={{ scale: 1, offsetX: -100, offsetY: -200 }} size={size} bounds={bounds} onChange={change}>Fondo</MobileViewport>)
    fireEvent.wheel(screen.getByTestId('mobile-viewport'), { ctrlKey: true, deltaY: -Math.log(2) / .002, clientX: 300, clientY: 250 })
    expect(change).toHaveBeenLastCalledWith({ scale: 2, offsetX: -200, offsetY: -400 })
  })
  it('tercer dedo cancela el gesto hasta levantar todos', () => {
    const change = vi.fn()
    render(<MobileViewport state={fit(size)} size={size} bounds={bounds} onChange={change}>Fondo</MobileViewport>)
    const viewport = screen.getByTestId('mobile-viewport')
    for (const id of [1, 2, 3]) fireEvent.pointerDown(viewport, { pointerId: id, clientX: id * 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerUp(viewport, { pointerId: 3 })
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 400, clientY: 100 })
    expect(change).not.toHaveBeenCalled()
    expect(viewport).toHaveAttribute('data-gesturing', 'true')
    fireEvent.pointerUp(viewport, { pointerId: 2 }); fireEvent.pointerUp(viewport, { pointerId: 1 })
    expect(viewport).toHaveAttribute('data-gesturing', 'false')
  })
  it('mínimos de ventana conservan cabecera e icono', () => {
    for (const definition of Object.values(MODULE_REGISTRY)) expect(definition.minimum).toEqual([27, 29])
  })
  it('clic solo en icono recoge y restaura dimensiones', () => {
    render(<Frame />)
    const frame = measureFrame(), header = frame.querySelector('.module-header')!
    fireEvent.doubleClick(header)
    expect(frame.parentElement).toHaveStyle({ width: '440px', height: '260px' })
    fireEvent.click(frame.querySelector('.module-icon')!, { detail: 1 })
    expect(frame.parentElement).toHaveStyle({ width: '27px', height: '29px' })
    expect(frame).toHaveAttribute('data-icon-only', 'true')
    fireEvent.click(frame.querySelector('.module-icon')!, { detail: 1 })
    expect(frame.parentElement).toHaveStyle({ width: '440px', height: '260px' })
  })
  it('tap en icono recoge sin interpretar un arrastre como tap', () => {
    render(<Frame />)
    const frame = measureFrame(), icon = frame.querySelector('.module-icon')!
    fireEvent.pointerDown(icon, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(icon, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.click(icon, { detail: 1 })
    expect(frame).toHaveAttribute('data-icon-only', 'true')
    fireEvent.pointerDown(icon, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(icon, { pointerId: 2, pointerType: 'touch', clientX: 40, clientY: 10 })
    fireEvent.pointerUp(icon, { pointerId: 2, pointerType: 'touch', clientX: 40, clientY: 10 })
    fireEvent.click(icon, { detail: 1 })
    expect(frame).toHaveAttribute('data-icon-only', 'true')
  })
  it('recupera zoom individual tras cerrar y volver a abrir el módulo', () => {
    function StoredFrame() { return <TooltipProvider><ModuleFrame id="coordinates" navigationKey="document-test.coordinates" active onClose={() => {}}>Texto</ModuleFrame></TooltipProvider> }
    const view = render(<StoredFrame />)
    const input = screen.getByRole('spinbutton', { name: 'Zoom de Coordenadas' })
    fireEvent.change(input, { target: { value: '175' } }); fireEvent.keyDown(input, { key: 'Enter' })
    view.unmount()
    render(<StoredFrame />)
    expect(screen.getByRole('spinbutton', { name: 'Zoom de Coordenadas' })).toHaveValue(175)
  })
  it('guarda desplazamiento y zoom por documento sin mezclar claves', () => {
    writeNavigation('document-a.dashboard', { scale: 1.5, offsetX: -150, offsetY: -300 })
    expect(readNavigation('document-a.dashboard')).toMatchObject({ scale: 1.5, offsetX: -150, offsetY: -300 })
    expect(readNavigation('document-b.dashboard')).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    localStorage.setItem('angie.navigation.invalid', '{')
    expect(readNavigation('invalid')).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })
  it('altas y bajas usan medidas internas sin multiplicar otra vez el zoom', () => {
    const resize = vi.fn()
    render(<TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={resize}><RequestContent /></ModuleFrame></TooltipProvider>)
    const frame = screen.getByRole('region')
    Object.defineProperties(frame, { offsetWidth: { value: 200 }, offsetHeight: { value: 140 } })
    const input = screen.getByRole('spinbutton', { name: 'Zoom de Reloj' })
    fireEvent.change(input, { target: { value: '200' } }); fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir contenido' }))
    expect(resize).toHaveBeenLastCalledWith({ width: 302, height: 249 })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar contenido' }))
    expect(resize).toHaveBeenLastCalledWith({ width: 200, height: 149 })
  })
  it('añadir y quitar bloques adapta la altura sin conservar un mínimo manual', async () => {
    function Blocks() {
      const [count, setCount] = useState(2)
      return <><button onClick={() => setCount(value => value + 1)}>Añadir bloque</button><button onClick={() => setCount(value => value - 1)}>Quitar bloque</button>{Array.from({ length: count }, (_, index) => <div className="notebook-block" key={index}>Bloque</div>)}</>
    }
    function NotebookFrame() {
      const [box, setBox] = useState({ width: 440, height: 100 })
      return <TooltipProvider><div style={box}><ModuleFrame id="notebook" height={box.height} width={box.width} active onClose={() => {}} onFit={setBox}><Blocks /></ModuleFrame></div></TooltipProvider>
    }
    render(<NotebookFrame />)
    const frame = measureFrame(), body = frame.querySelector('.module-scaled-content')!
    Object.defineProperty(body, 'scrollHeight', { get: () => body.querySelectorAll('.notebook-block').length * 30 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Añadir bloque' })) })
    expect(frame.parentElement).toHaveStyle({ height: '139px' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Quitar bloque' })) })
    expect(frame.parentElement).toHaveStyle({ height: '109px' })
  })
  it('rueda sin Ctrl no desplaza el contenido de un módulo', () => {
    render(<TooltipProvider><ModuleFrame id="coordinates" active onClose={() => {}}>Texto</ModuleFrame></TooltipProvider>)
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    screen.getByText('Texto').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
  it('arrastra una lista desde sus botones sin activarlos y conserva el clic simple', () => {
    const click = vi.fn()
    render(<TooltipProvider><ModuleFrame id="elements" active onClose={() => {}}><div className="elements-list" style={{ overflowY: 'auto' }}><button onClick={click}>Elemento</button></div></ModuleFrame></TooltipProvider>)
    const list = screen.getByText('Elemento').parentElement!, body = screen.getByText('Elemento').closest('.module-content')!
    Object.defineProperties(list, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } })
    const button = screen.getByRole('button', { name: 'Elemento' })
    fireEvent.pointerDown(button, { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 150 })
    fireEvent.pointerMove(body, { pointerId: 1, isPrimary: true, clientX: 20, clientY: 50 })
    fireEvent.pointerUp(body, { pointerId: 1 })
    fireEvent.click(button, { detail: 1 })
    expect(list.scrollTop).toBe(100)
    expect(click).not.toHaveBeenCalled()
    fireEvent.pointerDown(button, { pointerId: 2, isPrimary: true, button: 0, clientX: 20, clientY: 50 })
    fireEvent.pointerUp(button, { pointerId: 2 })
    fireEvent.click(button, { detail: 1 })
    expect(click).toHaveBeenCalledOnce()
  })
  it('restaura el desplazamiento de una lista aunque cambien los elementos anteriores', () => {
    function StoredList({ extra = false }) { return <TooltipProvider><ModuleFrame id="elements" active navigationKey="document.elements" onClose={() => {}}>{extra && <div>Nuevo control</div>}<div className="elements-list">Lista</div></ModuleFrame></TooltipProvider> }
    const view = render(<StoredList />)
    screen.getByText('Lista').scrollTop = 120
    fireEvent.scroll(screen.getByText('Lista'))
    view.unmount()
    render(<StoredList extra />)
    expect(screen.getByText('Lista').scrollTop).toBe(120)
  })
  it('Pizarra escala su superficie desde la esquina visible entre 25 y 200', () => {
    const initial = { scale: 1, offsetX: -100, offsetY: -200 }
    const boardBounds = { left: 0, top: 0, right: 4000, bottom: 3000 }
    expect(zoomBoardAt(initial, 2, { x: 200, y: 100 }, size, boardBounds)).toEqual({ scale: 2, offsetX: -200, offsetY: -400 })
    expect(zoomBoardAt(initial, 20, { x: 0, y: 0 }, size, boardBounds).scale).toBe(2)
  })
})
