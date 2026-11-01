/* global crypto, IDBObjectStore */
// Run via playwright-cli run-code --filename=tests/catalog-upgrade-quota.browser.js.
async page => {
  await page.reload()
  return page.evaluate(async () => {
    const { default: Dexie } = await import('/node_modules/.vite/deps/dexie.js')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const name = 'angie-catalog-upgrade-quota-' + crypto.randomUUID()
    const old = new Dexie(name)
    old.version(3).stores({ documents: 'key', imageResources: 'id', gpxResources: 'fingerprint' })
    const document = createEmptyDocument('Conservado antes de indexar')
    const record = { key: 'active', document, revision: 3 }
    await old.table('documents').put(record); old.close()
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'documentCatalog') throw new DOMException('Quota de indexación', 'QuotaExceededError')
      return put.apply(this, args)
    }
    const failed = createDatabase(name)
    let rejected = false
    try { await failed.open() } catch { rejected = true }
    finally { IDBObjectStore.prototype.put = put; failed.close() }
    const original = new Dexie(name)
    original.version(3).stores({ documents: 'key', imageResources: 'id', gpxResources: 'fingerprint' })
    try {
      await original.open()
      if (!rejected || original.verno !== 3 || JSON.stringify(await original.table('documents').get('active')) !== JSON.stringify(record)) throw new Error('Upgrade quota must leave the complete V3 recovery intact')
    } finally { original.close() }
    const retry = createDatabase(name)
    try {
      await retry.open()
      const entry = await retry.table('documentCatalog').get('active')
      if (entry?.documentId !== document.document.id || entry.listed !== 1) throw new Error('Upgrade retry must index a legacy active-only recovery')
      return { status: 'PASS', quotaDuringUpgrade: true, originalSchemaAndRecoveryIntact: true, retried: true, legacyActiveOnly: true }
    } finally { await retry.delete() }
  })
}
