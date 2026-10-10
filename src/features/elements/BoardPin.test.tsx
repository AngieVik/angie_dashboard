import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentElement } from '../../domain/document/types'
import { ViewportContext } from '../../layout/ViewportContext'
import { BoardPin } from './BoardPin'

afterEach(() => vi.useRealTimers())
const element: DocumentElement = { id: crypto.randomUUID(), name: 'Tango 1', visual: { type: 'asset', assetId: 'ambulance', scale: 1 }, pinVisible: true, information: '', position: { x: 500, y: 500 }, isUnit: false, operational: null }
function setup() {
  const onSelect = vi.fn(), onMove = vi.fn(), onScale = vi.fn()
  const surface = { current: document.createElement('div') }
  vi.spyOn(surface.current, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 1000 } as DOMRect)
  const blockedRef = { current: false }
  const props = { element, selected: true, enabled: true, surface, onSelect, onMove, onScale }
  const view = render(<ViewportContext.Provider value={{ blocked: false, blockedRef }}><BoardPin {...props} /></ViewportContext.Provider>)
  return { onSelect, onMove, onScale, view, props, blockedRef }
}
describe('pin coordinado con la pizarra', () => {
  it('oculta solo el nombre y conserva el pin seleccionable', () => {
    const { view, props } = setup()
    view.rerender(<BoardPin {...props} element={{ ...element, nameHidden: true }} />)
    expect(screen.queryByText('Tango 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeEnabled()
    expect(screen.getByRole('img', { name: 'Ambulancia' })).toBeVisible()
  })
  it('mover invierte zoom propio y principal sin cambiar el centro al escalar', () => {
    vi.useFakeTimers()
    const { view, props, onMove } = setup()
    view.rerender(<BoardPin {...props} view={{ scale: 2, offsetX: -100, offsetY: -200 }} viewportSize={{ width: 500, height: 500 }} />)
    const pin = screen.getByRole('button', { name: 'Seleccionar Tango 1' })
    fireEvent.pointerDown(pin, { pointerId: 1, button: 0, clientX: 500, clientY: 500 })
    act(() => vi.advanceTimersByTime(250))
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 540, clientY: 520 })
    fireEvent.pointerUp(pin, { pointerId: 1 })
    expect(onMove).toHaveBeenCalledExactlyOnceWith({ x: 510, y: 505 })
  })
  it('escala PNG/emoji con letra independiente, con tirador para ambos', () => {
    const { view, props } = setup()
    const image = screen.getByRole('img', { name: 'Ambulancia' })
    expect(image).toHaveAttribute('src', '/assets/elements/icon_medical.png')
    expect(image).toHaveStyle({ objectFit: 'contain', objectPosition: 'center', width: '100%', height: '100%' })
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '150px', height: '100px' })
    const name = screen.getByText('Tango 1')
    expect(name).toHaveStyle({ fontSize: '16px' })
    view.rerender(<BoardPin {...props} element={{ ...element, visual: { ...element.visual, type: 'asset', assetId: 'ambulance', scale: 3 } }} />)
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '450px', height: '300px' })
    expect(screen.getByText('Tango 1')).toHaveStyle({ fontSize: '16px' })
    view.rerender(<BoardPin {...props} element={{ ...element, visual: { type: 'emoji', value: '🚴🏽‍♂️', scale: 2 } }} />)
    expect(screen.getByText('🚴🏽‍♂️')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '128px', height: '128px' })
    expect(screen.getByText('Tango 1')).toHaveStyle({ fontSize: '16px' })
    expect(screen.getByText('🚴🏽‍♂️')).toHaveStyle({ fontSize: '96px' })
    expect(screen.getByRole('button', { name: 'Redimensionar Tango 1' })).toBeInTheDocument()
  })
  it('resize de emoji previsualiza sin guardar, conserva centro y cancela el preview', () => {
    const { view, props, onScale } = setup()
    const emoji = { ...element, visual: { type: 'emoji' as const, value: '📍', scale: .5 } }
    view.rerender(<BoardPin {...props} element={emoji} />)
    const handle = screen.getByRole('button', { name: 'Redimensionar Tango 1' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 516, clientY: 516 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 564, clientY: 564 })
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '128px', height: '128px' })
    expect(screen.getByText('Tango 1')).toHaveStyle({ fontSize: '16px' })
    expect(onScale).not.toHaveBeenCalled()
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onScale).toHaveBeenCalledExactlyOnceWith(2)
    expect(document.querySelector('.board-pin')).toHaveStyle({ left: '500px', top: '500px' })
    onScale.mockClear()
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 516, clientY: 516 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 564, clientY: 564 })
    fireEvent.pointerCancel(handle, { pointerId: 2 })
    expect(onScale).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '32px', height: '32px' })
  })
  it('clic selecciona; arrastre requiere 250 ms y permite centros más allá de 1000', () => {
    vi.useFakeTimers()
    const { onSelect, onMove } = setup()
    const pin = screen.getByRole('button', { name: 'Seleccionar Tango 1' })
    fireEvent.click(pin); expect(onSelect).toHaveBeenCalledOnce()
    fireEvent.pointerDown(pin, { pointerId: 1, button: 0, clientX: 500, clientY: 500 })
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 800, clientY: 800 })
    fireEvent.pointerUp(pin, { pointerId: 1 }); expect(onMove).not.toHaveBeenCalled()
    fireEvent.pointerDown(pin, { pointerId: 2, button: 0, clientX: 500, clientY: 500 })
    act(() => vi.advanceTimersByTime(250))
    fireEvent.pointerMove(pin, { pointerId: 2, clientX: 1100, clientY: 1100 })
    fireEvent.pointerUp(pin, { pointerId: 2 })
    expect(onMove).toHaveBeenCalledWith({ x: 1100, y: 1100 })
  })
  it('tirador modifica una sola escala proporcional y cancela si aparece el segundo dedo', () => {
    const { onScale, view, props, blockedRef } = setup()
    const handle = screen.getByRole('button', { name: 'Redimensionar Tango 1' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 575, clientY: 550 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 650, clientY: 600 })
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '300px', height: '200px' })
    fireEvent.pointerUp(handle, { pointerId: 1 }); expect(onScale).toHaveBeenCalledWith(2)
    onScale.mockClear()
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 575, clientY: 550 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 650, clientY: 600 })
    blockedRef.current = true
    view.rerender(<ViewportContext.Provider value={{ blocked: true, blockedRef }}><BoardPin {...props} /></ViewportContext.Provider>)
    fireEvent.pointerUp(handle, { pointerId: 2 })
    expect(onScale).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveStyle({ width: '150px', height: '100px' })
  })
  it('Lápiz/Goma desactivan gestos del pin sin ocultarlo; position null no tiene pin', () => {
    const { view, props, onSelect, onScale } = setup()
    view.rerender(<BoardPin {...props} enabled={false} />)
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    expect(onSelect).not.toHaveBeenCalled(); expect(onScale).not.toHaveBeenCalled()
    view.rerender(<BoardPin {...props} element={{ ...element, position: null }} />)
    expect(screen.queryByText('Tango 1')).not.toBeInTheDocument()
  })
})
