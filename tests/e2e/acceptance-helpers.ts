import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'

export async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
export async function bringModuleToFront(page: Page, name: string) {
  await page.getByRole('button', { name: `Cerrar ${name}`, exact: true }).focus()
}
export async function fileCommand(page: Page, name: string) {
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
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
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
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
  await module.getByRole('button', { name: 'Añadir', exact: true }).click()
  await module.getByLabel('Nombre', { exact: true }).fill(name)
  if (emoji) {
    await module.getByLabel('Representación').selectOption('emoji')
    await module.getByLabel('Emoji', { exact: true }).fill(emoji)
  }
  await module.getByLabel('Información', { exact: true }).fill('Preparación · Canal 4')
  await module.getByRole('button', { name: 'Crear elemento', exact: true }).click()
  await expect(module.getByRole('button', { name: `Seleccionar ${name}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
}
export async function noPageScroll(page: Page) {
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
}
