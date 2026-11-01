/* global window, performance */
// Real Mapa/Plano/Cuaderno; synthetic data and isolated Chromium only.
async page => {
  const origin = new URL(page.url()).origin
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000))
  await page.reload()
  const localOnly = route => route.request().url().startsWith(origin) ? route.continue() : route.abort()
  await page.route('**/*', localOnly)
  const check = (value, message) => { if (!value) throw new Error(message) }
  const cdp = await page.context().newCDPSession(page)
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
  const open = async name => {
    await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
    await page.getByRole('region', { name, exact: true }).waitFor()
  }
  try {
    await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Nuevo UIBoard', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('GPX 6B ficticio ' + Date.now())
    await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
    const discard = page.getByRole('button', { name: 'Continuar sin guardar', exact: true })
    if (await discard.count()) await discard.click()
    await open('Cuaderno'); await open('Mapa'); await open('Plano operativo')
    // Prepare Blobs before measuring. Playwright's Buffer upload decodes many
    // MiB of base64 synchronously in the page, adding unrelated long tasks.
    await page.evaluate(async () => {
      window.__gpxRenderFiles = new Map()
      for (const [name, count, offset] of [['A ficticio.gpx', 75000, 0], ['B ficticio.gpx', 75000, .01],
        ['Exceso ficticio.gpx', 1, .02], ['Repetido ficticio.gpx', 20000, .03], ['Cerrar ficticio.gpx', 150000, .04]]) {
        const parts = ['<gpx><trk><trkseg>']
        for (let start = 0; start < count; start += 2048) {
          parts.push(Array.from({ length: Math.min(2048, count - start) }, (_, j) => {
            const i = start + j
            return `<trkpt lat="${36.7 + i / 10000000}" lon="${-4.4 + offset}"><ele>${i % 100}</ele></trkpt>`
          }).join(''))
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        parts.push('</trkseg></trk></gpx>')
        window.__gpxRenderFiles.set(name, new File(parts, name, { type: 'application/gpx+xml' }))
      }
    })
    await page.evaluate(async () => {
      // Follow the URLs actually loaded by Vite, including HMR identities.
      const resources = performance.getEntriesByType('resource').map(entry => entry.name)
      const loaded = path => resources.find(url => new URL(url).pathname === path)
      const { getDocumentStore } = await import(loaded('/src/features/document/documentStore.ts'))
      const { gpxGeometryMemory } = await import(loaded('/src/features/map/useGpxFiles.ts'))
      const { gpxLayerMemory } = await import(loaded('/src/features/map/gpxLayers.ts'))
      const { gpxOriginalMemory } = await import(loaded('/src/storage/gpxResources.ts'))
      const store = getDocumentStore()
      window.__gpxRender = { store, state: () => ({ geometry: gpxGeometryMemory(store), visual: gpxLayerMemory(), originals: gpxOriginalMemory(),
        references: store.getSnapshot().document.map?.gpx.length ?? 0 }), clicksDuringLayers: 0, ticks: 0, maximumGap: 0, longTasks: [] }
      window.__gpxRender.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__gpxRender.longTasks.push({ start: entry.startTime, duration: entry.duration, jobs: gpxLayerMemory().jobs })
      })
      window.__gpxRender.observer.observe({ type: 'longtask' })
      let last = performance.now()
      window.__gpxRender.timer = setInterval(() => {
        const now = performance.now()
        if (gpxLayerMemory().jobs) { window.__gpxRender.ticks++; window.__gpxRender.maximumGap = Math.max(window.__gpxRender.maximumGap, now - last) }
        last = now
      }, 10)
      window.__gpxRender.click = event => {
        if (event.target.closest('[aria-label="Nota"]') && gpxLayerMemory().jobs) window.__gpxRender.clicksDuringLayers++
      }
      document.addEventListener('click', window.__gpxRender.click, true)
    })
    const input = () => page.getByRole('region', { name: 'Mapa', exact: true }).locator('input[type=file][accept=".gpx,application/gpx+xml"]')
    const importFiles = async names => input().evaluate((input, names) => {
      const transfer = new DataTransfer()
      for (const name of names) transfer.items.add(window.__gpxRenderFiles.get(name))
      input.files = transfer.files
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, Array.isArray(names) ? names : [names])
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await importFiles(['A ficticio.gpx', 'B ficticio.gpx'])
    await page.waitForFunction(() => window.__gpxRender.state().visual.jobs > 0 && window.__gpxRender.state().references === 1, null, { timeout: 30000 })
    await page.getByRole('region', { name: 'Cuaderno', exact: true }).getByRole('button', { name: 'Nota', exact: true }).click()
    await page.waitForFunction(() => window.__gpxRender.state().references === 2 && window.__gpxRender.state().visual.jobs === 0, null, { timeout: 45000 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    const successful = await page.evaluate(() => ({ ...window.__gpxRender.state(), clicks: window.__gpxRender.clicksDuringLayers,
      ticks: window.__gpxRender.ticks, maximumGap: window.__gpxRender.maximumGap, longTasks: window.__gpxRender.longTasks }))
    check(successful.clicks > 0, 'Cuaderno was not used while layers were appearing')
    check(successful.geometry.points === 150000 && successful.geometry.files === 2, 'Aggregate points / file admission')
    check(successful.geometry.bytes <= 64 * 1024 * 1024, 'Aggregate geometry memory estimate')
    check(successful.ticks > 2, 'No event-loop progress during layer construction')
    await importFiles('A ficticio.gpx')
    await page.waitForFunction(() => !document.querySelector('[aria-label="Cancelar importación GPX"]'))
    check((await page.evaluate(() => window.__gpxRender.state())).geometry.points === 150000, 'Reimport duplicated admitted geometry')
    // A third file cannot reuse a fresh 150k allowance.
    await importFiles('Exceso ficticio.gpx')
    await page.waitForFunction(() => !document.querySelector('[aria-label="Cancelar importación GPX"]'))
    check((await page.evaluate(() => window.__gpxRender.state())).references === 2, 'Over-budget import entered the document')
    // Repeat a full import/remove cycle with real map layers, not just a cache.
    const samples = []
    const remove = async () => {
      await page.evaluate(async () => {
        const { replaceMap } = await import('/src/features/document/documentEdits.ts')
        const store = window.__gpxRender.store
        store.applyDocumentCommand(document => replaceMap(document, { ...document.map, gpx: [] }))
        await store.flushAutosave()
      })
      await page.waitForFunction(() => {
        const state = window.__gpxRender.state()
        return state.geometry.files === 0 && state.visual.layers === 0 && state.visual.jobs === 0
      })
    }
    await remove()
    for (let cycle = 0; cycle < 10; cycle++) {
      await importFiles('Repetido ficticio.gpx')
      await page.waitForFunction(() => window.__gpxRender.state().geometry.files === 1 && window.__gpxRender.state().visual.jobs === 0)
      await remove()
      samples.push(await heap())
    }
    check(samples.at(-1) - samples[2] < 4 * 1024 * 1024, 'Heap did not stabilize: ' + samples.join(', '))
    // Unmount while a new renderer still has queued work.
    await importFiles('Cerrar ficticio.gpx')
    await page.waitForFunction(() => window.__gpxRender.state().visual.jobs > 0, null, { timeout: 30000 })
    await page.getByRole('button', { name: 'Cerrar Mapa', exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar Plano operativo', exact: true }).click()
    await page.waitForFunction(() => { const state = window.__gpxRender.state(); return state.geometry.files === 0 && state.visual.jobs === 0 && state.visual.layers === 0 })
    return { status: 'PASS', successful, heapUsedAfterGC: samples, cycles: 10, closeDuringRendering: true, aggregateRejection: true, reimportAtCapacity: true,
      final: await page.evaluate(() => window.__gpxRender.state()) }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await cdp.detach()
    await page.evaluate(() => { if (window.__gpxRender) { clearInterval(window.__gpxRender.timer); window.__gpxRender.observer.disconnect(); document.removeEventListener('click', window.__gpxRender.click, true); delete window.__gpxRender }; delete window.__gpxRenderFiles })
    await page.unroute('**/*', localOnly)
  }
}
