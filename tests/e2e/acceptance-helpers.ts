import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'

export function watchAppErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText}: ${request.url()}`))
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`)
  })
  return errors
}

export async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  const item = page.getByRole('menuitemcheckbox', { name, exact: true })
  if (await item.getAttribute('aria-checked') === 'true') await page.keyboard.press('Escape')
  else await item.click()
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
  return { text, document: JSON.parse(text) as AngieDocument }
}
export async function loadDocument(page: Page, text: string) {
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'aceptacion.json', mimeType: 'application/json', buffer: Buffer.from(text) })
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
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }))
}
