import { useContext, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleFrame } from './ModuleFrame'
import { ModuleSizeContext } from './ModuleSizeContext'
import { TooltipProvider } from '../components/ui/tooltip'
import { ViewportContext } from './ViewportContext'
import { useAutoGrowingTextarea } from '../features/notebook/useAutoGrowingTextarea'

function Request() {
  const request = useContext(ModuleSizeContext)
  return <><button onClick={() => request({ width: 300, height: 200 })}>Añadir</button><button onClick={() => request({ width: 0, height: 100 }, { fitHeight: true })}>Recoger</button></>
}
describe('espacio solicitado por un módulo', () => {
  it('no amplía una ventana colapsada por solicitudes del contenido', () => {
    const fit = vi.fn()
    render(<TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={fit}><Request /></ModuleFrame></TooltipProvider>)
    const frame = screen.getByRole('region')
    Object.defineProperties(frame, { offsetWidth: { value: 440 }, offsetHeight: { value: 260 } })
    Object.defineProperty(frame.querySelector('.module-header'), 'offsetHeight', { value: 27 })
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Reloj' }))
    fireEvent.click(screen.getByText('Añadir'))
    fireEvent.click(screen.getByText('Recoger'))
    expect(fit).toHaveBeenCalledExactlyOnceWith({ width: 200, height: 27 })
  })
  it('bloquea colapso y expansión durante gestos del viewport', () => {
    const fit = vi.fn(), blockedRef = { current: true }
    const view = render(<ViewportContext value={{ blocked: true, blockedRef }}><TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={fit} /></TooltipProvider></ViewportContext>)
    expect(screen.getByRole('button', { name: 'Colapsar Reloj' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Reloj' }))
    expect(fit).not.toHaveBeenCalled()
    blockedRef.current = false
    view.rerender(<ViewportContext value={{ blocked: false, blockedRef }}><TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={fit} /></TooltipProvider></ViewportContext>)
    const frame = screen.getByRole('region')
    Object.defineProperties(frame, { offsetWidth: { value: 440 }, offsetHeight: { value: 260 } })
    Object.defineProperty(frame.querySelector('.module-header'), 'offsetHeight', { value: 27 })
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Reloj' }))
    blockedRef.current = true
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Reloj' }))
    expect(fit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Expandir Reloj' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('amplía medidas internas sin doble zoom y recoge al quitar contenido', () => {
    const fit = vi.fn()
    render(<TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={fit}><Request /></ModuleFrame></TooltipProvider>)
    const frame = screen.getByRole('region')
    Object.defineProperties(frame, { offsetWidth: { configurable: true, value: 200 }, offsetHeight: { configurable: true, value: 140 } })
    Object.defineProperty(frame.querySelector('.module-header'), 'offsetHeight', { value: 27 })
    Object.defineProperty(frame.querySelector('.module-controls'), 'offsetHeight', { value: 25 })
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom de Reloj' })
    fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(fit).toHaveBeenLastCalledWith({ width: 302, height: 254 })
    Object.defineProperties(frame, { offsetWidth: { value: 800 }, offsetHeight: { value: 600 } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(fit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }))
    expect(fit).toHaveBeenLastCalledWith({ width: 800, height: 154 })
    expect(frame.style.width).toBe('')
  })
  it('el zoom conserva el marco y la edición del texto sigue ajustando la altura', async () => {
    let onResize: ResizeObserverCallback = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { onResize = callback }
      observe() {}
      disconnect() {}
    })
    try {
      function TextContent() {
        const [value, setValue] = useState('')
        const ref = useAutoGrowingTextarea(value)
        return <textarea ref={ref} aria-label="Anotación" value={value} onChange={event => setValue(event.target.value)} />
      }
      const fit = vi.fn()
      render(<TooltipProvider><ModuleFrame id="operations" active onClose={() => {}} onFit={fit}><TextContent /></ModuleFrame></TooltipProvider>)
      const frame = screen.getByRole('region')
      Object.defineProperties(frame, { offsetWidth: { value: 340 }, offsetHeight: { value: 164 } })
      Object.defineProperty(frame.querySelector('.module-controls'), 'offsetHeight', { value: 20 })
      let height = 115
      Object.defineProperties(frame.querySelector('.module-scaled-content'), {
        scrollWidth: { get: () => 338 }, scrollHeight: { get: () => height },
      })
      const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Anotación' })
      Object.defineProperty(textarea, 'scrollHeight', { get: () => height })
      const zoom = screen.getByRole('spinbutton', { name: 'Zoom de Operativo' })
      fireEvent.change(zoom, { target: { value: '50' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
      height = 40
      await act(async () => onResize([{ target: textarea, contentRect: { width: 200 } } as unknown as ResizeObserverEntry], {} as ResizeObserver))
      expect(fit).not.toHaveBeenCalled()
      height = 260
      fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
      await act(async () => onResize([{ target: textarea, contentRect: { width: 100 } } as unknown as ResizeObserverEntry], {} as ResizeObserver))
      expect(fit).not.toHaveBeenCalled()
      height = 210
      await act(async () => fireEvent.change(textarea, { target: { value: 'Uno\nDos\nTres' } }))
      expect(fit).toHaveBeenLastCalledWith({ width: 340, height: 259 })
      height = 40
      await act(async () => fireEvent.change(textarea, { target: { value: '' } }))
      expect(fit).toHaveBeenLastCalledWith({ width: 340, height: 89 })
    } finally { vi.unstubAllGlobals() }
  })
})
