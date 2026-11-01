/* global window, Blob, File, document, crypto, navigator, createImageBitmap, atob */
// Run with playwright-cli run-code --filename=tests/image-resources.browser.js.
// Dedicated IndexedDB + OPFS only. The crash interrupts a real readwrite transaction.
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
    const { createWorkspaceFiles } = await import('/src/platform/files/workspaceFiles.ts')
    const { loadVisibleDocument } = await import('/src/platform/files/fileAccess.ts')
    const { portableDocument, workingDocument, imageResource, boardImageFile } = await import('/src/storage/imageResources.ts')
    const { serializeDocument } = await import('/src/domain/document/serializeDocument.ts')
    const { validateDocument, validateWorkingDocument } = await import('/src/domain/document/validateDocument.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const bytes = async blob => Array.from(new Uint8Array(await blob.arrayBuffer())).join(',')
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
    const context = canvas.getContext('2d'), pixels = context.createImageData(128, 128)
    crypto.getRandomValues(pixels.data); context.putImageData(pixels, 0, 0)
    const png = canvas.toDataURL('image/png'), jpeg = canvas.toDataURL('image/jpeg')
    const name = 'angie-image-resources-' + crypto.randomUUID()
    // Start with the previous database schema, containing an embedded V4 record.
    const legacy = new Dexie(name); legacy.version(1).stores({ documents: 'key' }); await legacy.open()
    const original = createEmptyDocument('Original ficticio')
    original.board.backgroundImage = { dataUrl: png, layout: { x: 10, y: 20, width: 128, height: 128 } }
    const originalText = serializeDocument(original)
    await legacy.table('documents').bulkPut([
      { key: 'active', document: original, revision: 1 }, { key: 'board:' + original.document.id, document: original, revision: 1 },
    ]); legacy.close()
    const db = createDatabase(name), repo = new DocumentRepository(db)
    const loaded = await repo.loadActive(), id = loaded.board.backgroundImage.resourceId
    check(id?.startsWith('sha256:'), 'legacy load returns a lightweight reference')
    check((await db.table('documents').get('active')).document.board.backgroundImage.dataUrl === png, 'reading leaves legacy record intact')
    check(serializeDocument(original) === originalText, 'source document intact')
    check(validateWorkingDocument(loaded).success && !validateDocument(loaded).success, 'internal references never enter the portable schema')
    const originalBytes = await bytes(boardImageFile(original.board.backgroundImage))
    check(await bytes(imageResource(id).blob) === originalBytes, 'original PNG bytes')
    await repo.saveActive(loaded)
    check(await db.table('imageResources').count() === 1, 'one blob after upgrade')
    for (let version = 0; version < 7; version++) {
      await repo.replaceActive({ ...loaded, document: { ...loaded.document, title: 'Versión ' + version } }, { openModules: ['board'] })
    }
    const records = await db.table('documents').toArray()
    check(records.filter(r => r.key.startsWith('snapshot:')).length === 5, 'existing retention unchanged')
    check(records.every(r => !JSON.stringify(r.document).includes('data:image/')), 'all newly written recoveries contain references')
    check(await db.table('imageResources').count() === 1, 'all versions share one blob')
    const candidates = await repo.listRecoverable()
    check(candidates.length >= 2, 'versions listed')
    for (const candidate of candidates) {
      const recovered = await repo.loadRecoverable(candidate.key)
      check((await portableDocument(recovered.document)).board.backgroundImage.dataUrl === png, 'version retains exact image')
    }
    // File import/export exercises decoding and the store's actual download path.
    let downloaded
    const store = createDocumentStore(repo, { platform: { download: text => { downloaded = text } } })
    await store.initialize()
    check(await store.loadDocument(new File([originalText], 'antiguo.json', { type: 'application/json' })), 'open legacy file')
    check(!('dataUrl' in store.getSnapshot().document.board.backgroundImage), 'state contains no image bytes')
    await store.downloadJson()
    check(JSON.parse(downloaded).board.backgroundImage.dataUrl === png, 'download reconstructs portable V4')
    const reopened = await loadVisibleDocument(new File([downloaded], 'exportado.json'))
    check(reopened.status === 'loaded' && reopened.document.board.backgroundImage.dataUrl === png, 'export reopens and decodes')
    for (const version of [1, 2, 3]) {
      const old = createEmptyDocument('Histórico'); old.formatVersion = version
      if (version === 1) old.filters = { visibleStatuses: [] }
      const migrated = await loadVisibleDocument(new File([JSON.stringify(old)], 'historico.json'))
      check(migrated.status === 'loaded', 'portable V' + version + ': ' + migrated.message)
    }
    const jpegDoc = { ...original, board: { ...original.board, backgroundImage: { ...original.board.backgroundImage, dataUrl: jpeg } } }
    const jpegWorking = await workingDocument(jpegDoc)
    check((await portableDocument(jpegWorking)).board.backgroundImage.dataUrl === jpeg, 'JPEG retains exact bytes too')
    // A branch with the same original shares storage; removing/replacing an image never deletes it.
    const branch = { ...loaded, document: { ...loaded.document, id: crypto.randomUUID(), title: 'Rama' } }
    await repo.replaceActive(branch, { openModules: [] })
    check(await db.table('imageResources').count() === 1, 'branch shares original')
    await repo.saveActive({ ...branch, board: { ...branch.board, backgroundImage: undefined } })
    check(await db.table('imageResources').count() === 1, 'removal keeps original for older versions')
    // Folder files keep their current portable contract, including backups.
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const handle = Object.create(root)
    for (const key of ['getDirectoryHandle', 'getFileHandle', 'entries', 'removeEntry', 'isSameEntry']) handle[key] = root[key].bind(root)
    handle.queryPermission = async () => 'granted'
    const files = createWorkspaceFiles(async () => ({ handle, accessId: name, isContainer: true }))
    const saved = await files.save(loaded)
    check(saved.status === 'saved', 'portable folder save: ' + saved.message)
    const parts = saved.path.split('/'), folder = await (await root.getDirectoryHandle(parts[0])).getDirectoryHandle(parts[1])
    const disk = await (await folder.getFileHandle('dashboard.json')).getFile()
    check(JSON.parse(await disk.text()).board.backgroundImage.dataUrl === png, 'folder self-contained')
    check((await loadVisibleDocument(disk)).status === 'loaded', 'folder file reopens')
    // Abort after both the new resource and its references have been written.
    const before = JSON.stringify(await db.table('documents').toArray())
    const countBefore = await db.table('imageResources').count()
    const abortDoc = { ...jpegWorking, document: { ...jpegWorking.document, id: crypto.randomUUID() } }
    const table = db.table('documents'), put = table.put.bind(table)
    table.put = async value => {
      const key = await put(value)
      if (value.key === 'active' && value.document.document.id === abortDoc.document.id) Dexie.currentTransaction.abort()
      return key
    }
    let rejected = false
    try { await repo.saveActive(abortDoc) } catch { rejected = true }
    table.put = put
    check(rejected, 'aborted save rejects')
    check(JSON.stringify(await db.table('documents').toArray()) === before, 'abort rolls back references and revision')
    check(await db.table('imageResources').count() === countBefore, 'abort rolls back new blob')
    check(await bytes((await db.table('imageResources').get(id)).blob) === originalBytes, 'abort preserves original')
    await store.flushAutosave()
    // Hold a genuine transaction after inserting its new blob and active reference.
    const crashDoc = { ...abortDoc, document: { ...abortDoc.document, title: 'No confirmada' } }
    const crashBefore = JSON.stringify(await table.toArray())
    table.put = async value => {
      const key = await put(value)
      if (value.key === 'active' && value.document.document.id === crashDoc.document.id) {
        window.__imageCrashReady = true
        await Dexie.waitFor(new Promise(() => {}), 60_000)
      }
      return key
    }
    // The table instance used by the repository is the same cached Dexie table.
    void repo.saveActive(crashDoc).catch(() => {})
    window.__imageTest = { name, id, originalBytes, countBefore, before: crashBefore }
    return { name, pngBytes: imageResource(id).blob.size, snapshots: 5, legacy: true, portable: true, jpeg: true, shared: true, rollback: true }
  })
  await page.waitForFunction(() => window.__imageCrashReady, undefined, { timeout: 15000 })
  const state = await page.evaluate(() => window.__imageTest)
  const cdp = await page.context().newCDPSession(page)
  // Page.crash terminates the renderer process, bypassing page lifecycle handlers.
  const crashed = page.waitForEvent('crash')
  void cdp.send('Page.crash').catch(() => {})
  await crashed
  const recovered = await page.context().newPage(); await recovered.goto(url)
  const crash = await recovered.evaluate(async state => {
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { portableDocument } = await import('/src/storage/imageResources.ts')
    const db = createDatabase(state.name); await db.open()
    const records = await db.table('documents').toArray()
    if (JSON.stringify(records) !== state.before) throw new Error('Interrupted transaction changed committed records')
    if (await db.table('imageResources').count() !== state.countBefore) throw new Error('Interrupted transaction left a partial blob')
    const blob = (await db.table('imageResources').get(state.id)).blob
    if (Array.from(new Uint8Array(await blob.arrayBuffer())).join(',') !== state.originalBytes) throw new Error('Original changed after termination')
    const repo = new DocumentRepository(db)
    const versions = await repo.listRecoverable()
    const withImage = versions.find(v => v.title.startsWith('Versión'))
    const version = await repo.loadRecoverable(withImage.key)
    const portable = await portableDocument(version.document)
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(portable.board.backgroundImage.dataUrl.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/png' }))
    bitmap.close()
    const counts = { records: records.length, resources: await db.table('imageResources').count(), recoveredImage: true }
    db.close(); await db.delete()
    await (await navigator.storage.getDirectory()).removeEntry(state.name, { recursive: true })
    return counts
  }, state)
  return { status: 'PASS', ...result, terminatedDuringTransaction: crash }
}
