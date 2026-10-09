import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { createDocumentStore, useDocumentStore } from '../document/documentStore'
import { BoardModule } from './BoardModule'
import { useBoardImage } from './useBoardImage'
import { ViewportContext } from '../../layout/ViewportContext'
import { createElement } from '../elements/elementCommands'
import { TooltipProvider } from '../../components/ui/tooltip'

// jsdom has no canvas renderer; actual Konva pixels are covered by browser tests.
vi.mock('react-konva', () => ({ Stage: () => null, Layer: () => null, Rect: () => null, Image: () => null, Line: () => null, Circle: () => null, Group: () => null }))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

async function setup() {
  const measurements: { node: HTMLElement; callback: () => void }[] = []
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: (entries: ResizeObserverEntry[]) => void) {}
    observe(node: HTMLElement) {
      if (!node.classList.contains('board-area')) { this.callback([]); return }
      Object.defineProperties(node, { clientWidth: { value: 400, configurable: true }, clientHeight: { value: 400, configurable: true } })
      measurements.push({ node, callback: () => this.callback([]) })
      this.callback([])
    }
    unobserve() {}
    disconnect() {}
  })
  let local = createEmptyDocument()
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async document => { local = document }, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  const blockedRef = { current: false }
  const onSelect = vi.fn()
  const onViewChange = vi.fn()
  function Harness({ visible = true, blocked = false }: { visible?: boolean; blocked?: boolean }) {
    blockedRef.current = blocked
    const imageSession = useBoardImage(store)
    const { documentGeneration } = useDocumentStore(store)
    return <TooltipProvider><ViewportContext.Provider value={{ blocked, blockedRef }}>
      <output aria-label="Imagen temporal">{imageSession.image ? `${imageSession.image.width}x${imageSession.image.height}` : 'Sin imagen'}</output>
      {visible && <BoardModule key={documentGeneration} store={store} imageSession={imageSession} onSelect={onSelect} onViewChange={onViewChange} />}
    </ViewportContext.Provider></TooltipProvider>
  }
  const view = render(<Harness />)
  const surface = screen.getByTestId('board-surface')
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 400, height: 400, right: 500, bottom: 500, x: 100, y: 100, toJSON: () => ({}) })
  const resize = (width: number, height: number) => act(() => {
    for (const { node, callback } of measurements) if (node.isConnected) {
      Object.defineProperties(node, { clientWidth: { value: width, configurable: true }, clientHeight: { value: height, configurable: true } }); callback()
    }
  })
  return { store, view, Harness, onSelect, onViewChange, resize, local: () => local }
}

describe('módulo Pizarra', () => {
  it('cerrar durante la decodificación descarta su aviso tardío y conserva el fondo anterior', async () => {
    let reject!: (error: Error) => void
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise<ImageBitmap>((_resolve, fail) => { reject = fail })))
    const { store, view, Harness } = await setup()
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['local'], 'mapa.png', { type: 'image/png' })] } })
    view.rerender(<Harness visible={false} />)
    await act(async () => reject(new Error('Imagen ilegible')))
    view.rerender(<Harness />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(store.getSnapshot().document).toEqual(before)
  })
  it('un aviso de imagen caducado o cerrado no reaparece al abrir Pizarra', async () => {
    const { view, Harness } = await setup()
    vi.useFakeTimers()
    const fail = async () => {
      await act(async () => fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['x'], 'archivo.txt', { type: 'text/plain' })] } }))
    }
    await fail()
    expect(screen.getByRole('alert')).toBeVisible()
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    view.rerender(<Harness visible={false} />); view.rerender(<Harness />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await fail()
    expect(screen.getByRole('alert')).toBeVisible()
    view.rerender(<Harness visible={false} />); view.rerender(<Harness />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('ocultar un pin lejano no desplaza la cámara ni el centro de creación al abrir o redimensionar', async () => {
    const { store, view, Harness, resize, onViewChange } = await setup()
    act(() => store.mutateDocument(document => {
      createElement(document, { name: 'Visible', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 500, y: 500 } })
      const hidden = createElement(document, { name: 'Oculto', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 50000, y: 50000 } })
      hidden.pinVisible = false
    }))
    view.rerender(<Harness visible={false} />); view.rerender(<Harness />)
    const original = structuredClone(store.getSnapshot().document)
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 500, y: 500 })
    expect(screen.queryByRole('button', { name: 'Seleccionar Oculto' })).not.toBeInTheDocument()
    const camera = screen.getByTestId('board-surface').getAttribute('data-offset-y')
    resize(720, 480)
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-offset-y', camera)
    expect(store.getSnapshot().document).toEqual(original)
  })
  it('centra cajas al abrir, mantiene escena al cambiar forma y descarta cámara al cambiar documento', async () => {
    const { store, view, Harness, resize, onViewChange } = await setup()
    act(() => store.mutateDocument(document => { document.board.quickNotes.push({ id: crypto.randomUUID(), title: '', scale: 1, text: 'Ruta', position: { x: 1200, y: 1600 }, width: 180, height: 80 }) }))
    view.rerender(<Harness visible={false} />); view.rerender(<Harness />)
    const before = structuredClone(store.getSnapshot().document)
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-scale', '1')
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 1200, y: 1600 })
    const camera = screen.getByTestId('board-surface').getAttribute('data-offset-y')
    resize(700, 300); resize(300, 700)
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-offset-y', camera)
    expect(store.getSnapshot().document).toEqual(before)
    act(() => store.newDocument())
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-offset-x', '0')
    expect(screen.getByTestId('board-surface')).toHaveAttribute('data-offset-y', '0')
    expect(onViewChange).toHaveBeenLastCalledWith({ x: 200, y: 200 })
  })
  it('rueda y Ctrl+rueda cambian solo cámara; el trazo puede guardar puntos más allá de 1000', async () => {
    const { store } = await setup(), surface = screen.getByTestId('board-surface')
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.wheel(surface, { clientX: 100, clientY: 100, deltaY: 1000, ctrlKey: true })
    expect(surface).toHaveAttribute('data-scale', '0.25')
    expect(store.getSnapshot().document).toEqual(before)
    fireEvent.click(screen.getByRole('radio', { name: 'Lápiz' }))
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 400, clientY: 400 })
    fireEvent.pointerUp(surface, { pointerId: 1 })
    expect(store.getSnapshot().document.board.strokes[0]?.points).toEqual([{ x: 1200, y: 1200 }])
  })
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
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 200, clientY: 200 })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null)
  })
  it('muestra todos los pines persistentes sin filtro; Goma no los manipula', async () => {
    const { store } = await setup()
    act(() => store.mutateDocument(document => {
      createElement(document, { name: 'Tango', visual: { type: 'asset', assetId: 'ambulance', scale: 1 }, information: '', isUnit: true })
      createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, information: '', isUnit: false })
    }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Goma' }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Ruta' })).toBeInTheDocument()
    expect(store.getSnapshot().document.elements).toHaveLength(2)
  })
  it('ofrece modos exclusivos y guarda el color con autoguardado', async () => {
    const { store, local } = await setup()
    expect(screen.getByRole('radio', { name: 'Seleccionar/mover' })).toHaveAttribute('aria-checked', 'true')
    for (const name of ['Lápiz', 'Goma', 'Seleccionar/mover']) {
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(screen.getAllByRole('radio').filter(button => button.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    }
    fireEvent.change(screen.getByLabelText('Color de fondo'), { target: { value: '#ffffff' } })
    await store.flushAutosave()
    expect(local().board.backgroundColor).toBe('#FFFFFF')
    expect(Object.keys(local().board)).toEqual(['backgroundColor', 'strokes', 'quickNotes'])
  })

  it('un clic crea, selecciona y enfoca una nota vacía; blur guarda y SquareX elimina', async () => {
    const { store, local } = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Nota rápida' }))
    const body = screen.getByLabelText('Texto de nota rápida')
    expect(body).toHaveFocus()
    expect(store.getSnapshot().document.board.quickNotes[0]).toMatchObject({ title: '', text: '', scale: 1, position: { x: 102, y: 41 }, width: 180, height: 58 })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    fireEvent.change(body, { target: { value: 'Acceso norte' } }); fireEvent.blur(body)
    await store.flushAutosave()
    expect(local().board.quickNotes[0]?.text).toBe('Acceso norte')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nota' }))
    await store.flushAutosave(); expect(local().board.quickNotes).toEqual([])
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

it('conserva extensión de contenido borrado y cámara explorada al redimensionar', async () => {
  const { store, resize } = await setup(), surface = screen.getByTestId('board-surface')
  act(() => store.mutateDocument(document => { document.board.quickNotes.push({ id: crypto.randomUUID(), title: '', scale: 1, text: 'Lejana', position: { x: 5000, y: 6000 }, width: 200, height: 80 }) }))
  const far = Number(surface.getAttribute('data-extent-height'))
  act(() => store.mutateDocument(document => { document.board.quickNotes = [] }))
  expect(Number(surface.getAttribute('data-extent-height'))).toBeGreaterThanOrEqual(far)
  for (let i = 0; i < 8; i++) fireEvent.wheel(surface, { deltaY: 350 })
  const offset = surface.getAttribute('data-offset-y')
  resize(300, 700)
  expect(surface).toHaveAttribute('data-offset-y', offset)
})


describe('herramientas 5B', () => {
  it('retirar imagen libera el recurso y conserva todo el documento y el color', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 400, close }))
    const { store } = await setup()
    act(() => store.mutateDocument(document => {
      document.board.backgroundColor = '#223344'
      document.board.quickNotes.push({ id: crypto.randomUUID(), title: '', scale: 1, text: 'Acceso', position: { x: 200, y: 200 }, width: 220, height: 96 })
      document.board.strokes.push({ id: crypto.randomUUID(), tool: 'pen', color: '#FFFFFF', width: 4, points: [{ x: 40, y: 40 }] })
      createElement(document, { name: 'Punto', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 } })
    }))
    fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['local'], 'mapa.png', { type: 'image/png' })] } })
    await waitFor(() => expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('800x400'))
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.click(screen.getByRole('button', { name: 'Borrar imagen de fondo' }))
    expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('Sin imagen')
    expect(close).toHaveBeenCalledOnce()
    expect(store.getSnapshot().document).toEqual(before)
  })
  it.each(['Lápiz', 'Goma'])('un clic vacío con %s deselecciona sin perder el punto; terminar arrastre conserva selección', async name => {
    const { store, onSelect } = await setup(), surface = screen.getByTestId('board-surface')
    fireEvent.click(screen.getByRole('radio', { name }))
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 250, clientY: 250 })
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 250, clientY: 250 })
    expect(onSelect).not.toHaveBeenCalled()
    expect(store.getSnapshot().document.board.strokes).toHaveLength(1)
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 200 })
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 200, clientY: 200 })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null)
    expect(store.getSnapshot().document.board.strokes).toHaveLength(2)
  })
  it('arrastrar vacío en Selección y cancelar puntero no deseleccionan', async () => {
    const { onSelect } = await setup(), surface = screen.getByTestId('board-surface')
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 250, clientY: 200 })
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 250, clientY: 200 })
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 200 })
    fireEvent.pointerCancel(surface, { pointerId: 2 })
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 200, clientY: 200 })
    expect(onSelect).not.toHaveBeenCalled()
  })
})


it('grosor usa rango propio 1–40 y el tacto nunca muestra cursor de hover', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir deslizador: Grosor' }))
  const slider = screen.getByRole('slider', { name: 'Grosor' })
  fireEvent.keyDown(slider, { key: 'End' })
  expect(slider).toHaveAttribute('aria-valuenow', '40')
  fireEvent.keyDown(slider, { key: 'Home' })
  expect(slider).toHaveAttribute('aria-valuenow', '1')
  fireEvent.keyDown(slider, { key: 'Escape' })
  fireEvent.click(screen.getByRole('radio', { name: 'Lápiz' }))
  const surface = screen.getByTestId('board-surface')
  fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', clientX: 200, clientY: 200 })
  expect(document.querySelector('.board-tool-cursor')).toBeInTheDocument()
  fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 200, clientY: 200 })
  expect(document.querySelector('.board-tool-cursor')).not.toBeInTheDocument()
})


it('borrar imagen pendiente cancela su decodificación tardía sin cambiar el documento', async () => {
  let complete!: (bitmap: ImageBitmap) => void
  vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise<ImageBitmap>(resolve => { complete = resolve })))
  const { store } = await setup(), before = structuredClone(store.getSnapshot().document)
  fireEvent.change(screen.getByLabelText('Cargar imagen de fondo'), { target: { files: [new File(['local'], 'mapa.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Borrar imagen de fondo' }))
  const close = vi.fn()
  await act(async () => complete({ width: 800, height: 400, close } as unknown as ImageBitmap))
  expect(screen.getByLabelText('Imagen temporal')).toHaveTextContent('Sin imagen')
  expect(close).toHaveBeenCalledOnce()
  expect(store.getSnapshot().document).toEqual(before)
})

it('un punto dibujado sobre la caja de un pin no cuenta como vacío', async () => {
  const { store, onSelect } = await setup()
  act(() => store.mutateDocument(doc => createElement(doc, { name: 'Referencia', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 } })))
  const pin = screen.getByRole('button', { name: 'Seleccionar Referencia' }).closest('.board-pin')!
  vi.spyOn(pin, 'getBoundingClientRect').mockReturnValue({ left: 180, top: 180, right: 220, bottom: 240, width: 40, height: 60, x: 180, y: 180, toJSON: () => ({}) })
  fireEvent.click(screen.getByRole('radio', { name: 'Lápiz' }))
  const surface = screen.getByTestId('board-surface')
  fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 200 })
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200, clientY: 200 })
  expect(onSelect).not.toHaveBeenCalled()
  expect(store.getSnapshot().document.board.strokes).toHaveLength(1)
})


it('crear en cámara desplazada usa el hueco visible sin cambiar la cámara ni los objetos', async () => {
  const { store } = await setup(), surface = screen.getByTestId('board-surface')
  fireEvent.wheel(surface, { deltaY: 1000, deltaX: 700 })
  const camera = [surface.getAttribute('data-offset-x'), surface.getAttribute('data-offset-y'), surface.getAttribute('data-scale')]
  fireEvent.click(screen.getByRole('button', { name: 'Nota rápida' }))
  const first = structuredClone(store.getSnapshot().document.board.quickNotes[0]!)
  fireEvent.keyDown(screen.getByLabelText('Texto de nota rápida'), { key: 'Escape' })
  expect(store.getSnapshot().document.board.quickNotes[0]).toEqual(first)
  fireEvent.click(screen.getByRole('button', { name: 'Nota rápida' }))
  expect(store.getSnapshot().document.board.quickNotes[1]).toMatchObject({ position: { x: first.position.x + 192, y: first.position.y } })
  expect(store.getSnapshot().document.board.quickNotes[0]).toEqual(first)
  expect([surface.getAttribute('data-offset-x'), surface.getAttribute('data-offset-y'), surface.getAttribute('data-scale')]).toEqual(camera)
})

it('cerrar confirma el texto activo y Nuevo descarta el borrador de otra generación', async () => {
  const { store, view, Harness } = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Nota rápida' }))
  fireEvent.change(screen.getByLabelText('Texto de nota rápida'), { target: { value: 'Acceso cerrado' } })
  view.rerender(<Harness visible={false} />)
  expect(store.getSnapshot().document.board.quickNotes[0]?.text).toBe('Acceso cerrado')
  view.rerender(<Harness />)
  const body = screen.getByLabelText('Texto de nota rápida')
  act(() => body.focus()); fireEvent.change(body, { target: { value: 'No copiar' } })
  act(() => store.newDocument())
  expect(store.getSnapshot().document.board.quickNotes).toEqual([])
})


it('el primer hueco usa la parte realmente visible cuando el dashboard recorta la superficie', async () => {
  const { store } = await setup(), surface = screen.getByTestId('board-surface')
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: -100, top: -100, width: 400, height: 400, right: 300, bottom: 300 } as DOMRect)
  fireEvent.click(screen.getByRole('button', { name: 'Nota rápida' }))
  expect(store.getSnapshot().document.board.quickNotes[0]).toMatchObject({ position: { x: 202, y: 141 } })
})
