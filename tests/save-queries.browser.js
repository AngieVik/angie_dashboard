/* global IDBObjectStore, IDBIndex, IDBKeyRange, crypto */
// Run via playwright-cli run-code --filename=tests/save-queries.browser.js.
// Real IndexedDB, a unique test database and fictitious documents only.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  return page.evaluate(async () => {
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository, DocumentConflictError } = await import('/src/storage/documentRepository.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const { catalogRecord } = await import('/src/storage/documentCatalog.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const db = createDatabase('angie-save-queries-test-' + crypto.randomUUID())
    const repo = new DocumentRepository(db), table = db.table('documents')
    const document = createEmptyDocument('Pequeño ficticio'), id = document.document.id
    const prefix = 'snapshot:' + id + ':'
    const change = title => ({ ...document, document: { ...document.document, title } })
    const record = (key, document, savedAt = '2026-01-01T00:00:00.000Z') => ({ key, document, revision: 1, savedAt })
    const samples = [], restore = []
    let reads
    // Observe native requests and their returned values, below Dexie. Cursor
    // success fires for every row, so an unbounded scan cannot hide in a filter.
    for (const prototype of [IDBObjectStore.prototype, IDBIndex.prototype]) {
      for (const method of ['get', 'getAll', 'getAllKeys', 'openCursor', 'openKeyCursor', 'count']) {
        if (!prototype[method]) continue
        const original = prototype[method]
        prototype[method] = function (...args) {
          const request = original.apply(this, args)
          const store = this.objectStore ?? this
          if (store.name !== 'documents' || !reads) return request
          const target = reads, range = args[0]
          target.requests.push({ method, lower: range instanceof IDBKeyRange ? range.lower : range,
            upper: range instanceof IDBKeyRange ? range.upper : range })
          request.addEventListener('success', () => {
            if (method === 'count' || method === 'getAllKeys' || method === 'openKeyCursor') return
            const result = request.result
            const values = method === 'getAll' ? result : [method === 'openCursor' ? result?.value : result]
            for (const value of values) {
              if (!value) continue
              target.keys.push(value.key)
              target.bytes += new TextEncoder().encode(JSON.stringify(value)).byteLength
              if (value.document?.document?.id !== id) target.foreign.push(value.key)
            }
          })
          return request
        }
        restore.push(() => { prototype[method] = original })
      }
    }
    const measure = async action => {
      reads = { requests: [], keys: [], foreign: [], bytes: 0 }
      try { await action(); return reads } finally { reads = undefined }
    }
    const snapshots = () => table.where(':id').startsWith(prefix).toArray()
    const expectConflict = async action => {
      let error
      try { await action() } catch (caught) { error = caught }
      check(error instanceof DocumentConflictError, 'revision conflict must reject the write')
    }
    try {
      await repo.saveActive(document)
      await repo.saveActive(change('Primera revisión'))
      check((await snapshots()).length === 1, 'first changed save captures a snapshot without prior history')
      let librarySize = 0
      for (const size of [0, 10, 100, 500]) {
        // Include a neighbouring ID to detect overly broad prefix matching.
        const added = []
        for (; librarySize < size; librarySize++) {
          const other = createEmptyDocument('Ajeno ' + librarySize)
          other.document.id = librarySize === 0 ? id + '-neighbor' : crypto.randomUUID()
          other.notebook = [{ id: crypto.randomUUID(), type: 'note', title: '', text: 'x'.repeat(8192) }]
          for (const key of ['board:' + other.document.id, 'previous:' + other.document.id,
            'snapshot:' + other.document.id + ':old', 'archive:' + other.document.id + ':old', 'damaged:' + other.document.id]) {
            added.push(record(key, other))
          }
        }
        if (added.length) {
          await table.bulkPut(added)
          await db.table('documentCatalog').bulkPut(added.map(catalogRecord))
        }
        const oldKeys = await table.where(':id').startsWith(prefix).primaryKeys()
        await table.bulkDelete(oldKeys)
        await db.table('documentCatalog').bulkDelete(oldKeys)
        // Legacy snapshots can lack capturedAt. savedAt must remain the fallback.
        const seeded = Array.from({ length: 5 }, (_, index) => ({
          ...record(prefix + 'old-' + index, change('Historia ' + index), `2026-01-0${index + 1}T00:00:00.000Z`),
          ...(index % 2 ? { capturedAt: `2026-01-0${index + 1}T00:00:00.000Z` } : {}),
        }))
        await table.bulkPut(seeded)
        await db.table('documentCatalog').bulkPut(seeded.map(catalogRecord))
        const edited = change('Guardado ' + size)
        const normal = await measure(() => repo.saveActive(edited))
        const retained = await snapshots()
        check(retained.length === 5 && !retained.some(r => r.key === prefix + 'old-0'), 'prune the oldest target version')
        check(retained.some(r => r.key === prefix + 'old-4'), 'keep the newest legacy version')
        const throttled = await measure(() => repo.saveActive(change('Rápido ' + size)))
        check(JSON.stringify((await snapshots()).map(r => r.key)) === JSON.stringify(retained.map(r => r.key)), 'five-minute snapshot interval')
        const unchanged = await measure(() => repo.saveActive(change('Rápido ' + size)))
        const archived = await measure(() => repo.replaceActive(change('Forzado ' + size), { openModules: ['notebook'] }))
        check((await snapshots()).length === 5 && !await table.get(prefix + 'old-1'), 'forced archive keeps retention and timestamp fallback')
        for (const [mode, read] of Object.entries({ normal, throttled, unchanged, archived })) {
          check(read.foreign.length === 0, `${size}/${mode}: foreign content read: ${read.foreign.slice(0, 8)}`)
          check(read.requests.every(r => r.lower !== undefined && r.lower !== null), `${size}/${mode}: unbounded read`)
          const rows = read.keys.length
          if (samples.length) check(rows === samples[0][mode].rows, `${size}/${mode}: reads grow with library`)
        }
        samples.push({ documents: size, ...Object.fromEntries(Object.entries({ normal, throttled, unchanged, archived })
          .map(([mode, read]) => [mode, { rows: read.keys.length, bytes: read.bytes, requests: read.requests
            .filter(request => typeof request.lower !== 'number' || Number.isFinite(request.lower)) }])) })
      }
      const current = await repo.loadActive()
      check(current.document.title === 'Forzado 500', 'last content saved')
      check((await repo.loadActiveSession()).openModules[0] === 'notebook', 'session preserved')
      check((await table.get('previous:' + id)).document.document.title === 'Rápido 500', 'previous version preserved')
      check(await table.where(':id').startsWith('snapshot:' + id + '-neighbor:').count() === 1, 'neighbour versions preserved')

      // A failure after pruning must roll back deletions and writes together.
      const before = await table.toArray(), originalPut = table.put
      table.put = function (value, ...args) {
        if (value.key === 'active') throw new Error('Injected transaction failure')
        return originalPut.call(this, value, ...args)
      }
      let failed = false
      try { await repo.replaceActive(change('Abortado'), { openModules: [] }) }
      catch (error) { failed = error.message === 'Injected transaction failure' }
      finally { table.put = originalPut }
      check(failed && JSON.stringify(await table.toArray()) === JSON.stringify(before), 'atomic rollback including pruning')
      await repo.saveActive(change('Reintento'))

      // Real competing repositories retain both known and unknown revision checks.
      const competitor = new DocumentRepository(db)
      await competitor.loadActive()
      await repo.saveActive(change('Ganador'))
      await expectConflict(() => competitor.saveActive(change('Obsoleto')))
      const unknown = new DocumentRepository(db)
      await expectConflict(() => unknown.saveActive(change('Sin revisión')))
      check((await table.get('board:' + id)).document.document.title === 'Ganador', 'conflicts preserve committed content')
      await unknown.saveActive(change('Ganador'))
      return { status: 'PASS', samples, retention: true, rollback: true, revisionConflicts: true }
    } finally {
      for (const undo of restore) undo()
      await db.delete()
    }
  })
}
