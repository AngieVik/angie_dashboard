import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ViewportContext } from '../../layout/ViewportContext'
import { createDocumentStore } from '../document/documentStore'
import { addNotebookBlock, editNotebookNote } from './notebookCommands'
import { NotebookModule } from './NotebookModule'

async function setup() {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  return store
}
async function add(type: 'Nota' | 'Checklist') {
  fireEvent.click(screen.getByRole('button', { name: type }))
}
function blocks() { return within(screen.getByRole('list', { name: 'Bloques del Cuaderno' })).getAllByRole('listitem').filter(node => node.hasAttribute('data-block-id')) }
function geometry() {
  const list = screen.getByRole('list', { name: 'Bloques del Cuaderno' })
  vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 400, left: 0, right: 360, height: 400, width: 360 } as DOMRect)
  blocks().forEach((block, index) => vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({ top: index * 100, bottom: index * 100 + 90, height: 90 } as DOMRect))
}

describe('Cuaderno', () => {
  it('ofrece Nota y Checklist directamente, títulos editables y elimina bloques independientes', async () => {
    const store = await setup()
    render(<NotebookModule store={store} />)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    await add('Nota')
    const text = screen.getByRole('textbox', { name: 'Texto de nota' })
    expect(text.tagName).toBe('TEXTAREA')
    expect(text).toHaveAttribute('rows', '1')
    fireEvent.change(text, { target: { value: 'Preparación\n⚠ Acceso norte 📻' } })
    await add('Checklist')
    expect(blocks().map(node => node.dataset.blockType)).toEqual(['note', 'checklist'])
    fireEvent.change(screen.getByRole('textbox', { name: 'Título del bloque 1' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Título del bloque 2' }), { target: { value: 'Radio 📻'.repeat(30) } })
    expect(store.getSnapshot().document.notebook[0]).toMatchObject({ type: 'note', title: '', text: 'Preparación\n⚠ Acceso norte 📻' })
    expect(store.getSnapshot().document.notebook[1]?.title).toBe('Radio 📻'.repeat(30))
    fireEvent.click(within(blocks()[0]!).getByRole('button', { name: 'Eliminar bloque' }))
    expect(store.getSnapshot().document.notebook).toHaveLength(1)
    expect(store.getSnapshot().document.notebook[0]?.type).toBe('checklist')
    expect(screen.getByRole('button', { name: 'Nota' })).toHaveFocus()
  })

  it('permite añadir, editar, marcar, desmarcar y eliminar elementos del checklist', async () => {
    const store = await setup()
    render(<NotebookModule store={store} />)
    await add('Checklist')
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento' }))
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 1' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 1' })).toHaveAttribute('rows', '1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto del elemento 1' }), { target: { value: 'Comprobar radio 📻' } })
    const checkbox = screen.getByRole('checkbox', { name: 'Marcar elemento 1' })
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(store.getSnapshot().document.notebook[0]).toMatchObject({ items: [{ text: 'Comprobar radio 📻', checked: true }] })
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento después de 1' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar elemento 1' }))
    expect(store.getSnapshot().document.notebook[0]).toMatchObject({ items: [{ text: '', checked: false }] })
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 1' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar elemento 1' }))
    expect(screen.getByRole('button', { name: 'Añadir elemento' })).toHaveFocus()
  })

  it('el + inserta junto al ítem elegido y la eliminación recupera foco en el vecino disponible', async () => {
    const store = await setup()
    render(<NotebookModule store={store} />)
    await add('Checklist')
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto del elemento 1' }), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento después de 1' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto del elemento 2' }), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento después de 1' }))
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 2' })).toHaveFocus()
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto del elemento 2' }), { target: { value: 'Entre A y B' } })
    expect(screen.getAllByRole('textbox', { name: /Texto del elemento/ }).map(node => (node as HTMLTextAreaElement).value)).toEqual(['A', 'Entre A y B', 'B'])
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar elemento 2' }))
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 2' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 2' })).toHaveValue('B')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar elemento 2' }))
    expect(screen.getByRole('textbox', { name: 'Texto del elemento 1' })).toHaveFocus()
  })

  it('solo el tirador inicia el reordenado con ratón o tacto; cancelar no cambia el orden', async () => {
    const store = await setup()
    store.mutateDocument(document => { addNotebookBlock(document, 'note'); addNotebookBlock(document, 'checklist') })
    render(<NotebookModule store={store} />)
    geometry()
    const ids = store.getSnapshot().document.notebook.map(block => block.id)
    const content = screen.getByRole('textbox', { name: 'Texto de nota' })
    fireEvent.pointerDown(content, { pointerId: 1, button: 0, clientY: 20, pointerType: 'touch' })
    fireEvent.pointerMove(content, { pointerId: 1, clientY: 180, pointerType: 'touch' })
    fireEvent.pointerUp(content, { pointerId: 1, pointerType: 'touch' })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual(ids)
    const handle = screen.getAllByRole('button', { name: /Reordenar bloque/ })[0]!
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientY: 20 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 180 })
    fireEvent.pointerCancel(handle, { pointerId: 2 })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual(ids)
    fireEvent.pointerDown(handle, { pointerId: 3, button: 0, clientY: 20, pointerType: 'touch' })
    fireEvent.pointerMove(handle, { pointerId: 3, clientY: 180, pointerType: 'touch' })
    fireEvent.pointerUp(handle, { pointerId: 3, pointerType: 'touch' })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual([ids[1], ids[0]])
  })

  it('el tirador permite teclado y respeta los extremos del orden', async () => {
    const store = await setup()
    store.mutateDocument(document => { addNotebookBlock(document, 'note'); addNotebookBlock(document, 'checklist') })
    render(<NotebookModule store={store} />)
    const ids = store.getSnapshot().document.notebook.map(block => block.id)
    const handle = screen.getAllByRole('button', { name: /Reordenar bloque/ })[0]!
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual(ids)
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual([ids[1], ids[0]])
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(store.getSnapshot().document.notebook.map(block => block.id)).toEqual(ids)
  })

  it('conserva contenido al cerrar y reabrir y refleja el documento cargado', async () => {
    const store = await setup()
    const view = render(<NotebookModule store={store} />)
    await add('Nota')
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de nota' }), { target: { value: 'Preparación\n📻' } })
    view.unmount()
    render(<NotebookModule store={store} />)
    expect(screen.getByRole('textbox', { name: 'Texto de nota' })).toHaveValue('Preparación\n📻')
    act(() => store.newDocument())
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    act(() => store.mutateDocument(document => { const note = addNotebookBlock(document, 'note'); editNotebookNote(document, note.id, 'Importada') }))
    expect(screen.getByRole('textbox', { name: 'Texto de nota' })).toHaveValue('Importada')
  })

  it('dos dedos cancelan un arrastre y bloquean la edición y los controles', async () => {
    const store = await setup()
    store.mutateDocument(document => { addNotebookBlock(document, 'note'); addNotebookBlock(document, 'checklist') })
    const blockedRef = { current: false }
    const view = render(<ViewportContext.Provider value={{ blocked: false, blockedRef }}><NotebookModule store={store} /></ViewportContext.Provider>)
    geometry()
    const before = store.getSnapshot().document
    const handle = screen.getAllByRole('button', { name: /Reordenar bloque/ })[0]!
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 20 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 180 })
    blockedRef.current = true
    view.rerender(<ViewportContext.Provider value={{ blocked: true, blockedRef }}><NotebookModule store={store} /></ViewportContext.Provider>)
    fireEvent.pointerUp(handle, { pointerId: 1 })
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de nota' }), { target: { value: 'No' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Título del bloque 1' }), { target: { value: 'No' } })
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    expect(store.getSnapshot().document).toBe(before)
  })
})
