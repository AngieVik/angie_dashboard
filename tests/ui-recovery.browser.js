/* global window, URL, console, setTimeout */
// Run with an isolated Playwright CLI browser on the local Vite server:
// npx --package @playwright/cli playwright-cli -s=ui-recovery open http://127.0.0.1:5173
// npx --package @playwright/cli playwright-cli -s=ui-recovery run-code --filename=tests/ui-recovery.browser.js
// Faults are injected into browser responses only; no production test hooks.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated browser on the local Vite server')
  for (const [path, signature, flag] of [
    ['src/features/notebook/NotebookModule.tsx', 'function NotebookModule({ store }) {', '__failNotebook'],
    ['src/app/App.tsx', 'function App() {', '__failApp'],
  ]) {
    await page.route('**/' + path + '*', async route => {
      const response = await route.fetch()
      const body = await response.text()
      if (!body.includes(signature)) throw new Error('No se encontró punto de inyección: ' + path)
      await route.fulfill({ response, body: body.replace(signature, signature + ` if (window.${flag}) throw new Error('Excepción de prueba ${flag}');`) })
    })
  }
  await page.reload()
  await page.getByRole('menuitem', { name: 'Archivo', exact: true }).waitFor()
  await page.evaluate(async () => {
    const { getDocumentStore } = await import('/src/features/document/documentStore.ts')
    const store = getDocumentStore()
    await store.initialize()
    store.continueLocally()
    if (!await store.newDocument('Prueba recuperación')) throw new Error('No se pudo crear UIBoard ficticio')
    window.__recoveryStore = store
  })
  await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Cuaderno' }).click()
  await page.getByRole('menuitem', { name: 'Módulos', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Calculadora' }).click()
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  await page.evaluate(async () => {
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    // Keep the next edit unavailable on disk so recovery really uses memory.
    DocumentRepository.prototype.saveActive = async () => { throw new Error('Almacenamiento bloqueado en prueba') }
  })
  await page.getByRole('textbox', { name: 'Texto de nota' }).fill('Cambios pendientes antes del fallo')
  await page.evaluate(() => {
    const store = window.__recoveryStore
    const current = store.getSnapshot()
    if (!current.fileDirty) throw new Error('La prueba necesita cambios pendientes')
    window.__expectedGeneration = current.documentGeneration
    window.__expectedId = current.document.document.id
    window.__failNotebook = true
    store.mutateDocument(document => { document.notebook[0].text += ' · conservados' })
    window.__expectedNote = store.getSnapshot().document.notebook[0].text
  })
  await page.getByRole('alert', { name: 'Error en Cuaderno' }).waitFor()
  await page.getByRole('region', { name: 'Calculadora', exact: true }).waitFor()
  if (!await page.getByRole('menuitem', { name: 'Archivo', exact: true }).isVisible()) throw new Error('Se perdió la cabecera')
  console.log('OK: fallo de Cuaderno contenido; Calculadora y Archivo siguen visibles con cambios pendientes')
  const operation = page.getByRole('textbox', { name: 'Operación', exact: true })
  await operation.fill('2+3')
  await page.getByRole('button', { name: 'Calcular', exact: true }).click()
  if (await operation.inputValue() !== '5') throw new Error('El otro módulo no sigue operativo')
  await page.getByRole('button', { name: 'Reintentar módulo', exact: true }).click()
  await page.getByRole('alert', { name: 'Error en Cuaderno' }).waitFor()
  await page.evaluate(() => { window.__failNotebook = false })
  await page.getByRole('button', { name: 'Reintentar módulo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Texto de nota' }).waitFor()
  const expected = await page.evaluate(() => window.__expectedNote)
  if (await page.getByRole('textbox', { name: 'Texto de nota' }).inputValue() !== expected) throw new Error('Se perdió la nota al reintentar')
  if (await operation.inputValue() !== '5') throw new Error('Se reinició el módulo sano')
  await page.evaluate(async () => {
    const { getDocumentStore } = await import('/src/features/document/documentStore.ts')
    const current = getDocumentStore().getSnapshot()
    if (getDocumentStore() !== window.__recoveryStore || current.documentGeneration !== window.__expectedGeneration || current.document.document.id !== window.__expectedId) throw new Error('Se reinició el store')
    if (!current.autosaveUnavailable) throw new Error('La prueba no bloqueó el guardado')
    void Promise.reject(new Error('Rechazo asíncrono de prueba'))
  })
  await page.getByRole('alert', { name: 'Error de acción' }).waitFor()
  if (await operation.inputValue() !== '5') throw new Error('El rechazo desmontó el módulo')
  await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).click()
  await page.evaluate(() => { setTimeout(() => { throw new Error('Fallo en evento de prueba') }, 0) })
  await page.getByRole('alert', { name: 'Error de acción' }).waitFor()
  await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).click()
  await page.evaluate(async () => {
    const { getTimerStore } = await import('/src/features/clock/timerStore.ts')
    window.__timerStore = getTimerStore()
    getTimerStore().add('tminus')
    getTimerStore().setNote(getTimerStore().getSnapshot().timers.at(-1).id, 'Temporizador conservado')
    window.__timersBefore = JSON.stringify(getTimerStore().getSnapshot().timers)
    window.__failApp = true
    window.__recoveryStore.mutateDocument(document => { document.notebook[0].text += ' · rescate global' })
    window.__globalCopyExpected = JSON.stringify(window.__recoveryStore.getSnapshot().document)
  })
  await page.getByRole('alert', { name: 'Recuperación de Angie' }).waitFor()
  // Exercise the manual escape route when a download cannot start.
  await page.evaluate(() => {
    window.__originalObjectURL = URL.createObjectURL
    URL.createObjectURL = () => { throw new Error('Descarga bloqueada en prueba') }
  })
  await page.getByRole('button', { name: 'Descargar copia recuperable', exact: true }).click()
  const manual = page.getByRole('textbox', { name: 'JSON recuperable' })
  await manual.waitFor()
  if (JSON.stringify(JSON.parse(await manual.inputValue())) !== await page.evaluate(() => window.__globalCopyExpected)) throw new Error('Copia manual incompleta')
  await page.evaluate(() => { URL.createObjectURL = window.__originalObjectURL })
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar copia recuperable', exact: true }).click()
  const download = await downloadEvent
  let json = ''
  for await (const chunk of await download.createReadStream()) json += chunk.toString()
  await page.evaluate(async json => {
    const { loadVisibleDocument } = await import('/src/platform/files/fileAccess.ts')
    const loaded = await loadVisibleDocument({ text: async () => json })
    if (!loaded || loaded.status !== 'loaded' || JSON.stringify(loaded.document) !== window.__globalCopyExpected) throw new Error('La copia descargada no se puede recuperar completa')
  }, json)
  await page.evaluate(() => { window.__failApp = false })
  await page.getByRole('button', { name: 'Reintentar interfaz', exact: true }).click()
  await page.getByRole('textbox', { name: 'Texto de nota' }).waitFor()
  await page.evaluate(async () => {
    const { getDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { getTimerStore } = await import('/src/features/clock/timerStore.ts')
    const current = getDocumentStore().getSnapshot()
    if (getDocumentStore() !== window.__recoveryStore || current.documentGeneration !== window.__expectedGeneration || current.document.document.id !== window.__expectedId) throw new Error('Se reinició el documento al recuperar la app')
    if (current.document.notebook[0].text !== JSON.parse(window.__globalCopyExpected).notebook[0].text) throw new Error('Se perdió contenido al recuperar la app')
    if (getTimerStore() !== window.__timerStore || JSON.stringify(getTimerStore().getSnapshot().timers) !== window.__timersBefore) throw new Error('Se reiniciaron temporizadores')
  })
  return 'PASS: aislamiento, reintento repetido, módulo sano operativo, rechazo asíncrono, error de evento, rescate manual y JSON reabrible, reintento global con el mismo documento y stores'
}

