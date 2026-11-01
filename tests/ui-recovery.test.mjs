import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, createEmergencyCopy, listenForUnexpectedErrors, createEmptyDocument, migrateDocument
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null } })
  ;({ createEmergencyCopy, listenForUnexpectedErrors } = await server.ssrLoadModule('/src/app/recovery/uiRecovery.ts'))
  ;({ createEmptyDocument } = await server.ssrLoadModule('/src/domain/document/defaultDocument.ts'))
  ;({ migrateDocument } = await server.ssrLoadModule('/src/domain/document/migrateDocument.ts'))
})
after(async () => { await server?.close() })

test('emergency copy preserves pending content and loads through the existing document importer', () => {
  const document = createEmptyDocument('Prueba de recuperación')
  document.notebook.push({ id: randomUUID(), type: 'note', title: 'Nota', text: 'Cambios sin guardar' })
  const before = structuredClone(document)
  const copy = createEmergencyCopy(document)
  const loaded = migrateDocument(JSON.parse(copy.text))
  assert.equal(loaded.success, true)
  assert.deepEqual(loaded.document, before)
  assert.deepEqual(document, before)
  assert.match(copy.filename, /recuperacion\.json$/)
})

test('emergency copy does not discard available data even if normal validation would reject it', () => {
  const document = { ...createEmptyDocument('Rescate'), notebook: [{ unexpected: 'Dato disponible' }] }
  const copy = createEmergencyCopy(document)
  assert.deepEqual(JSON.parse(copy.text), document)
})

test('unexpected async and event errors are reported without cancelling browser diagnostics', () => {
  const target = new EventTarget()
  const errors = []
  const disconnect = listenForUnexpectedErrors(target, error => errors.push(error))
  const rejection = new Event('unhandledrejection', { cancelable: true })
  const reason = new Error('Fallo asíncrono')
  Object.assign(rejection, { reason })
  target.dispatchEvent(rejection)
  assert.deepEqual(errors, [reason])
  assert.equal(rejection.defaultPrevented, false)
  const sync = new Event('error')
  Object.assign(sync, { error: new Error('Fallo de evento') })
  target.dispatchEvent(sync)
  assert.equal(errors.length, 2)
  const cancelled = new Event('unhandledrejection')
  Object.assign(cancelled, { reason: new DOMException('Cancelado', 'AbortError') })
  target.dispatchEvent(cancelled)
  assert.equal(errors.length, 2)
  disconnect()
  target.dispatchEvent(rejection)
  target.dispatchEvent(sync)
  assert.equal(errors.length, 2)
})
