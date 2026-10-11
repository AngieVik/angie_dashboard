import { useContext } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleFrame } from './ModuleFrame'
import { ModuleSizeContext } from './ModuleSizeContext'
import { TooltipProvider } from '../components/ui/tooltip'
import { ViewportContext } from './ViewportContext'

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
    expect(fit).toHaveBeenCalledExactlyOnceWith({ width: 440, height: 29 })
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
  it('amplía al zoom individual y suma la cabecera y footer sin encoger', () => {
    const fit = vi.fn()
    render(<TooltipProvider><ModuleFrame id="clock" active onClose={() => {}} onFit={fit}><Request /></ModuleFrame></TooltipProvider>)
    const frame = screen.getByRole('region')
    Object.defineProperties(frame, { offsetWidth: { configurable: true, value: 200 }, offsetHeight: { configurable: true, value: 140 } })
    Object.defineProperty(frame.querySelector('.module-header'), 'offsetHeight', { value: 27 })
    Object.defineProperty(frame.querySelector('.module-controls'), 'offsetHeight', { value: 25 })
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom de Reloj' })
    fireEvent.change(zoom, { target: { value: '200' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(fit).toHaveBeenLastCalledWith({ width: 602, height: 454 })
    Object.defineProperties(frame, { offsetWidth: { value: 800 }, offsetHeight: { value: 600 } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(fit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }))
    expect(fit).toHaveBeenLastCalledWith({ width: 800, height: 254 })
    expect(frame.style.width).toBe('')
  })
})
