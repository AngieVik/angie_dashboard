import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
async function action(page: Page, name: string) {
  await page.getByRole('button', { name: 'Configurar elementos', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
async function saved(page: Page): Promise<AngieDocument> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('angie-dashboard')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('documents', 'readonly')
      const active = transaction.objectStore('documents').get('active')
      active.onsuccess = () => resolve(active.result?.document)
      transaction.oncomplete = () => db.close()
    }
  }))
}
async function create(page: Page, name: string, isUnit = false, icon = 'ambulance', emoji?: string) {
  await action(page, 'Añadir')
  await page.getByLabel('Nombre', { exact: true }).fill(name)
  if (isUnit) await page.getByRole('checkbox', { name: 'Dotación', exact: true }).check()
  if (emoji) {
    await page.getByLabel('Representación', { exact: true }).selectOption('emoji')
    await page.getByLabel('Emoji', { exact: true }).fill(emoji)
  } else await page.getByLabel('Icono', { exact: true }).selectOption(icon)
  await page.getByLabel('Información', { exact: true }).fill('Acceso norte · Canal 4')
  await page.getByRole('button', { name: 'Crear elemento', exact: true }).click()
}
async function point(page: Page, x: number, y: number) {
  const rect = (await page.getByTestId('board-surface').boundingBox())!
  return { x: rect.x + x * rect.width / 1000, y: rect.y + y * rect.height / 1000 }
}
async function exportJson(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8')) as AngieDocument
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/'); await open(page, 'Pizarra'); await open(page, 'Elementos')
})

test('CRUD, selección compartida, escala sincronizada, ausencia de filtros, JSON y recuperación', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await create(page, 'Tango 1', true)
  const module = page.locator('[data-module="elements"]'), board = page.locator('[data-module="board"]')
  await expect(board.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await action(page, 'Modificar')
  await expect(page.getByText('Tipo: Dotación', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Dotación' })).toHaveCount(0)
  await page.getByLabel('Escala del icono').fill('1.5')
  await expect.poll(async () => (await saved(page)).elements[0]?.visual).toEqual({ type: 'asset', assetId: 'ambulance', scale: 1.5 })
  const beforeSize = await board.locator('.board-pin-visual').evaluate(el => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
  expect(beforeSize).toEqual({ w: 225, h: 150 })
  const handle = board.getByRole('button', { name: 'Redimensionar Tango 1' }), box = (await handle.boundingBox())!
  const surface = (await page.getByTestId('board-surface').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 37.5 * surface.width / 1000, box.y + box.height / 2 + 25 * surface.height / 1000, { steps: 6 }); await page.mouse.up()
  await expect.poll(async () => Number(await page.getByLabel('Escala del icono').inputValue())).toBeCloseTo(2, 1)
  await expect(board.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
  await expect(board.locator('.board-pin-visual img')).toHaveCSS('object-fit', 'contain')
  await page.getByRole('button', { name: 'Guardar elemento' }).click()
  await action(page, 'Duplicar')
  await expect(module.getByRole('button', { name: 'Seleccionar Tango 1 copia', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await saved(page)).elements.length).toBe(2)
  const copied = (await saved(page)).elements
  expect(copied[1]!.id).not.toBe(copied[0]!.id)
  expect(copied[1]!.position).toEqual({ x: 524, y: 524 })
  expect(copied[1]!.operational).toEqual({ status: 'Disponible', notes: '', tags: [] })
  await action(page, 'Quitar')
  await create(page, 'Ruta', false, 'ambulance', '🚴🏽‍♂️')
  const pin = board.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })
  // The new emoji shares the initial center. Select the exposed corner of the PNG.
  await pin.click({ position: { x: 2, y: 2 } })
  await expect(module.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const blank = await point(page, 100, 100); await page.mouse.click(blank.x, blank.y)
  await expect(pin).toHaveAttribute('aria-pressed', 'false')
  await expect(module.getByRole('group', { name: 'Filtrar dotaciones por estado' })).toHaveCount(0)
  await expect(pin).toBeVisible()
  await expect(module.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })).toBeVisible()
  await expect(board.getByRole('button', { name: 'Seleccionar Ruta', exact: true })).toBeVisible()
  const json = await exportJson(page)
  expect(json.elements[0]!.visual).toMatchObject({ type: 'asset', scale: expect.closeTo(2, 1) })
  expect(json.elements[0]!.information).toBe('Acceso norte · Canal 4')
  expect(json).not.toHaveProperty('filters')
  expect(json.timeline).toEqual([])
  expect(Object.keys(json)).toHaveLength(8)
  await page.screenshot({ path: info.outputPath('elements-desktop-mobile.png') })
  await page.reload(); await expect(page.locator('[data-module]')).toHaveCount(0)
  await open(page, 'Pizarra'); await open(page, 'Elementos')
  await expect(board.getByRole('button', { name: 'Seleccionar Ruta', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect((await saved(page)).elements).toEqual(json.elements)
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'elementos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(module.getByRole('group', { name: 'Filtrar dotaciones por estado' })).toHaveCount(0)
  await expect(pin).toBeVisible()
  await expect(pin).toHaveAttribute('aria-pressed', 'false')
  expect(errors).toEqual([])
})

test('ratón: clic breve no mueve, arrastre mantenido y escala máxima respetan la caja; lápiz y goma no manipulan pines', async ({ page }, info) => {
  await create(page, 'Tango', false)
  await expect.poll(async () => (await saved(page)).elements.length).toBe(1)
  const pin = page.locator('.board-pin-visual'), center = await point(page, 500, 500), end = await point(page, 990, 990)
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + 5, center.y + 5); await page.mouse.up()
  expect((await saved(page)).elements[0]!.position).toEqual({ x: 500, y: 500 })
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.waitForTimeout(280); await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).elements[0]!.position).toEqual({ x: 925, y: 950 })
  await action(page, 'Modificar'); await page.getByLabel('Escala del icono').fill('3')
  await expect.poll(async () => (await saved(page)).elements[0]!.position).toEqual({ x: 775, y: 850 })
  await page.getByRole('button', { name: 'Guardar elemento' }).click()
  const before = (await saved(page)).elements
  for (const mode of ['Lápiz', 'Goma']) {
    await page.getByRole('radio', { name: mode, exact: true }).click()
    const p = await point(page, 775, 800), q = await point(page, 500, 600)
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(280); await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up()
    await expect(pin).toBeVisible(); expect((await saved(page)).elements).toEqual(before)
  }
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(2)
  await page.getByRole('radio', { name: 'Seleccionar/mover', exact: true }).click()
  const surface = (await page.getByTestId('board-surface').boundingBox())!, pinBox = (await page.locator('.board-pin').boundingBox())!
  expect(pinBox.x).toBeGreaterThanOrEqual(surface.x - 1); expect(pinBox.y).toBeGreaterThanOrEqual(surface.y - 1)
  expect(pinBox.x + pinBox.width).toBeLessThanOrEqual(surface.x + surface.width + 1)
  expect(pinBox.y + pinBox.height).toBeLessThanOrEqual(surface.y + surface.height + 1)
  await page.screenshot({ path: info.outputPath('pin-maximum-edge.png') })
})

test('catálogo real carga los nueve PNG, teclado selecciona y el tamaño mínimo mantiene scroll interno', async ({ page }, info) => {
  for (const id of ['ambulance', 'pathfinder', 'quad', 'checkpoint', 'hydration', 'start', 'finish', 'warning', 'pushpin']) await create(page, id, false, id)
  for (const image of await page.locator('.board-pin-visual img').all()) {
    expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect(image).toHaveCSS('object-fit', 'contain'); await expect(image).toHaveCSS('object-position', '50% 50%')
  }
  const module = page.locator('[data-module="elements"]')
  const select = module.getByRole('button', { name: 'Seleccionar ambulance', exact: true })
  await select.focus(); await page.keyboard.press('Enter')
  await expect(select).toHaveAttribute('aria-pressed', 'true'); await expect(select).toHaveCSS('outline-style', 'solid')
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const handle = (await module.locator('.react-resizable-handle-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
  await page.mouse.move(handle.x - 90 * scale, handle.y - 190 * scale, { steps: 8 }); await page.mouse.up()
  await expect(module).toHaveAttribute('data-width', '220'); await expect(module).toHaveAttribute('data-height', '240')
  expect(await module.locator('.elements-list').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
  await page.screenshot({ path: info.outputPath('elements-minimum.png') })
})

test('tacto: mueve y redimensiona con un dedo; dos dedos cancelan cambios y selección accidental', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil Chromium')
  await create(page, 'Tango', false)
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const center = await point(page, 500, 500), finger = { ...center, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(280); await touch('touchMove', [{ ...finger, x: finger.x + 12 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await saved(page)).elements[0]!.position!.x).toBeGreaterThan(550)
  let handle = (await page.getByRole('button', { name: 'Redimensionar Tango' }).boundingBox())!
  const resize = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, id: 1 }
  await touch('touchStart', [resize]); await touch('touchMove', [{ ...resize, x: resize.x + 8, y: resize.y + 5 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await saved(page)).elements[0]!.visual).toMatchObject({ scale: expect.any(Number) })
  const before = (await saved(page)).elements
  expect(before[0]!.visual.type === 'asset' && before[0]!.visual.scale).toBeGreaterThan(1)
  for (const kind of ['move', 'resize']) {
    const rect = kind === 'move' ? (await page.locator('.board-pin-visual').boundingBox())! : (await page.getByRole('button', { name: 'Redimensionar Tango' }).boundingBox())!
    const a = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }, b = { x: a.x - 30, y: a.y - 30, id: 2 }
    await touch('touchStart', [a]); await page.waitForTimeout(280); await touch('touchMove', [{ ...a, x: a.x + 3 }])
    await touch('touchStart', [{ ...a, x: a.x + 3 }, b]); await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
    await touch('touchMove', [{ ...a, x: a.x + 10 }, { ...b, x: b.x - 10 }]); await touch('touchEnd', [])
    expect((await saved(page)).elements).toEqual(before)
    await page.getByRole('button', { name: 'Encajar' }).click()
  }
  handle = (await page.getByRole('button', { name: 'Redimensionar Tango' }).boundingBox())!
  expect(handle.width).toBeGreaterThan(0)
  const blankA = { ...await point(page, 100, 100), id: 1 }, blankB = { ...await point(page, 300, 100), id: 2 }
  await touch('touchStart', [blankA]); await touch('touchStart', [blankA, blankB])
  await touch('touchMove', [{ ...blankA, x: blankA.x - 5 }, { ...blankB, x: blankB.x + 5 }]); await touch('touchEnd', [])
  await expect(page.locator('.board-pin-visual')).toHaveAttribute('aria-pressed', 'true')
})
