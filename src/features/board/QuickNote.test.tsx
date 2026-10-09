import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickNote } from './QuickNote'
import { ViewportContext } from '../../layout/ViewportContext'
import type { QuickNote as Note } from '../../domain/document/types'

function setup() {
  const node = document.createElement('div')
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 1400, height: 600 } as DOMRect)
  const onMove = vi.fn(), onResize = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn(), blockedRef = { current: false }
  const note: Note = { id: 'note', title: '', scale: 1, text: 'Ruta', position: { x: 500, y: 300 }, width: 220, height: 96 }
  const props = { note, selected: true, enabled: true, surface: { current: node }, view: { scale: .5, offsetX: -50, offsetY: -30 },
    viewportSize: { width: 700, height: 300 }, onSelect: vi.fn(), onMove, onResize, onEdit, onDelete }
  function Harness({ blocked = false }: { blocked?: boolean }) {
    blockedRef.current = blocked
    return <ViewportContext.Provider value={{ blocked, blockedRef }}><QuickNote {...props} /></ViewportContext.Provider>
  }
  return { ...render(<Harness />), Harness, onMove, onResize, onEdit, onDelete, note }
}
describe('nota rápida en sitio', () => {
  it('escala desde diagonal con esquina fija y confirma solo al levantar', () => {
    const { onResize, container } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 320, clientY: 196 })
    expect(onResize).not.toHaveBeenCalled()
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '440px', height: '192px', left: '610px', top: '348px' })
    expect(screen.getByLabelText('Texto de nota rápida')).toHaveValue('Ruta')
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onResize).toHaveBeenCalledExactlyOnceWith(2)
  })
  it('pointercancel o segundo dedo descartan preview y no confirman edición', () => {
    const { onResize, onEdit, container, rerender, Harness } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
    const body = screen.getByLabelText('Texto de nota rápida')
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Borrador' } })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 140, clientY: 120 })
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 140, clientY: 120 })
    rerender(<Harness blocked />); fireEvent.pointerUp(handle, { pointerId: 2 })
    expect(onResize).not.toHaveBeenCalled(); expect(onEdit).not.toHaveBeenCalled()
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px' })
    expect(body).toHaveValue('Borrador')
  })
  it('blur confirma un campo; Escape descarta solo su borrador y devuelve foco', () => {
    const { onEdit, container } = setup(), title = screen.getByLabelText('Título de nota rápida'), body = screen.getByLabelText('Texto de nota rápida')
    fireEvent.focus(title); fireEvent.change(title, { target: { value: 'Accesos' } }); fireEvent.blur(title)
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ title: 'Accesos' })
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Provisional' } }); fireEvent.keyDown(body, { key: 'Escape' }); fireEvent.blur(body)
    expect(body).toHaveValue('Ruta'); expect(onEdit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.quick-note')).toHaveFocus()
  })
  it('Enter en título confirma una vez, pasa al cuerpo y respeta IME', () => {
    const { onEdit } = setup(), title = screen.getByLabelText('Título de nota rápida'), body = screen.getByLabelText('Texto de nota rápida')
    fireEvent.focus(title); fireEvent.change(title, { target: { value: 'Accesos' } })
    fireEvent.compositionStart(title); fireEvent.keyDown(title, { key: 'Enter', isComposing: true })
    expect(onEdit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(title); fireEvent.keyDown(title, { key: 'Enter' }); fireEvent.blur(title)
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ title: 'Accesos' }); expect(body).toHaveFocus()
  })
  it('editar campos nunca arrastra; SquareX elimina sin confirmar el borrador', () => {
    const { onMove, onEdit, onDelete } = setup(), body = screen.getByLabelText('Texto de nota rápida')
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Descartar' } })
    fireEvent.pointerDown(body, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 150, clientY: 130 }); fireEvent.pointerUp(body, { pointerId: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nota' })); fireEvent.blur(body)
    expect(onMove).not.toHaveBeenCalled(); expect(onEdit).not.toHaveBeenCalled(); expect(onDelete).toHaveBeenCalledOnce()
  })
  it('cerrar confirma el campo activo y montar una caja heredada no cambia geometría', () => {
    const { unmount, onEdit, container } = setup(), body = screen.getByLabelText('Texto de nota rápida')
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px' })
    expect(onEdit).not.toHaveBeenCalled()
    act(() => body.focus()); fireEvent.change(body, { target: { value: 'Salida sur' } }); unmount()
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ text: 'Salida sur' })
  })
})

it('cruzar la esquina al reducir no colapsa la nota ni sus controles', () => {
  const { onResize, container } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300, clientY: 200 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(handle, { pointerId: 1 })
  expect(onResize).not.toHaveBeenCalled()
  expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px' })
})
