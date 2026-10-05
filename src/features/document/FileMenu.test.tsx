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
    expect(store.getSnapshot().document.document.title).toBe('')
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
