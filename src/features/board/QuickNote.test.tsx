import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickNote } from './QuickNote'
import { ViewportContext } from '../../layout/ViewportContext'

function setup() {
  const node = document.createElement('div')
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 1400, height: 600 } as DOMRect)
  const onMove = vi.fn(), onResize = vi.fn(), blockedRef = { current: false }
  const props = { note: { id: 'note', text: 'Ruta', position: { x: 500, y: 300 }, width: 220, height: 96 },
    selected: true, enabled: true, surface: { current: node }, view: { scale: .5, offsetX: -50, offsetY: -30 },
    viewportSize: { width: 700, height: 300 }, onSelect: vi.fn(), onMove, onResize, onEdit: vi.fn(), onDelete: vi.fn() }
  function Harness({ blocked = false }: { blocked?: boolean }) {
    blockedRef.current = blocked
    return <ViewportContext.Provider value={{ blocked, blockedRef }}><QuickNote {...props} /></ViewportContext.Provider>
  }
  return { ...render(<Harness />), Harness, onMove, onResize }
}
describe('caja de nota rápida', () => {
  it('respeta dimensiones persistentes; resize conserva texto y centro y confirma únicamente al levantar', () => {
    const { onResize, container } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px', left: '500px', top: '300px' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 140, clientY: 120 })
    expect(onResize).not.toHaveBeenCalled()
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '300px', height: '136px', left: '500px', top: '300px' })
    expect(screen.getByRole('button', { name: 'Ruta' })).toHaveTextContent('Ruta')
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onResize).toHaveBeenCalledExactlyOnceWith({ width: 300, height: 136 })
  })
  it('impone mínimos y descarta preview al cancelar o pasar a dos dedos', () => {
    const { onResize, container, rerender, Harness } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -100, clientY: -100 })
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '120px', height: '64px' })
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    expect(onResize).not.toHaveBeenCalled()
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 140, clientY: 120 })
    rerender(<Harness blocked />)
    fireEvent.pointerUp(handle, { pointerId: 2 })
    expect(onResize).not.toHaveBeenCalled()
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px' })
  })
})
