import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { downloadDocument, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'

async function setup(page: Page, width = 600, height = 480) {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  const fixture = createEmptyDocument('Notas rápidas'), referenceSize = await page.getByTestId('mobile-viewport').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  fixture.moduleLayouts.board = { x: 0, y: 0, width: Math.min(width, referenceSize.width), height: Math.min(height, referenceSize.height), referenceSize }
  await loadDocument(page, fixture); await openModule(page, 'Pizarra')
  return fixture
}
async function zoom(page: Page, value: number, name: string) {
  const input = page.getByRole('spinbutton', { name, exact: true })
  await input.fill(String(value)); await input.press('Enter')
}

test('nota de una línea: campo único amarillo, tamaño manual, Escape y eliminación', async ({ page }, info) => {
  await setup(page)
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  const body = page.getByLabel('Texto de nota rápida')
  await expect(page.getByLabel('Título de nota rápida')).toHaveCount(0)
  await expect(page.locator('.quick-note textarea')).toHaveCount(1)
  await expect(body).toBeFocused(); await expect(body).toHaveAttribute('rows', '1')
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(1)
  const initial = (await savedDocument(page))!.board.quickNotes[0]!
  expect(initial).toMatchObject({ title: '', text: '', scale: 1, width: 180 })
  expect(initial.height).toBe(52)
  await expect(page.locator('.quick-note')).toHaveCSS('outline-offset', '-1px')
  await expect(page.locator('.quick-note')).toHaveCSS('background-image', /rgb\(255, 240, 163\)/)
  await expect(page.getByRole('button', { name: 'Eliminar nota', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await body.fill('Norte\nSur\nPunto de encuentro'); await body.press('Tab')
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.text).toBe('Norte\nSur\nPunto de encuentro')
  const grown = (await savedDocument(page))!.board.quickNotes[0]!
  expect(grown.title).toBe(''); expect(grown.height).toBe(initial.height)
  expect(await body.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(grown.position.y - grown.height / 2).toBe(initial.position.y - initial.height / 2)
  await body.fill('Descartar'); await body.press('Escape'); await expect(body).toHaveValue(grown.text)
  await expect(page.locator('.quick-note')).toBeFocused()
  await body.fill('Norte'); await body.press('Tab')
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.height).toBe(initial.height)
  await page.screenshot({ path: info.outputPath('note-one-line.png') })
  await body.fill('Borrador al cerrar'); await page.getByRole('button', { name: 'Cerrar Pizarra' }).click()
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.text).toBe('Borrador al cerrar')
  await openModule(page, 'Pizarra'); await body.fill('No guardar al eliminar')
  await page.getByRole('button', { name: 'Eliminar nota', exact: true }).click()
  await expect(page.locator('.quick-note')).toHaveCount(0)
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(0)
  await noPageScroll(page)
})

test('huecos, nombres de pines, invisibles y fallback delante sin desplazar cámara', async ({ page }, info) => {
  const fixture = await setup(page, 400, 240)
  fixture.elements.push({ id: crypto.randomUUID(), name: 'Referencia operativa con nombre largo', information: '', isUnit: false, operational: null, pinVisible: true,
    visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 90, y: 44 } })
  fixture.elements.push({ ...fixture.elements[0]!, id: crypto.randomUUID(), pinVisible: false, position: { x: 30000, y: 30000 } })
  fixture.board.strokes.push({ id: crypto.randomUUID(), tool: 'pen', color: '#FFFFFF', width: 40, points: [{ x: 12, y: 12 }] })
  await loadDocument(page, fixture)
  const camera = await page.getByTestId('board-surface').evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(1)
  const note = (await savedDocument(page))!.board.quickNotes[0]!
  expect(note.position.x - note.width / 2).toBeGreaterThanOrEqual(202)
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(9)
  const notes = (await savedDocument(page))!.board.quickNotes
  expect(notes.at(-1)!.position).toEqual({ x: 102, y: notes.at(-1)!.height / 2 + 12 })
  expect(notes[0]).toEqual(note)
  await expect(page.getByLabel('Texto de nota rápida').last()).toBeFocused()
  expect(await page.getByTestId('board-surface').evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))).toEqual(camera)
  await page.screenshot({ path: info.outputPath('note-fallback.png') })
})

for (const value of [25, 100, 200, 400]) test(`colocación visible bajo zoom ${value}% y cámara propia`, async ({ page }, info) => {
  await setup(page, 320, 400)
  await zoom(page, value, 'Zoom de Pizarra'); await zoom(page, value, 'Zoom actual')
  const surface = page.getByTestId('board-surface')
  await surface.dispatchEvent('wheel', { deltaX: 180, deltaY: 120, clientX: 50, clientY: 100 })
  await surface.dispatchEvent('wheel', { deltaY: -Math.log(1.5) / .002, ctrlKey: true, clientX: 50, clientY: 100 })
  const camera = await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))
  // At 25% x 25% the icon is subpixel for pointer hit testing; keyboard remains usable.
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).focus(); await page.keyboard.press('Enter')
  const body = page.getByLabel('Texto de nota rápida')
  await expect(body).toBeFocused(); await body.fill('Acceso norte'); await body.press('Tab')
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.text).toBe('Acceso norte')
  const note = await page.locator('.quick-note').boundingBox()
  const clip = await page.locator('[data-module="board"] .module-content').boundingBox()
  expect(note!.x + note!.width).toBeGreaterThan(Math.max(0, clip!.x))
  expect(note!.x).toBeLessThan(Math.min(page.viewportSize()!.width, clip!.x + clip!.width))
  expect(note!.y).toBeLessThan(Math.min(page.viewportSize()!.height, clip!.y + clip!.height))
  expect(await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))).toEqual(camera)
  await page.screenshot({ path: info.outputPath(`note-zoom-${value}.png`) }); await noPageScroll(page)
})

test('caja heredada no se transforma al montar; Nuevo descarta borrador antiguo', async ({ page }) => {
  const fixture = await setup(page)
  fixture.board.quickNotes.push({ id: crypto.randomUUID(), title: 'Heredada', text: 'Una\nDos', scale: 1, width: 240, height: 200, position: { x: 160, y: 150 } })
  await loadDocument(page, fixture)
  await expect(page.locator('.quick-note')).toHaveCSS('height', '200px')
  expect((await downloadDocument(page)).document.board.quickNotes).toEqual(fixture.board.quickNotes)
  await page.getByLabel('Texto de nota rápida').fill('Borrador anterior')
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'nuevo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createEmptyDocument('Otro'))) })
  await expect(page.locator('.quick-note')).toHaveCount(0)
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(0)
})


test('viewport menor que nota mantiene tamaño y amplía superficie sin mover cámara', async ({ page }) => {
  await setup(page, 140, 140)
  const surface = page.getByTestId('board-surface')
  const camera = await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes.length).toBe(1)
  const note = (await savedDocument(page))!.board.quickNotes[0]!
  expect(note.width).toBe(180); expect(note.scale).toBe(1)
  expect(Number(await surface.getAttribute('data-extent-width'))).toBeGreaterThanOrEqual(note.position.x + 90)
  expect(Number(await surface.getAttribute('data-extent-height'))).toBeGreaterThanOrEqual(note.position.y + note.height / 2)
  expect(await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))).toEqual(camera)
})

test('tacto emulado: crear y borrar con tap; mover desde borde y cancelar redimensionado con dos dedos', async ({ page, context, isMobile }, info) => {
  test.skip(!isMobile, 'Solo Chromium con tacto emulado')
  await setup(page)
  const add = page.getByRole('button', { name: 'Nota rápida', exact: true })
  await add.tap(); const body = page.getByLabel('Texto de nota rápida')
  await expect(body).toBeFocused(); await body.fill('Ruta'); await body.press('Tab')
  await page.getByRole('button', { name: 'Eliminar nota', exact: true }).tap()
  await expect(page.locator('.quick-note')).toHaveCount(0)
  await add.tap(); await body.fill('Ruta'); await body.press('Tab')
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.text).toBe('Ruta')
  const before = (await savedDocument(page))!.board.quickNotes[0]!
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const header = (await page.locator('.quick-note > .quick-note-header').boundingBox())!, finger = { x: header.x + 3, y: header.y + header.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...finger, x: finger.x + 10 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.position.x).toBeGreaterThan(before.position.x)
  const moved = (await savedDocument(page))!.board.quickNotes[0]!
  await body.fill('Borrador sin confirmar')
  const handle = (await page.getByRole('button', { name: 'Redimensionar nota rápida' }).boundingBox())!
  const a = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, id: 1 }
  await touch('touchStart', [a]); await touch('touchMove', [{ ...a, x: a.x + 8 }])
  const b = { x: a.x + 45, y: a.y + 35, id: 2 }
  await touch('touchStart', [{ ...a, x: a.x + 8 }, b]); await touch('touchMove', [{ ...a, x: a.x - 4 }, { ...b, x: b.x + 5 }]); await touch('touchEnd', [])
  expect((await savedDocument(page))!.board.quickNotes[0]).toEqual(moved)
  await expect(body).toHaveValue('Borrador sin confirmar'); await body.press('Escape'); await expect(body).toHaveValue('Ruta')
  await page.screenshot({ path: info.outputPath('note-touch.png') }); await session.detach()
})

test('nota heredada con texto largo conserva caja y permite scroll interior sin mover cámara', async ({ page }) => {
  const fixture = await setup(page)
  fixture.board.quickNotes.push({ id: crypto.randomUUID(), title: 'Heredada', text: Array.from({ length: 20 }, (_, i) => `Acceso ${i + 1}`).join('\n'), scale: 1,
    width: 240, height: 100, position: { x: 160, y: 150 } })
  await loadDocument(page, fixture)
  const body = page.getByLabel('Texto de nota rápida'), surface = page.getByTestId('board-surface')
  const camera = await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))
  await body.hover(); await page.mouse.wheel(0, 160)
  await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  expect(await surface.evaluate(el => ['data-offset-x', 'data-offset-y', 'data-scale'].map(a => el.getAttribute(a)))).toEqual(camera)
  expect((await downloadDocument(page)).document.board.quickNotes).toEqual(fixture.board.quickNotes)
})


test('mejoras compactas: texto de nota rápida se ajusta a su caja y recupera tamaño', async ({ page }, info) => {
  const fixture = await setup(page)
  fixture.board.quickNotes.push({ id: crypto.randomUUID(), title: '', text: 'Acceso norte.\n' + 'Comprobar material y radio. '.repeat(12), position: { x: 180, y: 160 }, width: 320, height: 160, scale: 1 })
  await loadDocument(page, fixture)
  const body = page.getByLabel('Texto de nota rápida')
  await body.focus()
  const initial = await body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  const fits = () => body.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)
  expect(await fits()).toBe(true)
  const handle = page.getByRole('button', { name: 'Redimensionar nota rápida' })
  const start = (await handle.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 - 200, start.y + start.height / 2 - 96, { steps: 4 })
  await page.mouse.up()
  expect(await body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThan(initial)
  expect(await fits()).toBe(true)
  await page.screenshot({ path: info.outputPath('nota-texto-ajustado.png') })
  const small = (await handle.boundingBox())!
  await page.mouse.move(small.x + small.width / 2, small.y + small.height / 2)
  await page.mouse.down()
  await page.mouse.move(small.x + small.width / 2 + 200, small.y + small.height / 2 + 96, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(initial, 1)
  expect(await fits()).toBe(true)
  await expect.poll(async () => (await savedDocument(page))?.board.quickNotes[0]?.text).toBe(fixture.board.quickNotes[0]!.text)
})


test('nota rápida amplía el texto por encima de 16 y lo vuelve a reducir al encoger', async ({ page }, info) => {
  const fixture = await setup(page)
  fixture.board.quickNotes.push({ id: crypto.randomUUID(), title: '', text: 'Acceso norte', position: { x: 180, y: 160 }, width: 280, height: 140, scale: 1 })
  await loadDocument(page, fixture)
  const body = page.getByLabel('Texto de nota rápida')
  await body.focus()
  await expect.poll(() => body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(16)
  const initial = await body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  const handle = page.getByRole('button', { name: 'Redimensionar nota rápida' })
  const start = (await handle.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 40, start.y + start.height / 2 + 30, { steps: 4 }); await page.mouse.up()
  await expect.poll(() => body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(initial)
  await expect(handle).toBeInViewport()
  const big = (await handle.boundingBox())!
  await page.mouse.move(big.x + big.width / 2, big.y + big.height / 2); await page.mouse.down()
  await page.mouse.move(big.x + big.width / 2 - 40, big.y + big.height / 2 - 30, { steps: 4 }); await page.mouse.up()
  await expect.poll(() => body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(initial, 1)
  expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
  await page.screenshot({ path: info.outputPath('nota-texto-grande.png') })
})
