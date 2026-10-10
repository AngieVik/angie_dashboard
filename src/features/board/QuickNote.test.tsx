import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickNote } from './QuickNote'
import { ViewportContext } from '../../layout/ViewportContext'
import type { QuickNote as Note } from '../../domain/document/types'

function setup(legacy = false) {
  const node = document.createElement('div')
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 1400, height: 600 } as DOMRect)
  const onMove = vi.fn(), onResize = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn(), blockedRef = { current: false }
  const note: Note = { id: 'note', title: legacy ? 'Accesos' : '', scale: 1, text: 'Ruta', position: { x: 500, y: 300 }, width: 220, height: 96 }
  const props = { note, selected: true, enabled: true, surface: { current: node }, view: { scale: .5, offsetX: -50, offsetY: -30 },
    viewportSize: { width: 700, height: 300 }, onSelect: vi.fn(), onMove, onResize, onEdit, onDelete }
  function Harness({ blocked = false }: { blocked?: boolean }) {
    blockedRef.current = blocked
    return <ViewportContext.Provider value={{ blocked, blockedRef }}><QuickNote {...props} /></ViewportContext.Provider>
  }
  return { ...render(<Harness />), Harness, onMove, onResize, onEdit, onDelete, note }
}
describe('nota rápida en sitio', () => {
  it('redimensiona ancho sin cambiar alto ni texto y confirma solo al levantar', () => {
    const { onResize, container } = setup(), handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 320, clientY: 100 })
    expect(onResize).not.toHaveBeenCalled()
    expect(container.querySelector('.quick-note')).toHaveStyle({ width: '440px', height: '96px', left: '610px', top: '300px' })
    expect(screen.getByLabelText('Texto de nota rápida')).toHaveValue('Ruta')
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onResize).toHaveBeenCalledExactlyOnceWith({ width: 440, height: 96 })
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
  it('muestra un solo campo y conserva títulos antiguos dentro del texto; Escape descarta el borrador', () => {
    const { onEdit, container, note } = setup(), body = screen.getByLabelText('Texto de nota rápida')
    expect(screen.queryByLabelText('Título de nota rápida')).not.toBeInTheDocument()
    expect(container.querySelectorAll('textarea')).toHaveLength(1)
    expect(body).toHaveAttribute('rows', '1')
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Acceso norte' } }); fireEvent.blur(body)
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ text: 'Acceso norte' })
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Provisional' } }); fireEvent.keyDown(body, { key: 'Escape' }); fireEvent.blur(body)
    expect(body).toHaveValue(note.text); expect(onEdit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.quick-note')).toHaveFocus()
  })
  it('Enter añade líneas y respeta composición IME', () => {
    const { onEdit } = setup(), body = screen.getByLabelText('Texto de nota rápida')
    fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Accesos' } })
    fireEvent.compositionStart(body); fireEvent.keyDown(body, { key: 'Escape', isComposing: true })
    expect(body).toHaveValue('Accesos'); expect(onEdit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(body); fireEvent.change(body, { target: { value: 'Accesos\nNorte' } }); fireEvent.keyDown(body, { key: 'Enter' }); fireEvent.blur(body)
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ text: 'Accesos\nNorte' })
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
  expect(onResize).toHaveBeenCalledExactlyOnceWith({ width: 48, height: 32 })
  expect(container.querySelector('.quick-note')).toHaveStyle({ width: '220px', height: '96px' })
})


it('un título heredado se ve en el campo único y se guarda sin duplicarlo al editar', () => {
  const { onEdit } = setup(true), body = screen.getByLabelText('Texto de nota rápida')
  expect(body).toHaveValue('Accesos\nRuta')
  fireEvent.focus(body); fireEvent.change(body, { target: { value: 'Accesos\nRuta norte' } }); fireEvent.blur(body)
  expect(onEdit).toHaveBeenCalledExactlyOnceWith({ title: '', text: 'Accesos\nRuta norte' })
})


it('ajusta el texto al reducir la caja y recupera tamaño al ampliar sin editar el documento', () => {
  const { onEdit, onResize } = setup()
  const body = screen.getByLabelText('Texto de nota rápida') as HTMLTextAreaElement
  Object.defineProperties(body, {
    clientWidth: { configurable: true, get: () => 100 },
    clientHeight: { configurable: true, get: () => 20 },
    scrollWidth: { configurable: true, get: () => 100 },
    scrollHeight: { configurable: true, get: () => parseFloat(body.style.fontSize || '16') * 3 },
  })
  const handle = screen.getByRole('button', { name: 'Redimensionar nota rápida' })
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 80, clientY: 100 })
  expect(parseFloat(body.style.fontSize)).toBeLessThanOrEqual(20 / 3)
  expect(parseFloat(body.style.fontSize)).toBeGreaterThan(6.5)
  Object.defineProperty(body, 'clientHeight', { get: () => 100 })
  fireEvent.pointerCancel(handle, { pointerId: 1 })
  expect(parseFloat(body.style.fontSize)).toBeGreaterThan(33.2)
  expect(parseFloat(body.style.fontSize)).toBeLessThanOrEqual(100 / 3)
  expect(onEdit).not.toHaveBeenCalled(); expect(onResize).not.toHaveBeenCalled()
})
