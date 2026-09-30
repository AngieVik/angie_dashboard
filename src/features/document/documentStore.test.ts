import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import type { AngieDocumentV1 } from '../../domain/document/types'
import type { ActiveDocumentRepository } from '../../storage/documentRepository'
import { createDocumentStore } from './documentStore'

function setup(saved: AngieDocumentV1 | null = null) {
  let local = saved
  const repository: ActiveDocumentRepository = {
    loadActive: vi.fn(async () => local),
    saveActive: vi.fn(async document => { local = structuredClone(document) }),
    clearActive: vi.fn(async () => { local = null }),
  }
  const download = vi.fn()
  const store = createDocumentStore(repository, { platform: { download } })
  return { store, repository, download, local: () => local }
}

describe('documento activo y autoguardado', () => {
  it('una carga pendiente no reemplaza una edición posterior a su inicio', async () => {
    const { store, local } = setup(createEmptyDocument('Actual'))
    await store.initialize()
    let finish!: (text: string) => void
    const reading = store.loadDocument({ text: () => new Promise(resolve => { finish = resolve }) })
    store.setTitle('Editado durante lectura')
    finish(JSON.stringify(createEmptyDocument('Desde archivo')))
    await reading
    await store.flushAutosave()
    expect(store.getSnapshot().document.document.title).toBe('Editado durante lectura')
    expect(local()?.document.title).toBe('Editado durante lectura')
    expect(store.getSnapshot().fileMessage).toContain('Vuelve a cargar')
  })

  it('la alternativa de descarga exporta el estado actual, incluido lo editado tras el fallo', async () => {
    const repository: ActiveDocumentRepository = {
      loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {},
    }
    const download = vi.fn()
    const store = createDocumentStore(repository, { platform: {
      download, pickSave: async () => { throw new DOMException('denegado', 'NotAllowedError') },
    } })
    await store.initialize()
    store.setTitle('Antes del fallo')
    await store.saveDocument()
    store.setTitle('Último estado')
    await store.acceptDownloadFallback()
    expect(JSON.parse(download.mock.calls[0]![0]).document.title).toBe('Último estado')
    expect(download.mock.calls[0]![1]).toBe('Último estado.json')
  })

  it('recupera y guarda cambios persistentes con createdAt estable y updatedAt actualizado', async () => {
    const saved = createEmptyDocument('Recuperado')
    const { store, local } = setup(saved)
    await store.initialize()
    expect(store.getSnapshot().document).toEqual(saved)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.parse(saved.document.updatedAt) + 1000))
    store.setTitle('Editado')
    await store.flushAutosave()
    vi.useRealTimers()
    expect(local()?.document.title).toBe('Editado')
    expect(local()?.document.createdAt).toBe(saved.document.createdAt)
    expect(local()?.document.updatedAt).not.toBe(saved.document.updatedAt)
  })

  it('serializa escrituras rápidas y guarda el estado más reciente', async () => {
    const { store, local } = setup()
    await store.initialize()
    store.setTitle('Primero')
    store.setTitle('Último')
    await store.flushAutosave()
    expect(local()?.document.title).toBe('Último')
  })

  it('Nuevo y carga válida sustituyen solo el documento y se autoguardan', async () => {
    const { store, local } = setup(createEmptyDocument('Anterior'))
    await store.initialize()
    const oldId = store.getSnapshot().document.document.id
    store.newDocument()
    await store.flushAutosave()
    expect(local()?.document.title).toBe('')
    expect(local()?.document.id).not.toBe(oldId)
    const imported = createEmptyDocument('Importado')
    await store.loadDocument({ text: async () => JSON.stringify(imported) })
    await store.flushAutosave()
    expect(local()).toEqual(imported)
  })

  it.each(['{', '{"format":"otro"}', '{"format":"angie-dashboard","formatVersion":2}'])('carga rechazada conserva estado y autoguardado: %s', async text => {
    const { store, local } = setup(createEmptyDocument('Conservar'))
    await store.initialize()
    const before = structuredClone(store.getSnapshot().document)
    await store.loadDocument({ text: async () => text })
    await store.flushAutosave()
    expect(store.getSnapshot().document).toEqual(before)
    expect(local()).toEqual(before)
    expect(store.getSnapshot().fileMessage).not.toBeNull()
  })

  it('un fallo de escritura mantiene cambios en memoria, permite exportar y reintenta el último estado', async () => {
    const { store, repository, download, local } = setup()
    await store.initialize()
    vi.mocked(repository.saveActive).mockRejectedValueOnce(new Error('cuota'))
    store.setTitle('Uno')
    await store.flushAutosave()
    expect(store.getSnapshot().autosaveUnavailable).toBe(true)
    store.setTitle('Dos')
    await store.flushAutosave()
    expect(store.getSnapshot().document.document.title).toBe('Dos')
    await store.saveDocument()
    expect(JSON.parse(download.mock.calls[0]![0]).document.title).toBe('Dos')
    await store.retryAutosave()
    expect(local()?.document.title).toBe('Dos')
    expect(store.getSnapshot().autosaveUnavailable).toBe(false)
    expect(repository.clearActive).not.toHaveBeenCalled()
  })

  it('una recuperación tardía exige confirmación y rechazar conserva y guarda el estado en memoria', async () => {
    const recovered = createEmptyDocument('En disco')
    const { store, repository, local } = setup(recovered)
    vi.mocked(repository.loadActive).mockRejectedValueOnce(new Error('lectura bloqueada'))
    await store.initialize()
    store.setTitle('Trabajo en memoria')
    await store.flushAutosave()
    expect(local()).toEqual(recovered)
    await store.retryAutosave()
    expect(store.getSnapshot().document.document.title).toBe('Trabajo en memoria')
    expect(store.getSnapshot().recoveryPending).toBe(true)
    await store.confirmRecovery(false)
    expect(local()?.document.title).toBe('Trabajo en memoria')
    expect(store.getSnapshot().autosaveUnavailable).toBe(false)
  })

  it('confirmar la recuperación sustituye el documento únicamente en ese momento', async () => {
    const recovered = createEmptyDocument('En disco')
    const { store, repository } = setup(recovered)
    vi.mocked(repository.loadActive).mockRejectedValueOnce(new Error('lectura'))
    await store.initialize()
    store.setTitle('Memoria')
    await store.retryAutosave()
    expect(store.getSnapshot().recoveryPending).toBe(true)
    await store.confirmRecovery(true)
    expect(store.getSnapshot().document).toEqual(recovered)
    expect(store.getSnapshot().recoveryPending).toBe(false)
  })

  it('protege cambios que llegan mientras se lee el autoguardado inicial', async () => {
    const recovered = createEmptyDocument('Disco')
    const { store, repository } = setup()
    let finish!: (document: AngieDocumentV1) => void
    vi.mocked(repository.loadActive).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const initialization = store.initialize()
    store.setTitle('Editado durante lectura')
    finish(recovered)
    await initialization
    expect(store.getSnapshot().document.document.title).toBe('Editado durante lectura')
    expect(store.getSnapshot().recoveryPending).toBe(true)
  })

  it('rechaza una mutación inválida atómicamente y no actualiza fechas en un no-op', async () => {
    const { store } = setup()
    await store.initialize()
    const original = structuredClone(store.getSnapshot().document)
    store.setTitle(original.document.title)
    expect(store.getSnapshot().document).toEqual(original)
    expect(() => store.mutateDocument(document => { document.board.backgroundColor = 'rojo' })).toThrow('board.backgroundColor')
    expect(store.getSnapshot().document).toEqual(original)
  })
})
