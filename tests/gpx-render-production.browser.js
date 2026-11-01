/* global window, performance */
// Compiled PWA, real UI, no source imports or application test globals.
async page => {
  const origin = new URL(page.url()).origin
  const localOnly = route => route.request().url().startsWith(origin) ? route.continue() : route.abort()
  await page.route('**/*', localOnly)
  const check = (value, message) => { if (!value) throw new Error(message) }
  const cdp = await page.context().newCDPSession(page)
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
  const open = async name => {
    await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  try {
    await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Nuevo UIBoard', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Producción GPX ficticio ' + Date.now())
    await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
    const discard = page.getByRole('button', { name: 'Continuar sin guardar', exact: true })
    if (await discard.count()) await discard.click()
    await open('Cuaderno'); await open('Mapa'); await open('Plano operativo')
    const map = page.getByRole('region', { name: 'Mapa', exact: true })
    await map.getByRole('button', { name: 'GPX', exact: true }).click()
    await page.evaluate(async () => {
      const files = new Map()
      for (const [name, count, offset] of [['A ficticio.gpx', 75000, 0], ['B ficticio.gpx', 75000, .01],
        ['Exceso ficticio.gpx', 1, .02], ['Repetido ficticio.gpx', 20000, .03]]) {
        const parts = ['<gpx><trk><trkseg>']
        for (let start = 0; start < count; start += 2048) {
          parts.push(Array.from({ length: Math.min(2048, count - start) }, (_, j) => {
            const i = start + j
            return `<trkpt lat="${36.7 + i / 10000000}" lon="${-4.4 + offset}"><ele>${i % 100}</ele></trkpt>`
          }).join(''))
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        parts.push('</trkseg></trk></gpx>')
        files.set(name, new File(parts, name, { type: 'application/gpx+xml' }))
      }
      const nativeStroke = CanvasRenderingContext2D.prototype.stroke
      window.__gpxProduction = { files, nativeStroke, strokes: 0, lastStroke: 0, click: 0, ticks: 0, maximumGap: 0, longTasks: [] }
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (this.canvas.closest('[data-map-surface]')) { window.__gpxProduction.strokes++; window.__gpxProduction.lastStroke = performance.now() }
        return nativeStroke.apply(this, args)
      }
      let last = performance.now()
      window.__gpxProduction.timer = setInterval(() => {
        const now = performance.now(); window.__gpxProduction.ticks++
        window.__gpxProduction.maximumGap = Math.max(window.__gpxProduction.maximumGap, now - last); last = now
      }, 10)
      window.__gpxProduction.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__gpxProduction.longTasks.push(entry.duration)
      })
      window.__gpxProduction.observer.observe({ type: 'longtask' })
      window.__gpxProduction.onClick = event => {
        if (event.target.closest('[aria-label="Nota"]')) window.__gpxProduction.click = performance.now()
      }
      document.addEventListener('click', window.__gpxProduction.onClick, true)
    })
    const importFiles = async names => map.locator('input[type=file][accept=".gpx,application/gpx+xml"]').evaluate((input, names) => {
      const transfer = new DataTransfer()
      for (const name of names) transfer.items.add(window.__gpxProduction.files.get(name))
      input.files = transfer.files
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
    }, Array.isArray(names) ? names : [names])
    const ready = async name => {
      await map.getByRole('button', { name, exact: true }).waitFor()
      await page.waitForFunction(() => !document.querySelector('[aria-label="Cancelar importación GPX"]'))
      await page.waitForFunction(() => performance.now() - window.__gpxProduction.lastStroke > 150)
    }
    const remove = async name => {
      await map.getByRole('button', { name, exact: true }).click()
      await map.getByRole('button', { name: 'Retirar ' + name, exact: true }).click()
      await map.getByRole('button', { name, exact: true }).waitFor({ state: 'hidden' })
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await importFiles(['A ficticio.gpx', 'B ficticio.gpx'])
    await page.waitForFunction(() => window.__gpxProduction.strokes > 0)
    await page.getByRole('region', { name: 'Cuaderno', exact: true }).getByRole('button', { name: 'Nota', exact: true }).click()
    await ready('B ficticio.gpx')
    const interaction = await page.evaluate(() => ({ strokes: window.__gpxProduction.strokes, click: window.__gpxProduction.click,
      lastStroke: window.__gpxProduction.lastStroke, ticks: window.__gpxProduction.ticks, maximumGap: window.__gpxProduction.maximumGap,
      longTasks: window.__gpxProduction.longTasks }))
    check(interaction.click > 0 && interaction.lastStroke > interaction.click, 'No drawing after Cuaderno interaction')
    check(interaction.ticks > 10, 'Main thread did not yield during import and drawing')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await importFiles('A ficticio.gpx'); await ready('A ficticio.gpx')
    check(await map.locator('.map-file-name').count() === 2, 'Reimport duplicated an existing reference')
    await importFiles('Exceso ficticio.gpx')
    await ready('B ficticio.gpx')
    check(await map.locator('.map-file-name').count() === 2, 'Third file exceeded aggregate admission')
    // Verify hide/show changes while using the real controls.
    await map.getByRole('button', { name: 'A ficticio.gpx', exact: true }).click()
    await map.getByRole('button', { name: 'Ocultar A ficticio.gpx', exact: true }).click()
    await map.getByRole('button', { name: 'Mostrar A ficticio.gpx', exact: true }).click()
    await remove('A ficticio.gpx'); await remove('B ficticio.gpx')
    const samples = []
    for (let i = 0; i < 10; i++) {
      await importFiles('Repetido ficticio.gpx'); await ready('Repetido ficticio.gpx')
      await remove('Repetido ficticio.gpx')
      await page.waitForFunction(() => performance.now() - window.__gpxProduction.lastStroke > 150)
      samples.push(await heap())
    }
    check(samples.at(-1) - samples[2] < 4 * 1024 * 1024, 'Production heap did not stabilize: ' + samples.join(', '))
    await page.getByRole('button', { name: 'Cerrar Mapa', exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar Plano operativo', exact: true }).click()
    return { status: 'PASS', compiledApp: true, points: 150000, cpuThrottling: 4, interaction, heapUsedAfterGC: samples,
      cycles: 10, aggregateRejection: true, reimportAtCapacity: true, hideShow: true }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach()
    await page.evaluate(() => {
      const test = window.__gpxProduction
      if (!test) return
      CanvasRenderingContext2D.prototype.stroke = test.nativeStroke
      clearInterval(test.timer); test.observer.disconnect(); document.removeEventListener('click', test.onClick, true)
      delete window.__gpxProduction
    })
    await page.unroute('**/*', localOnly)
  }
}
