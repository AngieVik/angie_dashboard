/* global crypto, Blob, document */
// Run via playwright-cli run-code --filename=tests/resource-cleanup.browser.js.
// Real IndexedDB in unique databases, synthetic originals and documents only.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  return page.evaluate(async () => {
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createEmptyDocument } = await import('/src/domain/document/defaultDocument.ts')
    const { catalogRecord } = await import('/src/storage/documentCatalog.ts')
    const { migrateDocument } = await import('/src/domain/document/migrateDocument.ts')
    const { registerImage, imageResource } = await import('/src/storage/imageResources.ts')
    const { registerGpx } = await import('/src/storage/gpxResources.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10
    const imageId = await registerImage(await new Promise(resolve => canvas.toBlob(resolve)))
    const gpx = new Blob(['<gpx version="1.1" creator="cleanup-test"/>'], { type: 'application/gpx+xml' })
    const { fingerprint } = await registerGpx(gpx)
    const reference = { id: crypto.randomUUID(), name: 'Ficticio.gpx', fingerprint, size: gpx.size, lastModified: 1234,
      visible: true, color: '#D63A3A', kilometers: false, kilometerInterval: 1 }
    const withResources = title => {
      const value = createEmptyDocument(title)
      value.board.backgroundImage = { resourceId: imageId, layout: { x: 0, y: 0, width: 10, height: 10 } }
      value.map = { markers: [], gpx: [reference] }
      return value
    }
    const outcomes = []
    async function scenario(label, action) {
      const db = createDatabase('angie-cleanup-test-' + crypto.randomUUID())
      const repo = new DocumentRepository(db)
      await db.open()
      const put = async (key, value, indexed = true) => {
        const record = { key, document: value, revision: 1, savedAt: '2026-01-01T00:00:00.000Z' }
        await db.table('documents').put(record)
        const entry = catalogRecord(record)
        if (indexed && entry) await db.table('documentCatalog').put(entry)
      }
      const originals = async () => {
        await db.table('imageResources').put(imageResource(imageId))
        await db.table('gpxResources').put({ fingerprint, blob: gpx })
      }
      const present = async () => !!await db.table('imageResources').get(imageId) && !!await db.table('gpxResources').get(fingerprint)
      const absent = async () => !await db.table('imageResources').get(imageId) && !await db.table('gpxResources').get(fingerprint)
      try { await action({ db, repo, put, originals, present, absent }); outcomes.push(label) }
      finally { await db.delete() }
    }

    // Removing the last *catalogued* owner must not delete a raw, uncatalogued owner's originals.
    await scenario('uncatalogued references', async ({ repo, put, originals, present }) => {
      await originals()
      await put('snapshot:remove', withResources('Retirar'))
      await put('archive:uncatalogued', withResources('Conservar'), false)
      await repo.removeRetained({ key: 'snapshot:remove' })
      check(await present(), 'uncatalogued retained document protects both originals')
      check((await repo.loadRecoverable('archive:uncatalogued')).document.board.backgroundImage.resourceId === imageId, 'retained image remains recoverable and passes digest verification')
      check(await (await repo.readGpx(reference)).text() === await gpx.text(), 'retained GPX bytes remain available')
    })

    await scenario('progressive documents and versions', async ({ db, repo, present, absent }) => {
      const first = withResources('Compartido A'), second = withResources('Compartido B')
      await repo.replaceActive(first, { openModules: [] })
      await repo.replaceActive(second, { openModules: [] })
      const without = { ...second, board: { ...second.board, backgroundImage: undefined }, map: { markers: [], gpx: [] } }
      await repo.saveActive(without)
      await repo.replaceActive(createEmptyDocument('Activo sin recursos'), { openModules: [] })
      await repo.removeRetained({ documentId: first.document.id })
      check(await present(), 'other document versions protect shared originals after current references disappear')
      const versions = await db.table('documentCatalog').where('documentId').equals(second.document.id).toArray()
      const protectedVersions = versions.filter(entry => entry.resourceIds.length)
      check(protectedVersions.length >= 2, 'fixture has multiple protected recovery versions')
      for (let index = 0; index < protectedVersions.length; index++) {
        await repo.removeRetained({ key: protectedVersions[index].key })
        if (index < protectedVersions.length - 1) check(await present(), 'every remaining recovery protects shared originals')
      }
      check(await absent(), 'last reference removal releases both originals')
      check(await db.table('documents').get('board:' + second.document.id), 'resource cleanup does not delete a retained document')
    })

    const damaged = withResources('Dañado'); damaged.map = null
    const old = { ...createEmptyDocument('Antiguo desconocido'), formatVersion: 0 }
    const future = { ...createEmptyDocument('Futuro'), formatVersion: 99 }
    for (const [label, key, value] of [
      ['damaged reference structure', 'damaged:bad-map', damaged],
      ['unsupported historical format', 'archive:old', old],
      ['future format', 'archive:future', future],
      ['unknown record key', 'unrecognized:retained', createEmptyDocument('Desconocido')],
      ['invalid presence', 'session-presence', { broken: true }],
    ]) await scenario(label, async ({ db, repo, put, originals, present, absent }) => {
      await originals()
      await put('snapshot:remove', withResources('Retirar'))
      await put(key, value)
      const before = JSON.stringify(await db.table('documents').get(key))
      const report = await repo.removeRetained({ key: 'snapshot:remove' })
      check(await present(), label + ' blocks deletion of originals')
      check(report.protectedRecords.includes(key) && report.removedImages === 0 && report.removedGpx === 0, label + ' is reported as a protection barrier')
      check(JSON.stringify(await db.table('documents').get(key)) === before, label + ' is never rewritten or removed')
      if (key.startsWith('damaged:') || key.startsWith('archive:')) {
        await repo.removeRetained({ key })
        check(await absent(), 'only explicit removal of the barrier permits collection')
      }
    })

    await scenario('unknown record envelope', async ({ db, repo, put, originals, present }) => {
      await originals()
      await put('snapshot:remove', withResources('Retirar'))
      await put('archive:unknown-envelope', createEmptyDocument('Conservar'))
      await db.table('documents').update('archive:unknown-envelope', { resources: [imageId, fingerprint] })
      const report = await repo.removeRetained({ key: 'snapshot:remove' })
      check(await present() && report.protectedRecords.includes('archive:unknown-envelope'), 'unrecognized record envelope can carry dependencies outside a known document')
    })

    await scenario('accumulated orphans and foreign keys', async ({ db, repo, put, originals, absent }) => {
      await originals()
      await db.table('imageResources').put({ id: 'unknown-image-format', blob: gpx })
      await db.table('gpxResources').put({ fingerprint: 'unknown-gpx-format', blob: gpx })
      await put('snapshot:remove', createEmptyDocument('Sin recursos'))
      await put('session-presence', { documentId: crypto.randomUUID(), seenAt: '2026-01-01T00:00:00.000Z', closed: true })
      const report = await repo.removeRetained({ key: 'snapshot:remove' })
      check(await absent(), 'cleanup also collects accumulated orphans outside the removed selection')
      check(report.removedImages === 1 && report.removedGpx === 1 && report.protectedRecords.length === 0, 'cleanup returns verifiable counts')
      check(await db.table('imageResources').get('unknown-image-format') && await db.table('gpxResources').get('unknown-gpx-format'), 'unknown resource identities are preserved')
    })

    await scenario('recognized historical format', async ({ repo, put, originals, absent }) => {
      await originals()
      const legacy = createEmptyDocument('V3 conservado'); legacy.formatVersion = 3
      check(migrateDocument(legacy).success, 'valid historical fixture: ' + JSON.stringify(migrateDocument(legacy)))
      await put('archive:legacy', legacy)
      await put('snapshot:remove', withResources('Retirar'))
      const report = await repo.removeRetained({ key: 'snapshot:remove' })
      check(await absent(), 'a validated historical record with no resource dependencies allows collection')
      check(report.removedImages === 1 && report.removedGpx === 1 && report.protectedRecords.length === 0, 'recognized historical format is understood without rewriting it')
    })

    await scenario('atomic rollback', async ({ db, repo, put, originals, present }) => {
      await originals()
      await put('snapshot:remove', withResources('Retirar'))
      const table = db.table('gpxResources'), remove = table.bulkDelete
      table.bulkDelete = () => { throw new Error('Synthetic cleanup failure') }
      let failed = false
      try { await repo.removeRetained({ key: 'snapshot:remove' }) } catch { failed = true }
      finally { table.bulkDelete = remove }
      check(failed && await present(), 'failure rolls back all resource deletions')
      check(await db.table('documents').get('snapshot:remove') && await db.table('documentCatalog').get('snapshot:remove'), 'failure also rolls back explicit record and catalog deletion')
    })
    return { status: 'PASS', scenarios: outcomes }
  })
}
