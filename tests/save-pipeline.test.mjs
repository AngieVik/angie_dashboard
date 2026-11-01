import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, createStore, edits, Conflict, DocumentSave, createAutosave, createWorkspaceAutosave, createWorkspaceFiles
before(async () => {
  server = await createServer({ configFile: false, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  ;({ createDocumentStore: createStore } = await server.ssrLoadModule('/src/features/document/documentStore.ts'))
  edits = await server.ssrLoadModule('/src/features/notebook/notebookCommands.ts')
  ;({ DocumentConflictError: Conflict } = await server.ssrLoadModule('/src/storage/documentRepository.ts'))
  ;({ DocumentSave } = await server.ssrLoadModule('/src/storage/documentSave.ts'))
  ;({ createAutosave } = await server.ssrLoadModule('/src/storage/autosave.ts'))
  ;({ createWorkspaceAutosave } = await server.ssrLoadModule('/src/storage/workspaceAutosave.ts'))
  ;({ createWorkspaceFiles } = await server.ssrLoadModule('/src/platform/files/workspaceFiles.ts'))
})
after(async () => { await server?.close() })
const saved = () => ({ status: 'saved', path: 'prueba/dashboard.json', savedAt: new Date().toISOString() })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function fixture() {
  const local = [], folder = []
  let localAction = async () => {}, folderAction = async () => saved()
  const repository = { loadActive: async () => null, clearActive: async () => {},
    saveActive: async document => { await localAction(document); local.push(document) } }
  const store = createStore(repository, { platform: { download() {} }, workspace: {
    save: async document => { const result = await folderAction(document); folder.push(document); return result }, create: async () => saved(),
  }, now: () => new Date('2026-11-01T12:00:00Z') })
  await store.initialize(); await store.newDocument('Prueba')
  store.applyDocumentCommand(d => edits.addNotebookBlock(d, 'note'))
  await store.flushWorkspaceSave()
  const edit = text => store.applyDocumentCommand(d => edits.editNotebookNote(d, d.notebook[0].id, text))
  return { store, edit, local, folder, repository,
    localAction: action => { localAction = action }, folderAction: action => { folderAction = action } }
}

test('ediciones rápidas reutilizan el JSON de admisión y preparan una sola copia para ambos canales', async () => {
  const f = await fixture()
  // A large unchanged branch makes full-document work observable, without real data.
  const large = Array.from({ length: 9 }, () => ({ id: crypto.randomUUID(), type: 'note', title: 'Carga', text: 'x'.repeat(100_000) }))
  f.store.applyDocumentCommand(d => ({ document: { ...d, notebook: [...d.notebook, ...large] }, changed: true }))
  await f.store.flushWorkspaceSave()
  let serializations = 0, copies = 0
  const stringify = JSON.stringify, parse = JSON.parse, clone = globalThis.structuredClone
  JSON.stringify = (value, ...args) => { if (value?.formatVersion === 4) serializations++; return stringify(value, ...args) }
  JSON.parse = (value, ...args) => { const result = parse(value, ...args); if (result?.formatVersion === 4) copies++; return result }
  globalThis.structuredClone = (value, ...args) => { if (value?.formatVersion === 4) copies++; return clone(value, ...args) }
  const start = performance.now(), count = 30
  let elapsed
  try {
    for (let i = 0; i < count; i++) assert.equal(f.edit('Cambio ' + i), true)
    elapsed = performance.now() - start
    await f.store.flushWorkspaceSave()
  } finally { JSON.stringify = stringify; JSON.parse = parse; globalThis.structuredClone = clone }
  console.log(JSON.stringify({ edits: count, editMs: Math.round(elapsed * 100) / 100, serializations, copies }))
  assert.equal(f.local.at(-1).notebook[0].text, 'Cambio 29')
  assert.equal(f.folder.at(-1).notebook[0].text, 'Cambio 29')
  assert.equal(f.local.at(-1), f.folder.at(-1), 'channels receive the same prepared snapshot')
  assert.equal(serializations, count, 'only admission serializes each accepted edit')
  assert.equal(copies, 1, 'coalesced channels share the prepared snapshot')
  assert.equal(f.store.getSnapshot().workspaceStatus, 'saved')
})

test('un resultado anterior no presenta la revisión pendiente como guardada', async () => {
  const f = await fixture(), gate = deferred(), started = deferred()
  f.folderAction(async () => { started.resolve(); return gate.promise })
  f.edit('Primera'); const flushing = f.store.flushWorkspaceSave(); await started.promise
  f.edit('Pendiente')
  const observed = []
  const disconnect = f.store.subscribe(() => { const s = f.store.getSnapshot(); observed.push([s.workspaceStatus, s.fileDirty]) })
  f.folderAction(async () => ({ status: 'error', message: 'Disco lleno' }))
  gate.resolve(saved()); await flushing; disconnect()
  assert.equal(observed.some(([status, dirty]) => status === 'saved' || !dirty), false)
  assert.equal(f.store.getSnapshot().workspaceStatus, 'error')
  assert.equal(f.store.getSnapshot().fileDirty, true)
})

test('el fallo local y de carpeta conserva cambios, bloquea sustitución y admite reintento', async () => {
  const f = await fixture()
  f.localAction(async () => { throw new Error('Disco lleno') })
  f.folderAction(async () => ({ status: 'error', message: 'Carpeta no disponible' }))
  f.edit('Sin proteger'); await f.store.flushWorkspaceSave()
  const old = f.store.getSnapshot().document
  assert.equal(f.store.getSnapshot().autosaveUnavailable, true)
  assert.equal(await f.store.newDocument('Otro'), false)
  assert.equal(f.store.getSnapshot().document, old)
  f.localAction(async () => {}); f.folderAction(async () => saved())
  await f.store.retryAutosave(); await f.store.saveWorkspaceNow()
  assert.equal(f.store.getSnapshot().workspaceStatus, 'saved')
  assert.equal(f.store.getSnapshot().autosaveUnavailable, false)
  assert.equal(await f.store.newDocument('Otro'), true)
})

test('los conflictos bloquean escrituras posteriores hasta conservar en rama', async () => {
  const f = await fixture()
  f.localAction(async () => { throw new Conflict() })
  f.edit('Conflicto'); await f.store.flushWorkspaceSave()
  assert.equal(f.store.getSnapshot().storageConflict, true)
  const count = f.local.length
  f.edit('Conservado en memoria'); await f.store.retryAutosave(); await f.store.flushWorkspaceSave()
  assert.equal(f.local.length, count)
  assert.equal(await f.store.newDocument('Otro'), false)
  assert.equal(f.store.getSnapshot().document.notebook[0].text, 'Conservado en memoria')
})

test('cambiar de documento vacía la revisión saliente y aísla generaciones', async () => {
  const f = await fixture(), gate = deferred(), started = deferred()
  f.localAction(async () => { started.resolve(); await gate.promise })
  const oldId = f.store.getSnapshot().document.document.id
  f.edit('Última saliente'); await started.promise
  f.edit('Final saliente')
  const replacing = f.store.newDocument('Siguiente')
  gate.resolve(); assert.equal(await replacing, true)
  await f.store.flushWorkspaceSave()
  const lastOld = f.local.filter(d => d.document.id === oldId).at(-1)
  assert.equal(lastOld.notebook[0].text, 'Final saliente')
  assert.equal(f.store.getSnapshot().document.document.title, 'Siguiente')
  assert.equal(f.store.getSnapshot().workspaceStatus, 'saved')
  assert.equal(f.store.getSnapshot().autosaveSaving, false)
})

test('recursos pendientes conservan su resultado y el documento sucio', async () => {
  const f = await fixture()
  f.folderAction(async () => ({ ...saved(), resourcesPending: true, message: 'GPX pendiente' }))
  f.edit('Recurso'); await f.store.flushWorkspaceSave()
  assert.equal(f.store.getSnapshot().workspaceStatus, 'error')
  assert.equal(f.store.getSnapshot().fileDirty, true)
  assert.equal(f.store.getSnapshot().workspaceMessage, 'GPX pendiente')
})

test('el resultado local no oculta el de carpeta y la carpeta protege ante un fallo local', async () => {
  const f = await fixture()
  f.localAction(async () => { throw new Error('Dispositivo no disponible') })
  f.edit('Protegido en carpeta'); await f.store.flushWorkspaceSave()
  assert.equal(f.store.getSnapshot().autosaveUnavailable, true)
  assert.equal(f.store.getSnapshot().workspaceStatus, 'saved')
  assert.equal(f.store.getSnapshot().fileDirty, false)
  assert.equal(await f.store.newDocument('Otro'), true)
})

test('las colas retienen documentos distintos y resuelven solo tras su escritura', async () => {
  const f = await fixture(), gate = deferred(), started = deferred(), writes = []
  const queue = createAutosave({ saveActive: async document => {
    writes.push(document)
    if (writes.length === 1) { started.resolve(); await gate.promise }
  } }, () => {})
  const doc = f.store.getSnapshot().document
  let firstResolved = false, secondResolved = false
  const first = queue.save(new DocumentSave(doc)).then(result => { firstResolved = true; return result })
  await started.promise
  const secondDoc = { ...doc, document: { ...doc.document, id: crypto.randomUUID() } }
  const second = queue.save(new DocumentSave(secondDoc)).then(result => { secondResolved = true; return result })
  assert.equal(firstResolved, false); assert.equal(secondResolved, false)
  gate.resolve(); await queue.flush()
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.deepEqual(writes.map(d => d.document.id), [doc.document.id, secondDoc.document.id])
})

test('la carpeta conserva 1 segundo de espera y 5 segundos como plazo máximo', async t => {
  const f = await fixture(), writes = []
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const queue = createWorkspaceAutosave({ save: async document => { writes.push(document); return saved() } })
  const doc = f.store.getSnapshot().document
  const first = queue.schedule(new DocumentSave(doc))
  t.mock.timers.tick(999); assert.equal(writes.length, 0)
  t.mock.timers.tick(1); await first; assert.equal(writes.length, 1)
  const results = []
  for (let i = 0; i < 12; i++) {
    results.push(queue.schedule(new DocumentSave({ ...doc, notebook: [{ ...doc.notebook[0], text: 'Continua ' + i }] })))
    t.mock.timers.tick(400)
  }
  assert.equal(writes.length, 1)
  t.mock.timers.tick(200); await Promise.all(results)
  assert.equal(writes.length, 2)
  assert.equal(writes.at(-1).notebook[0].text, 'Continua 11')
})

test('guardar directamente un documento inválido devuelve error sin tocar la carpeta', async () => {
  const files = createWorkspaceFiles(async () => { throw new Error('No debe consultar la carpeta') })
  const result = await files.save({ formatVersion: 4 })
  assert.equal(result.status, 'error')
  assert.notEqual(result.message, 'No debe consultar la carpeta')
})
