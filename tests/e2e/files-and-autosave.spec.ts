import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { downloadDocument, openModule, savedDocument } from './acceptance-helpers'

for (const origin of ['archivo', 'IndexedDB'] as const) {
  test(`V1 real desde ${origin}: conserva datos ocultos, convierte, autoguarda y exporta V3`, async ({ page }) => {
    const legacy = JSON.parse(await readFile('src/domain/document/fixtures/complete.json', 'utf8'))
    const converted = JSON.parse(await readFile('src/domain/document/fixtures/v3-complete.json', 'utf8'))
    const source = JSON.stringify({ ...legacy, filters: { visibleStatuses: [] } })
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
    await page.goto('/')
    await expect.poll(async () => (await savedDocument(page))?.formatVersion).toBe(3)
    if (origin === 'archivo') {
      await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(source) })
    } else {
      await page.evaluate(async document => {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('angie-dashboard')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction('documents', 'readwrite')
            transaction.objectStore('documents').put({ key: 'active', document })
            transaction.oncomplete = () => { db.close(); resolve() }
            transaction.onerror = () => { db.close(); reject(transaction.error) }
          }
        })
      }, JSON.parse(source))
      await page.reload()
    }
    await expect(page.getByLabel('Título del documento')).toHaveValue(legacy.document.title)
    await expect.poll(() => savedDocument(page)).toEqual(converted)
    const exported = await downloadDocument(page)
    expect(exported.document).toEqual(converted)
    expect(JSON.parse(source)).toEqual({ ...legacy, filters: { visibleStatuses: [] } })
    await openModule(page, 'Dotaciones')
    const elements = page.getByRole('region', { name: 'Dotaciones', exact: true })
    await expect(elements.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
    await expect(elements.getByRole('group', { name: 'Filtrar dotaciones por estado' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cerrar Dotaciones', exact: true }).click()
    await openModule(page, 'Pizarra')
    await expect(page.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Acceso norte', exact: true })).toBeVisible()
  })
}

async function persistedTitle(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const open = indexedDB.open('angie-dashboard')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      if (!db.objectStoreNames.contains('documents')) { db.close(); resolve(null); return }
      const transaction = db.transaction('documents', 'readonly')
      const request = transaction.objectStore('documents').get('active')
      request.onsuccess = () => resolve(request.result?.document.document.title ?? null)
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => reject(transaction.error)
    }
  }))
}

async function command(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

test('título, autoguardado real, recarga, descarga, carga segura y Nuevo', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Exercise the download path available on browsers without a native picker.
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/')
  const title = page.getByRole('textbox', { name: 'Título del documento' })
  await title.fill('Servicio áé_1<>.JSON')
  await expect.poll(() => persistedTitle(page)).toBe('Servicio áé_1<>.JSON')
  await page.reload()
  await expect(title).toHaveValue('Servicio áé_1<>.JSON')
  await page.screenshot({ path: testInfo.outputPath('recovered-document.png') })
  const downloaded = page.waitForEvent('download')
  await command(page, 'Guardar')
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('Servicio áé_1.json')
  const text = await readFile((await download.path())!, 'utf8')
  const json = JSON.parse(text)
  expect(json.document.title).toBe('Servicio áé_1<>.JSON')
  expect(Object.keys(json)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
  expect(text).toContain('\n  "format"')
  expect(text.endsWith('\n')).toBe(true)
  for (const invalid of ['{', '{"format":"otro"}', '{"format":"angie-dashboard","formatVersion":2}']) {
    await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(invalid) })
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(title).toHaveValue('Servicio áé_1<>.JSON')
    expect(await persistedTitle(page)).toBe('Servicio áé_1<>.JSON')
  }
  json.document.title = 'Importado'
  await command(page, 'Cargar')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(title).toHaveValue('Importado')
  await expect.poll(() => persistedTitle(page)).toBe('Importado')
  await command(page, 'Nuevo')
  await expect(title).toHaveValue('')
  await expect.poll(() => persistedTitle(page)).toBe('')
  await page.reload()
  await expect(title).toHaveValue('')
  expect(await readFile((await download.path())!, 'utf8')).toBe(text)
  await expect(page.getByRole('main')).toBeEmpty()
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('document-header.png') })
})

test('selector compatible: vínculo, cambio de título, cancelación y permiso denegado', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const state = { picks: [] as string[], contents: [] as string[], denied: false, cancel: false }
    Object.assign(window, { fileTest: state })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async (options: { suggestedName: string }) => {
      state.picks.push(options.suggestedName)
      if (state.cancel) throw new DOMException('Cancelado', 'AbortError')
      return {
        queryPermission: async () => state.denied ? 'denied' : 'granted',
        createWritable: async () => {
          let pending = ''
          return { write: async (text: string) => { pending = text }, close: async () => { state.contents.push(pending) }, abort: async () => {} }
        },
      }
    } })
  })
  await page.goto('/')
  const title = page.getByRole('textbox', { name: 'Título del documento' })
  await title.fill('Uno')
  await command(page, 'Guardar')
  await command(page, 'Guardar')
  expect(await page.evaluate(() => (window as unknown as { fileTest: { picks: string[] } }).fileTest.picks)).toEqual(['Uno.json'])
  await title.fill('Dos')
  await page.evaluate(() => { (window as unknown as { fileTest: { cancel: boolean } }).fileTest.cancel = true })
  await command(page, 'Guardar')
  await expect(title).toHaveValue('Dos')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { fileTest: { contents: string[] } }).fileTest.contents.length)).toBe(2)
  await page.evaluate(() => { (window as unknown as { fileTest: { cancel: boolean } }).fileTest.cancel = false })
  await command(page, 'Guardar')
  await page.evaluate(() => { (window as unknown as { fileTest: { denied: boolean } }).fileTest.denied = true })
  await command(page, 'Guardar')
  await expect(page.getByRole('button', { name: 'Descargar JSON' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('save-fallback.png') })
  await title.fill('Últimos cambios')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar JSON' }).click()
  expect((await downloaded).suggestedFilename()).toBe('Últimos cambios.json')
  await expect.poll(() => persistedTitle(page)).toBe('Últimos cambios')
})

test('IndexedDB bloqueado: trabajo en memoria, exportación y recuperación confirmada', async ({ page }, testInfo) => {
  await page.goto('/')
  const title = page.getByRole('textbox', { name: 'Título del documento' })
  await title.fill('Documento en disco')
  await expect.poll(() => persistedTitle(page)).toBe('Documento en disco')
  await page.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB)
    Object.assign(window, { restoreDatabase: () => { indexedDB.open = original } })
    indexedDB.open = () => { throw new DOMException('bloqueado', 'SecurityError') }
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true })
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Autoguardado no disponible')
  await title.fill('Trabajo en memoria')
  await page.screenshot({ path: testInfo.outputPath('autosave-unavailable.png') })
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Guardar JSON', exact: true }).click()
  const download = await downloaded
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).document.title).toBe('Trabajo en memoria')
  await page.evaluate(() => { (window as unknown as { restoreDatabase: () => void }).restoreDatabase() })
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('confirm-recovery.png') })
  // A modal deliberately hides the header from the accessibility tree.
  await expect(page.getByLabel('Título del documento')).toHaveValue('Trabajo en memoria')
  await page.getByRole('button', { name: 'Conservar cambios actuales' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => persistedTitle(page)).toBe('Trabajo en memoria')
  await expect(page.getByText('Autoguardado no disponible')).toHaveCount(0)
})

test('Archivo se acciona por teclado y el título conserva foco visible', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Archivo', exact: true })
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Nuevo', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Cargar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Ver', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  const title = page.getByRole('textbox', { name: 'Título del documento' })
  await expect(title).toBeFocused()
  await expect(title).toHaveCSS('outline-style', 'solid')
})
