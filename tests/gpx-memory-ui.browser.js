/* global window */
// Real Mapa/Plano/Informes components in an isolated local browser; no external cartography.
async page => {
  const origin = new URL(page.url()).origin
  const localOnly = route => route.request().url().startsWith(origin) ? route.continue() : route.abort()
  await page.route('**/*', localOnly)
  try {
    await page.evaluate(() => performance.setResourceTimingBufferSize(5000))
    await page.getByRole('menuitem', { name: 'Archivo', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Nuevo UIBoard', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('GPX memoria UI ' + Date.now())
    await page.getByRole('button', { name: 'Aceptar', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).waitFor({ state: 'hidden' })
    const open = async name => {
      await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
      await page.getByRole('menuitem', { name, exact: true }).click()
      await page.getByRole('region', { name, exact: true }).waitFor()
    }
    await open('Mapa')
    const name = 'Compartido ficticio.gpx'
    const text = '<gpx><trk><trkseg><trkpt lat="36.7" lon="-4.4"/><trkpt lat="36.71" lon="-4.41"/></trkseg></trk></gpx>'
    await page.locator('input[type=file][accept=".gpx,application/gpx+xml"]').setInputFiles({ name, mimeType: 'application/gpx+xml', buffer: Buffer.from(text) })
    await page.evaluate(async () => {
      const resources = performance.getEntriesByType('resource').map(entry => entry.name)
      const { getDocumentStore } = await import(resources.find(url => url.includes('/src/features/document/documentStore.ts')))
      const { gpxGeometryMemory } = await import(resources.find(url => url.includes('/src/features/map/useGpxFiles.ts')))
      window.__gpxUiMemory = () => gpxGeometryMemory(getDocumentStore())
    })
    await page.waitForFunction(() => window.__gpxUiMemory().files === 1)
    await open('Plano operativo')
    await page.waitForFunction(() => window.__gpxUiMemory().consumers === 2)
    await open('Informes')
    const reports = page.getByRole('region', { name: 'Informes', exact: true })
    await reports.getByRole('checkbox', { name: 'Datos de GPX', exact: true }).check()
    await page.waitForFunction(() => window.__gpxUiMemory().consumers === 3)
    if ((await page.evaluate(() => window.__gpxUiMemory())).files !== 1) throw new Error('Mapa, Plano and Informes must share one geometry')
    await page.getByRole('button', { name: 'Cerrar Mapa', exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar Plano operativo', exact: true }).click()
    await page.waitForFunction(() => window.__gpxUiMemory().consumers === 1)
    await reports.getByRole('button', { name: 'Generar vista previa', exact: true }).click()
    await reports.locator('iframe').waitFor()
    await reports.getByRole('checkbox', { name: 'Datos de GPX', exact: true }).uncheck()
    await page.waitForFunction(() => window.__gpxUiMemory().files === 0)
    await reports.getByRole('checkbox', { name: 'Datos de GPX', exact: true }).check()
    await page.waitForFunction(() => window.__gpxUiMemory().files === 1)
    await page.getByRole('button', { name: 'Cerrar Informes', exact: true }).click()
    await page.waitForFunction(() => window.__gpxUiMemory().consumers === 0 && window.__gpxUiMemory().files === 0)
    await open('Mapa')
    await page.waitForFunction(() => window.__gpxUiMemory().files === 1)
    return { status: 'PASS', actualComponents: ['Mapa', 'Plano operativo', 'Informes'], sharedGeometry: true,
      previewDoesNotRetainGeometry: true, reloaded: true }
  } finally { await page.unroute('**/*', localOnly) }
}
