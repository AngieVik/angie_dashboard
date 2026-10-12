import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'
import { getDocumentStore } from '../features/document/documentStore'
import { writeNavigation } from '../layout/navigationStorage'
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null, Group: () => null }))
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })
it('recupera navegación del documento antes de la primera medición sin resetear al 100', async () => {
  const store = getDocumentStore()
  await store.initialize()
  await act(async () => { store.newDocument() })
  writeNavigation(store.getSnapshot().document.document.id + '.dashboard', { scale: 1.5, offsetX: -150, offsetY: -300 })
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: () => void) {}
    observe(element: HTMLElement) {
      if (!element.classList.contains('dashboard-workspace')) return
      Object.defineProperties(element, { clientWidth: { value: 800 }, clientHeight: { value: 500 } })
      this.callback()
    }
    disconnect() {}
  })
  render(<App />)
  expect(screen.getByLabelText('Zoom actual')).toHaveValue(150)
  expect(screen.getByTestId('mobile-viewport')).toHaveAttribute('data-offset-x', '-150')
  expect(screen.getByTestId('mobile-viewport')).toHaveAttribute('data-offset-y', '-300')
})
