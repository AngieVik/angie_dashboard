import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'
import { bringModuleToFront, createElement as createVisibleElement, fileCommand, loadDocument, noPageScroll } from './acceptance-helpers'
import { createElement as createFixtureElement } from '../../src/features/elements/elementCommands'
import { changeElementStatus } from '../../src/domain/operations/changeStatus'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
async function action(page: Page, name: string, moduleName = 'Elementos') {
  await bringModuleToFront(page, moduleName)
  const module = page.getByRole('region', { name: moduleName, exact: true })
  const rows = module.locator('.element-row[data-selected="true"]')
  const target = name === 'Crear' ? module : await rows.count() ? rows : module.locator('.element-row').first()
  await target.getByRole('button', { name, exact: true }).click()
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
async function create(page: Page, name: string, isUnit = false, icon = 'checkpoint', emoji?: string) {
  // Historical movement cases keep their known position via the closed-board rule.
  await bringModuleToFront(page, 'Pizarra')
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click()
  const moduleName = isUnit ? 'Dotaciones' : 'Elementos'
  if (!await page.locator('[data-module="' + (isUnit ? 'dotations' : 'elements') + '"]').count()) await open(page, moduleName)
  await action(page, 'Crear', moduleName)
  await page.getByLabel('Nombre', { exact: true }).fill(name)
  if (emoji) {
    await page.getByRole('radio', { name: 'Emoji', exact: true }).click()
    await page.getByRole('textbox', { name: 'Emoji', exact: true }).fill(emoji)
  } else await page.getByLabel('Pin', { exact: true }).selectOption(icon)
  await page.getByLabel('Información', { exact: true }).fill('Acceso norte · Canal 4')
  await page.getByRole('region', { name: moduleName, exact: true }).getByRole('button', { name: 'Crear', exact: true }).click()
  await open(page, 'Pizarra')
}
async function point(page: Page, x: number, y: number) {
  await bringModuleToFront(page, 'Pizarra')
  return page.getByTestId('board-surface').evaluate((el, point) => {
    const rect = el.getBoundingClientRect(), scale = Number(el.getAttribute('data-scale'))
    return { x: rect.x + (point.x * scale + Number(el.getAttribute('data-offset-x'))) * rect.width / el.clientWidth,
      y: rect.y + (point.y * scale + Number(el.getAttribute('data-offset-y'))) * rect.height / el.clientHeight }
  }, { x, y })
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

test('borrador, preview estable y acciones visibles en tamaños mínimo, inicial y ampliado', async ({ page, isMobile }, info) => {
  const module = page.locator('[data-module="elements"]')
  await bringModuleToFront(page, 'Elementos')
  await expect(module.getByRole('button', { name: 'Crear', exact: true })).toBeEnabled()
  for (const name of ['Modificar', 'Duplicar', 'Quitar']) await expect(module.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(module.getByRole('button', { name: 'Configurar elementos' })).toHaveCount(0)
  await create(page, 'Nombre largo de punto de cobertura norte', false, 'hydration')
  await expect.poll(async () => (await saved(page)).elements.length).toBe(1)
  const before = await saved(page)
  await action(page, 'Modificar')
  await page.getByLabel('Nombre', { exact: true }).fill('Borrador descartado')
  await page.getByLabel('Información', { exact: true }).fill('Texto descartado')
  await page.getByLabel('Escala', { exact: true }).fill('200')
  const preview = module.getByRole('img', { name: 'Previsualización del elemento' })
  await expect(preview.locator('.element-preview-pin')).toHaveCSS('width', '200px')
  await expect(preview.locator('.element-preview-pin')).toHaveCSS('height', '300px')
  await expect(preview.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
  await page.getByRole('radio', { name: 'Emoji', exact: true }).click(); await page.getByRole('textbox', { name: 'Emoji', exact: true }).fill('📍')
  await expect(preview.locator('.element-preview-pin')).toHaveCSS('width', '128px')
  await expect(preview.locator('.board-pin-emoji')).toHaveCSS('font-size', '96px')
  await page.waitForTimeout(400)
  expect((await saved(page)).elements).toEqual(before.elements)
  expect((await saved(page)).document.updatedAt).toBe(before.document.updatedAt)
  await page.getByRole('button', { name: 'Atrás', exact: true }).click()
  expect((await saved(page)).elements).toEqual(before.elements)
  await action(page, 'Modificar')
  const states = [{ width: 220, height: 240, scale: .5 }, { width: 300, height: 420, scale: 1 }, { width: isMobile ? 340 : 380, height: 600, scale: 3 }]
  for (const mode of ['edit', 'create']) {
    if (mode === 'create') {
      await page.getByRole('button', { name: 'Atrás', exact: true }).click()
      await action(page, 'Crear')
      await page.getByLabel('Nombre', { exact: true }).fill('Nombre largo de punto de cobertura norte')
      await page.getByLabel('Pin', { exact: true }).selectOption('hydration')
    }
  for (const state of states) {
    const handle = (await module.locator('.react-resizable-handle-se').boundingBox())!
    const currentWidth = Number(await module.getAttribute('data-width')), currentHeight = Number(await module.getAttribute('data-height'))
    const mainScale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + (state.width - currentWidth) * mainScale,
      handle.y + handle.height / 2 + (state.height - currentHeight) * mainScale, { steps: 8 }); await page.mouse.up()
    await expect(module).toHaveAttribute('data-width', String(state.width))
    await page.getByLabel('Escala', { exact: true }).fill(String(state.scale * 100))
    await preview.scrollIntoViewIfNeeded()
    await expect(preview.locator('.element-preview-scene')).toHaveCSS('height', `${150 * state.scale + 12}px`)
    await expect(preview.locator('.element-preview-pin')).toHaveCSS('width', `${100 * state.scale}px`)
    await expect(preview.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
    await expect(module.getByRole('button', { name: 'Atrás', exact: true })).toBeVisible()
    await noPageScroll(page)
    await page.screenshot({ path: info.outputPath(`element-${mode}-png-${state.width}.png`) })
    await page.getByRole('radio', { name: 'Emoji', exact: true }).click()
    await page.getByRole('textbox', { name: 'Emoji', exact: true }).fill('📍')
    await preview.scrollIntoViewIfNeeded()
    await expect(preview.locator('.element-preview-pin')).toHaveCSS('width', `${64 * state.scale}px`)
    await expect(preview.locator('.board-pin-emoji')).toHaveCSS('font-size', `${48 * state.scale}px`)
    await expect(preview.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
    await page.screenshot({ path: info.outputPath(`element-${mode}-emoji-${state.width}.png`) })
    await page.getByRole('radio', { name: 'PNG', exact: true }).click()
  }
  }
  await page.getByRole('button', { name: 'Atrás', exact: true }).click()
  expect((await saved(page)).elements).toEqual(before.elements)
})

test('crear usa cámara actual sin navegar; cerrar o cambiar documento descarta su centro', async ({ page }) => {
  const surface = page.getByTestId('board-surface')
  await bringModuleToFront(page, 'Pizarra')
  const box = (await surface.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, { steps: 5 })
  await page.mouse.up({ button: 'middle' })
  await expect.poll(async () => Number(await surface.getAttribute('data-offset-y'))).toBeLessThan(0)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control')
  await expect.poll(async () => Number(await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).inputValue())).toBeGreaterThan(100)
  await expect(surface).toHaveAttribute('data-scale', '1')
  const camera = await surface.evaluate(el => ({ scale: Number(el.getAttribute('data-scale')), x: Number(el.getAttribute('data-offset-x')), y: Number(el.getAttribute('data-offset-y')), width: el.clientWidth, height: el.clientHeight }))
  const expected = { x: Math.max(0, (camera.width / 2 - camera.x) / camera.scale), y: Math.max(0, (camera.height / 2 - camera.y) / camera.scale) }
  await createVisibleElement(page, 'Centro visible', false, '📍')
  await expect.poll(async () => (await saved(page)).elements[0]?.position).toEqual(expected)
  expect(await surface.evaluate(el => [Number(el.getAttribute('data-scale')), Number(el.getAttribute('data-offset-x')), Number(el.getAttribute('data-offset-y'))])).toEqual([camera.scale, camera.x, camera.y])
  await bringModuleToFront(page, 'Pizarra'); await page.getByRole('button', { name: 'Cerrar Pizarra' }).click()
  await createVisibleElement(page, 'Cerrada', false, '📍')
  await expect.poll(async () => (await saved(page)).elements[1]?.position).toEqual({ x: 500, y: 500 })
  await open(page, 'Pizarra')
  const original = (await saved(page)).elements
  await createVisibleElement(page, 'No mover anteriores', false, '📍')
  expect((await saved(page)).elements.slice(0, 2)).toEqual(original)
  await fileCommand(page, 'Nuevo')
  await expect(page.locator('.board-pin')).toHaveCount(0)
  await createVisibleElement(page, 'Documento vacío', false, '📍')
  const emptyCenter = await surface.evaluate(el => ({ x: el.clientWidth / 2, y: el.clientHeight / 2 }))
  await expect.poll(async () => (await saved(page)).elements[0]?.position).toEqual(emptyCenter)
  const loaded = createEmptyDocument('Centro nuevo')
  loaded.board.quickNotes = [{ id: crypto.randomUUID(), title: '', scale: 1, text: 'Referencia', position: { x: 2000, y: 1600 }, width: 220, height: 96 }]
  await loadDocument(page, loaded)
  await expect(surface).toHaveAttribute('data-scale', '1')
  await createVisibleElement(page, 'Documento cargado', false, '📍')
  await expect.poll(async () => (await saved(page)).elements[0]?.position).toEqual({ x: 2000, y: 1600 })
})

test('emoji: tirador y editor sincronizados, letra independiente, duplicación y JSON/recarga', async ({ page, context, isMobile }, info) => {
  await create(page, 'Referencia emoji con nombre largo', false, 'ambulance', '📍')
  await action(page, 'Modificar'); await page.getByLabel('Escala', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]!.visual.scale).toBe(.5)
  await action(page, 'Modificar')
  await bringModuleToFront(page, 'Pizarra')
  const pin = page.locator('.board-pin'), handle = page.getByRole('button', { name: 'Redimensionar Referencia emoji con nombre largo' })
  await expect(pin).toHaveCSS('width', '32px'); await expect(pin.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
  const box = (await handle.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2
  const scale = Number(await page.getByTestId('board-surface').getAttribute('data-scale')) * Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  if (isMobile) {
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 48 * scale, y: y + 48 * scale, id: 1 }] })
    await expect(pin).toHaveCSS('width', '128px')
    expect((await saved(page)).elements[0]!.visual.scale).toBe(.5)
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 48 * scale, y + 48 * scale, { steps: 6 })
    await expect(pin).toHaveCSS('width', '128px')
    expect((await saved(page)).elements[0]!.visual.scale).toBe(.5)
    await page.mouse.up()
  }
  await expect.poll(async () => (await saved(page)).elements[0]!.visual.scale).toBeCloseTo(2, 5)
  await expect(pin.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
  await expect(pin.locator('.board-pin-emoji')).toHaveCSS('font-size', '96px')
  expect((await saved(page)).elements[0]!.position).toEqual({ x: 500, y: 500 })
  await page.screenshot({ path: info.outputPath('emoji-scaled.png') })
  await bringModuleToFront(page, 'Elementos'); await expect(page.getByLabel('Escala', { exact: true })).toHaveValue('200')
  await page.getByRole('button', { name: 'Atrás' }).click(); await action(page, 'Duplicar')
  await expect.poll(async () => (await saved(page)).elements.length).toBe(2)
  expect((await saved(page)).elements[1]).toMatchObject({ visual: { type: 'emoji', value: '📍', scale: 2 }, position: { x: 524, y: 524 } })
  const json = await exportJson(page)
  await page.reload(); await open(page, 'Pizarra'); await open(page, 'Elementos')
  expect((await saved(page)).elements).toEqual(json.elements)
  await expect(page.locator('.board-pin').first()).toHaveCSS('width', '128px')
  await expect(page.locator('.board-pin-name').first()).toHaveCSS('font-size', '16px')
  await loadDocument(page, json)
  await expect(page.locator('.board-pin').first()).toHaveCSS('width', '128px')
  await noPageScroll(page)
})

test('CRUD, selección compartida, escala sincronizada, ausencia de filtros, JSON y recuperación', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await create(page, 'Tango 1', true, 'ambulance')
  const module = page.locator('[data-module="dotations"]'), board = page.locator('[data-module="board"]')
  await expect(board.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await action(page, 'Modificar', 'Dotaciones')
  await expect(page.getByLabel('Pin', { exact: true })).toHaveValue('ambulance')
  await expect(page.getByRole('checkbox', { name: 'Dotación' })).toHaveCount(0)
  await page.getByLabel('Escala', { exact: true }).fill('150')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(async () => (await saved(page)).elements[0]?.visual).toEqual({ type: 'asset', assetId: 'ambulance', scale: 1.5 })
  const beforeSize = await board.locator('.board-pin-visual').evaluate(el => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
  expect(beforeSize).toEqual({ w: 225, h: 150 })
  await bringModuleToFront(page, 'Pizarra')
  const handle = board.getByRole('button', { name: 'Redimensionar Tango 1' }), box = (await handle.boundingBox())!
  const physicalScale = Number(await page.getByTestId('board-surface').getAttribute('data-scale')) * Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 37.5 * physicalScale, box.y + box.height / 2 + 25 * physicalScale, { steps: 6 }); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).elements[0]!.visual.scale).toBeCloseTo(2, 1)
  await expect(board.locator('.board-pin-name')).toHaveCSS('font-size', '16px')
  await expect(board.locator('.board-pin-visual img')).toHaveCSS('object-fit', 'contain')
  await action(page, 'Modificar', 'Dotaciones')
  await expect.poll(async () => Number(await page.getByLabel('Escala', { exact: true }).inputValue()) / 100).toBeCloseTo(2, 1)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await action(page, 'Duplicar', 'Dotaciones')
  await expect(module.getByRole('button', { name: 'Seleccionar Tango 1 copia', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await saved(page)).elements.length).toBe(2)
  const copied = (await saved(page)).elements
  expect(copied[1]!.id).not.toBe(copied[0]!.id)
  expect(copied[1]!.position).toEqual({ x: 524, y: 524 })
  expect(copied[1]!.operational).toEqual({ status: null, currentEntryId: null, notes: '', tags: [] })
  await action(page, 'Quitar', 'Dotaciones')
  await create(page, 'Ruta', false, 'ambulance', '🚴🏽‍♂️')
  const pin = board.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })
  // The new emoji shares the initial center. Select the exposed corner of the PNG.
  await bringModuleToFront(page, 'Pizarra')
  await pin.click({ position: { x: 2, y: 2 } })
  await expect(module.getByRole('button', { name: 'Seleccionar Tango 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const blankSurface = (await page.getByTestId('board-surface').boundingBox())!
  await page.mouse.click(blankSurface.x + 20, blankSurface.y + 20)
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
  await expect.poll(async () => (await saved(page)).elements[0]!.position).toEqual({ x: 990, y: 990 })
  await action(page, 'Modificar'); await page.getByLabel('Escala', { exact: true }).fill('300')
  await expect.poll(async () => (await saved(page)).elements[0]!.position).toEqual({ x: 990, y: 990 })
  await page.getByRole('button', { name: 'Guardar' }).click()
  await bringModuleToFront(page, 'Pizarra')
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click(); await open(page, 'Pizarra')
  const before = (await saved(page)).elements
  for (const mode of ['Lápiz', 'Goma']) {
    await page.getByRole('radio', { name: mode, exact: true }).click()
    const p = await point(page, 990, 990), q = await point(page, 950, 900)
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(280); await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up()
    await expect(pin).toBeVisible(); expect((await saved(page)).elements).toEqual(before)
  }
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(2)
  await page.getByRole('radio', { name: 'Seleccionar/mover', exact: true }).click()
  const zoomPoint = await point(page, 990, 990)
  await page.mouse.move(zoomPoint.x, zoomPoint.y); await page.keyboard.down('Control')
  for (let step = 0; step < 3; step++) await page.mouse.wheel(0, 350)
  await page.keyboard.up('Control')
  await expect.poll(async () => Number(await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).inputValue())).toBeLessThan(60)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-scale', '1')
  const surface = (await page.getByTestId('board-surface').boundingBox())!, pinBox = (await page.locator('.board-pin').boundingBox())!
  expect(pinBox.x).toBeGreaterThanOrEqual(surface.x - 1); expect(pinBox.y).toBeGreaterThanOrEqual(surface.y - 1)
  expect(pinBox.x + pinBox.width).toBeLessThanOrEqual(surface.x + surface.width + 1)
  expect(pinBox.y + pinBox.height).toBeLessThanOrEqual(surface.y + surface.height + 1)
  await page.screenshot({ path: info.outputPath('pin-maximum-edge.png') })
})

test('catálogo real carga los nueve PNG, teclado selecciona y el tamaño mínimo mantiene scroll interno', async ({ page }, info) => {
  for (const id of ['ambulance', 'pathfinder', 'quad', 'checkpoint', 'hydration', 'start', 'finish', 'warning', 'pushpin']) await create(page, id, ['ambulance', 'pathfinder', 'quad'].includes(id), id)
  for (const image of await page.locator('.board-pin-visual img').all()) {
    expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect(image).toHaveCSS('object-fit', 'contain'); await expect(image).toHaveCSS('object-position', '50% 50%')
  }
  const module = page.locator('[data-module="elements"]')
  const select = module.getByRole('button', { name: 'Seleccionar checkpoint', exact: true })
  await select.focus(); await page.keyboard.press('Enter')
  await expect(select).toHaveAttribute('aria-pressed', 'true'); await expect(select).toHaveCSS('outline-style', 'solid')
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const handle = (await module.locator('.react-resizable-handle-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + (220 - Number(await module.getAttribute('data-width'))) * scale, handle.y + handle.height / 2 + (240 - Number(await module.getAttribute('data-height'))) * scale, { steps: 8 }); await page.mouse.up()
  await expect(module).toHaveAttribute('data-width', '220'); await expect(module).toHaveAttribute('data-height', '240')
  await expect(module.locator('.elements-list')).toHaveCSS('overflow-y', 'auto')
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
  const physicalScale = Number(await page.getByTestId('board-surface').getAttribute('data-scale')) * Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  await expect.poll(async () => (await saved(page)).elements[0]!.position!.x).toBeCloseTo(500 + 12 / physicalScale, 1)
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
  const blankSurface = (await page.getByTestId('board-surface').boundingBox())!
  const blankA = { x: blankSurface.x + 20, y: blankSurface.y + 20, id: 1 }, blankB = { x: blankSurface.x + 80, y: blankSurface.y + 20, id: 2 }
  await touch('touchStart', [blankA]); await touch('touchStart', [blankA, blankB])
  await touch('touchMove', [{ ...blankA, x: blankA.x - 5 }, { ...blankB, x: blankB.x + 5 }]); await touch('touchEnd', [])
  await expect(page.locator('.board-pin-visual')).toHaveAttribute('aria-pressed', 'true')
})


test('entrega 6: visibilidad conserva selección e historial; letra independiente persiste y radios validan', async ({ page }, info) => {
  await page.clock.install()
  const document = createEmptyDocument('Entrega 6')
  const unit = createFixtureElement(document, { name: 'Tango norte', information: 'Canal 4', isUnit: true, nameFontSize: 24, visual: { type: 'asset', assetId: 'ambulance', scale: 1 } })
  Object.assign(document, changeElementStatus(document, unit.id, 'Activada', new Date()))
  const source = document.elements[0]!
  if (source.isUnit) { source.operational.notes = 'Cobertura norte'; source.operational.tags = ['Radio'] }
  await loadDocument(page, document); await open(page, 'Dotaciones')
  const module = page.locator('[data-module="dotations"]')
  const row = module.locator('.element-row').first()
  await row.getByRole('button', { name: 'Seleccionar Tango norte' }).press('Enter')
  const before = await saved(page)
  await row.getByRole('button', { name: 'Ocultar pin de Tango norte' }).press('Enter')
  await expect(page.locator('.board-pin')).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Seleccionar Tango norte' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await saved(page)).elements[0]).toEqual({ ...before.elements[0], pinVisible: false })
  expect((await saved(page)).timeline).toEqual(before.timeline)
  await row.getByRole('button', { name: 'Duplicar' }).press('Enter')
  await expect.poll(async () => (await saved(page)).elements.length).toBe(2)
  expect((await saved(page)).elements[1]).toMatchObject({ pinVisible: false, nameFontSize: 24, operational: { status: null, currentEntryId: null, notes: '', tags: [] } })
  expect((await saved(page)).timeline).toEqual(before.timeline)
  await row.getByRole('button', { name: 'Mostrar pin de Tango norte' }).press('Enter')
  await expect(page.locator('.board-pin')).toHaveCount(1)
  await expect.poll(async () => (await saved(page)).elements[0]?.position).toEqual(before.elements[0]!.position)
  await row.getByRole('button', { name: 'Modificar' }).press('Enter')
  const png = module.getByRole('radio', { name: 'PNG', exact: true }), emoji = module.getByRole('radio', { name: 'Emoji', exact: true })
  await png.focus()
  await page.keyboard.down('ArrowRight'); await page.clock.runFor(1); await page.keyboard.up('ArrowRight')
  await expect(emoji).toBeChecked(); await expect(png).not.toBeChecked()
  await module.getByRole('textbox', { name: 'Emoji', exact: true }).fill('📍')
  await module.getByLabel('Nombre', { exact: true }).fill('')
  await module.getByRole('button', { name: 'Guardar', exact: true }).press('Enter')
  await expect(module.getByRole('alert')).toBeVisible()
  await page.clock.fastForward(5001)
  await expect(module.getByRole('alert')).toHaveCount(0)
  await expect(module.getByLabel('Nombre', { exact: true })).toHaveAttribute('aria-invalid', 'false')
  await module.getByRole('button', { name: 'Guardar', exact: true }).press('Enter')
  await expect(module.getByRole('alert')).toBeVisible()
  await module.getByLabel('Nombre', { exact: true }).fill('Tango norte')
  await module.getByLabel('Escala', { exact: true }).fill('200')
  await module.getByRole('slider', { name: 'Escala del icono' }).press('End')
  await expect(module.getByLabel('Escala', { exact: true })).toHaveValue('300')
  await module.getByRole('slider', { name: 'Escala del icono' }).press('Home')
  await expect(module.getByLabel('Escala', { exact: true })).toHaveValue('25')
  await module.getByLabel('Escala', { exact: true }).fill('200')
  await module.getByLabel('Tamaño de letra del nombre').fill('36')
  await expect(module.locator('.element-preview-pin .board-pin-name')).toHaveCSS('font-size', '36px')
  await module.getByRole('button', { name: 'Guardar', exact: true }).press('Enter')
  await expect.poll(async () => (await saved(page)).elements[0]?.nameFontSize).toBe(36)
  await expect(page.locator('.board-pin-name')).toHaveCSS('font-size', '36px')
  const json = await exportJson(page)
  await page.reload(); await open(page, 'Pizarra'); await open(page, 'Dotaciones')
  expect((await saved(page)).elements).toEqual(json.elements)
  await expect(page.locator('.board-pin-name')).toHaveCSS('font-size', '36px')
  await loadDocument(page, json)
  expect((await saved(page)).timeline).toEqual(before.timeline)
  await bringModuleToFront(page, 'Dotaciones')
  await page.screenshot({ path: info.outputPath('phase6-list.png') })
})

test('entrega 6: legado fuera de catálogo, Atrás y cierre descartan todo el borrador', async ({ page }) => {
  const document = createEmptyDocument('Legado')
  const element = createFixtureElement(document, { name: 'Legado', isUnit: true, information: '', visual: { type: 'asset', assetId: 'warning', scale: 1 } })
  delete element.nameFontSize
  await loadDocument(page, document); await open(page, 'Dotaciones')
  const module = page.locator('[data-module="dotations"]')
  await module.getByRole('button', { name: 'Modificar' }).press('Enter')
  expect(await module.getByLabel('Pin', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value))).toEqual(['warning', 'ambulance', 'pathfinder', 'quad'])
  await module.getByLabel('Nombre', { exact: true }).fill('Borrador')
  await module.getByLabel('Pin', { exact: true }).selectOption('quad')
  await module.getByLabel('Tamaño de letra del nombre').fill('48')
  await module.getByRole('button', { name: 'Atrás' }).press('Enter')
  await expect(module.getByRole('button', { name: 'Seleccionar Legado' })).toHaveAttribute('aria-pressed', 'false')
  expect((await saved(page)).elements).toEqual(document.elements)
  await module.getByRole('button', { name: 'Modificar' }).press('Enter')
  await module.getByLabel('Nombre', { exact: true }).fill('Legado editado')
  await module.getByRole('button', { name: 'Guardar' }).press('Enter')
  await expect.poll(async () => (await saved(page)).elements[0]?.name).toBe('Legado editado')
  expect((await saved(page)).elements[0]?.visual).toEqual(element.visual)
  await module.getByRole('button', { name: 'Crear', exact: true }).press('Enter')
  await module.getByLabel('Nombre', { exact: true }).fill('No crear')
  await module.getByRole('button', { name: 'Cerrar Dotaciones' }).press('Enter')
  await open(page, 'Dotaciones')
  await expect(module.getByLabel('Nombre', { exact: true })).toHaveCount(0)
  expect((await saved(page)).elements).toHaveLength(1)
})

test('entrega 6: listas largas y editor con ambos zooms sin scroll de página', async ({ page }, info) => {
  await bringModuleToFront(page, 'Pizarra'); await page.getByRole('button', { name: 'Cerrar Pizarra' }).click()
  const document = createEmptyDocument('Listas')
  for (let index = 0; index < 14; index++) createFixtureElement(document, { name: `Dotación ${index} con nombre operativo completo de cobertura norte`, isUnit: true, information: 'Información de varias líneas\nAcceso norte', visual: { type: 'asset', assetId: 'ambulance', scale: 1 } })
  await loadDocument(page, document); await open(page, 'Dotaciones')
  const module = page.locator('[data-module="dotations"]')
  await bringModuleToFront(page, 'Dotaciones')
  for (const [general, individual] of [[25, 25], [100, 100], [200, 100], [100, 200], [400, 100], [100, 400]]) {
    const zoom = page.getByRole('spinbutton', { name: 'Zoom actual', exact: true })
    await zoom.fill(String(general)); await zoom.press('Enter')
    const own = module.getByRole('spinbutton', { name: 'Zoom de Dotaciones', exact: true })
    await own.fill(String(individual)); await own.press('Enter')
    await noPageScroll(page)
    await expect(module.locator('.elements-list')).toHaveCSS('overflow-y', 'auto')
    await page.screenshot({ path: info.outputPath(`phase6-list-${general}-${individual}.png`) })
    await module.locator('.element-row').first().getByRole('button', { name: 'Modificar' }).press('Enter')
    await module.getByLabel('Información').fill('Línea 1\nLínea 2\nLínea 3')
    await noPageScroll(page)
    await page.screenshot({ path: info.outputPath(`phase6-editor-${general}-${individual}.png`) })
    await module.getByRole('button', { name: 'Atrás', exact: true }).press('Enter')
  }
  expect((await saved(page)).elements).toEqual(document.elements)
})


test('entrega 6: tecleo y preview de letra grande sobre icono pequeño', async ({ page }) => {
  await bringModuleToFront(page, 'Elementos')
  const module = page.locator('[data-module="elements"]')
  await module.getByRole('button', { name: 'Crear', exact: true }).press('Enter')
  await module.getByLabel('Nombre', { exact: true }).fill('CP')
  await module.getByRole('radio', { name: 'Emoji', exact: true }).press('Space')
  await module.getByRole('textbox', { name: 'Emoji', exact: true }).fill('📍')
  const letter = module.getByLabel('Tamaño de letra del nombre')
  await letter.focus(); await letter.press('ControlOrMeta+A'); await letter.pressSequentially('32'); await letter.press('Tab')
  await expect(letter).toHaveValue('32')
  const scale = module.getByLabel('Escala', { exact: true })
  await scale.focus(); await scale.press('ControlOrMeta+A'); await scale.pressSequentially('100'); await scale.press('Tab')
  await expect(scale).toHaveValue('100')
  await scale.fill(''); await scale.press('Tab'); await expect(scale).toHaveValue('100')
  await scale.fill('25'); await scale.press('Tab')
  await letter.fill('72'); await letter.press('Tab')
  const scene = module.locator('.element-preview-scene'), label = module.locator('.element-preview-pin .board-pin-name')
  const sceneBox = (await scene.boundingBox())!, labelBox = (await label.boundingBox())!
  expect(labelBox.y).toBeGreaterThanOrEqual(sceneBox.y)
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(sceneBox.y + sceneBox.height)
  await module.getByRole('button', { name: 'Crear', exact: true }).press('Enter')
  await expect.poll(async () => (await saved(page)).elements[0]).toMatchObject({ nameFontSize: 72, visual: { scale: .25 } })
})


test('entrega 6: preview sin recorte de etiqueta mayor que el icono', async ({ page }) => {
  await bringModuleToFront(page, 'Elementos')
  const module = page.locator('[data-module="elements"]')
  await module.getByRole('button', { name: 'Crear', exact: true }).press('Enter')
  await module.getByLabel('Nombre', { exact: true }).fill('CP')
  await module.getByRole('radio', { name: 'Emoji', exact: true }).press('Space')
  await module.getByRole('textbox', { name: 'Emoji', exact: true }).fill('📍')
  await module.getByLabel('Escala', { exact: true }).fill('25')
  await module.getByLabel('Escala', { exact: true }).press('Tab')
  await module.getByLabel('Tamaño de letra del nombre').fill('72')
  await module.getByLabel('Tamaño de letra del nombre').press('Tab')
  const sceneBox = (await module.locator('.element-preview-scene').boundingBox())!
  const labelBox = (await module.locator('.element-preview-pin .board-pin-name').boundingBox())!
  expect(labelBox.y).toBeGreaterThanOrEqual(sceneBox.y)
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(sceneBox.y + sceneBox.height)
})


test('cabecera única, nombres automáticos y ocultar nombre persisten sin duplicar acciones', async ({ page }, info) => {
  const fixture = createEmptyDocument('Mejoras de elementos')
  for (const id of ['board', 'elements', 'dotations'] as const) {
    fixture.moduleLayouts[id] = { x: 0, y: 0, width: 280, height: 360, referenceSize: { width: 1440, height: 900 } }
  }
  await loadDocument(page, fixture)
  await page.getByRole('spinbutton', { name: 'Zoom actual', exact: true }).fill('100')
  await page.getByRole('spinbutton', { name: 'Zoom actual', exact: true }).press('Enter')
  for (const [moduleName, automaticName] of [['Elementos', 'E1'], ['Dotaciones', 'D1']]) {
    if (moduleName === 'Dotaciones') await open(page, moduleName!)
    await bringModuleToFront(page, moduleName!)
    const panel = page.getByRole('region', { name: moduleName, exact: true })
    await panel.getByRole('button', { name: 'Crear', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Crear', exact: true })).toHaveCount(1)
    await expect(panel.locator('form button[type="submit"]')).toHaveCount(0)
    const hide = panel.getByRole('checkbox', { name: 'Ocultar', exact: true })
    const hideBox = (await hide.boundingBox())!, fontBox = (await panel.getByLabel('Tamaño de letra del nombre').boundingBox())!
    expect(hideBox.x).toBeGreaterThanOrEqual(fontBox.x + fontBox.width)
    await hide.check()
    await panel.getByRole('button', { name: 'Crear', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Seleccionar ' + automaticName, exact: true })).toBeVisible()
    await panel.getByRole('button', { name: 'Modificar', exact: true }).click()
    await expect(hide).toBeChecked()
    await panel.getByLabel('Nombre', { exact: true }).fill('Borrador')
    await panel.getByRole('button', { name: 'Atrás', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Seleccionar ' + automaticName, exact: true })).toBeVisible()
  }
  await expect.poll(async () => (await saved(page)).elements.map(element => [element.name, element.nameHidden])).toEqual([['E1', true], ['D1', true]])
  await expect(page.locator('.board-pin-name')).toHaveCount(0)
  await page.reload()
  await open(page, 'Dotaciones')
  const panel = page.getByRole('region', { name: 'Dotaciones', exact: true })
  await panel.getByRole('button', { name: 'Modificar', exact: true }).click()
  await expect(panel.getByRole('checkbox', { name: 'Ocultar' })).toBeChecked()
  await panel.getByRole('checkbox', { name: 'Ocultar' }).uncheck()
  await panel.getByLabel('Nombre', { exact: true }).fill('ABCDEFGHIJKLM')
  await page.screenshot({ path: info.outputPath('formulario-cabecera.png') })
  await panel.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(panel.locator('.element-row-text strong > span')).toHaveText(['ABCDEF', 'GHIJKL'])
  await expect(panel.locator('.element-row-status, .ui-badge')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('dotaciones-dos-lineas.png') })
})
