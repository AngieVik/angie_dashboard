/* global window, document, crypto, IDBObjectStore */
// Run via playwright-cli run-code --filename=tests/catalog-ui.browser.js.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  await page.evaluate(async () => {
    const { default: Dexie } = await import('/node_modules/.vite/deps/dexie.js')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const { createDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { RecoveryDialog } = await import('/src/features/document/RecoveryDialog.tsx')
    const { default: { createElement } } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const name = 'angie-catalog-ui-' + crypto.randomUUID(), old = new Dexie(name)
    old.version(3).stores({ documents: 'key', imageResources: 'id', gpxResources: 'fingerprint' })
    const records = []
    for (let index = 0; index < 150; index++) {
      const base = createEmptyDocument('Documento ' + String(index).padStart(3, '0'))
      for (let version = 0; version < 3; version++) records.push({ key: version === 0 ? 'board:' + base.document.id : `snapshot:${base.document.id}:${version}`,
        document: { ...base, notebook: [{ id: crypto.randomUUID(), type: 'note', title: '', text: 'Versión ' + version }] },
        revision: version + 1, savedAt: `2026-01-01T12:00:0${version}.000Z` })
    }
    await old.table('documents').bulkPut(records); old.close()
    const db = createDatabase(name), repo = new DocumentRepository(db)
    const store = createDocumentStore(repo, { platform: { download() {} } })
    await store.initialize()
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container)
    const fixture = { db, repo, store, root, container, reads: 0, undo: [], opened: null, originalId: records.at(-1).document.document.id }
    window.__catalogUi = fixture
    root.render(createElement(RecoveryDialog, { store, busy: false, error: null, onRefresh: () => store.refreshRecoverable(), onClose() {}, onRecent() {},
      onOpen: copy => { fixture.opened = store.restoreDocument(copy.key, copy) } }))
    for (const method of ['get', 'getAll', 'openCursor']) {
      const original = IDBObjectStore.prototype[method]
      IDBObjectStore.prototype[method] = function (...args) {
        if (['documents', 'imageResources', 'gpxResources'].includes(this.name)) fixture.reads++
        return original.apply(this, args)
      }
      fixture.undo.push(() => { IDBObjectStore.prototype[method] = original })
    }
  })
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const list = page.locator('[data-slot="recovery-list"]')
  const ready = () => page.waitForFunction(() => document.querySelector('[data-slot="recovery-list"]')?.getAttribute('aria-busy') === 'false')
  try {
    await ready()
    check(await list.getByRole('button').count() === 10, 'ten visible rows')
    for (let index = 0; index < 12; index++) { await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await ready() }
    check(await page.getByText('Página 13', { exact: true }).count() === 1, 'navigate beyond nine pages')
    await page.getByRole('button', { name: 'Página anterior', exact: true }).click(); await ready()
    await page.getByRole('textbox', { name: 'Buscar guardados' }).fill('Documento 149')
    await ready()
    await page.waitForFunction(() => document.querySelector('[data-slot="recovery-list"]')?.textContent.includes('Documento 149'))
    check(await list.getByRole('button').count() === 3, 'filtered versions')
    check(await page.evaluate(() => window.__catalogUi.reads) === 0, 'UI browsing reads no document payload')
    check(await page.getByRole('status', { name: 'Capacidad del sitio' }).count() === 1, 'capacity visible')
    await page.screenshot({ path: 'output/playwright/catalog-ui.png' })
    await list.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await page.waitForFunction(() => window.__catalogUi.opened !== null)
    check(await page.evaluate(() => window.__catalogUi.opened), 'open selected historical version in a branch')
    check(await page.evaluate(() => window.__catalogUi.store.getSnapshot().document.notebook[0].text) === 'Versión 2', 'selected version content')
    const current = list.locator('button').filter({ has: page.locator('span[title*="board:"]') })
    await current.click()
    await page.getByRole('button', { name: 'Eliminar documento', exact: true }).click()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    check(await page.evaluate(async () => (await window.__catalogUi.repo.listRecoveryPage({ documentId: window.__catalogUi.originalId })).entries.length) === 3, 'cancel keeps recoveries')
    await page.getByRole('button', { name: 'Eliminar documento', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click()
    await ready()
    check(await page.evaluate(async () => (await window.__catalogUi.repo.listRecoveryPage({ documentId: window.__catalogUi.originalId })).entries.length) === 0, 'confirmed removal')
    const quota = await page.evaluate(async () => {
      const f = window.__catalogUi, catalog = f.db.table('documentCatalog'), original = catalog.put
      const before = JSON.stringify(await catalog.toArray())
      catalog.put = () => { throw new DOMException('Quota ficticia', 'QuotaExceededError') }
      try {
        f.store.applyDocumentCommand(document => ({ document: { ...document, document: { ...document.document, title: 'Cambio pendiente' } }, changed: true }))
        await f.store.flushAutosave()
        const state = f.store.getSnapshot()
        return { unavailable: state.autosaveUnavailable, message: state.localStorageMessage, preserved: JSON.stringify(await catalog.toArray()) === before }
      } finally { catalog.put = original }
    })
    check(quota.unavailable && quota.message?.includes('espacio') && quota.preserved, 'quota is explicit and keeps recoveries')
    await page.evaluate(() => window.__catalogUi.store.retryAutosave())
    check(!await page.evaluate(() => window.__catalogUi.store.getSnapshot().autosaveUnavailable), 'quota retry')
    return { status: 'PASS', pages: 13, payloadReadsWhileBrowsing: 0, versionOpened: true, cancelledRemoval: true, confirmedRemoval: true, capacity: true, quota: true, retry: true }
  } finally {
    await page.evaluate(async () => {
      const f = window.__catalogUi
      for (const undo of f.undo) undo()
      f.root.unmount(); f.container.remove(); await f.db.delete(); delete window.__catalogUi
    })
  }
}
