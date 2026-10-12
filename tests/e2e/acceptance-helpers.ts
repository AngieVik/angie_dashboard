import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'

export async function setElementScale(scope: Page | Locator, value: number) {
  const slider = scope.getByRole('slider', { name: 'Escala del icono', exact: true })
  await slider.press('Home')
  const steps = value - 25
  for (let step = 0; step < Math.floor(steps / 10); step++) await slider.press('PageUp')
  for (let step = 0; step < steps % 10; step++) await slider.press('ArrowRight')
}

export async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  const item = page.getByRole('menuitemcheckbox', { name, exact: true })
  if (await item.getAttribute('aria-checked') === 'true') await page.keyboard.press('Escape')
  else await item.click()
}
export async function bringModuleToFront(page: Page, name: string) {
  await page.getByRole('button', { name: `Cerrar ${name}`, exact: true }).focus()
}
export async function fileCommand(page: Page, name: string) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}
export async function setDocumentTitle(page: Page, title: string) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menu').locator('[data-document-name]').click()
  const field = page.getByRole('textbox', { name: 'Título del documento', exact: true })
  await field.fill(title)
  await field.press('Enter')
  await expect(field).toHaveCount(0)
}
export async function expectDocumentTitle(page: Page, title: string) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menu').locator('[data-document-name]').click()
  await expect(page.getByRole('textbox', { name: 'Título del documento', exact: true })).toHaveValue(title)
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
}
export async function downloadDocument(page: Page) {
  const pending = page.waitForEvent('download')
  await fileCommand(page, 'Guardar')
  const download = await pending
  const text = await readFile((await download.path())!, 'utf8')
  return { download, text, document: JSON.parse(text) as AngieDocument }
}
export async function loadDocument(page: Page, document: AngieDocument) {
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'aceptacion.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expectDocumentTitle(page, document.document.title)
}
export async function savedDocument(page: Page): Promise<AngieDocument | null> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('angie-dashboard')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      if (!db.objectStoreNames.contains('documents')) { db.close(); resolve(null); return }
      const transaction = db.transaction('documents', 'readonly')
      const request = transaction.objectStore('documents').get('active')
      request.onsuccess = () => resolve(request.result?.document ?? null)
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => db.close()
    }
  }))
}
export async function createElement(page: Page, name: string, isUnit: boolean, emoji?: string) {
  const moduleName = isUnit ? 'Dotaciones' : 'Elementos'
  const module = page.getByRole('region', { name: moduleName, exact: true })
  if (!await module.count()) await openModule(page, moduleName)
  await bringModuleToFront(page, moduleName)
  await module.getByRole('button', { name: 'Crear', exact: true }).click()
  await module.getByLabel('Nombre', { exact: true }).fill(name)
  if (emoji) {
    await module.getByRole('radio', { name: 'Emoji', exact: true }).click()
    await module.getByRole('textbox', { name: 'Emoji', exact: true }).fill(emoji)
  }
  await module.getByLabel('Información', { exact: true }).fill('Preparación · Canal 4')
  await module.getByRole('button', { name: 'Crear', exact: true }).click()
  await expect(module.getByRole('button', { name: `Seleccionar ${name}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
}
export async function noPageScroll(page: Page) {
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
}
