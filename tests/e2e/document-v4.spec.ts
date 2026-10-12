import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { bringModuleToFront, createElement, downloadDocument, expectDocumentTitle, fileCommand, loadDocument, noPageScroll, openModule, savedDocument, setDocumentTitle } from './acceptance-helpers'

async function openIds(page: Page): Promise<string[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('angie-dashboard')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active')
      read.onsuccess = () => resolve(read.result?.session?.openModules ?? [])
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => db.close()
    }
  }))
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
})

test('V4 refrescar restaura módulos abiertos y fondo portable', { tag: '@responsive' }, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await setDocumentTitle(page, 'Servicio portable')
  for (const name of ['Pizarra', 'Cuaderno', 'Información']) await openModule(page, name)
  await bringModuleToFront(page, 'Pizarra')
  const png = await readFile('public/assets/pwa/favicon-16.png')
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'fondo.png', mimeType: 'image/png', buffer: png })
  const dataUrl = 'data:image/png;base64,' + png.toString('base64')
  await expect.poll(async () => (await savedDocument(page))?.board.backgroundImage?.dataUrl).toBe(dataUrl)
  await bringModuleToFront(page, 'Información')
  await page.getByRole('button', { name: 'Cerrar Información', exact: true }).click()
  await expect.poll(() => openIds(page)).toEqual(['board', 'notebook'])
  const exported = await downloadDocument(page)
  expect(exported.document.formatVersion).toBe(4)
  expect(exported.document.board.backgroundImage?.dataUrl).toBe(dataUrl)
  expect(exported.document).not.toHaveProperty('openModules')
  expect(exported.document).not.toHaveProperty('timers')
  await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Pizarra', exact: true })).toBeAttached()
  await expect(page.getByRole('region', { name: 'Cuaderno', exact: true })).toBeAttached()
  await expect(page.getByRole('region', { name: 'Información', exact: true })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Mover y redimensionar imagen' })).toBeEnabled()
  await expect.poll(() => openIds(page)).toEqual(['board', 'notebook'])
  await noPageScroll(page)
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await expect(page.getByText(/Guardado en este dispositivo/)).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Guardar como', exact: true })).toBeVisible()
  if (testInfo.project.name === 'desktop') await page.screenshot({ path: testInfo.outputPath('save-menu.png') })
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('V4 conserva las horas de entrada y reentrada tras guardar cargar y refrescar', { tag: '@responsive' }, async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T06:00:00.000Z'))
  await page.goto('/')
  await setDocumentTitle(page, 'Horas operativas')
  await createElement(page, 'Tango horario', true)
  await openModule(page, 'Operativo')
  await bringModuleToFront(page, 'Operativo')
  const ops = page.getByRole('region', { name: 'Operativo', exact: true })
  for (const [status, instant] of [['Activada', '2026-10-12T06:10:23.000Z'], ['Interviniendo', '2026-10-12T06:12:05.000Z'], ['Activada', '2026-10-12T06:18:41.000Z']]) {
    await page.clock.setFixedTime(new Date(instant!))
    await ops.getByRole('button', { name: status!, exact: true }).click()
    await expect.poll(async () => (await savedDocument(page))?.timeline.at(-1)?.occurredAt).toBe(instant)
  }
  await page.clock.setFixedTime(new Date('2026-10-12T06:30:00.000Z'))
  await ops.getByRole('button', { name: 'Activada', exact: true }).click()
  await openModule(page, 'Información')
  await bringModuleToFront(page, 'Información')
  await expect(page.getByLabel('Hora de entrada al estado')).toHaveText('Desde 08:18:41')
  const exported = await downloadDocument(page)
  expect(exported.document.timeline.map(entry => entry.occurredAt)).toEqual(['2026-10-12T06:10:23.000Z', '2026-10-12T06:12:05.000Z', '2026-10-12T06:18:41.000Z'])
  const currentEntryId = exported.document.elements[0]!.operational!.currentEntryId
  await fileCommand(page, 'Nuevo')
  await expectDocumentTitle(page, '')
  await loadDocument(page, exported.document)
  await page.reload()
  await expect(page.getByLabel('Hora de entrada al estado')).toHaveAttribute('datetime', '2026-10-12T06:18:41.000Z')
  await expect.poll(async () => (await savedDocument(page))?.elements[0]?.operational?.currentEntryId).toBe(currentEntryId)
  expect((await savedDocument(page))?.timeline.map(entry => entry.occurredAt)).toEqual(['2026-10-12T06:10:23.000Z', '2026-10-12T06:12:05.000Z', '2026-10-12T06:18:41.000Z'])
})

test('V4 Nuevo protege el documento y Recuperar mantiene contenido ante un JSON inválido', { tag: '@responsive' }, async ({ page }) => {
  await page.goto('/')
  await setDocumentTitle(page, 'Servicio anterior')
  await openModule(page, 'Cuaderno')
  const notebook = page.getByRole('region', { name: 'Cuaderno', exact: true })
  await notebook.getByRole('button', { name: 'Nota', exact: true }).click()
  await notebook.getByLabel('Texto de nota').fill('Revisar canal 4')
  await expect.poll(async () => (await savedDocument(page))?.notebook[0]).toMatchObject({ text: 'Revisar canal 4' })
  await fileCommand(page, 'Nuevo')
  await expectDocumentTitle(page, '')
  await fileCommand(page, 'Recuperar documento local')
  await page.getByRole('alertdialog').getByRole('button', { name: /Servicio anterior/ }).last().click()
  await expectDocumentTitle(page, 'Servicio anterior')
  await expect(notebook.getByLabel('Texto de nota')).toHaveValue('Revisar canal 4')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"angie-dashboard","formatVersion":5}') })
  await expect(page.getByRole('alert')).toContainText('versión futura')
  await expect.poll(async () => (await savedDocument(page))?.document.title).toBe('Servicio anterior')
  await page.reload()
  await expect(notebook.getByLabel('Texto de nota')).toHaveValue('Revisar canal 4')
})
