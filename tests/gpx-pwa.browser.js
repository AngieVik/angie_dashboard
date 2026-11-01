/* global navigator, localStorage, indexedDB, Buffer */
// Two phases on an isolated persistent Chromium profile against the compiled PWA:
// 1. Run online. 2. Kill the test browser process, stop the server, reopen the same profile,
//    set the context offline, navigate to the same URL and run again.
async page => {
  const key = 'angie-gpx-pwa-test'
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local PWA')
  const previous = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), key)
  if (previous) {
    if (await page.evaluate(() => navigator.onLine)) throw new Error('Phase two must be offline')
    await page.getByRole('region', { name: 'Mapa', exact: true }).waitFor()
    await page.getByRole('button', { name: 'GPX', exact: true }).click()
    await page.getByRole('button', { name: previous.name, exact: true }).waitFor()
    if (await page.getByRole('button', { name: 'Seleccionar GPX ' + previous.name, exact: true }).count()) throw new Error('Reopened GPX is pending')
    const state = await page.evaluate(async previous => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('angie-dashboard'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const read = (table, id) => new Promise((resolve, reject) => { const request = db.transaction(table).objectStore(table).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      for (const id of previous.ids) {
        const record = await read('documents', 'board:' + id)
        if (record.document.map.gpx[0].fingerprint !== previous.fingerprint) throw new Error('Shared reference missing')
      }
      const resource = await read('gpxResources', previous.fingerprint)
      if (Array.from(new Uint8Array(await resource.blob.arrayBuffer())).join(',') !== previous.bytes) throw new Error('Original bytes changed')
      db.close()
      return { offline: !navigator.onLine, documents: previous.ids.length, exactBytes: true, mapLoaded: true }
    }, previous)
    return { status: 'PASS', phase: 'cold offline reopen after browser termination', ...state }
  }
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo UIBoard', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('GPX offline A ficticio')
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
  await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Mapa', exact: true }).click()
  await page.getByRole('region', { name: 'Mapa', exact: true }).waitFor()
  const name = 'GPX original ficticio.gpx'
  const text = '\ufeff<gpx version="1.1" creator="Prueba"><!--bytes originales--><trk><trkseg><trkpt lat="36.7" lon="-4.4"/><trkpt lat="36.71" lon="-4.41"/></trkseg></trk></gpx>\r\n'
  await page.locator('input[type=file][accept=".gpx,application/gpx+xml"]').setInputFiles({ name, mimeType: 'application/gpx+xml', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: 'GPX', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).waitFor()
  // Wait for the real transaction, rather than lifecycle flushes or an arbitrary delay.
  await page.waitForFunction(async () => {
    const db = await new Promise(resolve => { const request = indexedDB.open('angie-dashboard'); request.onsuccess = () => resolve(request.result) })
    const count = await new Promise(resolve => { const request = db.transaction('gpxResources').objectStore('gpxResources').count(); request.onsuccess = () => resolve(request.result) })
    db.close(); return count === 1
  })
  await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar como…', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('GPX offline B ficticio')
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
  await page.getByRole('region', { name: 'Mapa', exact: true }).waitFor()
  const state = await page.evaluate(async ({ key, name }) => {
    const db = await new Promise(resolve => { const request = indexedDB.open('angie-dashboard'); request.onsuccess = () => resolve(request.result) })
    const all = table => new Promise(resolve => { const request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => resolve(request.result) })
    const documents = (await all('documents')).filter(record => record.key.startsWith('board:') && record.document.map?.gpx.length)
    const resources = await all('gpxResources')
    if (documents.length !== 2 || resources.length !== 1) throw new Error('Expected two documents sharing one original')
    const state = { name, ids: documents.map(record => record.document.document.id), fingerprint: resources[0].fingerprint, bytes: Array.from(new Uint8Array(await resources[0].blob.arrayBuffer())).join(',') }
    localStorage.setItem(key, JSON.stringify(state)); db.close()
    return { documents: documents.length, originals: resources.length }
  }, { key, name })
  return { status: 'READY', phase: 'terminate browser and reopen offline', ...state }
}
