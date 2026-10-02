import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { downloadDocument } from './acceptance-helpers'

async function toggle(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
}
async function geometry(page: Page, id: string) {
  return page.locator(`[data-module="${id}"]`).evaluate(el => ({
    x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')),
    width: Number(el.getAttribute('data-width')), height: Number(el.getAttribute('data-height')),
  }))
}
test('abre y cierra los nueve marcos; conserva distribución, no visibilidad ni viewport', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  const names = ['Pizarra', 'Elementos', 'Información', 'Operativo', 'Coordenadas', 'Reloj', 'Calculadora', 'Cuaderno', 'Registro cronológico']
  for (const name of names) {
    await toggle(page, name)
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ver', exact: true }).click()
    await expect(page.getByRole('menuitemcheckbox', { name, exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: `Cerrar ${name}`, exact: true }).click()
  }
  await toggle(page, 'Pizarra')
  await toggle(page, 'Elementos')
  const available = await page.getByTestId('mobile-viewport').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  const boardGeometry = { x: 0, y: 0, width: Math.min(720, available.width), height: Math.min(480, available.height) }
  expect(await geometry(page, 'board')).toEqual(boardGeometry)
  expect(await geometry(page, 'elements')).toEqual({ x: 0, y: 0, width: 300, height: 420 })
  await page.screenshot({ path: info.outputPath('modules.png') })
  await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await toggle(page, 'Pizarra')
  expect(await geometry(page, 'board')).toEqual(boardGeometry)
  const bounds = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }))
  expect(bounds.width).toBe(bounds.w); expect(bounds.height).toBe(bounds.h)
})

test('arrastra y amplía sobre otro módulo sin modificarlo; conserva mínimos y referencia del gesto', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/')
  const fixture = createEmptyDocument('Superposición')
  fixture.moduleLayouts = {
    board: { x: 0, y: 0, width: 320, height: 220, referenceSize: { width: 1600, height: 1000 } },
    elements: { x: 330, y: 0, width: 220, height: 240, referenceSize: { width: 1600, height: 1000 } },
  }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'overlap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await toggle(page, 'Pizarra'); await toggle(page, 'Elementos')
  const unchanged = await geometry(page, 'elements')
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const header = await page.locator('[data-module="board"] .module-header').boundingBox()
  await page.mouse.move(header!.x + 40 * scale, header!.y + 15 * scale)
  await page.mouse.down(); await page.mouse.move(header!.x + 80 * scale, header!.y + 75 * scale, { steps: 10 });
  await page.mouse.up()
  const moved = await geometry(page, 'board')
  expect(moved).toEqual({ x: 40, y: 60, width: 320, height: 220 })
  expect(await geometry(page, 'elements')).toEqual(unchanged)
  const resize = await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox()
  await page.mouse.move(resize!.x + resize!.width / 2, resize!.y + resize!.height / 2)
  await page.mouse.down(); await page.mouse.move(resize!.x + resize!.width / 2 + 30, resize!.y + resize!.height / 2 + 50, { steps: 8 }); await page.mouse.up()
  const enlarged = await geometry(page, 'board')
  expect(enlarged).toEqual({ x: 40, y: 60, width: 350, height: 270 })
  expect(enlarged.x + enlarged.width).toBeGreaterThan(unchanged.x)
  expect(enlarged.y).toBeLessThan(unchanged.y + unchanged.height)
  expect(await geometry(page, 'elements')).toEqual(unchanged)
  const handle = await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down(); await page.mouse.move(handle!.x - 500 * scale, handle!.y - 400 * scale, { steps: 10 }); await page.mouse.up()
  const shrunk = await geometry(page, 'board')
  expect(shrunk.width).toBe(320); expect(shrunk.height).toBe(220)
  expect(await geometry(page, 'elements')).toEqual(unchanged)
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click(); await toggle(page, 'Pizarra')
  expect(await geometry(page, 'board')).toEqual(shrunk)
  const zoom = await page.getByTestId('mobile-viewport').getAttribute('data-scale')
  expect(Number(zoom)).toBe(scale)
  const referenceSize = await page.locator('.logical-workspace').evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))
  const exported = (await downloadDocument(page)).document
  expect(exported.moduleLayouts.board).toEqual({ ...shrunk, referenceSize })
  expect(exported.moduleLayouts.elements).toEqual(fixture.moduleLayouts.elements)
})

test('sin hueco abre al tamaño inicial adaptado sobre el resto, sin aviso ni excepción', async ({ page }) => {
  const document = createEmptyDocument('Distribución completa')
  document.moduleLayouts.board = { x: 0, y: 0, width: 1600, height: 1000, referenceSize: { width: 1600, height: 1000 } }
  await page.goto('/')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
  await toggle(page, 'Pizarra'); await toggle(page, 'Información')
  const unchanged = await geometry(page, 'board')
  expect(await geometry(page, 'information')).toEqual({ x: Math.floor((unchanged.width - 320) / 2), y: Math.floor((unchanged.height - 240) / 2), width: 320, height: 240 })
  await expect(page.locator('[data-module="information"]')).not.toHaveAttribute('data-exceptional')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('[data-module="information"] .module-frame')).toHaveAttribute('data-active', 'true')
  expect(await geometry(page, 'board')).toEqual(unchanged)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Pizarra', exact: true }).click()
  const header = await page.locator('[data-module="information"] .module-header').boundingBox()
  await page.mouse.move(header!.x + 20, header!.y + header!.height / 2)
  await page.mouse.down(); await page.mouse.move(header!.x + 40, header!.y + header!.height / 2, { steps: 5 }); await page.mouse.up()
  const placed = await geometry(page, 'information')
  await page.getByRole('button', { name: 'Cerrar Información' }).click(); await toggle(page, 'Información')
  expect(await geometry(page, 'information')).toEqual(placed)
})

test('cargar geometrías ocupadas las adapta sin reescribirlas y exporta las referencias originales', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/'); await toggle(page, 'Pizarra'); await toggle(page, 'Elementos')
  const document = createEmptyDocument('Distribución importada')
  document.moduleLayouts = { board: { x: 0, y: 0, width: 720, height: 480, referenceSize: { width: 1600, height: 1000 } }, elements: { x: 0, y: 0, width: 300, height: 420, referenceSize: { width: 1600, height: 1000 } } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
  expect(await geometry(page, 'elements')).toEqual({ x: 0, y: 0, width: 300, height: 420 })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  const downloaded = await downloading
  const json = JSON.parse(await readFile((await downloaded.path())!, 'utf8'))
  expect(json.moduleLayouts).toEqual(document.moduleLayouts)
  expect(json.document.updatedAt).toEqual(document.document.updatedAt)
  expect(Object.keys(json)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
  for (const layout of Object.values(json.moduleLayouts)) expect(Object.keys(layout as object)).toEqual(['x', 'y', 'width', 'height', 'referenceSize'])
})

test('abre y cierra con teclado y conserva el título y el foco accesible', async ({ page }) => {
  await page.goto('/')
  const view = page.getByRole('button', { name: 'Ver', exact: true })
  await view.focus(); await page.keyboard.press('Enter')
  await page.keyboard.press('Home'); await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Pizarra', exact: true })).toBeVisible()
  await view.focus(); await page.keyboard.press('Enter')
  await page.keyboard.press('Home'); await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Pizarra', exact: true })).toHaveCount(0)
  await toggle(page, 'Pizarra')
  const close = page.getByRole('button', { name: 'Cerrar Pizarra' })
  await close.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('[data-module]')).toHaveCount(0)
})

test('cambiar pantalla y orientación conserva el JSON y volver recupera los anclajes guardados', async ({ page }, info) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  const fixture = createEmptyDocument('Anclajes entre pantallas')
  fixture.moduleLayouts.information = { x: 640, y: 380, width: 320, height: 240, referenceSize: { width: 1600, height: 1000 } }
  await page.goto('/')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'anchors.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await toggle(page, 'Información')
  for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1600, height: 1044 }]) {
    await page.setViewportSize(size)
    const logical = page.locator('.logical-workspace')
    await expect.poll(() => logical.evaluate(el => el.clientWidth)).toBe(size.width)
    const presented = await geometry(page, 'information')
    expect(presented.width).toBe(320); expect(presented.height).toBe(240)
    expect(presented.x).toBe(Math.round((size.width - 320) / 2))
    await page.getByRole('button', { name: 'Encajar' }).click()
    await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-scale', '1')
    await expect(page.getByLabel('Zoom actual')).toHaveText('100 %')
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([size.width, size.height])
    await page.screenshot({ path: info.outputPath(`adaptive-${size.width}x${size.height}.png`) })
  }
  expect(await geometry(page, 'information')).toEqual({ x: 640, y: 380, width: 320, height: 240 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  expect(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).toEqual(fixture)
})

test('controles y títulos usan criterios tipográficos comunes y crecen con el módulo', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const fixture = createEmptyDocument('Tipografía común')
  fixture.moduleLayouts = {
    elements: { x: 0, y: 0, width: 300, height: 420, referenceSize: { width: 1920, height: 1036 } },
    coordinates: { x: 400, y: 0, width: 300, height: 420, referenceSize: { width: 1920, height: 1036 } },
  }
  await page.goto('/')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'type.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await toggle(page, 'Elementos'); await toggle(page, 'Coordenadas')
  const controlFont = (id: string) => page.locator(`[data-module="${id}"] .module-content .document-button`).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  const titleFont = (id: string) => page.locator(`[data-module="${id}"] h2`).evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  const before = await controlFont('elements')
  expect(before).toBeGreaterThanOrEqual(13); expect(before).toBeLessThanOrEqual(16)
  expect(await controlFont('coordinates')).toBe(before)
  expect(await titleFont('coordinates')).toBe(await titleFont('elements'))
  expect(await titleFont('elements')).toBeGreaterThanOrEqual(15)
  const handle = await page.locator('[data-module="elements"] .react-resizable-handle-se').boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down(); await page.mouse.move(handle!.x + handle!.width / 2 + 280, handle!.y + handle!.height / 2 + 30, { steps: 8 }); await page.mouse.up()
  expect(await controlFont('elements')).toBeGreaterThan(before)
  expect(await controlFont('elements')).toBeLessThanOrEqual(16)
  expect(await titleFont('elements')).toBeLessThanOrEqual(18)
  await page.screenshot({ path: info.outputPath('adaptive-type.png') })
})

test('un dedo mueve módulos y dos dedos cancelan también resize y controles', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil')
  await page.goto('/'); await toggle(page, 'Pizarra')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const header = await page.locator('[data-module="board"] .module-header').boundingBox()
  // At fit, Chromium adjusts tiny touch targets toward nearby toolbar buttons.
  // Use the open part of the header to exercise dragging unambiguously.
  const x = header!.x + header!.width * 0.65, y = header!.y + header!.height / 2
  await touch('touchStart', [{ x, y, id: 1 }]); await touch('touchMove', [{ x, y: y + 30, id: 1 }]); await touch('touchEnd', [])
  expect((await geometry(page, 'board')).y).toBeGreaterThan(0)
  const before = await geometry(page, 'board')
  const handle = await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox()
  const hx = handle!.x + handle!.width / 2, hy = handle!.y + handle!.height / 2
  await touch('touchStart', [{ x: hx, y: hy, id: 1 }]); await touch('touchMove', [{ x: hx + 10, y: hy + 10, id: 1 }])
  await touch('touchStart', [{ x: hx + 10, y: hy + 10, id: 1 }, { x: hx - 30, y: hy, id: 2 }])
  await touch('touchMove', [{ x: hx + 20, y: hy + 20, id: 1 }, { x: hx - 40, y: hy, id: 2 }]); await touch('touchEnd', [])
  expect(await geometry(page, 'board')).toEqual(before)
  await page.getByRole('button', { name: 'Encajar' }).click()
  const close = await page.getByRole('button', { name: 'Cerrar Pizarra' }).boundingBox()
  const cx = close!.x + close!.width / 2, cy = close!.y + close!.height / 2
  await touch('touchStart', [{ x: cx, y: cy, id: 1 }]); await touch('touchStart', [{ x: cx, y: cy, id: 1 }, { x: cx - 30, y: cy + 30, id: 2 }])
  await touch('touchEnd', [])
  await expect(page.getByRole('region', { name: 'Pizarra', exact: true })).toBeVisible()
})

test('el marco permite desplazar su contenido con un dedo sin desplazar la página', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'desplazamiento táctil nativo')
  // Pizarra owns spatial gestures; test the generic frame on a list surface.
  await page.goto('/'); await toggle(page, 'Información')
  const content = page.locator('[data-module="information"] .module-content')
  await content.evaluate(el => {
    const fixture = document.createElement('div')
    fixture.style.height = '4000px'; fixture.textContent = 'Contenido de prueba'
    el.append(fixture)
  })
  const rect = await content.boundingBox(), session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height * 0.8
  await touch('touchStart', [{ x, y, id: 1 }])
  await touch('touchMove', [{ x, y: y - 20, id: 1 }]); await touch('touchMove', [{ x, y: y - 50, id: 1 }]); await touch('touchEnd', [])
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('encaja bajo la cabecera y mantiene centro lógico al rotar', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: 'Encajar' }).click()
  const read = () => page.getByTestId('mobile-viewport').evaluate(el => ({
    scale: Number(el.getAttribute('data-scale')), x: Number(el.getAttribute('data-offset-x')), y: Number(el.getAttribute('data-offset-y')),
    w: el.clientWidth, h: el.clientHeight,
  }))
  const before = await read()
  expect(before.scale).toBe(1)
  expect(before.x).toBe(0)
  expect(before.y).toBe(0)
  await page.setViewportSize({ width: 850, height: 420 })
  await expect.poll(async () => (await read()).w).toBe(850)
  const rotated = await read()
  expect(rotated.scale).toBe(1)
  expect(Math.abs(rotated.x)).toBeLessThanOrEqual(rotated.w * 0.1)
  expect(Math.abs(rotated.y)).toBeLessThanOrEqual(rotated.h * 0.1)
  await page.getByRole('button', { name: 'Encajar' }).click()
  const fitted = await read()
  expect(fitted).toMatchObject({ scale: 1, x: 0, y: 0 })
})

test('dos dedos hacen zoom y pan y cancelan el arrastre de módulo sin accionar cierre', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'gestos mediante emulación táctil Chromium')
  await page.goto('/'); await toggle(page, 'Pizarra')
  const original = await geometry(page, 'board')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const header = await page.locator('[data-module="board"] .module-header').boundingBox()
  const x = header!.x + 30, y = header!.y + header!.height / 2
  await touch('touchStart', [{ x, y, id: 1 }])
  await touch('touchMove', [{ x, y: y + 10, id: 1 }])
  await touch('touchStart', [{ x, y: y + 10, id: 1 }, { x: x + 40, y: y + 10, id: 2 }])
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
  const initialScale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  await touch('touchMove', [{ x: x - 10, y: y + 40, id: 1 }, { x: x + 80, y: y + 40, id: 2 }])
  await touch('touchEnd', [])
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'false')
  expect(Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))).toBeGreaterThan(initialScale)
  expect(await geometry(page, 'board')).toEqual(original)
  await expect(page.getByRole('button', { name: 'Cerrar Pizarra' })).toBeVisible()
  await expect(page.getByRole('banner')).toHaveCSS('position', 'relative')
  await page.getByRole('button', { name: 'Encajar' }).click()
  expect(await geometry(page, 'board')).toEqual(original)
})
