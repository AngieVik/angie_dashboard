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

test('cuatro formatos, teclado, error sin alterar entrada y copia real incluso sin conexión', async ({ page, context }, info) => {
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
  const copy = module.getByRole('button', { name: 'Copiar enlace', exact: true })
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
    await expect(copy).toBeDisabled()
    await expect(module.getByLabel('Resultado DD')).toHaveText('')
    await input.press('Enter')
    await expect(input).toHaveValue(invalid)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(module.getByRole('alert')).toBeVisible()
    await expect(module.getByRole('link', { name: 'Enlace de Google Maps' })).toHaveCount(0)
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
  const referenceSize = await page.locator('.logical-workspace').evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))
  expect(json.moduleLayouts.coordinates).toEqual({ x: 0, y: 0, width: 360, height: 280, referenceSize })
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
  await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled()
})

test('tamaño mínimo, error de portapapeles y scroll interno conservan el acceso a controles', async ({ page }, info) => {
  const document = createEmptyDocument('Mínimo Coordenadas')
  document.moduleLayouts.coordinates = { x: 0, y: 0, width: 260, height: 180, referenceSize: { width: 1600, height: 1000 } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  const module = page.getByRole('region', { name: 'Coordenadas', exact: true })
  await module.getByRole('textbox', { name: 'Coordenadas' }).fill('30S 588700 4101800')
  await module.getByRole('button', { name: 'Convertir' }).click()
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await module.getByRole('button', { name: 'Copiar enlace' }).click()
  await expect(module.getByRole('status')).toContainText('Copia el enlace manualmente')
  const link = module.getByRole('link', { name: 'Enlace de Google Maps' })
  await link.focus()
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('href', /^https:\/\/www.google.com\/maps\/search\/\?api=1&query=/)
  expect(await module.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('coordinates-minimum.png') })
  await page.getByRole('button', { name: 'Cerrar Coordenadas', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(module).toHaveCount(0)
})

test('filas copiables, Maps interceptado y tamaños mínimo, inicial y ampliado', async ({ page, context, isMobile }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const module = page.getByRole('region', { name: 'Coordenadas', exact: true })
  const input = module.getByRole('textbox', { name: 'Coordenadas', exact: true })
  for (const [width, height] of [[260, 180], [360, 280], [380, 480]]) {
    const document = createEmptyDocument('Coordenadas compactas')
    document.moduleLayouts.coordinates = { x: 0, y: 0, width: width!, height: height!, referenceSize: { width: 1440, height: 900 } }
    await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'coordinates.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
    await input.fill('37.060234, -2.002295'); await input.press('Enter')
    await expect(module.getByText('Coordenadas', { exact: true })).toHaveCount(1) // window title only
    await expect(module.getByText('DD · DMS · DMM · UTM', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`coordinates-${width}.png`) })
    for (const [format, expected] of [
      ['DD', '37.060234, -2.002295'], ['DMS', '37°03\'36.8"N 2°00\'08.3"W'], ['DMM', "37°03.614'N 2°00.138'W"],
    ]) {
      const row = module.getByRole('button', { name: `Copiar ${format}`, exact: true })
      if (isMobile) await row.tap(); else await row.click()
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
      await expect(row.locator('button')).toHaveCount(0)
      await expect(module.getByRole('status')).toHaveCount(0)
    }
    await input.fill('30S 588700 4101800'); await input.press('Enter')
    const utm = module.getByRole('button', { name: 'Copiar UTM', exact: true })
    for (const key of ['Enter', 'Space']) {
      await page.evaluate(() => navigator.clipboard.writeText('sentinel'))
      await utm.focus(); await expect(utm).toHaveCSS('outline-style', 'solid'); await utm.press(key)
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('30S 588700 4101800')
    }
    await noPageScroll(page)
  }
  await input.fill('89, 0'); await input.press('Enter')
  await expect(module.getByRole('button', { name: 'Copiar UTM', exact: true })).toHaveCount(0)
  await page.evaluate(() => navigator.clipboard.writeText('sentinel'))
  await module.getByLabel('Resultado UTM', { exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sentinel')
  const intercepted: string[] = []
  await context.route('https://www.google.com/**', async route => {
    intercepted.push(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<title>Maps interceptado</title>' })
  })
  await input.fill('37, -2'); await input.press('Enter')
  const link = module.getByRole('link', { name: 'Enlace de Google Maps' })
  await expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=37%2C-2')
  await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  const opening = context.waitForEvent('page')
  await link.click()
  const popup = await opening
  await expect(popup).toHaveTitle('Maps interceptado')
  expect(intercepted).toEqual(['https://www.google.com/maps/search/?api=1&query=37%2C-2'])
  await popup.close()
  await module.getByRole('button', { name: 'Copiar enlace', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('https://www.google.com/maps/search/?api=1&query=37%2C-2')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await module.getByRole('button', { name: 'Copiar DD', exact: true }).click()
  const error = module.getByRole('status')
  await expect(error).toHaveText('No se pudo copiar la coordenada.')
  await expect(error).toHaveCSS('clip-path', 'inset(50%)')
  expect((await error.boundingBox())!.height).toBe(1)
  await noPageScroll(page)
})
