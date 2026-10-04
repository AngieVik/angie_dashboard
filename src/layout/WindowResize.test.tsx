import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WindowResize } from './WindowResize'

it('redimensiona una ventana con escala externa y cancela un gesto incompleto', () => {
  render(<div data-testid="window"><WindowResize label="Redimensionar editor" /></div>)
  const window = screen.getByTestId('window')
  Object.defineProperties(window, { offsetWidth: { value: 200 }, offsetHeight: { value: 100 } })
  vi.spyOn(window, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, toJSON() {} })
  const handle = screen.getByRole('button', { name: 'Redimensionar editor' })
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 400, clientY: 200 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500, clientY: 240 })
  expect(window.style.width).toBe('250px'); expect(window.style.height).toBe('120px')
  fireEvent.pointerCancel(handle, { pointerId: 1 })
  expect(window.style.width).toBe(''); expect(window.style.height).toBe('')
})
