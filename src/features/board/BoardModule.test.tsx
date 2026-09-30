import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { createDocumentStore } from '../document/documentStore'
import { BoardModule } from './BoardModule'
import { useBoardImage } from './useBoardImage'
import { ViewportContext } from '../../layout/ViewportContext'
import { createElement } from '../elements/elementCommands'

// jsdom has no canvas renderer; actual Konva pixels are covered by browser tests.
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null }))
afterEach(() => vi.unstubAllGlobals())

async function setup() {
  let local = createEmptyDocument()
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async document => { local = document }, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  const blockedRef = { current: false }
  const onSelect = vi.fn()
  function Harness({ visible = true, blocked = false }: { visible?: boolean; blocked?: boolean }) {
    blockedRef.current = blocked
    const imageSession = useBoardImage(store)
    return <ViewportContext.Provider value={{ blocked, blockedRef }}>
      <output aria-label="Imagen temporal">{imageSession.image ? `${imageSession.image.width}x${imageSession.image.height}` : 'Sin imagen'}</output>
      {visible && <BoardModule store={store} imageSession={imageSession} onSelect={onSelect} />}
    </ViewportContext.Provider>
  }
  const view = render(<Harness />)
  const surface = screen.getByTestId('board-surface')
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 400, height: 400, right: 500, bottom: 500, x: 100, y: 100, toJSON: () => ({}) })
  return { store, view, Harness, onSelect, local: () => local }
}

describe('módulo Pizarra', () => {
  it('deselecciona al terminar un toque vacío y cancela esa acción cuando aparece otro dedo', async () => {
    const { view, Harness, onSelect } = await setup()
    const surface = screen.getByTestId('board-surface')
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    expect(onSelect).not.toHaveBeenCalled()
    view.rerender(<Harness blocked />)
    fireEvent.pointerUp(surface, { pointerId: 1 })
    expect(onSelect).not.toHaveBeenCalled()
    view.rerender(<Harness />)
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 200 })
    fireEvent.pointerUp(surface, { pointerId: 2 })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null)
  })
  it('muestra los pines persistentes y el filtro oculta solo dotaciones; Goma no los manipula', async () => {
    const { store } = await setup()
    act(() => store.mutateDocument(document => {
      createElement(document, { name: 'Tango', visual: { type: 'asset', assetId: 'ambulance', scale: 1 }, information: '', isUnit: true })
      createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍' }, information: '', isUnit: false })
    }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Goma' }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeDisabled()
    act(() => store.mutateDocument(document => { document.filters.visibleStatuses = [] }))
    expect(screen.queryByRole('button', { name: 'Seleccionar Tango' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Ruta' })).toBeInTheDocument()
    expect(store.getSnapshot().document.elements).toHaveLength(2)
  })
  it('ofrece cuatro modos exclusivos y guarda el color con autoguardado', async () => {
    const { store, local } = await setup()
    expect(screen.getByRole('radio', { name: 'Seleccionar/mover' })).toHaveAttribute('aria-checked', 'true')
    for (const name of ['Lápiz', 'Goma', 'Nota rápida', 'Seleccionar/mover']) {
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(screen.getAllByRole('radio').filter(button => button.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    }
    fireEvent.change(screen.getByLabelText('Color de fondo'), { target: { value: '#ffffff' } })
    await store.flushAutosave()
    expect(local().board.backgroundColor).toBe('#FFFFFF')
    expect(Object.keys(local().board)).toEqual(['backgroundColor', 'strokes', 'quickNotes'])
  })

  it('crea, edita y elimina notas persistentes; crear vuelve al modo seleccionar', async () => {
    const { store, local } = await setup()
    fireEvent.click(screen.getByRole('radio', { name: 'Nota rápida' }))
    fireEvent.pointerDown(screen.getByTestId('board-surface'), { pointerId: 1, button: 0, clientX: 300, clientY: 240 })
    fireEvent.change(screen.getByLabelText('Texto de nota rápida'), { target: { value: 'Acceso norte' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear nota' }))
    await store.flushAutosave()
    expect(local().board.quickNotes[0]).toMatchObject({ text: 'Acceso norte', position: { x: 500, y: 350 } })
    expect(screen.getByRole('radio', { name: 'Seleccionar/mover' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }))
    fireEvent.change(screen.getByLabelText('Texto de nota rápida'), { target: { value: 'Acceso sur' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }))
    expect(screen.getByRole('button', { name: 'Acceso sur' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nota' }))
    await store.flushAutosave()
    expect(local().board.quickNotes).toEqual([])
  })

  it('un segundo dedo cancela un trazo pendiente sin guardar puntos accidentales', async () => {
    const { store, view, Harness } = await setup()
    fireEvent.click(screen.getByRole('radio', { name: 'Lápiz' }))
    fireEvent.pointerDown(screen.getByTestId('board-surface'), { pointerId: 1, button: 0, clientX: 300, clientY: 240 })
    view.rerender(<Harness blocked />)
    fireEvent.pointerUp(screen.getByTestId('board-surface'), { pointerId: 1, clientX: 350, clientY: 250 })
    expect(store.getSnapshot().document.board.strokes).toEqual([])
  })

  it('conserva imagen al cerrar el módulo y ante errores; cargar el mismo JSON la descarta y libera', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 400, close }))
    const { store, view, Harness, local } = await setup()
    const upload = () => fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['local'], 'mapa.png', { type: 'image/png' })] } })
    upload()
    await waitFor(() => expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('800x400'))
    view.rerender(<Harness visible={false} />); view.rerender(<Harness />)
    expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('800x400')
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('dañado'))
    upload()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Se conserva el fondo anterior'))
    expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('800x400')
    expect(close).not.toHaveBeenCalled()
    await store.flushAutosave()
    expect(Object.keys(local().board)).toEqual(['backgroundColor', 'strokes', 'quickNotes'])
    await act(() => store.loadDocument({ text: async () => JSON.stringify(store.getSnapshot().document) }))
    expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('Sin imagen')
    expect(close).toHaveBeenCalledOnce()
  })

  it('una decodificación tardía no reintroduce una imagen tras Nuevo', async () => {
    let complete!: (bitmap: ImageBitmap) => void
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise<ImageBitmap>(resolve => { complete = resolve })))
    const { store } = await setup()
    fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['local'], 'mapa.png', { type: 'image/png' })] } })
    act(() => store.newDocument())
    const close = vi.fn()
    await act(async () => { complete({ width: 800, height: 400, close } as unknown as ImageBitmap) })
    expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('Sin imagen')
    expect(close).toHaveBeenCalledOnce()
  })
})
