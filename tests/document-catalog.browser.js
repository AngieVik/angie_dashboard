/* global crypto, IDBObjectStore */
// Run via playwright-cli run-code --filename=tests/document-catalog.browser.js.
// Unique databases and fictitious data only; quota failures never touch user data.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  return page.evaluate(async () => {
    const { default: Dexie } = await import('/node_modules/.vite/deps/dexie.js')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const name = 'angie-catalog-test-' + crypto.randomUUID()
    const legacy = new Dexie(name)
    legacy.version(3).stores({ documents: 'key', imageResources: 'id', gpxResources: 'fingerprint' })
    const source = createEmptyDocument('Original ficticio'), records = []
    // References deliberately point to an unavailable image: listing must not
    // decode it, silently discard its recoveries or touch its resource table.
    for (let index = 0; index < 300; index++) {
      const document = createEmptyDocument('Documento ' + String(index).padStart(3, '0'))
      document.board.backgroundImage = { resourceId: 'sha256:' + '0'.repeat(64), layout: { x: 0, y: 0, width: 10, height: 10 } }
      for (let version = 0; version < 4; version++) records.push({
        key: version === 0 ? 'board:' + document.document.id : `snapshot:${document.document.id}:${version}`,
        document, revision: version + 1, savedAt: `2026-01-${String(index % 28 + 1).padStart(2, '0')}T12:00:00.000Z`,
      })
    }
    records.push({ key: 'board:' + source.document.id, document: source, revision: 1, savedAt: source.document.updatedAt })
    records.push({ key: 'damaged:old', document: { broken: true } })
    records.push({ key: 'active', document: source, revision: 1, savedAt: source.document.updatedAt })
    await legacy.table('documents').bulkPut(records)
    legacy.close()
    const db = createDatabase(name), repo = new DocumentRepository(db)
    const originalGet = IDBObjectStore.prototype.get, originalAll = IDBObjectStore.prototype.getAll, originalCursor = IDBObjectStore.prototype.openCursor
    let payloadReads = 0, watching = false
    for (const method of ['get', 'getAll', 'openCursor']) {
      const original = IDBObjectStore.prototype[method]
      IDBObjectStore.prototype[method] = function (...args) {
        if (watching && ['documents', 'imageResources', 'gpxResources'].includes(this.name)) payloadReads++
        return original.apply(this, args)
      }
    }
    try {
      await db.open()
      check(await db.table('documentCatalog').count() === records.length, 'upgrade indexes every document record, including damaged ones')
      watching = true
      let cursor, pages = 0, seen = new Set(), chosen
      do {
        const result = await repo.listRecoveryPage({ cursor, limit: 17 })
        check(result.entries.length <= 17, 'bounded page size')
        for (const entry of result.entries) {
          check(!seen.has(entry.key), 'no duplicate between pages with identical dates')
          check(!('document' in entry) && !('blob' in entry), 'metadata only')
          seen.add(entry.key)
          if (entry.key === 'board:' + source.document.id) chosen = entry
        }
        cursor = result.nextCursor; pages++
      } while (cursor)
      check(seen.size === 1203 && pages > 60, 'all versions and session aliases reachable beyond the former nine-page limit')
      check(payloadReads === 0, 'pagination must not read documents or originals')
      const filtered = await repo.listRecoveryPage({ search: 'Documento 299', limit: 20 })
      check(filtered.entries.length === 4, 'title search across versions')
      check((await repo.listRecoveryPage({ fromDay: '2026-01-28', toDay: '2026-01-28', limit: 100 })).entries.length === 40, 'date filter applies across the catalog')
      const measured = await repo.measureStorage()
      check(measured.documents === 301 && measured.versions >= 1202, 'storage counts come from metadata')
      check(payloadReads === 0, 'measurement must not read payloads')
      watching = false
      const opened = await repo.loadRecoverable(chosen.key)
      check(opened.document.document.id === source.document.id && opened.revision === 1, 'open the selected version on demand')
      let missing = false
      try { await repo.loadRecoverable(filtered.entries[0].key) } catch { missing = true }
      check(missing, 'missing original reports an error at open time')
      check((await repo.listRecoveryPage({ search: 'Documento 299' })).entries.length === 4, 'unreadable recovery remains in the catalog')

      await repo.loadActive()
      const beforeRecords = JSON.stringify(await db.table('documents').toArray())
      const beforeCatalog = JSON.stringify(await db.table('documentCatalog').toArray())
      const catalog = db.table('documentCatalog'), put = catalog.put
      catalog.put = () => { throw new DOMException('Quota de prueba', 'QuotaExceededError') }
      let quota = false
      try { await repo.replaceActive({ ...source, document: { ...source.document, title: 'Sin espacio' } }, { openModules: [] }) }
      catch (error) { quota = error.name === 'QuotaExceededError' }
      finally { catalog.put = put }
      check(quota, 'quota error surfaces')
      check(JSON.stringify(await db.table('documents').toArray()) === beforeRecords, 'quota rolls back content and pruning')
      check(JSON.stringify(await catalog.toArray()) === beforeCatalog, 'quota rolls back metadata')
      await repo.saveActive(source)

      let blocked = false
      try { await repo.removeRetained({ documentId: source.document.id }) } catch { blocked = true }
      check(blocked && await repo.loadRecoverable('board:' + source.document.id), 'active document cannot be deleted')
      const target = filtered.entries[0]
      await repo.removeRetained({ key: target.key, expectedRevision: target.revision, expectedSavedAt: target.savedAt })
      check(!await repo.loadRecoverable(target.key), 'explicit version removal')
      check((await repo.listRecoveryPage({ search: 'Documento 299' })).entries.length === 3, 'catalog follows removal')
      await repo.removeRetained({ documentId: target.documentId })
      check((await repo.listRecoveryPage({ search: 'Documento 299' })).entries.length === 0, 'explicit whole-document removal')
      check(await repo.loadRecoverable(chosen.key), 'other document preserved')
      await repo.removeRetained({ key: 'damaged:old' })
      const { registerImage } = await import('/src/storage/imageResources.ts')
      const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10
      const image = await registerImage(await new Promise(resolve => canvas.toBlob(resolve)))
      const first = createEmptyDocument('Compartido A'), second = createEmptyDocument('Compartido B')
      first.board.backgroundImage = second.board.backgroundImage = { resourceId: image, layout: { x: 0, y: 0, width: 10, height: 10 } }
      await repo.replaceActive(first, { openModules: [] })
      await repo.replaceActive(second, { openModules: [] })
      await repo.replaceActive(createEmptyDocument('Otro activo'), { openModules: [] })
      await repo.removeRetained({ documentId: first.document.id })
      check(await db.table('imageResources').get(image), 'shared original survives first document removal')
      await repo.removeRetained({ documentId: second.document.id })
      check(!await db.table('imageResources').get(image), 'last explicit removal releases unshared original')

      const estimate = navigator.storage.estimate
      navigator.storage.estimate = async () => { throw new Error('Estimate failure') }
      try { check((await repo.measureStorage()).estimateError, 'storage estimate errors remain explicit') }
      finally { navigator.storage.estimate = estimate }
      return { status: 'PASS', entries: seen.size, pages, payloadReadsWhileBrowsing: payloadReads,
        upgrade: true, onDemandOpen: true, missingOriginalPreserved: true, quotaRollback: true, explicitRemoval: true, activeProtected: true, sharedResources: true }
    } finally {
      watching = false
      IDBObjectStore.prototype.get = originalGet
      IDBObjectStore.prototype.getAll = originalAll
      IDBObjectStore.prototype.openCursor = originalCursor
      await db.delete()
    }
  })
}
