import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpTooltip, TooltipProvider } from './tooltip'
import { Button } from './button'

function touch(node: HTMLElement, type: string, values: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10, ...values })
  fireEvent(node, event)
}
afterEach(() => vi.useRealTimers())
describe('ayudas táctiles', () => {
  it('un segundo dedo fuera del control cancela la ayuda antes de los 500 ms', () => {
    vi.useFakeTimers()
    render(<TooltipProvider><HelpTooltip text="Ayuda"><Button>Acción</Button></HelpTooltip></TooltipProvider>)
    touch(screen.getByRole('button', { name: 'Acción' }), 'pointerdown')
    act(() => vi.advanceTimersByTime(250))
    touch(document.body, 'pointerdown', { pointerId: 2, isPrimary: false })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
  it('tap ejecuta una acción; consulta mantenida abre ayuda y consume solo su propio click', () => {
    vi.useFakeTimers(); const action = vi.fn()
    render(<TooltipProvider><HelpTooltip text="Ayuda"><Button onClick={action}>Acción</Button></HelpTooltip></TooltipProvider>)
    const button = screen.getByRole('button', { name: 'Acción' })
    touch(button, 'pointerdown'); touch(button, 'pointerup'); fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    touch(button, 'pointerdown'); act(() => vi.advanceTimersByTime(499))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ayuda')
    touch(button, 'pointerup'); fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    touch(button, 'pointerdown'); touch(button, 'pointerup'); fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(2)
  })
  it('movimiento y cancelación descartan la consulta pendiente; desmontar limpia el plazo', () => {
    vi.useFakeTimers()
    const { unmount } = render(<TooltipProvider><HelpTooltip text="Ayuda"><Button>Acción</Button></HelpTooltip></TooltipProvider>)
    const button = screen.getByRole('button', { name: 'Acción' })
    touch(button, 'pointerdown'); touch(button, 'pointermove', { clientX: 30 })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    touch(button, 'pointerdown'); touch(button, 'pointercancel')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    touch(button, 'pointerdown'); unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
