import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentStore } from './documentStore'
import { FileMenu, DocumentNotices } from './FileMenu'
import { createEmptyDocument } from '../../domain/document/defaultDocument'

async function setup(fail = false) {
  let local = createEmptyDocument('Recuperado')
  const repository = {
    loadActive: vi.fn(async () => { if (fail) throw new Error('apertura'); return local }),
    saveActive: vi.fn(async (document: typeof local) => { local = document }),
    clearActive: vi.fn(async () => {}),
  }
  const download = vi.fn()
  const store = createDocumentStore(repository, { platform: { download } })
  await store.initialize()
  render(<><FileMenu store={store} /><DocumentNotices store={store} /></>)
  return { store, repository, download }
}

describe('Archivo y modo degradado', () => {
  afterEach(() => vi.useRealTimers())
  it('el rechazo de archivo caduca sin reemplazar documento; el fallo de DB permanece', async () => {
    const { store } = await setup(true)
    vi.useFakeTimers()
    const original = store.getSnapshot().document
    await act(async () => store.loadDocument({ text: async () => '{' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Autoguardado no disponible')
    expect(store.getSnapshot().document).toBe(original)
    await act(async () => store.loadDocument({ text: async () => '{' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
  it('acepta el nombre desde Archivo y permite dejarlo vacío sin tocar el contenido', async () => {
    const { store } = await setup()
    const before = structuredClone(store.getSnapshot().document)
    const openName = async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Archivo' }), { key: 'ArrowDown' })
      fireEvent.click(await screen.findByRole('menuitem', { name: store.getSnapshot().document.document.title || 'Introducir nombre' }))
      return screen.findByRole('textbox', { name: 'Título del documento' })
    }
    const field = await openName()
    expect(field).toHaveValue('Recuperado')
    fireEvent.change(field, { target: { value: 'Preparación norte' } })
    expect(store.getSnapshot().document).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(store.getSnapshot().document.document.title).toBe('Preparación norte')
    expect(store.getSnapshot().document.board).toEqual(before.board)
    expect(store.getSnapshot().document.document.id).toBe(before.document.id)
    expect(screen.queryByRole('textbox', { name: 'Título del documento' })).not.toBeInTheDocument()
    const reopened = await openName()
    expect(reopened).toHaveValue('Preparación norte')
    fireEvent.change(reopened, { target: { value: '' } })
    fireEvent.submit(reopened.closest('form')!)
    await waitFor(() => expect(store.getSnapshot().document.document.title).toBe(''))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Archivo' }), { key: 'ArrowDown' })
    expect(await screen.findByRole('menuitem', { name: 'Introducir nombre' })).toBeInTheDocument()
  })

  it('cancelar el nombre conserva el documento y descarta el borrador', async () => {
    const { store } = await setup()
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Archivo' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: store.getSnapshot().document.document.title || 'Introducir nombre' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Título del documento' }), { target: { value: 'Descartar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(store.getSnapshot().document).toEqual(before)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Archivo' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: store.getSnapshot().document.document.title || 'Introducir nombre' }))
    expect(await screen.findByRole('textbox', { name: 'Título del documento' })).toHaveValue('Recuperado')
  })
  it('permite Nuevo y Guardar con teclado', async () => {
    const { store, download } = await setup()
    const trigger = screen.getByRole('button', { name: 'Archivo' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await screen.findByRole('menuitem', { name: 'Guardar' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Guardar' }))
    await waitFor(() => expect(download).toHaveBeenCalled())
    expect(JSON.parse(download.mock.calls[0]![0]).document.title).toBe('Recuperado')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Nuevo' }))
    await waitFor(() => expect(store.getSnapshot().document.document.title).toBe(''))
  })

  it('carga desde el input y un error conserva el documento', async () => {
    const { store } = await setup()
    const original = store.getSnapshot().document
    const input = screen.getByLabelText('Cargar documento JSON')
    fireEvent.change(input, { target: { files: [{ text: async () => '{' }] } })
    await screen.findByRole('alert')
    expect(store.getSnapshot().document).toEqual(original)
    const imported = createEmptyDocument('Archivo válido')
    fireEvent.change(input, { target: { files: [{ text: async () => JSON.stringify(imported) }] } })
    await waitFor(() => expect(store.getSnapshot().document).toEqual(imported))
  })

  it('muestra aviso persistente, exporta en memoria y retira el aviso tras reintentar', async () => {
    const { store, repository, download } = await setup(true)
    expect(screen.getByRole('alert')).toHaveTextContent('Autoguardado no disponible')
    act(() => store.setTitle('Sin IndexedDB'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar JSON' }))
    await waitFor(() => expect(download).toHaveBeenCalled())
    expect(JSON.parse(download.mock.calls[0]![0]).document.title).toBe('Sin IndexedDB')
    vi.mocked(repository.loadActive).mockResolvedValueOnce(null!)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.queryByText('Autoguardado no disponible')).not.toBeInTheDocument())
    expect(store.getSnapshot().document.document.title).toBe('Sin IndexedDB')
  })
})


describe('interfaz de guardado V4', () => {
  it('ofrece Guardar como y distingue el dispositivo del archivo pendiente', async () => {
    const { store } = await setup()
    act(() => store.setTitle('Cambios'))
    await act(async () => { await store.flushAutosave() })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Archivo' }), { key: 'ArrowDown' })
    expect(await screen.findByRole('menuitem', { name: 'Guardar como' })).toBeInTheDocument()
    expect(screen.getByText(/Guardado en este dispositivo/)).toBeInTheDocument()
    expect(screen.getByText('Cambios pendientes de guardar en archivo')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Recuperar documento local' })).toBeInTheDocument()
  })
  it('impide sustituir el documento sin protección y permite cancelar desde el diálogo', async () => {
    const { store } = await setup(true)
    act(() => store.setTitle('En memoria'))
    await act(async () => { await store.newDocument() })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(store.getSnapshot().document.document.title).toBe('En memoria')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar sustitución' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(store.getSnapshot().document.document.title).toBe('En memoria')
  })
})
