import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { noPageScroll } from './acceptance-helpers'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Coordenadas', exact: true }).click()
})

test('cinco filas, copia Maps sin navegación, teclado, error sin alterar entrada y copia real incluso sin conexión', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const module = page.getByRole('region', { name: 'Coordenadas', exact: true })
  const input = module.getByRole('textbox', { name: 'Coordenadas', exact: true })
  const externalRequests: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url()) })
  await context.setOffline(true)
  await input.fill('37.060234. -2.002295'); await input.press('Enter')
  await expect(input).toHaveValue('37.060234, -2.002295')
  await expect(module.getByLabel('Resultado DMS')).toHaveText('37°03\'36.8"N 2°00\'08.3"W')
  await expect(module.getByLabel('Resultado DMM')).toHaveText("37°03.614'N 2°00.138'W")
  for (const format of ['DD', 'DMS', 'DMM', 'UTM']) await expect(module.getByLabel(`Resultado ${format}`)).toBeVisible()
  const copy = module.getByRole('button', { name: 'Copiar Maps', exact: true })
  await copy.focus(); await page.keyboard.press('Enter')
  await expect(module.getByRole('status')).toHaveText('Enlace copiado')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  await page.screenshot({ path: info.outputPath('coordinates.png') })
  for (const value of ['37°03\'36.8"N 2°00\'08.2"W', "37°03.614'N 2°00.137'W", '30S 588700 4101800']) {
    await input.fill(value); await input.press('Enter')
    await expect(module.getByLabel('Resultado DD')).toHaveText(/^37\./)
    await expect(module.getByRole('alert')).toHaveCount(0)
  }
  for (const invalid of [' 30I. 588700, 4101800 ', '37.12', '30N 500000.1']) {
    await input.fill(invalid)
    await expect(copy).toHaveCount(0)
    await expect(module.getByLabel('Resultado DD')).toHaveText('')
    await input.press('Enter')
    await expect(input).toHaveValue(invalid)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(module.getByRole('alert')).toBeVisible()
    await expect(module.getByLabel('Resultado Maps')).toHaveText('')
  }
  expect(externalRequests).toEqual([])
  await page.screenshot({ path: info.outputPath('coordinates-invalid.png') })
})

test('JSON y autoguardado excluyen datos temporales; recargar comienza cerrado y vacío', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Coordenadas', exact: true })
  await input.fill('37.060234, -2.002295'); await input.press('Enter')
  await page.getByRole('textbox', { name: 'Título del documento' }).fill('Coordenadas Task 9')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  const jsonText = await readFile((await (await download).path())!, 'utf8')
  const json = JSON.parse(jsonText)
  expect(Object.keys(json)).toHaveLength(8)
  expect(json.moduleLayouts.coordinates).toBeUndefined()
  for (const temporary of ['37.060234', '-2.002295', 'google.com/maps', 'normalizedInput', 'conversions']) expect(jsonText).not.toContain(temporary)
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('angie-dashboard')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction('documents', 'readonly').objectStore('documents').get('active')
        request.onsuccess = () => resolve(JSON.stringify(request.result.document))
        request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  })
  expect(Object.keys(JSON.parse(saved))).toHaveLength(8)
  for (const temporary of ['37.060234', '-2.002295', 'google.com/maps', 'normalizedInput', 'conversions']) expect(saved).not.toContain(temporary)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Título del documento' })).toHaveValue('Coordenadas Task 9')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Coordenadas', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(page.getByLabel('Resultado DD')).toHaveText('')
  await expect(page.getByRole('button', { name: /^Copiar / })).toHaveCount(0)
})

test('tamaño mínimo, error de portapapeles y scroll interno conservan el acceso a controles', async ({ page }, info) => {
  const document = createEmptyDocument('Mínimo Coordenadas')
  document.moduleLayouts.coordinates = { x: 0, y: 0, width: 260, height: 180, referenceSize: { width: 1600, height: 1000 } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  const module = page.getByRole('region', { name: 'Coordenadas', exact: true })
  await module.getByRole('textbox', { name: 'Coordenadas' }).fill('30S 588700 4101800')
  await module.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }).click()
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await module.getByRole('button', { name: 'Copiar Maps' }).click()
  await expect(module.getByRole('status')).toContainText('Copia el enlace manualmente')
  const maps = module.getByRole('button', { name: 'Copiar Maps' })
  await maps.focus()
  await expect(module.getByLabel('Resultado Maps')).toHaveText(new RegExp('^https://www[.]google[.]com/maps/search/[?]api=1&query='))
  expect(await module.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('coordinates-minimum.png') })
  await page.getByRole('button', { name: 'Cerrar Coordenadas', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(module).toHaveCount(0)
})

test('cinco filas copiables sin navegación, scroll interior y zoom 100/150', async ({ page, context, isMobile }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const module = page.getByRole('region', { name: 'Coordenadas', exact: true })
  const input = module.getByRole('textbox', { name: 'Coordenadas', exact: true })
  const external: string[] = [], popups: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url()) })
  page.on('popup', popup => popups.push(popup.url()))
  for (const [width, height, zoom] of [[360, 280, 100], [260, 180, 150]]) {
    const document = createEmptyDocument('Coordenadas compactas')
    document.moduleLayouts.coordinates = { x: 0, y: 0, width: width!, height: height!, referenceSize: { width: 1440, height: 900 } }
    await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'coordinates.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
    const scale = module.getByRole('spinbutton', { name: 'Zoom de Coordenadas', exact: true })
    await scale.fill(String(zoom)); await scale.press('Enter')
    await expect(input).toHaveAttribute('placeholder', 'coordenadas')
    await input.fill('37.060234, -2.002295')
    await module.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }).click()
    await expect(module.locator('.coordinates-results dt')).toHaveText(['DD', 'DMS', 'DMM', 'UTM', 'Maps'])
    await expect(module.getByRole('link')).toHaveCount(0)
    await expect(module.getByRole('button', { name: 'Copiar enlace', exact: true })).toHaveCount(0)
    await module.locator('.module-content').evaluate(node => { node.scrollLeft = 0; node.scrollTop = 0 })
    await page.screenshot({ path: info.outputPath(`coordinates-${width}-zoom${zoom}.png`) })
    for (const [format, expected] of [
      ['DD', '37.060234, -2.002295'], ['DMS', '37°03\'36.8"N 2°00\'08.3"W'], ['DMM', "37°03.614'N 2°00.138'W"],
      ['Maps', 'https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295'],
    ]) {
      const row = module.getByRole('button', { name: `Copiar ${format}`, exact: true })
      if (isMobile) await row.tap(); else await row.click()
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
    }
    await input.fill('30S 588700 4101800'); await input.press('Enter')
    const utm = module.getByRole('button', { name: 'Copiar UTM', exact: true })
    for (const key of ['Enter', 'Space']) {
      await page.evaluate(() => navigator.clipboard.writeText('sentinel'))
      await utm.focus(); await expect(utm).toHaveCSS('outline-style', 'solid'); await utm.press(key)
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('30S 588700 4101800')
    }
    const dmm = module.getByRole('button', { name: 'Copiar DMM', exact: true }).locator('dt')
    await expect(dmm).toHaveCSS('white-space', 'nowrap')
    await dmm.scrollIntoViewIfNeeded()
    await module.locator('.module-content').evaluate(node => { node.scrollLeft = 0 })
    const labelRect = (await dmm.boundingBox())!, contentRect = (await module.locator('.module-content').boundingBox())!
    expect(labelRect.x).toBeGreaterThanOrEqual(contentRect.x)
    expect(labelRect.x + labelRect.width).toBeLessThanOrEqual(contentRect.x + contentRect.width)
    if (zoom === 150) await page.screenshot({ path: info.outputPath('coordinates-260-zoom150-rows.png') })
    const maps = module.getByLabel('Resultado Maps', { exact: true })
    await expect(maps).toHaveCSS('overflow-x', 'auto')
    expect(await maps.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
    await maps.evaluate(node => { node.scrollLeft = node.scrollWidth })
    expect(await maps.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
    if (zoom === 150) expect(await module.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
    await module.getByRole('button', { name: 'Copiar Maps' }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp('^https://www[.]google[.]com/maps/search/[?]api=1&query='))
    await noPageScroll(page)
  }
  expect(popups).toEqual([])
  expect(external).toEqual([])
  await input.fill('89, 0'); await input.press('Enter')
  await expect(module.getByRole('button', { name: 'Copiar UTM', exact: true })).toHaveCount(0)
  await page.evaluate(() => navigator.clipboard.writeText('sentinel'))
  await module.getByLabel('Resultado UTM', { exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sentinel')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await module.getByRole('button', { name: 'Copiar DD', exact: true }).click()
  await expect(module.getByRole('status')).toHaveText('No se pudo copiar la coordenada.')
  await module.getByRole('button', { name: 'Copiar Maps', exact: true }).click()
  await expect(module.getByRole('status')).toContainText('Copia el enlace manualmente')
  await noPageScroll(page)
})
