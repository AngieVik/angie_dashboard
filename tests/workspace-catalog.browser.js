/* global crypto, navigator, File, IDBObjectStore */
// Run via playwright-cli run-code --filename=tests/workspace-catalog.browser.js.
// Fictitious OPFS folders only; never writes to an external folder.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  return page.evaluate(async () => {
    const { createWorkspaceFiles } = await import('/src/platform/files/workspaceFiles.ts')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const { createDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const name = 'catalog-folder-' + crypto.randomUUID()
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const library = await root.getDirectoryHandle('angie_dashboard', { create: true })
    const handle = Object.create(root)
    for (const key of ['getDirectoryHandle', 'getFileHandle', 'entries', 'removeEntry', 'isSameEntry']) handle[key] = root[key].bind(root)
    handle.queryPermission = async () => 'granted'
    const workspace = createWorkspaceFiles(async () => ({ handle, accessId: name, isContainer: true }))
    const write = async (folder, filename, value) => {
      const writer = await (await folder.getFileHandle(filename, { create: true })).createWritable()
      await writer.write(JSON.stringify(value)); await writer.close()
    }
    let first
    for (let index = 0; index < 60; index++) {
      const document = createEmptyDocument('Carpeta ' + String(index).padStart(3, '0'))
      const folder = await library.getDirectoryHandle(document.document.title, { create: true })
      await write(folder, 'dashboard.json', document)
      const copies = await folder.getDirectoryHandle('copias', { create: true })
      for (let version = 0; version < 2; version++) await write(copies, `dashboard_${1760000000000 + version}_${crypto.randomUUID()}.json`,
        { ...document, notebook: [{ id: crypto.randomUUID(), type: 'note', title: '', text: 'Historia ' + version }] })
      first ??= document
    }
    const db = createDatabase(), localDb = createDatabase(name), repo = new DocumentRepository(localDb)
    const text = File.prototype.text, put = IDBObjectStore.prototype.put
    let reads = 0
    File.prototype.text = function () { if (this.name === 'dashboard.json' || /^dashboard_/.test(this.name)) reads++; return text.call(this) }
    try {
      await db.open()
      const initial = await workspace.listRecoveryPage({ limit: 11 })
      check(reads === 180 && initial.entries.length === 11, 'one-time discovery indexes historical folder files')
      reads = 0
      let cursor, count = 0
      do {
        const result = await workspace.listRecoveryPage({ cursor, limit: 11 })
        count += result.entries.length; cursor = result.nextCursor
      } while (cursor)
      check(count === 180 && reads === 0, 'folder pages read only metadata after discovery')
      workspace.invalidateRecoveryCatalog()
      const refreshed = await workspace.listRecoveryPage({ limit: 11 })
      check(reads === 0 && refreshed.entries.length === 11, 'refresh reuses unchanged file stamps')
      const firstFolder = await library.getDirectoryHandle(first.document.title)
      await write(firstFolder, 'dashboard.json', { ...first, document: { ...first.document, title: 'Carpeta editada', updatedAt: new Date().toISOString() } })
      workspace.invalidateRecoveryCatalog()
      check((await workspace.listRecoveryPage({ search: 'Carpeta editada' })).entries.length === 1 && reads === 1, 'only a changed file is reindexed')
      reads = 0
      await repo.saveActive(createEmptyDocument('Local de prueba'))
      const store = createDocumentStore(repo, { platform: { download() {} }, workspace })
      await store.initialize()
      let mixedCursor, mixedCount = 0
      do {
        const result = await store.listRecoveryPage({ cursor: mixedCursor, limit: 13 }, 'all')
        mixedCount += result.entries.length; mixedCursor = result.nextCursor
      } while (mixedCursor)
      check(mixedCount === 182 && reads === 0, 'combined paging stays bounded and does not omit local or folder entries')
      const selected = initial.entries.find(entry => entry.kind === 'snapshot') ?? initial.entries[0]
      const opened = await workspace.loadRecoverable(selected.key)
      check(opened.document.document.id === selected.documentId && reads > 0, 'folder content loads on selected open')
      const before = JSON.stringify(await db.table('workspaceCatalog').where('accessId').equals(name).toArray())
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'workspaceCatalog') throw new DOMException('Quota de catálogo', 'QuotaExceededError')
        return put.apply(this, args)
      }
      workspace.invalidateRecoveryCatalog()
      let quota = false
      try { await workspace.listRecoveryPage() } catch { quota = true }
      finally { IDBObjectStore.prototype.put = put }
      check(quota && JSON.stringify(await db.table('workspaceCatalog').where('accessId').equals(name).toArray()) === before, 'folder catalog quota preserves prior index')
      check(await workspace.loadRecoverable(selected.key), 'folder originals remain available after quota')
      check((await workspace.listRecoveryPage()).entries.length === 10, 'folder catalog retries')
      return { status: 'PASS', entries: count, documentReadsDuringPaging: 0, refreshUsesMetadata: true, combinedPaging: true, onDemandOpen: true, quotaPreservesCatalogAndFiles: true }
    } finally {
      File.prototype.text = text; IDBObjectStore.prototype.put = put
      await db.table('workspaceCatalog').where('accessId').equals(name).delete(); db.close()
      await localDb.delete()
      await (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true })
    }
  })
}
