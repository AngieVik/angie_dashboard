import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentStore } from './documentStore'
import { DocumentRepository } from '../../storage/documentRepository'
import { createDatabase } from '../../storage/db'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import type { SaveFileHandle } from '../../platform/files/fileAccess'
const databases: ReturnType<typeof createDatabase>[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function setup(factory = new IDBFactory()) {
  const db = createDatabase('document-recovery', { indexedDB: factory, IDBKeyRange }); databases.push(db)
  const repository = new DocumentRepository(db)
  let exported = ''
  const store = createDocumentStore(repository, { platform: { download: text => { exported = text } } })
  return { factory, repository, store, exported: () => exported }
}
describe('flujo de guardado protegido V4', () => {
  it('abrir y cerrar módulos se autoguarda aunque no cambie el documento', async () => {
    const first = setup(); await first.store.initialize()
    const unchanged = structuredClone(first.store.getSnapshot().document)
    first.store.setOpenModules(['board', 'notebook', 'information'])
    first.store.setOpenModules(['board', 'information'])
    await first.store.flushAutosave()
    const restored = setup(first.factory)
    const reopened = restored.store; await reopened.initialize()
    expect(reopened.getSnapshot().ready).toBe(true)
    expect(reopened.getSnapshot().openModules).toEqual(['board', 'information'])
    expect(reopened.getSnapshot().document).toEqual(unchanged)
    await reopened.saveDocument()
    expect(JSON.parse(restored.exported())).not.toHaveProperty('openModules')
  })
  it('Nuevo protege el documento anterior y Recuperar restaura su contenido y módulos', async () => {
    const { store } = setup(); await store.initialize()
    store.setTitle('Servicio anterior'); store.setOpenModules(['board', 'timeline'])
    await store.flushAutosave()
    await store.newDocument()
    expect(store.getSnapshot().document.document.title).toBe('')
    await store.refreshRecoverable()
    const archive = store.getSnapshot().recoverable.find(item => item.key.startsWith('archive:') && item.title === 'Servicio anterior')!
    expect(archive).toBeDefined()
    await store.restoreDocument(archive.key)
    expect(store.getSnapshot().document.document.title).toBe('Servicio anterior')
    expect(store.getSnapshot().openModules).toEqual(['board', 'timeline'])
  })
  it('un fallo al proteger impide Nuevo hasta cancelar o descartar expresamente', async () => {
    const { store, repository } = setup(); await store.initialize()
    store.setTitle('No perder'); await store.flushAutosave()
    vi.spyOn(repository, 'replaceActive').mockRejectedValueOnce(new Error('cuota'))
    await store.newDocument()
    expect(store.getSnapshot().document.document.title).toBe('No perder')
    expect(store.getSnapshot().replacementBlocked).toBe(true)
    store.cancelReplacement()
    expect(store.getSnapshot().replacementBlocked).toBe(false)
    expect(store.getSnapshot().document.document.title).toBe('No perder')
  })
  it('Nuevo no sustituye los cambios en memoria cuando falló el último autoguardado', async () => {
    const { store, repository } = setup(); await store.initialize()
    store.setTitle('Copia en disco'); await store.flushAutosave()
    vi.spyOn(repository, 'saveActive').mockRejectedValueOnce(new Error('cuota'))
    store.setTitle('Cambios solo en memoria'); await store.flushAutosave()
    expect(store.getSnapshot().autosaveUnavailable).toBe(true)
    await store.newDocument()
    expect(store.getSnapshot().document.document.title).toBe('Cambios solo en memoria')
    expect(store.getSnapshot().replacementBlocked).toBe(true)
    expect((await repository.loadActive())?.document.title).toBe('Copia en disco')
  })
  it('editar durante una escritura deja pendientes solo los cambios posteriores', async () => {
    let finish!: () => void
    let content = ''
    const handle: SaveFileHandle = { queryPermission: async () => 'granted', createWritable: async () => ({ write: async text => { content = text }, close: () => new Promise(resolve => { finish = resolve }), abort: async () => {} }) }
    const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { pickSave: async () => handle, download: () => {} } })
    await store.initialize(); store.setTitle('Antes')
    const saving = store.saveDocument()
    await vi.waitFor(() => expect(finish).toBeDefined())
    store.setTitle('Después'); finish(); await saving
    expect(JSON.parse(content).document.title).toBe('Antes')
    expect(store.getSnapshot().fileDirty).toBe(true)
    expect(store.getSnapshot().fileSavedAt).not.toBeNull()
  })
  it('una carga rechazada conserva contenido, módulos y copia local', async () => {
    const { store, repository } = setup(); await store.initialize()
    store.setTitle('Conservar'); store.setOpenModules(['information']); await store.flushAutosave()
    await store.loadDocument({ text: async () => '{' })
    expect(store.getSnapshot().document.document.title).toBe('Conservar')
    expect(store.getSnapshot().openModules).toEqual(['information'])
    expect((await repository.loadActive())?.document.title).toBe('Conservar')
  })
  it('detecta otra pestaña y permite recuperar sin perder los cambios en memoria', async () => {
    const first = setup(); await first.store.initialize()
    first.store.setTitle('Inicial'); await first.store.flushAutosave()
    const second = setup(first.factory); await second.store.initialize()
    first.store.setTitle('Primera pestaña'); await first.store.flushAutosave()
    second.store.setTitle('Segunda pestaña'); await second.store.flushAutosave()
    expect(second.store.getSnapshot().storageConflict).toBe(true)
    expect(second.store.getSnapshot().document.document.title).toBe('Segunda pestaña')
    await second.store.retryAutosave()
    expect(second.store.getSnapshot().recoveryPending).toBe(true)
    await second.store.confirmRecovery(false)
    expect((await setup(first.factory).repository.loadActive())?.document.title).toBe('Segunda pestaña')
    expect((await second.repository.listRecoverable()).some(item => item.title === 'Primera pestaña')).toBe(true)
  })
  it('cargar un V4 válido vincula su revisión y una edición vuelve a marcarla pendiente', async () => {
    const { store } = setup(); await store.initialize()
    const imported = createEmptyDocument('Archivo')
    await store.loadDocument({ text: async () => JSON.stringify(imported) })
    expect(store.getSnapshot().fileDirty).toBe(false)
    store.setTitle('Editado')
    expect(store.getSnapshot().fileDirty).toBe(true)
  })
})
