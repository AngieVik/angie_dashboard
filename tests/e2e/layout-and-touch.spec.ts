import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'

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
  expect(await geometry(page, 'board')).toEqual({ x: 0, y: 0, width: 720, height: 480 })
  // It was previously opened alone at (0,0). Its saved rectangle is now
  // occupied, so the closest free position is below the board.
  expect(await geometry(page, 'elements')).toEqual({ x: 0, y: 480, width: 300, height: 420 })
  await page.screenshot({ path: info.outputPath('modules.png') })
  await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await toggle(page, 'Pizarra')
  expect(await geometry(page, 'board')).toEqual({ x: 0, y: 0, width: 720, height: 480 })
  const bounds = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }))
  expect(bounds.width).toBe(bounds.w); expect(bounds.height).toBe(bounds.h)
})

test('arrastra y redimensiona sin packing, limita tamaños y colisiones', async ({ page }) => {
  await page.goto('/')
  await toggle(page, 'Pizarra'); await toggle(page, 'Elementos')
  const unchanged = await geometry(page, 'elements')
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const header = await page.locator('[data-module="board"] .module-header').boundingBox()
  await page.mouse.move(header!.x + 40 * scale, header!.y + 15 * scale)
  await page.mouse.down(); await page.mouse.move(header!.x + 40 * scale, header!.y + 15 * scale + 200 * scale, { steps: 10 });
  await page.mouse.up()
  // Chromium rounds input to physical pixels; below fit on mobile that pixel
  // represents several integer logical units.
  const moved = await geometry(page, 'board')
  expect(Math.abs(moved.y - 200)).toBeLessThanOrEqual(1 / scale)
  expect(await geometry(page, 'elements')).toEqual(unchanged)
  const currentHeader = await page.locator('[data-module="board"] .module-header').boundingBox()
  await page.mouse.move(currentHeader!.x + 40 * scale, currentHeader!.y + 15 * scale)
  await page.mouse.down(); await page.mouse.move(currentHeader!.x + 40 * scale + 750 * scale, currentHeader!.y + 15 * scale, { steps: 10 }); await page.mouse.up()
  const blocked = await geometry(page, 'board')
  expect(blocked.x + blocked.width).toBeLessThanOrEqual(unchanged.x)
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
})

test('abre excepcionalmente sin hueco, mantiene el resto y termina la excepción al recolocar', async ({ page }) => {
  const document = createEmptyDocument('Distribución completa')
  document.moduleLayouts.board = { x: 0, y: 0, width: 1600, height: 1000 }
  await page.goto('/')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
  await toggle(page, 'Pizarra'); await toggle(page, 'Información')
  const unchanged = await geometry(page, 'board')
  expect(await geometry(page, 'information')).toEqual({ x: 690, y: 430, width: 220, height: 140 })
  await expect(page.locator('[data-module="information"]')).toHaveAttribute('data-exceptional', 'true')
  await expect(page.getByRole('alert')).toHaveText('No hay espacio libre. Recoloca o cierra algún módulo.')
  await expect(page.locator('[data-module="information"] .module-frame')).toHaveAttribute('data-active', 'true')
  expect(await geometry(page, 'board')).toEqual(unchanged)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Pizarra', exact: true }).click()
  const header = await page.locator('[data-module="information"] .module-header').boundingBox()
  await page.mouse.move(header!.x + 20, header!.y + header!.height / 2)
  await page.mouse.down(); await page.mouse.move(header!.x + 40, header!.y + header!.height / 2, { steps: 5 }); await page.mouse.up()
  await expect(page.locator('[data-module="information"]')).toHaveAttribute('data-exceptional', 'false')
  const placed = await geometry(page, 'information')
  await page.getByRole('button', { name: 'Cerrar Información' }).click(); await toggle(page, 'Información')
  expect(await geometry(page, 'information')).toEqual(placed)
})

test('cargar geometrías guardadas ocupadas mantiene colocación válida y exporta solo geometrías', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/'); await toggle(page, 'Pizarra'); await toggle(page, 'Elementos')
  const document = createEmptyDocument('Distribución importada')
  document.moduleLayouts = { board: { x: 0, y: 0, width: 720, height: 480 }, elements: { x: 0, y: 0, width: 300, height: 420 } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByLabel('Título del documento')).toHaveValue(document.document.title)
  expect(await geometry(page, 'board')).toEqual(document.moduleLayouts.board)
  expect(await geometry(page, 'elements')).toEqual({ x: 0, y: 480, width: 300, height: 420 })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  const downloaded = await downloading
  const json = JSON.parse(await readFile((await downloaded.path())!, 'utf8'))
  expect(json.moduleLayouts.elements).toEqual(await geometry(page, 'elements'))
  expect(Object.keys(json)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts', 'filters'])
  for (const layout of Object.values(json.moduleLayouts)) expect(Object.keys(layout as object)).toEqual(['x', 'y', 'width', 'height'])
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

test('un dedo mueve módulos y dos dedos cancelan también resize y controles', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil')
  await page.goto('/'); await toggle(page, 'Pizarra')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const header = await page.locator('[data-module="board"] .module-header').boundingBox()
  const x = header!.x + 40, y = header!.y + header!.height / 2
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
  await page.goto('/'); await toggle(page, 'Pizarra')
  const content = page.locator('[data-module="board"] .module-content')
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
  const read = () => page.getByTestId('mobile-viewport').evaluate(el => ({
    scale: Number(el.getAttribute('data-scale')), x: Number(el.getAttribute('data-offset-x')), y: Number(el.getAttribute('data-offset-y')),
    w: el.clientWidth, h: el.clientHeight,
  }))
  const before = await read()
  expect(before.scale).toBeCloseTo(Math.min(before.w / 1600, before.h / 1000))
  expect(before.x).toBeCloseTo((before.w - 1600 * before.scale) / 2)
  expect(before.y).toBeCloseTo((before.h - 1000 * before.scale) / 2)
  await page.setViewportSize({ width: 850, height: 420 })
  await expect.poll(async () => (await read()).w).toBe(850)
  const rotated = await read()
  expect((rotated.w / 2 - rotated.x) / rotated.scale).toBeCloseTo(800)
  expect((rotated.h / 2 - rotated.y) / rotated.scale).toBeCloseTo(500)
  await page.getByRole('button', { name: 'Encajar' }).click()
  const fitted = await read()
  expect(fitted.scale).toBeCloseTo(Math.min(fitted.w / 1600, fitted.h / 1000))
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
