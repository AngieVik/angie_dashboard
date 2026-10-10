import { useContext } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleFrame } from './ModuleFrame'
import { ModuleSizeContext } from './ModuleSizeContext'
import { TooltipProvider } from '../components/ui/tooltip'

function Request() {
  const request = useContext(ModuleSizeContext)
  return <><button onClick={() => request({ width: 300, height: 200 })}>Añadir</button><button onClick={() => request({ width: 0, height: 100 }, { fitHeight: true })}>Recoger</button></>
}
describe('espacio solicitado por un módulo', () => {
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
