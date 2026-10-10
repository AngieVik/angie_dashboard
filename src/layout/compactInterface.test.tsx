import { fireEvent, render as renderView, screen, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { ZoomControl } from './ZoomControl'
import { TooltipProvider } from '../components/ui/tooltip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fit, clamp, zoomAt, resizeViewport } from './viewportMath'
import { ModuleFrame } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import { createEmptyDocument } from '../domain/document/defaultDocument'
import { serializeDocument } from '../domain/document/serializeDocument'
import { validateDocument } from '../domain/document/validateDocument'
import { CoordinatesModule } from '../features/coordinates/CoordinatesModule'
import { ElementEditor } from '../features/elements/ElementEditor'

const render = (view: ReactNode) => renderView(<TooltipProvider>{view}</TooltipProvider>)

describe('interfaz compacta aprobada', () => {
  afterEach(() => vi.unstubAllGlobals())
  const size = { width: 800, height: 600 }
  it('admite 25–400 %, sin huecos positivos ni recientes al cambiar el área', () => {
    expect(zoomAt(fit(size), 0.5, { x: 0, y: 0 }, size)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 })
    expect(zoomAt(fit(size), 0.01, { x: 0, y: 0 }, size).scale).toBe(0.25)
    expect(zoomAt(fit(size), 10, { x: 0, y: 0 }, size).scale).toBe(4)
    expect(clamp({ scale: 1, offsetX: 80, offsetY: 60 }, size)).toEqual(fit(size))
    expect(fit(size, { width: 1200, height: 1000 })).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(resizeViewport({ scale: 2, offsetX: -50, offsetY: -60 }, size, { width: 600, height: 800 })).toEqual({ scale: 2, offsetX: -50, offsetY: -60 })
  })
  it('no propaga NaN ni infinitos desde la entrada de zoom', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) expect(zoomAt(fit(size), invalid, { x: 0, y: 0 }, size)).toEqual(fit(size))
  })
  it('exporta ventanas menores que los antiguos mínimos, sin aceptar cero', () => {
    const document = createEmptyDocument()
    for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) {
      expect(MODULE_REGISTRY[id].minimum).toEqual([1, 1])
      document.moduleLayouts[id] = { x: 0, y: 0, width: 100, height: 80, referenceSize: size }
    }
    expect(validateDocument(document).success).toBe(true)
    expect(JSON.parse(serializeDocument(document))).toEqual(document)
    document.moduleLayouts.board!.width = 0
    expect(validateDocument(document).success).toBe(false)
  })
  it('el zoom usa el área disponible sin compensar porcentajes dos veces', () => {
    render(<ModuleFrame id="clock" active onClose={() => {}}>Reloj</ModuleFrame>)
    const field = screen.getByRole('spinbutton', { name: 'Zoom de Reloj' })
    fireEvent.change(field, { target: { value: '50' } }); fireEvent.keyDown(field, { key: 'Enter' })
    expect(screen.getByRole('region', { name: 'Reloj' }).querySelector('.module-scaled-content')).toHaveStyle({ width: '100%', height: '100%', zoom: '0.5' })
  })
  it('Proportions ajusta contenido al zoom actual sin cambiar el porcentaje', () => {
    const fit = vi.fn()
    render(<ModuleFrame id="elements" active onClose={vi.fn()} onFit={fit}><div>Tarjetas</div></ModuleFrame>)
    const region = screen.getByRole('region', { name: 'Elementos' })
    const scaled = region.querySelector('.module-scaled-content')!
    Object.defineProperties(scaled, { offsetWidth: { value: 200 }, offsetHeight: { value: 100 }, scrollWidth: { value: 200 }, scrollHeight: { value: 100 } })
    Object.defineProperty(region.querySelector('.module-header'), 'offsetHeight', { value: 27 })
    Object.defineProperty(region.querySelector('.module-controls'), 'offsetHeight', { value: 23 })
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom de Elementos' })
    fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar ventana de Elementos al contenido' }))
    expect(fit).toHaveBeenCalledWith({ width: 402, height: 252 })
    expect(zoom).toHaveValue(200)
    expect(region).not.toHaveAttribute('data-fitting')
  })
  it('la rueda de Pizarra sincroniza el porcentaje inferior sin otro zoom oculto', () => {
    render(<ModuleFrame id="board" active onClose={() => {}}><div className="board-surface">Lienzo</div></ModuleFrame>)
    const surface = screen.getByText('Lienzo'), field = screen.getByRole('spinbutton', { name: 'Zoom de Pizarra' })
    fireEvent.wheel(surface, { deltaY: -Math.log(1.5) / .002 })
    expect(field).toHaveValue(150)
    fireEvent.change(field, { target: { value: '75' } }); fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.wheel(surface, { deltaY: Math.log(1.5) / .002, ctrlKey: true })
    expect(field).toHaveValue(50)
  })
  it('separa arrastre, cierre y zoom; escala cada contenido independientemente', () => {
    const close = vi.fn()
    render(<><ModuleFrame id="elements" active onClose={close}><button>Herramienta</button></ModuleFrame>
      <ModuleFrame id="clock" active={false} onClose={vi.fn()}>Reloj</ModuleFrame></>)
    const elements = screen.getByRole('region', { name: 'Elementos' })
    expect(elements.querySelector('.module-header')).toContainElement(within(elements).getByRole('button', { name: 'Cerrar Elementos' }))
    expect(elements.querySelector('.module-controls')).not.toContainElement(within(elements).getByRole('button', { name: 'Cerrar Elementos' }))
    const zoom = within(elements).getByRole('spinbutton', { name: 'Zoom de Elementos' })
    fireEvent.change(zoom, { target: { value: '50' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    expect(elements.querySelector('.module-scaled-content')).toHaveAttribute('data-scale', '0.5')
    expect(screen.getByRole('region', { name: 'Reloj' }).querySelector('.module-scaled-content')).toHaveAttribute('data-scale', '1')
    fireEvent.change(zoom, { target: { value: '' } }); fireEvent.blur(zoom)
    expect(zoom).toHaveValue(50)
    fireEvent.click(within(elements).getByRole('button', { name: 'Cerrar Elementos' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('abre el slider de zoom sincronizado por teclado y conserva el valor al cancelar entrada inválida', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    render(<ModuleFrame id="elements" active onClose={vi.fn()} />)
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom de Elementos' })
    fireEvent.change(zoom, { target: { value: '800' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    expect(zoom).toHaveValue(400)
    fireEvent.change(zoom, { target: { value: '10' } }); fireEvent.keyDown(zoom, { key: 'Escape' })
    expect(zoom).toHaveValue(400)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir deslizador: Zoom de Elementos' }))
    const slider = screen.getByRole('slider', { name: 'Zoom de Elementos' })
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(zoom).toHaveValue(25)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(zoom).toHaveValue(400)
  })
  it('cambiar generación cierra popovers y descarta entrada pendiente sin cambiar el zoom individual', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const view = render(<ModuleFrame id="elements" active onClose={vi.fn()} generation={1} />)
    const input = screen.getByRole('spinbutton', { name: 'Zoom de Elementos' })
    fireEvent.change(input, { target: { value: '50' } }); fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir deslizador: Zoom de Elementos' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    view.rerender(<TooltipProvider><ModuleFrame id="elements" active onClose={vi.fn()} generation={2} /></TooltipProvider>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Zoom de Elementos' })).toHaveValue(50)
  })
  it('mantiene los cuatro formatos vacíos e impide copiarlos', () => {
    render(<CoordinatesModule />)
    for (const format of ['DD', 'DMS', 'DMM', 'UTM']) {
      expect(screen.getByText(format)).toBeVisible()
      expect(screen.getByLabelText(`Resultado ${format}`)).toHaveTextContent('')
      expect(screen.queryByRole('button', { name: `Copiar ${format}` })).not.toBeInTheDocument()
    }
  })
  it('información de Elementos comienza en una fila y conserva el borrador', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const save = vi.fn()
    render(<ElementEditor onSave={save} formId="element-test" />)
    expect(screen.queryByText('Añadir elemento')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Información' })).toHaveAttribute('rows', '1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Punto norte' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Información' }), { target: { value: 'Uno\nDos' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Crear elemento' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Punto norte', information: 'Uno\nDos' }))
  })
})


describe('enganche suave de sliders de zoom', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each(['bottom', 'right'] as const)('atrae a decenas con puntero en %s y conserva teclado y entrada exacta', side => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    function Probe() {
      const [scale, setScale] = useState(1)
      return <ZoomControl scale={scale} onChange={setScale} label="Zoom de prueba" side={side} />
    }
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir deslizador: Zoom de prueba' }))
    const slider = screen.getByRole('slider'), track = slider.closest('.ui-slider')!
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 375, top: 0, height: 20, right: 375, bottom: 20 } as DOMRect)
    Object.assign(track, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
    const input = screen.getByRole('spinbutton', { name: 'Zoom de prueba' })
    for (const [value, expected] of [[98, 100], [102, 100], [103, 103], [137, 137], [138, 140], [25, 25], [400, 400]]) {
      fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: value! - 25, clientY: 10 })
      fireEvent.pointerUp(track, { pointerId: 1 })
      expect(input).toHaveValue(expected)
    }
    fireEvent.change(input, { target: { value: '100' } }); fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(input).toHaveValue(101)
    fireEvent.change(input, { target: { value: '138' } }); fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(138)
  })
})
