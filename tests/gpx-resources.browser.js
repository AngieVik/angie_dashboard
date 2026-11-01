/* global window, File, Blob, crypto, navigator */
// Run with playwright-cli run-code --filename=tests/gpx-resources.browser.js against Vite.
// Dedicated IndexedDB/OPFS; synthetic GPX only. The renderer crash skips lifecycle flushes.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  const url = page.url()
  const result = await page.evaluate(async () => {
    const { default: Dexie } = await import('/node_modules/.vite/deps/dexie.js')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const { createDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { replaceMap } = await import('/src/features/document/documentEdits.ts')
    const { readGpxFile } = await import('/src/features/map/gpxFileAccess.ts')
    const { registerGpx } = await import('/src/storage/gpxResources.ts')
    const { createWorkspaceFiles } = await import('/src/platform/files/workspaceFiles.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const bytes = async blob => Array.from(new Uint8Array(await blob.arrayBuffer())).join(',')
    // BOM, CRLF, comments and extensions must survive byte for byte.
    const text = '\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n<gpx version="1.1" creator="Prueba"><!-- original --><trk><trkseg><trkpt lat="36.7" lon="-4.4"><ele>12</ele></trkpt><trkpt lat="36.71" lon="-4.41"/></trkseg></trk><extensions><extra>á &amp; ñ</extra></extensions></gpx>\r\n'
    const original = new File([text], 'Recorrido ficticio.gpx', { type: 'application/gpx+xml', lastModified: 1234 })
    // Compute identity without registering the original, to model an old references-only board.
    const hash = await crypto.subtle.digest('SHA-256', await original.arrayBuffer())
    const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
    const reference = { id: crypto.randomUUID(), name: original.name, fingerprint, size: original.size, lastModified: original.lastModified, visible: true, color: '#D63A3A', kilometers: false, kilometerInterval: 1 }
    const name = 'angie-gpx-resources-' + crypto.randomUUID()
    const first = createEmptyDocument('GPX A ficticio'); first.map = { markers: [], gpx: [reference] }
    const legacy = new Dexie(name); legacy.version(2).stores({ documents: 'key', imageResources: 'id' }); await legacy.open()
    await legacy.table('documents').bulkPut([{ key: 'active', document: first }, { key: 'board:' + first.document.id, document: first }]); legacy.close()
    const db = createDatabase(name), repo = new DocumentRepository(db)
    check((await repo.loadActive()).map.gpx[0].fingerprint === fingerprint, 'upgrade keeps old references')
    const pending = await repo.saveActive(first)
    check(pending.gpxFingerprints.length === 0 && await db.table('gpxResources').count() === 0, 'missing original is explicitly unprotected')
    const store = createDocumentStore(repo, { platform: { download() {} } })
    await store.initialize(); check(await store.openRecentDocument(), 'open historical board')
    check(store.getSnapshot().localGpxFingerprints.length === 0, 'store does not claim protection from JSON alone')
    const imported = await readGpxFile(original)
    check(imported.fingerprint === fingerprint && imported.data.pointCount === 2, 'real import path')
    check(await store.protectGpxResources(), 'relink without document mutation saves original')
    check(store.getSnapshot().localGpxFingerprints.includes(fingerprint), 'protection only after commit')
    check(await bytes(await repo.readGpx(reference)) === await bytes(original), 'exact BOM/CRLF/extensions')
    check(await db.table('gpxResources').count() === 1, 'single original')
    const second = { ...first, document: { ...first.document, id: crypto.randomUUID(), title: 'GPX B ficticio' } }
    await repo.replaceActive(second, { openModules: ['map'] })
    check(await db.table('gpxResources').count() === 1, 'two documents share one original')
    // Removing one reference must preserve the resource used by another document and its versions.
    await repo.saveActive({ ...second, map: { markers: [], gpx: [] } })
    check(await db.table('gpxResources').count() === 1, 'removal keeps shared original')
    await repo.replaceActive(second, { openModules: ['map'] })
    // Folder access still receives the exact local original, even without a remembered external handle.
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const handle = Object.create(root)
    for (const key of ['getDirectoryHandle', 'getFileHandle', 'entries', 'removeEntry', 'isSameEntry']) handle[key] = root[key].bind(root)
    handle.queryPermission = async () => 'granted'
    const folder = createWorkspaceFiles(async () => ({ handle, accessId: name, isContainer: true }))
    const saved = await folder.save(second)
    check(saved.status === 'saved' && !saved.resourcesPending, 'folder route uses local original: ' + saved.message)
    check(await bytes(await folder.readGpx(second, reference)) === await bytes(original), 'folder copy exact')
    // A new file and its references roll back together on storage failure.
    const other = new File([text.replace('36.71', '36.72')], 'Otro ficticio.gpx')
    const otherRead = await readGpxFile(other)
    const otherReference = { ...reference, id: crypto.randomUUID(), fingerprint: otherRead.fingerprint, size: other.size, name: other.name }
    const failed = { ...second, document: { ...second.document, id: crypto.randomUUID() }, map: { markers: [], gpx: [otherReference] } }
    const table = db.table('documents'), put = table.put.bind(table)
    const before = JSON.stringify(await table.toArray())
    table.put = async value => { const key = await put(value); if (value.key === 'active') Dexie.currentTransaction.abort(); return key }
    let rejected = false
    try { await repo.saveActive(failed) } catch { rejected = true }
    table.put = put
    check(rejected && JSON.stringify(await table.toArray()) === before, 'abort rolls back references')
    check(await db.table('gpxResources').count() === 1, 'abort rolls back original')
    // A failed save must not mark a memory-only original protected in the store.
    const failRepo = new DocumentRepository(db), failStore = createDocumentStore(failRepo, { platform: { download() {} } })
    await failStore.initialize(); check(await failStore.openRecentDocument(), 'open for quota failure')
    const saveActive = failRepo.saveActive.bind(failRepo)
    failRepo.saveActive = async () => { throw new Error('QuotaExceededError ficticio') }
    check(failStore.applyDocumentCommand(d => replaceMap(d, { ...d.map, gpx: [...d.map.gpx, otherReference] })), 'admit reference before storage failure')
    await failStore.flushAutosave()
    check(failStore.getSnapshot().autosaveUnavailable && !failStore.getSnapshot().localGpxFingerprints.includes(otherRead.fingerprint), 'failed write stays unprotected')
    failRepo.saveActive = saveActive
    await failStore.retryAutosave()
    check(failStore.getSnapshot().localGpxFingerprints.includes(otherRead.fingerprint), 'retry protects bytes with references')
    // Verify bytes on read and preserve a corrupt entry instead of using cached bytes to hide it.
    const resourceTable = db.table('gpxResources'), good = await resourceTable.get(fingerprint)
    await resourceTable.put({ fingerprint, blob: new Blob(['corrupto']) })
    let corruptRejected = false
    try { await repo.readGpx(reference) } catch { corruptRejected = true }
    check(corruptRejected && (await resourceTable.get(fingerprint)).blob.size === 8, 'corruption detected without rewriting')
    await resourceTable.put(good)
    // Older references can still recover through folder and authorized handle access,
    // then gain local protection without editing their portable metadata.
    const { rememberGpxAccess } = await import('/src/storage/gpxAccessRepository.ts')
    const externalFile = new File([text.replace('36.71', '36.74')], 'Desde carpeta ficticio.gpx')
    const handleFile = new File([text.replace('36.71', '36.75')], 'Desde handle ficticio.gpx')
    const makeReference = async file => {
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      return { ...reference, id: crypto.randomUUID(), name: file.name, size: file.size,
        fingerprint: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') }
    }
    const externalReference = await makeReference(externalFile), handleReference = await makeReference(handleFile)
    const fileHandle = await root.getFileHandle('handle-ficticio.gpx', { create: true })
    const stream = await fileHandle.createWritable(); await stream.write(handleFile); await stream.close()
    check(await rememberGpxAccess(handleReference.fingerprint, fileHandle), 'native authorized handle remembered')
    const promotionRepo = new DocumentRepository(db)
    const promotionStore = createDocumentStore(promotionRepo, { platform: { download() {} }, workspace: {
      save: async () => ({ status: 'unconfigured' }), readGpx: async (_document, ref) => ref.id === externalReference.id ? externalFile : null,
    } })
    await promotionStore.initialize(); check(await promotionStore.openRecentDocument(), 'open for external recovery')
    check(promotionStore.applyDocumentCommand(d => replaceMap(d, { ...d.map, gpx: [...d.map.gpx, externalReference, handleReference] })), 'retain external references')
    await promotionStore.flushAutosave()
    for (const ref of [externalReference, handleReference]) {
      check(!promotionStore.getSnapshot().localGpxFingerprints.includes(ref.fingerprint), 'external reference starts unprotected')
      check(await promotionStore.readGpx(ref), 'existing external access recovers original')
      await promotionStore.flushAutosave()
      check(promotionStore.getSnapshot().localGpxFingerprints.includes(ref.fingerprint), 'external bytes become locally protected')
    }
    // Restore the two committed documents and interrupt a third transaction after writing its resource.
    await repo.prepareOpen(second.document.id)
    await repo.replaceActive(second, { openModules: ['map'] })
    const crashOriginal = new File([text.replace('36.71', '36.73')], 'Interrumpido ficticio.gpx')
    const crashRead = await registerGpx(crashOriginal)
    const crashDoc = { ...failed, document: { ...failed.document, id: crypto.randomUUID() }, map: { markers: [], gpx: [{ ...otherReference, fingerprint: crashRead.fingerprint }] } }
    const crashBefore = JSON.stringify(await table.toArray()), resourceCount = await resourceTable.count()
    table.put = async value => {
      const key = await put(value)
      if (value.key === 'active' && value.document.document.id === crashDoc.document.id) {
        window.__gpxCrashReady = true
        await Dexie.waitFor(new Promise(() => {}), 60_000)
      }
      return key
    }
    window.__gpxTest = { name, firstId: first.document.id, secondId: second.document.id, reference, originalBytes: await bytes(original), before: crashBefore, resourceCount }
    void repo.saveActive(crashDoc).catch(() => {})
    return { exactBytes: true, upgrade: true, shared: true, folder: true, handles: true, externalPromotion: true, abort: true, quotaRetry: true, corruption: true }
  })
  await page.waitForFunction(() => window.__gpxCrashReady, undefined, { timeout: 15000 })
  const state = await page.evaluate(() => window.__gpxTest)
  const cdp = await page.context().newCDPSession(page), crashed = page.waitForEvent('crash')
  void cdp.send('Page.crash').catch(() => {})
  await crashed
  await page.close()
  const reopened = await page.context().newPage(); await reopened.goto(url)
  // Load the development test harness, then disable every network access for resource recovery.
  await reopened.evaluate(async () => {
    window.__gpxModules = {
      ...await import('/src/storage/db.ts'), ...await import('/src/storage/documentRepository.ts'),
      ...await import('/src/features/document/documentStore.ts'), ...await import('/src/features/map/gpxFileAccess.ts'),
    }
  })
  await page.context().setOffline(true)
  let recovered
  try {
    recovered = await reopened.evaluate(async state => {
      const { createDatabase, DocumentRepository, createDocumentStore, readGpxFile } = window.__gpxModules
      const check = (condition, message) => { if (!condition) throw new Error(message) }
      check(!navigator.onLine, 'offline')
      const db = createDatabase(state.name); await db.open()
      check(JSON.stringify(await db.table('documents').toArray()) === state.before, 'crash rolls back references')
      check(await db.table('gpxResources').count() === state.resourceCount, 'crash rolls back partial original')
      const repo = new DocumentRepository(db)
      const store = createDocumentStore(repo, { platform: { download() {} }, workspace: { save: async () => ({ status: 'unconfigured' }), readGpx: async () => { throw new Error('External access must not be required') } } })
      await store.initialize(); check(await store.openRecentDocument(), 'reopen after termination')
      const file = await store.readGpx(state.reference)
      check(file && Array.from(new Uint8Array(await file.arrayBuffer())).join(',') === state.originalBytes, 'local bytes after termination offline')
      check((await readGpxFile(file, state.reference.fingerprint)).data.pointCount === 2, 'original still parses')
      for (const id of [state.firstId, state.secondId]) {
        const saved = await repo.loadRecoverable('board:' + id)
        const original = await repo.readGpx(saved.document.map.gpx[0])
        check(Array.from(new Uint8Array(await original.arrayBuffer())).join(',') === state.originalBytes, 'shared original available to ' + id)
      }
      db.close(); await db.delete()
      await (await navigator.storage.getDirectory()).removeEntry(state.name, { recursive: true })
      return { offline: true, afterRendererTermination: true, bothDocuments: true, atomicCrashRollback: true }
    }, state)
  } finally { await page.context().setOffline(false) }
  return { status: 'PASS', ...result, ...recovered }
}
