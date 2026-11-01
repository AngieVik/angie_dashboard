/* global window, performance */
// Real worker and Map UI, synthetic files, isolated browser profile, local requests only.
async page => {
  const origin = new URL(page.url()).origin
  const localOnly = route => route.request().url().startsWith(origin) ? route.continue() : route.abort()
  await page.route('**/*', localOnly)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  const suffix = ' ' + Date.now()
  try {
    await page.keyboard.press('Escape')
    await page.evaluate(async () => {
      window.__gpxTestStore = (await import('/src/features/document/documentStore.ts')).getDocumentStore()
      const NativeWorker = window.__gpxNativeWorker ??= window.Worker
      window.__gpxWorkers = []; window.__gpxLateReplies = []; window.__gpxHold = false
      window.Worker = class extends NativeWorker {
        constructor(...args) { super(...args); this.record = { ticks: 0 }; window.__gpxWorkers.push(this.record) }
        postMessage(request, ...args) {
          Object.assign(this.record, { operationId: request.operationId, generation: request.documentGeneration, start: performance.now() })
          this.timer = setInterval(() => { this.record.ticks++ }, 10)
          super.postMessage(request, ...args)
        }
        set onmessage(handler) {
          super.onmessage = event => {
            clearInterval(this.timer); this.record.elapsed = performance.now() - this.record.start
            if (window.__gpxHold) window.__gpxLateReplies.push(() => handler.call(this, event))
            else handler.call(this, event)
          }
        }
        terminate() { this.record.terminated = true; clearInterval(this.timer); super.terminate() }
      }
    })
    const newDocument = async name => {
      const generation = await page.evaluate(async () => (await import('/src/features/document/documentStore.ts')).getDocumentStore().getSnapshot().documentGeneration)
      await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Nuevo UIBoard', exact: true }).click()
      await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(name + suffix)
      await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
      await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
      const discard = page.getByRole('button', { name: 'Continuar sin guardar', exact: true })
      if (await discard.count()) await discard.click()
      await page.waitForFunction(previous => window.__gpxTestStore.getSnapshot().documentGeneration > previous, generation)
    }
    const openMap = async () => {
      if (!await page.getByRole('region', { name: 'Mapa', exact: true }).count()) {
        await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Mapa', exact: true }).click()
      }
      await page.getByRole('region', { name: 'Mapa', exact: true }).waitFor()
      await page.getByRole('button', { name: 'GPX', exact: true }).click()
    }
    await newDocument('Worker A ficticio'); await openMap()
    // 150k points, near the 10 MiB input ceiling; no external/patient data.
    const xml = '<gpx version="1.1"><trk><trkseg>' + Array.from({ length: 150000 }, (_, i) =>
      `<trkpt lat="36.${70000 + i % 10000}" lon="-4.4"><ele>${i % 100}</ele></trkpt>`).join('') + '</trkseg></trk></gpx>'
    const file = { name: 'Grande ficticio.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(xml) }
    const input = () => page.locator('input[type=file][accept=".gpx,application/gpx+xml"]').first()
    const countReferences = () => page.evaluate(async () => {
      const { getDocumentStore } = await import('/src/features/document/documentStore.ts')
      return getDocumentStore().getSnapshot().document.map?.gpx.length ?? 0
    })
    // Cancel during a real parse, then deliberately deliver a queued reply if one raced the click.
    await page.evaluate(() => { window.__gpxHold = true })
    await input().setInputFiles(file)
    await page.getByRole('button', { name: 'Cancelar importación GPX', exact: true }).click()
    await page.evaluate(() => { for (const reply of window.__gpxLateReplies.splice(0)) reply() })
    check(await countReferences() === 0, 'Cancellation incorporated a reference')
    check(await page.evaluate(() => window.__gpxWorkers.at(-1).terminated), 'Cancellation did not terminate the worker')
    // Hold the completed result to exercise late delivery after replacement, deterministically.
    await input().setInputFiles(file)
    await page.waitForFunction(() => window.__gpxLateReplies.length > 0)
    const generationA = await page.evaluate(() => window.__gpxWorkers.at(-1).generation)
    await newDocument('Worker B ficticio')
    await page.evaluate(() => { for (const reply of window.__gpxLateReplies.splice(0)) reply(); window.__gpxHold = false })
    check(await countReferences() === 0, 'A late result entered document B')
    check(await page.evaluate(() => window.__gpxWorkers.at(-1).terminated), 'Replacement did not terminate the worker')
    // Successful large import: interact with the interface while the actual worker runs.
    await openMap()
    await input().setInputFiles(file)
    await page.getByRole('button', { name: 'Marcadores', exact: true }).click()
    await page.waitForFunction(() => window.__gpxTestStore.getSnapshot().document.map?.gpx.length === 1, null, { timeout: 30000 })
    const success = await page.evaluate(() => window.__gpxWorkers.at(-1))
    check(success.generation !== generationA, 'Import used the old generation')
    check(success.ticks >= 5, 'Main thread activity measurement: ' + JSON.stringify(success))
    check(success.terminated, 'Completed worker was not released')
    // Change document while parsing (not just while awaiting delivery).
    await newDocument('Worker C ficticio'); await openMap()
    await page.evaluate(() => { window.__gpxHold = true })
    await input().setInputFiles(file)
    await page.waitForFunction(() => window.__gpxWorkers.at(-1).start && !window.__gpxWorkers.at(-1).terminated)
    await newDocument('Worker D ficticio')
    await page.evaluate(() => { for (const reply of window.__gpxLateReplies.splice(0)) reply() })
    check(await countReferences() === 0, 'An in-flight parse entered document D')
    check(await page.evaluate(() => window.__gpxWorkers.at(-1).terminated), 'In-flight parse was not terminated')
    const result = { status: 'PASS', bytes: Buffer.byteLength(xml), points: 150000, cancel: true, lateReplyAfterReplacement: true,
      replacementWhileProcessing: true, interfaceInteraction: true, successfulImport: success }
    console.log(JSON.stringify(result))
    return result
  } finally {
    await page.evaluate(() => { if (window.__gpxNativeWorker) window.Worker = window.__gpxNativeWorker; window.__gpxHold = false })
    await page.unroute('**/*', localOnly)
  }
}
