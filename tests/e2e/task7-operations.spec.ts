import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { createElement } from '../../src/features/elements/elementCommands'
import type { AngieDocument } from '../../src/domain/document/types'
import { bringModuleToFront } from './acceptance-helpers'

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
function fixture() {
  const document = createEmptyDocument('Operativo Task 7')
  createElement(document, { name: 'Tango 1', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, information: 'Canal 4\nAcceso norte', position: { x: 250, y: 250 } })
  createElement(document, { name: 'Tango 2', isUnit: true, visual: { type: 'emoji', value: '🚗', scale: 1 }, information: 'Canal 5', position: { x: 500, y: 250 } })
  const third = createElement(document, { name: 'Tango 3', isUnit: true, visual: { type: 'emoji', value: '🚙', scale: 1 }, information: 'Canal 6', position: { x: 750, y: 250 } })
  if (third.isUnit) third.operational.status = 'En destino'
  createElement(document, { name: 'Acceso', isUnit: false, visual: { type: 'emoji', value: '📍', scale: 1 }, information: 'Puerta norte', position: { x: 500, y: 750 } })
  document.moduleLayouts = { board: { x: 0, y: 0, width: 600, height: 600, referenceSize: { width: 1600, height: 1000 } }, elements: { x: 600, y: 0, width: 300, height: 420, referenceSize: { width: 1600, height: 1000 } },
    information: { x: 900, y: 0, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }, operations: { x: 900, y: 240, width: 340, height: 320, referenceSize: { width: 1600, height: 1000 } }, timeline: { x: 600, y: 600, width: 420, height: 320, referenceSize: { width: 1600, height: 1000 } } }
  return document
}
async function load(page: Page, document: AngieDocument) {
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'task7.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
}
async function saved(page: Page): Promise<AngieDocument> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('angie-dashboard')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('documents', 'readonly'), active = transaction.objectStore('documents').get('active')
      active.onsuccess = () => resolve(active.result?.document)
      transaction.oncomplete = () => db.close()
    }
  }))
}
async function blankBoard(page: Page) {
  await bringModuleToFront(page, 'Pizarra')
  const rect = (await page.getByTestId('board-surface').boundingBox())!
  await page.mouse.click(rect.x + rect.width * .1, rect.y + rect.height * .8)
}
async function exportJson(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8')) as AngieDocument
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/')
})

test('sin selección Información muestra Sin dotaciones', async ({ page }) => {
  await open(page, 'Información')
  await expect(page.locator('[data-module="information"]').getByText('Sin dotaciones')).toBeVisible()
})

test('selección compartida, ocho estados, etiquetas y registro cerrado con recuperación/JSON/deshacer', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const document = fixture(); await load(page, document)
  for (const name of ['Pizarra', 'Elementos', 'Información', 'Operativo']) await open(page, name)
  const information = page.locator('[data-module="information"]'), ops = page.locator('[data-module="operations"]'), elements = page.locator('[data-module="elements"]'), board = page.locator('[data-module="board"]')
  await expect(information.getByRole('button', { name: /^Seleccionar / })).toHaveText(['Tango 1', 'Tango 2', 'Tango 3'])
  await expect(ops.locator('.operations-counter')).toHaveText(['🟢 2 Disponible', '🟠 1 En destino'])
  await ops.getByRole('button', { name: '🟢 2 Disponible' }).click()
  await expect(ops.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
  await ops.getByRole('button', { name: '🟠 1 En destino' }).click()
  await expect(ops.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveCount(0)
  await ops.getByRole('button', { name: 'Seleccionar Tango 3' }).click()
  await expect(information.getByText('Transferencia', { exact: true })).toBeVisible()
  await blankBoard(page)
  const fromInfo = information.getByRole('button', { name: 'Seleccionar Tango 1' })
  await fromInfo.focus(); await page.keyboard.press('Enter')
  await expect(elements.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveAttribute('aria-pressed', 'true')
  await expect(board.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveAttribute('aria-pressed', 'true')
  await expect(information.getByText('Espera', { exact: true })).toBeVisible()
  await expect(ops.getByRole('group', { name: 'Estado operativo' }).getByRole('button')).toHaveCount(8)
  await bringModuleToFront(page, 'Operativo')
  await ops.getByRole('button', { name: 'Disponible', exact: true }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(0)
  await ops.getByRole('button', { name: 'Asignada', exact: true }).click()
  await ops.getByRole('button', { name: 'En camino', exact: true }).click()
  await expect(information.getByText('Aproximación', { exact: true })).toBeVisible()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(2)
  await ops.getByRole('textbox', { name: 'Anotación' }).fill('Revisar radio\nCanal 4')
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill(' Sector norte ')
  await ops.getByRole('button', { name: 'Añadir', exact: true }).click()
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('Radio')
  await page.keyboard.press('Enter')
  await ops.getByRole('button', { name: 'Editar etiqueta Sector norte' }).click()
  await ops.getByRole('textbox', { name: 'Editar etiqueta' }).fill(' Sector sur ')
  await page.keyboard.press('Enter')
  await expect(information.getByText('Sector sur', { exact: true })).toBeVisible()
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('SECTOR SUR')
  await ops.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(ops.getByRole('alert')).toContainText('duplicada')
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('  ')
  await ops.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(ops.getByRole('alert')).toContainText('vacía')
  await ops.getByRole('button', { name: 'Eliminar etiqueta Radio' }).click()
  await expect(information.getByText('Radio', { exact: true })).toHaveCount(0)
  await expect(board.getByText('Sector sur', { exact: true })).toHaveCount(0)
  await bringModuleToFront(page, 'Elementos')
  await elements.getByRole('button', { name: 'Seleccionar Acceso' }).click()
  await expect(information.locator('.information-module')).toHaveText('Puerta norte')
  await expect(ops.locator('.operations-counter')).toHaveText(['🟢 1 Disponible', '🔵 1 En camino', '🟠 1 En destino'])
  await bringModuleToFront(page, 'Pizarra')
  await board.getByRole('button', { name: 'Seleccionar Tango 2' }).click()
  await expect(elements.getByRole('button', { name: 'Seleccionar Tango 2' })).toHaveAttribute('aria-pressed', 'true')
  await bringModuleToFront(page, 'Operativo')
  await ops.getByRole('button', { name: 'Inoperativa', exact: true }).click()
  await open(page, 'Registro cronológico')
  const timeline = page.locator('[data-module="timeline"]')
  await expect(timeline.getByRole('button', { name: 'Deshacer', exact: true })).toHaveCount(2)
  const latest = timeline.locator('li').filter({ hasText: 'Asignada 🟡 → En camino 🔵' })
  await latest.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBe('Asignada')
  await timeline.locator('li').filter({ hasText: 'Disponible 🟢 → Asignada 🟡' }).getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(1)
  await timeline.getByRole('textbox', { name: 'Acontecimiento' }).fill('Acceso cerrado')
  await timeline.getByRole('button', { name: 'Añadir entrada' }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(2)
  const occurredAt = (await saved(page)).timeline[1]!.occurredAt
  await timeline.getByRole('button', { name: 'Editar entrada' }).click()
  await timeline.getByRole('textbox', { name: 'Texto de entrada' }).fill('Acceso abierto 🚧')
  await timeline.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect.poll(async () => (await saved(page)).timeline[1]).toMatchObject({ text: 'Acceso abierto 🚧', occurredAt })
  await page.screenshot({ path: info.outputPath('task7-modules.png') })
  const json = await exportJson(page)
  expect(json.elements[0]!.operational).toEqual({ status: 'Disponible', notes: 'Revisar radio\nCanal 4', tags: ['Sector sur'] })
  expect(json.timeline).toHaveLength(2); expect(Object.keys(json)).toHaveLength(8)
  await page.reload(); await expect(page.locator('[data-module]')).toHaveCount(0)
  await open(page, 'Información'); await open(page, 'Registro cronológico')
  await expect(information.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
  await expect(timeline.getByText('Acceso abierto 🚧', { exact: true })).toBeVisible()
  await load(page, json)
  await expect(timeline.getByText('Acceso abierto 🚧', { exact: true })).toBeVisible()
  await timeline.getByRole('button', { name: 'Eliminar entrada' }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(1)
  await open(page, 'Elementos')
  await elements.getByRole('button', { name: 'Seleccionar Tango 2' }).click()
  await page.getByRole('button', { name: 'Configurar elementos' }).click(); await page.getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect(timeline.getByText(/Tango 2/)).toBeVisible()
  await expect(timeline.getByRole('button', { name: 'Deshacer' })).toHaveCount(0)
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(1)
  expect(errors).toEqual([])
})

test('registro ascendente sigue el final y conserva lectura antigua; controles en tamaños mínimos sin scroll de página', async ({ page }, info) => {
  const document = fixture()
  document.moduleLayouts.information = { x: 0, y: 0, width: 220, height: 140, referenceSize: { width: 1600, height: 1000 } }
  document.moduleLayouts.operations = { x: 220, y: 0, width: 240, height: 200, referenceSize: { width: 1600, height: 1000 } }
  document.moduleLayouts.timeline = { x: 460, y: 0, width: 280, height: 180, referenceSize: { width: 1600, height: 1000 } }
  document.timeline = Array.from({ length: 35 }, (_, index) => ({ id: crypto.randomUUID(), type: 'manual' as const, text: `Entrada ${index}`, occurredAt: new Date(Date.UTC(2026, 0, 1, 12, 0, index)).toISOString() }))
  await load(page, document)
  for (const name of ['Información', 'Operativo', 'Registro cronológico']) await open(page, name)
  const timeline = page.locator('[data-module="timeline"]'), log = timeline.getByRole('log')
  await expect(log.locator('time').first()).toHaveText('13:00:00')
  await expect(log.locator('time').last()).toHaveText('13:00:34')
  await expect.poll(() => log.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(3)
  await timeline.getByRole('textbox', { name: 'Acontecimiento' }).fill('Al final')
  await timeline.getByRole('button', { name: 'Añadir entrada' }).click()
  await expect(log.getByText('Al final', { exact: true })).toBeInViewport()
  await log.evaluate(node => { node.scrollTop = 12; node.dispatchEvent(new Event('scroll')) })
  await timeline.getByRole('textbox', { name: 'Acontecimiento' }).fill('Sin mover lectura')
  await timeline.getByRole('button', { name: 'Añadir entrada' }).click()
  await expect.poll(() => log.evaluate(node => node.scrollTop)).toBe(12)
  await bringModuleToFront(page, 'Información')
  await page.locator('[data-module="information"]').getByRole('button', { name: 'Seleccionar Tango 1' }).click()
  const ops = page.locator('[data-module="operations"]')
  await ops.getByRole('button', { name: 'En traslado', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(ops.getByRole('button', { name: 'En traslado', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(ops.getByRole('button', { name: 'En traslado', exact: true })).toHaveCSS('outline-style', 'solid')
  expect(await ops.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => ({ width: window.document.documentElement.scrollWidth, height: window.document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
  await page.screenshot({ path: info.outputPath('task7-minimum.png') })
})

test('JSON admitido con UUID mixtos y segundo intercalar conserva el historial y permite deshacer en orden inverso', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const document = fixture(), unit = document.elements[0]!
  if (unit.isUnit) unit.operational.status = 'Asignada'
  document.timeline = [
    { id: crypto.randomUUID(), type: 'manual', text: 'Importada', occurredAt: '2016-12-31T23:59:60Z' },
    { id: crypto.randomUUID(), type: 'status-change', unitId: unit.id, unitName: unit.name, previousStatus: 'Disponible', nextStatus: 'Asignada', occurredAt: '2026-01-01T12:00:00Z' },
    { id: crypto.randomUUID(), type: 'status-change', unitId: unit.id.toUpperCase(), unitName: unit.name, previousStatus: 'Asignada', nextStatus: 'Disponible', occurredAt: '2026-01-01T12:00:01Z' },
    { id: crypto.randomUUID(), type: 'status-change', unitId: unit.id.toUpperCase(), unitName: unit.name, previousStatus: 'Disponible', nextStatus: 'Asignada', occurredAt: '2026-01-01T12:00:02Z' },
  ]
  await load(page, document); await open(page, 'Registro cronológico')
  const timeline = page.locator('[data-module="timeline"]')
  await expect(timeline.getByText('00:59:60', { exact: true })).toHaveAttribute('datetime', '2016-12-31T23:59:60Z')
  await expect(timeline.getByRole('button', { name: 'Deshacer' })).toHaveCount(1)
  await timeline.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBe('Disponible')
  await expect(timeline.getByRole('button', { name: 'Deshacer' })).toHaveCount(1)
  await timeline.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBe('Asignada')
  await timeline.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBe('Disponible')
  await expect.poll(async () => (await saved(page)).timeline).toEqual([document.timeline[0]])
  expect(errors).toEqual([])
})
