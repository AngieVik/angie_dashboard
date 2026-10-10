import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { createElement } from '../../src/features/elements/elementCommands'
import type { AngieDocument } from '../../src/domain/document/types'
import { changeElementStatus } from '../../src/domain/operations/changeStatus'
import { bringModuleToFront, noPageScroll } from './acceptance-helpers'

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
function fixture() {
  const document = createEmptyDocument('Operativo Task 7')
  createElement(document, { name: 'Tango 1', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, information: 'Canal 4\nAcceso norte', position: { x: 250, y: 250 } })
  createElement(document, { name: 'Tango 2', isUnit: true, visual: { type: 'emoji', value: '🚗', scale: 1 }, information: 'Canal 5', position: { x: 500, y: 250 } })
  const third = createElement(document, { name: 'Tango 3', isUnit: true, visual: { type: 'emoji', value: '🚙', scale: 1 }, information: 'Canal 6', position: { x: 750, y: 250 } })
  for (const unit of document.elements) Object.assign(document, changeElementStatus(document, unit.id, unit.id === third.id ? 'Transfiriendo' : 'Disponible', new Date('2026-01-01T11:59:00Z')))
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
  const viewport = page.viewportSize()!
  const left = Math.max(0, rect.x), top = Math.max(0, rect.y)
  const right = Math.min(viewport.width, rect.x + rect.width), bottom = Math.min(viewport.height, rect.y + rect.height)
  await page.mouse.click(left + (right - left) * .1, top + (bottom - top) * .8)
  await expect(page.locator('[data-module="board"]').getByRole('button', { name: /^Seleccionar /, pressed: true })).toHaveCount(0)
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

test('Información: ocho estados con color y fase, tamaños mínimo, inicial y ampliado', async ({ page }, info) => {
  const states = [
    ['Disponible', 'Alerta', '🟢'], ['Activada', 'Alarma', '🟡'], ['Aproximandose', 'Aproximación', '🔵'],
    ['Interviniendo', 'Asistencia', '🔴'], ['Trasladando', 'Transporte', '💠'], ['Transfiriendo', 'Transferencia', '🟠'],
    ['Operativa', 'Reactivación', '🟢'], ['Inoperativa', 'Bloqueo', '⚫'],
  ] as const
  await open(page, 'Información')
  const information = page.locator('[data-module="information"]')
  for (const [width, height] of [[220, 140], [320, 240], [380, 360]]) {
    for (const [status, phase, icon] of states) {
      const document = fixture()
      document.elements = document.elements.slice(0, 1)
      const unit = document.elements[0]!
      if (unit.isUnit) { Object.assign(document, changeElementStatus(document, unit.id, status, new Date())); document.elements[0]!.operational!.tags = ['Sector norte', 'Radio'] }
      document.moduleLayouts.information = { x: 0, y: 0, width: width!, height: height!, referenceSize: { width: 1440, height: 900 } }
      await load(page, document)
      await expect(information.getByLabel('Estado operativo')).toHaveCount(0)
      await information.getByRole('button', { name: 'Seleccionar Tango 1', exact: true }).click()
      await expect(information.getByLabel('Estado operativo')).toHaveText(`${icon} ${status}`)
      await expect(information.getByText(phase, { exact: true })).toBeVisible()
      await expect(information.getByText('Sector norte', { exact: true })).toHaveCount(1)
      if (status === 'Trasladando') await page.screenshot({ path: info.outputPath(`information-${width}.png`) })
      await noPageScroll(page)
    }
  }
})

test('selección compartida, ocho estados, etiquetas y registro cerrado con recuperación/JSON/corrección', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const document = fixture(); await load(page, document)
  for (const name of ['Pizarra', 'Elementos', 'Dotaciones', 'Información', 'Operativo']) await open(page, name)
  const information = page.locator('[data-module="information"]'), ops = page.locator('[data-module="operations"]'), elements = page.locator('[data-module="elements"]'), units = page.locator('[data-module="dotations"]'), board = page.locator('[data-module="board"]')
  await expect(information.getByRole('button', { name: /^Seleccionar / })).toHaveText(['Tango 1', 'Tango 2', 'Tango 3'])
  await expect(ops.locator('.operations-counter')).toHaveText(['🟢 2 Disponible', '🟠 1 Transfiriendo'])
  await ops.getByRole('button', { name: '🟢 2 Disponible' }).click()
  await expect(ops.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
  await ops.getByRole('button', { name: '🟠 1 Transfiriendo' }).click()
  await expect(ops.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveCount(0)
  await ops.getByRole('button', { name: 'Seleccionar Tango 3' }).click()
  await expect(information.getByText('Transferencia', { exact: true })).toBeVisible()
  await blankBoard(page)
  const fromInfo = information.getByRole('button', { name: 'Seleccionar Tango 1' })
  await fromInfo.focus(); await page.keyboard.press('Enter')
  await expect(units.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveAttribute('aria-pressed', 'true')
  await expect(board.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveAttribute('aria-pressed', 'true')
  await expect(information.getByText('Alerta', { exact: true })).toBeVisible()
  await expect(ops.getByRole('group', { name: 'Estado operativo' }).getByRole('button')).toHaveCount(8)
  await bringModuleToFront(page, 'Operativo')
  await ops.getByRole('button', { name: 'Disponible', exact: true }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(3)
  await ops.getByRole('button', { name: 'Activada', exact: true }).click()
  await ops.getByRole('button', { name: 'Aproximandose', exact: true }).click()
  await expect(information.getByText('Aproximación', { exact: true })).toBeVisible()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(5)
  await ops.getByRole('textbox', { name: 'Anotación' }).fill('Revisar radio\nCanal 4')
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill(' Sector norte ')
  await ops.getByRole('button', { name: 'Añadir etiqueta', exact: true }).click()
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('Radio')
  await page.keyboard.press('Enter')
  await ops.getByRole('button', { name: 'Editar etiqueta Sector norte' }).click()
  await ops.getByRole('textbox', { name: 'Editar etiqueta' }).fill(' Sector sur ')
  await page.keyboard.press('Enter')
  await expect(information.getByText('Sector sur', { exact: true })).toBeVisible()
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('SECTOR SUR')
  await ops.getByRole('button', { name: 'Añadir etiqueta', exact: true }).click()
  await expect(ops.getByRole('alert')).toContainText('duplicada')
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('  ')
  await ops.getByRole('button', { name: 'Añadir etiqueta', exact: true }).click()
  await expect(ops.getByRole('alert')).toContainText('vacía')
  await ops.getByRole('button', { name: 'Eliminar etiqueta Radio' }).click()
  await expect(information.getByText('Radio', { exact: true })).toHaveCount(0)
  await expect(board.getByText('Sector sur', { exact: true })).toHaveCount(0)
  await bringModuleToFront(page, 'Elementos')
  await elements.getByRole('button', { name: 'Seleccionar Acceso' }).click()
  await expect(information.locator('.information-text')).toHaveText('Puerta norte')
  await expect(ops.locator('.operations-counter')).toHaveText(['🟢 1 Disponible', '🔵 1 Aproximandose', '🟠 1 Transfiriendo'])
  await bringModuleToFront(page, 'Pizarra')
  await board.getByRole('button', { name: 'Seleccionar Tango 2' }).click()
  await expect(units.getByRole('button', { name: 'Seleccionar Tango 2' })).toHaveAttribute('aria-pressed', 'true')
  await bringModuleToFront(page, 'Operativo')
  await ops.getByRole('button', { name: 'Inoperativa', exact: true }).click()
  await open(page, 'Registro cronológico')
  const timeline = page.locator('[data-module="timeline"]')
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(3)
  const latest = timeline.locator('li').filter({ hasText: 'Activada 🟡 → Aproximandose 🔵' })
  await latest.getByRole('button', { name: 'Editar entrada' }).click()
  await timeline.getByRole('button', { name: 'Corregir estado actual' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar corrección' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBeNull()
  await expect(timeline.locator('li').filter({ hasText: 'Disponible 🟢 → Activada 🟡' }).getByText('Actual', { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(6)
  await timeline.getByRole('textbox', { name: 'Acontecimiento' }).fill('Acceso cerrado')
  await timeline.getByRole('button', { name: 'Añadir entrada' }).click()
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(7)
  const occurredAt = (await saved(page)).timeline[6]!.occurredAt
  await timeline.locator('li').filter({ hasText: 'Acceso cerrado' }).getByRole('button', { name: 'Editar entrada' }).click()
  await timeline.getByRole('textbox', { name: 'Texto de entrada' }).fill('Acceso abierto 🚧')
  await timeline.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect.poll(async () => (await saved(page)).timeline[6]).toMatchObject({ text: 'Acceso cerrado', occurredAt, revisions: [{ kind: 'text', text: 'Acceso abierto 🚧' }] })
  await page.screenshot({ path: info.outputPath('task7-modules.png') })
  const json = await exportJson(page)
  expect(json.elements[0]!.operational).toEqual({ status: null, currentEntryId: null, notes: 'Revisar radio\nCanal 4', tags: ['Sector sur'] })
  expect(json.timeline).toHaveLength(7); expect(Object.keys(json)).toHaveLength(8)
  await page.reload(); await expect(page.locator('[data-module]')).toHaveCount(0)
  await open(page, 'Información'); await open(page, 'Registro cronológico')
  await expect(information.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeVisible()
  await expect(timeline.getByText('Acceso abierto 🚧', { exact: true })).toBeVisible()
  await load(page, json)
  await expect(timeline.getByText('Acceso abierto 🚧', { exact: true })).toBeVisible()
  await timeline.locator('li').filter({ hasText: 'Acceso abierto 🚧' }).getByRole('button', { name: 'Eliminar entrada' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar entrada' }).click()
  await expect(timeline.getByText('Acceso abierto 🚧', { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await saved(page)).timeline[6]!.revisions.at(-1)?.kind).toBe('delete')
  await open(page, 'Dotaciones')
  await units.getByRole('button', { name: 'Seleccionar Tango 2' }).click()
  await units.locator('.element-row[data-selected="true"]').getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect(timeline.getByText(/Tango 2/).first()).toBeVisible()
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(1)
  await expect.poll(async () => (await saved(page)).timeline.length).toBe(7)
  expect(errors).toEqual([])
})

test('registro ascendente sigue el final y conserva lectura antigua; controles en tamaños mínimos sin scroll de página', async ({ page }, info) => {
  const document = fixture()
  document.moduleLayouts.information = { x: 0, y: 0, width: 220, height: 140, referenceSize: { width: 1600, height: 1000 } }
  document.moduleLayouts.operations = { x: 220, y: 0, width: 240, height: 200, referenceSize: { width: 1600, height: 1000 } }
  document.moduleLayouts.timeline = { x: 460, y: 0, width: 280, height: 180, referenceSize: { width: 1600, height: 1000 } }
  document.timeline = Array.from({ length: 35 }, (_, index) => ({ id: crypto.randomUUID(), type: 'manual' as const, revisions: [], text: `Entrada ${index}`, occurredAt: new Date(Date.UTC(2026, 0, 1, 12, 0, index)).toISOString() }))
  for (const unit of document.elements) if (unit.isUnit) Object.assign(unit.operational, { status: null, currentEntryId: null })
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
  await ops.getByRole('button', { name: 'Trasladando', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(ops.getByRole('button', { name: 'Trasladando', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(ops.getByRole('button', { name: 'Trasladando', exact: true })).toHaveCSS('outline-style', 'solid')
  expect(await ops.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => ({ width: window.document.documentElement.scrollWidth, height: window.document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
  await page.screenshot({ path: info.outputPath('task7-minimum.png') })
})

test('JSON admitido con UUID mixtos y segundo intercalar conserva el historial sin recuperar estados al corregir', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const document = fixture(), unit = document.elements[0]!
  for (const other of document.elements.slice(1)) if (other.isUnit) Object.assign(other.operational, { status: null, currentEntryId: null })
  if (unit.isUnit) unit.operational.status = 'Activada'
  document.timeline = [
    { id: crypto.randomUUID(), type: 'manual', revisions: [], text: 'Importada', occurredAt: '2016-12-31T23:59:60Z' },
    { id: crypto.randomUUID(), type: 'status-change', revisions: [], unitId: unit.id, unitName: unit.name, previousStatus: 'Disponible', nextStatus: 'Activada', occurredAt: '2026-01-01T12:00:00Z' },
    { id: crypto.randomUUID(), type: 'status-change', revisions: [], unitId: unit.id.toUpperCase(), unitName: unit.name, previousStatus: 'Activada', nextStatus: 'Disponible', occurredAt: '2026-01-01T12:00:01Z' },
    { id: crypto.randomUUID(), type: 'status-change', revisions: [], unitId: unit.id.toUpperCase(), unitName: unit.name, previousStatus: 'Disponible', nextStatus: 'Activada', occurredAt: '2026-01-01T12:00:02Z' },
  ]
  if (unit.isUnit) unit.operational.currentEntryId = document.timeline[3]!.id
  document.moduleLayouts.timeline = { x: 0, y: 0, width: 340, height: 380, referenceSize: { width: 1440, height: 900 } }
  await load(page, document); await open(page, 'Registro cronológico')
  const timeline = page.locator('[data-module="timeline"]')
  await expect(timeline.getByText('00:59:60', { exact: true })).toHaveAttribute('datetime', '2016-12-31T23:59:60Z')
  await expect(timeline.getByText('Actual', { exact: true })).toHaveCount(0)
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('registro-100.png') })
  await timeline.locator('li[data-current="true"]').getByRole('button', { name: 'Editar entrada' }).click()
  await expect(timeline.getByRole('textbox', { name: 'Texto de entrada' })).toContainText('Activada')
  await timeline.getByRole('button', { name: 'Corregir estado actual' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Sin estado')
  await page.screenshot({ path: info.outputPath('registro-confirmacion.png') })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar corrección' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBeNull()
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(0)
  await expect.poll(async () => (await saved(page)).timeline.slice(0, 3)).toEqual(document.timeline.slice(0, 3))
  await expect.poll(async () => (await saved(page)).timeline[3]!.revisions).toMatchObject([{ kind: 'correction' }])
  await expect(timeline.getByText('Corregida', { exact: true })).toBeVisible()
  const zoom = timeline.getByRole('spinbutton', { name: 'Zoom de Registro cronológico', exact: true })
  await zoom.fill('150'); await zoom.press('Enter')
  await expect(timeline.getByRole('textbox', { name: 'Acontecimiento' })).toBeInViewport()
  await noPageScroll(page)
  await page.screenshot({ path: info.outputPath('registro-150.png') })
  const check = timeline.getByRole('button', { name: 'Añadir entrada' })
  await timeline.getByRole('textbox', { name: 'Acontecimiento' }).fill('Comprobación de scroll interno')
  await check.scrollIntoViewIfNeeded()
  await expect(check).toBeInViewport()
  expect(await check.evaluate(node => {
    const panel = node.closest('.module-content')!.getBoundingClientRect(), button = node.getBoundingClientRect()
    return button.left >= panel.left - 1 && button.right <= panel.right + 1
  })).toBe(true)
  await noPageScroll(page)
  await page.screenshot({ path: info.outputPath('registro-150-scroll.png') })
  await check.click()
  await expect.poll(async () => (await saved(page)).timeline.at(-1)).toMatchObject({ type: 'manual', text: 'Comprobación de scroll interno' })
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Registro entrega 9: borrar antigua y Actual conserva historial, JSON y autoguardado sin recuperar estado', async ({ page }) => {
  const document = createEmptyDocument('Registro entrega 9')
  const unit = createElement(document, { name: 'Tango 9', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, information: '' })
  const other = createElement(document, { name: 'Tango B', isUnit: true, visual: { type: 'emoji', value: '🚗', scale: 1 }, information: '' })
  for (const status of ['Disponible', 'Activada', 'Aproximandose'] as const) Object.assign(document, changeElementStatus(document, unit.id, status, new Date()))
  Object.assign(document, changeElementStatus(document, other.id, 'Inoperativa', new Date()))
  document.moduleLayouts.timeline = { x: 0, y: 0, width: 340, height: 380, referenceSize: { width: 1440, height: 900 } }
  await load(page, document); await open(page, 'Registro cronológico')
  const timeline = page.locator('[data-module="timeline"]')
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(2)
  const remove = async (entryId: string) => {
    // The structured transition text distinguishes entries even at equal timestamps.
    const index = document.timeline.findIndex(entry => entry.id === entryId)
    const label = index === 1 ? 'Disponible 🟢 → Activada 🟡' : 'Activada 🟡 → Aproximandose 🔵'
    await timeline.locator('li').filter({ hasText: label }).getByRole('button', { name: 'Eliminar entrada' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Tango 9')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar entrada' }).click()
  }
  await remove(document.timeline[1]!.id)
  await expect.poll(async () => (await saved(page)).elements[0]!.operational?.status).toBe('Aproximandose')
  await remove(document.timeline[2]!.id)
  await expect.poll(async () => (await saved(page)).elements.map(unit => unit.operational?.status)).toEqual([null, 'Inoperativa'])
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(1)
  await expect(timeline.getByText('Tango 9 · Sin estado → Disponible 🟢', { exact: true })).toBeVisible()
  const json = await exportJson(page)
  expect(json.timeline).toHaveLength(4)
  expect(json.timeline[1]!.revisions).toMatchObject([{ kind: 'delete' }])
  expect(json.timeline[2]!.revisions).toMatchObject([{ kind: 'delete' }])
  expect(json.elements[0]!.operational).toMatchObject({ status: null, currentEntryId: null })
  await page.reload(); await open(page, 'Registro cronológico')
  await expect.poll(() => saved(page)).toEqual(json)
  await expect(timeline.locator('li')).toHaveCount(2)
  await load(page, json)
  await expect(timeline.locator('li[data-current="true"]')).toHaveCount(1)
  await open(page, 'Dotaciones'); await open(page, 'Operativo')
  await bringModuleToFront(page, 'Dotaciones')
  await page.locator('[data-module="dotations"]').getByRole('button', { name: 'Seleccionar Tango 9', exact: true }).press('Enter')
  await bringModuleToFront(page, 'Operativo')
  await page.locator('[data-module="operations"]').getByRole('button', { name: 'Aproximandose', exact: true }).press('Enter')
  await expect.poll(async () => (await saved(page)).timeline.at(-1)).toMatchObject({ previousStatus: null, nextStatus: 'Aproximandose' })
})
