import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentStore } from '../document/documentStore'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { useBoardImage } from './useBoardImage'
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX9sAAAAASUVORK5CYII='
afterEach(() => vi.unstubAllGlobals())
function setup(document = createEmptyDocument()) {
  let local = document
  const store = createDocumentStore({ loadActive: async () => local, saveActive: async value => { local = value }, clearActive: async () => {} }, { platform: { download: () => {} } })
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }))
  return { store, local: () => local }
}
describe('imagen portable del documento', () => {
  it('incluye el fondo y su colocación en el autoguardado y al volver a abrir', async () => {
    const { store, local } = setup(); await store.initialize()
    const { result, unmount } = renderHook(() => useBoardImage(store))
    const file = new File([Uint8Array.from(atob(png.split(',')[1]!), character => character.charCodeAt(0))], 'fondo.png', { type: 'image/png' })
    await act(async () => { await result.current.load(file) })
    act(() => result.current.updateLayout({ x: -20, y: 30, width: 400, height: 400 }))
    await store.flushAutosave()
    expect(local().board.backgroundImage).toEqual({ dataUrl: png, layout: { x: -20, y: 30, width: 400, height: 400 } })
    unmount()
    const restored = setup(local()); await restored.store.initialize()
    const hook = renderHook(() => useBoardImage(restored.store))
    await waitFor(() => expect(hook.result.current.image?.width).toBe(1))
    expect(hook.result.current.layout).toEqual({ x: -20, y: 30, width: 400, height: 400 })
  })
  it('borrar el fondo lo elimina del documento persistente', async () => {
    const document = createEmptyDocument()
    Object.assign(document.board, { backgroundImage: { dataUrl: png, layout: { x: 0, y: 0, width: 100, height: 100 } } })
    const { store, local } = setup(document); await store.initialize()
    const hook = renderHook(() => useBoardImage(store))
    await waitFor(() => expect(hook.result.current.image).not.toBeNull())
    act(() => hook.result.current.clear())
    await store.flushAutosave()
    expect(local().board).not.toHaveProperty('backgroundImage')
    expect(hook.result.current.image).toBeNull()
  })
})
