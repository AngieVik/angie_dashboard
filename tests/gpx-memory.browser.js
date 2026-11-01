/* global window, document, File, Blob, crypto, requestAnimationFrame */
// Isolated Chromium profile + Vite. Real parser, IndexedDB, document store and React consumer lifecycle.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  await page.reload()
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map(entry => entry.name)
    const { default: React } = await import(resources.find(url => url.includes('/react.js?v=')))
    const { default: { createRoot } } = await import(resources.find(url => url.includes('/react-dom_client.js?v=')))
    const { createDatabase } = await import('/src/storage/db.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createDocumentStore, useDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { replaceMap } = await import('/src/features/document/documentEdits.ts')
    const { useGpxFiles, gpxGeometryMemory } = await import('/src/features/map/useGpxFiles.ts')
    const originals = await import('/src/storage/gpxResources.ts')
    const { readGpxFile } = await import('/src/features/map/gpxFileAccess.ts')
    const check = (value, message) => { if (!value) throw new Error(message) }
    const db = createDatabase('angie-gpx-memory-' + crypto.randomUUID())
    const repo = new DocumentRepository(db), store = createDocumentStore(repo, { platform: { download() {} } })
    await store.initialize(); check(await store.newDocument('Memoria GPX ficticia'), 'create document')
    const node = document.createElement('div'); document.body.append(node)
    const root = createRoot(node), views = new Map()
    function Consumer({ name }) {
      const { document, documentGeneration } = useDocumentStore(store)
      const value = useGpxFiles(store, documentGeneration, document.map?.gpx ?? [])
      React.useLayoutEffect(() => { views.set(name, value); return () => { views.delete(name) } }, [name, value])
      return null
    }
    function show(names) { root.render(React.createElement(React.Fragment, null, ...names.map(name => React.createElement(Consumer, { key: name, name })))) }
    async function until(predicate, message) {
      const deadline = performance.now() + 5000
      while (!predicate()) { if (performance.now() > deadline) throw new Error(message); await new Promise(requestAnimationFrame) }
    }
    const xml = index => '<gpx version="1.1"><trk><trkseg>' + Array.from({ length: 2000 }, (_, point) => `<trkpt lat="${36 + point / 100000}" lon="-4.4"><ele>${point + index}</ele></trkpt>`).join('') + '</trkseg></trk></gpx>'
    let counter = 0, reloaded = 0
    async function cycle() {
      const index = counter++
      show(['map', 'plan', 'report'])
      await until(() => views.size === 3, 'mount consumers')
      const file = new File([xml(index)], 'Ficticio.gpx')
      const imported = await readGpxFile(file)
      const reference = { id: crypto.randomUUID(), name: file.name, size: file.size, lastModified: file.lastModified, fingerprint: imported.fingerprint,
        visible: true, color: '#D63A3A', kilometers: false, kilometerInterval: 1 }
      check(store.applyDocumentCommand(doc => replaceMap(doc, { markers: [], gpx: [reference] })), 'import reference')
      await until(() => views.get('map')?.onFilesChange !== undefined, 'map ready')
      views.get('map').onFilesChange([{ ...reference, data: imported.data }])
      await store.protectGpxResources()
      await until(() => [...views.values()].every(view => view.files.length === 1), 'shared import')
      check([...views.values()].every(view => view.files[0].data === imported.data), 'same geometry identity in all consumers')
      check(gpxGeometryMemory(store).files === 1 && gpxGeometryMemory(store).consumers === 3, 'one geometry, three consumers')
      show(['report'])
      await until(() => views.size === 1, 'close map and plan')
      check(gpxGeometryMemory(store).files === 1, 'report keeps geometry alive')
      show([])
      await until(() => views.size === 0, 'close report')
      check(gpxGeometryMemory(store).files === 0 && gpxGeometryMemory(store).consumers === 0, 'last consumer releases geometry')
      // Force a cold cache and recover from the persisted bytes through the normal reader.
      originals.releaseGpxOriginals([reference.fingerprint])
      check(!originals.gpxResource(reference.fingerprint), 'original evicted')
      show(['map', 'plan', 'report'])
      await until(() => views.size === 3, 'remount')
      const loaded = await Promise.all([...views.values()].map(view => view.loadGpx(reference)))
      check(loaded.every(data => data === loaded[0] && data.pointCount === 2000), 'reconstructed and shared after eviction')
      reloaded++
      check(gpxGeometryMemory(store).files === 1, 'reconstructed once')
      check(store.applyDocumentCommand(doc => replaceMap(doc, { markers: [], gpx: [] })), 'remove reference')
      await until(() => gpxGeometryMemory(store).files === 0, 'removal frees geometry')
      await store.flushAutosave()
      check(await store.newDocument('Cambio ficticio ' + index), 'change document')
      await until(() => [...views.values()].every(view => view.files.length === 0), 'new document has no old geometry')
      show([]); await until(() => views.size === 0, 'close changed document')
      check(gpxGeometryMemory(store).files === 0 && originals.gpxOriginalMemory().files === 0, 'idle caches empty')
      // Test data should not turn this measurement into document-history retention.
      const keep = new Set(['active', 'board:' + store.getSnapshot().document.document.id])
      await db.table('documents').bulkDelete((await db.table('documents').toCollection().primaryKeys()).filter(key => !keep.has(key)))
      await db.table('gpxResources').clear()
    }
    window.__gpxMemoryFixture = {
      async run(count) { for (let i = 0; i < count; i++) await cycle(); return { cycles: counter, reloaded, geometry: gpxGeometryMemory(store), originals: originals.gpxOriginalMemory() } },
      async originalPressure() {
        const fingerprints = []
        for (let i = 0; i < 12; i++) {
          const blob = new Blob([String(i), new Uint8Array(8 * 1024 * 1024)])
          const { fingerprint } = await originals.registerGpx(blob)
          fingerprints.push(fingerprint); originals.commitGpxOriginals([fingerprint])
          check(originals.gpxOriginalMemory().bytes <= 50 * 1024 * 1024, 'original byte budget')
        }
        check(!originals.gpxResource(fingerprints[0]), 'byte pressure evicts older originals')
        originals.releaseGpxOriginals(fingerprints)
      },
      async reportRecovery() {
        const { default: L } = await import('/node_modules/.vite/deps/leaflet.js')
        const { createMapReportRecovery, createMapDataRecovery } = await import('/src/features/document/mapReportRecovery.ts')
        const { GpxGeometryCache } = await import('/src/features/map/gpxGeometryCache.ts')
        const file = new File([xml(999)], 'Informe ficticio.gpx'), imported = await readGpxFile(file)
        const reference = { id: crypto.randomUUID(), name: file.name, size: file.size, lastModified: file.lastModified, fingerprint: imported.fingerprint,
          visible: true, color: '#D63A3A', kilometers: false, kilometerInterval: 1 }
        check(store.applyDocumentCommand(doc => replaceMap(doc, { markers: [], gpx: [reference] })), 'report reference')
        await store.protectGpxResources(); originals.releaseGpxOriginals([reference.fingerprint])
        const cache = new GpxGeometryCache()
        const withGpxFiles = (references, run) => cache.withFiles(references, async reference => {
          const source = await repo.readGpx(reference)
          return source ? (await readGpxFile(source, reference.fingerprint, false)).data : null
        }, run)
        const element = document.createElement('div'); element.style.cssText = 'width:512px;height:384px'; document.body.append(element)
        const map = L.map(element).setView([36.71, -4.4], 12)
        const graphic = createMapReportRecovery({ documentId: store.getSnapshot().document.document.id, section: 'map', map, layers: [],
          crop: { left: 0, top: 0, width: 512, height: 384 }, fields: ['gpx', 'image'], markers: [], references: [reference],
          labels: true, routes: true, legend: true, background: null, information: false, withGpxFiles })
        map.remove(); element.remove()
        const issue = { section: 'map', kind: 'gpx', resourceId: reference.id, label: file.name, message: 'GPX no disponible.' }
        const graphicResult = await graphic.apply(issue, 'retry')
        check(graphicResult.image?.dataUrl && graphicResult.gpx[0].availability === 'Disponible', 'frozen graphic reconstructs after viewer removal')
        check(cache.memory().files === 0 && cache.memory().consumers === 0, 'graphic retry releases geometry')
        const table = createMapDataRecovery({ documentId: store.getSnapshot().document.document.id, markers: [],
          gpx: [{ name: file.name, distance: '—', points: '—', availability: 'No disponible' }], issues: [issue] }, [reference], withGpxFiles, ['gpx'])
        const tableResult = await table.apply(issue, 'retry')
        check(tableResult.gpx[0].availability === 'Disponible' && tableResult.gpx[0].points === '2000', 'table retry reconstructs metrics')
        check(cache.memory().files === 0 && cache.memory().consumers === 0, 'table retry releases geometry')
      },
      async dispose() { root.unmount(); node.remove(); db.close(); await db.delete() },
    }
  })
  const cdp = await page.context().newCDPSession(page)
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
  try {
    await page.evaluate(() => window.__gpxMemoryFixture.run(5))
    const samples = [await heap()]
    let state
    for (let batch = 0; batch < 3; batch++) {
      state = await page.evaluate(() => window.__gpxMemoryFixture.run(10))
      samples.push(await heap())
    }
    await page.evaluate(() => window.__gpxMemoryFixture.reportRecovery())
    await page.evaluate(() => window.__gpxMemoryFixture.originalPressure())
    if (samples.at(-1) - samples[1] > 4 * 1024 * 1024) throw new Error('Heap did not stabilize: ' + samples.join(', '))
    return { status: 'PASS', ...state, heapUsedAfterGC: samples, originalByteBudget: true, graphicAndTableRecovery: true }
  } finally {
    await page.evaluate(async () => { await window.__gpxMemoryFixture.dispose(); delete window.__gpxMemoryFixture })
    await cdp.detach()
  }
}
