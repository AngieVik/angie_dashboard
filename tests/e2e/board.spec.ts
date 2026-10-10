import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'

async function openBoard(page: Page) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Pizarra', exact: true }).click()
  await expect(page.getByTestId('board-surface')).toBeVisible()
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
      transaction.onerror = () => reject(transaction.error)
    }
  }))
}
async function canvasPoint(page: Page, x: number, y: number) {
  return page.getByTestId('board-surface').evaluate((el, point) => {
    const rect = el.getBoundingClientRect(), scale = Number(el.getAttribute('data-scale'))
    return { x: rect.x + (point.x * scale + Number(el.getAttribute('data-offset-x'))) * rect.width / el.clientWidth,
      y: rect.y + (point.y * scale + Number(el.getAttribute('data-offset-y'))) * rect.height / el.clientHeight }
  }, { x, y })
}
async function centerCamera(page: Page, x: number, y: number) {
  const rect = (await page.getByTestId('board-surface').boundingBox())!, point = await canvasPoint(page, x, y)
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  await page.mouse.move(center.x, center.y); await page.mouse.down({ button: 'middle' })
  await page.mouse.move(2 * center.x - point.x, 2 * center.y - point.y); await page.mouse.up({ button: 'middle' })
}
async function draw(page: Page, from: [number, number], to: [number, number]) {
  const start = await canvasPoint(page, ...from), end = await canvasPoint(page, ...to)
  await page.mouse.move(start.x, start.y); await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 10 }); await page.mouse.up()
}
async function pixel(page: Page, layer: number, x: number, y: number) {
  return page.getByTestId('board-surface').evaluate((el, point) => {
    const canvas = el.querySelectorAll('canvas')[point.layer]!, scale = Number(el.getAttribute('data-scale'))
    const rgba = canvas.getContext('2d')!.getImageData(Math.round((point.x * scale + Number(el.getAttribute('data-offset-x'))) * canvas.width / el.clientWidth),
      Math.round((point.y * scale + Number(el.getAttribute('data-offset-y'))) * canvas.height / el.clientHeight), 1, 1).data
    return [...rgba]
  }, { x, y, layer })
}
async function exportDocument(page: Page) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  return JSON.parse(await readFile((await (await downloading).path())!, 'utf8')) as AngieDocument
}
async function localImage(page: Page, width: number, height: number, type = 'image/png') {
  const data = await page.evaluate(async ({ width, height, type }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3680A0'; context.fillRect(0, 0, width, height)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), type))
    return [...new Uint8Array(await blob.arrayBuffer())]
  }, { width, height, type })
  return { name: type === 'image/png' ? 'fondo.png' : 'fondo.jpg', mimeType: type, buffer: Buffer.from(data) }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) })
  await page.goto('/'); await openBoard(page)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-offset-x', '0')
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-offset-y', '0')
  await centerCamera(page, 500, 500)
})

test('revisión adaptativa: superficie rectangular completa y herramientas en una fila', async ({ page }) => {
  const area = (await page.locator('.board-area').boundingBox())!, surface = (await page.getByTestId('board-surface').boundingBox())!
  expect(surface.width).toBeCloseTo(area.width, 1)
  expect(surface.height).toBeCloseTo(area.height, 1)
  expect(surface.x).toBeCloseTo(area.x, 1)
  expect(surface.y).toBeCloseTo(area.y, 1)
  const modes = (await page.getByRole('radiogroup').boundingBox())!, width = (await page.getByRole('button', { name: 'Abrir deslizador: Grosor' }).boundingBox())!
  expect(Math.abs(modes.y + modes.height / 2 - width.y - width.height / 2)).toBeLessThan(2)
  expect(await page.getByRole('radio').first().locator('svg').count()).toBe(1)
})

test('canvas real: fondo, lápiz, goma, notas, JSON y recuperación', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.getByLabel('Color de fondo', { exact: true }).fill('#ffffff')
  await expect.poll(() => pixel(page, 0, 500, 500)).toEqual([255, 255, 255, 255])
  const image = await localImage(page, 800, 800)
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(image)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await centerCamera(page, 500, 500)
  await expect.poll(() => pixel(page, 0, 500, 500)).toEqual([54, 128, 160, 255])
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte')
  await page.getByLabel('Texto de nota rápida').press('Tab')
  await expect(page.getByRole('radio', { name: 'Seleccionar/mover' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(1)
  const noteBefore = (await saved(page)).board.quickNotes[0]!
  expect(noteBefore).toMatchObject({ title: '', scale: 1, width: 180 })
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir deslizador: Grosor' }).click()
  await page.getByRole('slider', { name: 'Grosor' }).press('End')
  await page.keyboard.press('Escape')
  await draw(page, [300, 500], [700, 500])
  await expect.poll(() => pixel(page, 1, 400, 500)).toEqual([214, 58, 58, 255])
  await expect(page.getByLabel('Texto de nota rápida')).toBeVisible()
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(1)
  expect((await saved(page)).board.quickNotes[0]).toEqual(noteBefore)
  await page.getByRole('radio', { name: 'Goma', exact: true }).click()
  await draw(page, [400, 400], [400, 600])
  await expect.poll(() => pixel(page, 1, 400, 500)).toEqual([0, 0, 0, 0])
  expect(await pixel(page, 0, 400, 500)).toEqual([54, 128, 160, 255])
  expect(await pixel(page, 1, 600, 500)).toEqual([214, 58, 58, 255])
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(2)
  expect((await saved(page)).board.quickNotes[0]).toEqual(noteBefore)
  const json = await exportDocument(page)
  expect(Object.keys(json.board)).toEqual(['backgroundColor', 'strokes', 'quickNotes'])
  expect(json.board.strokes.map(stroke => stroke.tool)).toEqual(['pen', 'eraser'])
  expect(json.board.strokes[1]?.color).toBeNull()
  await page.screenshot({ path: info.outputPath('board-desktop-mobile.png') })
  await page.reload(); await expect(page.locator('[data-module]')).toHaveCount(0)
  await openBoard(page)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '0')
  await expect.poll(() => pixel(page, 1, 600, 500)).toEqual([214, 58, 58, 255])
  expect(await pixel(page, 1, 400, 500)).toEqual([0, 0, 0, 0])
  expect(await pixel(page, 0, 400, 500)).toEqual([255, 255, 255, 255])
  await expect(page.getByLabel('Texto de nota rápida')).toBeVisible()
  expect((await saved(page)).board).toEqual(json.board)
  expect(errors).toEqual([])
})

test('imagen local: reducción real, fondo anterior ante errores y descarte al cargar/Nuevo', async ({ page }) => {
  const network: string[] = []
  page.on('request', request => { if (!request.url().startsWith(new URL(page.url()).origin) && !request.url().startsWith('data:')) network.push(request.url()) })
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 6000, 3000, 'image/jpeg'))
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '4096')
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-height', '2048')
  const before = await pixel(page, 0, 50, 50)
  expect(before[3]).toBe(255)
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'dañado.png', mimeType: 'image/png', buffer: Buffer.from('archivo dañado') })
  await expect(page.getByRole('alert')).toContainText('Se conserva el fondo anterior')
  expect(await pixel(page, 0, 50, 50)).toEqual(before)
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click(); await openBoard(page)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '4096')
  const json = await exportDocument(page)
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'mismo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '0')
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 800, 400))
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await centerCamera(page, 500, 500)
  const handle = (await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox())!
  const camera = await page.getByTestId('board-surface').evaluate(el => [el.getAttribute('data-offset-x'), el.getAttribute('data-offset-y')])
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 320 - Number(await page.locator('[data-module="board"]').getAttribute('data-width')), handle.y + handle.height / 2 + 200); await page.mouse.up()
  await expect(page.locator('[data-module="board"]')).toHaveAttribute('data-width', '320')
  expect(await page.getByTestId('board-surface').evaluate(el => [el.getAttribute('data-offset-x'), el.getAttribute('data-offset-y')])).toEqual(camera)
  await centerCamera(page, 500, 500)
  await expect.poll(() => pixel(page, 0, 500, 400)).toEqual([54, 128, 160, 255])
  await expect.poll(() => pixel(page, 0, 500, 530)).toEqual([37, 40, 43, 255])
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-height', '400')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo', exact: true }).click()
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '0')
  expect(network).toEqual([])
})

test('rueda sincronizada y modificadores navegan solo la pizarra y permiten dibujar más allá de 1000', async ({ page }) => {
  const surface = page.getByTestId('board-surface'), rect = (await surface.boundingBox())!
  const before = await saved(page)
  await page.mouse.move(rect.x + 3, rect.y + rect.height / 2)
  const x = Number(await surface.getAttribute('data-offset-x')), y = Number(await surface.getAttribute('data-offset-y'))
  await page.mouse.wheel(0, 80)
  await expect.poll(async () => Number(await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).inputValue())).toBeLessThan(100)
  expect(Number(await surface.getAttribute('data-offset-y'))).toBe(y)
  expect(Number(await surface.getAttribute('data-offset-x'))).toBe(x)
  await page.keyboard.down('Shift'); await page.mouse.wheel(0, 80); await page.keyboard.up('Shift')
  await expect.poll(async () => Number(await surface.getAttribute('data-offset-x'))).toBeLessThan(x)
  await page.keyboard.down('Control')
  for (let step = 0; step < 4; step++) await page.mouse.wheel(0, 700)
  await page.keyboard.up('Control')
  await expect(page.locator('.module-scaled-content')).toHaveAttribute('data-scale', '0.25')
  await expect(surface).toHaveAttribute('data-scale', '1')
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-scale', '1')
  expect(await saved(page)).toEqual(before)
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  await page.mouse.click(rect.x + rect.width - 20, rect.y + rect.height / 2)
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(1)
  expect((await saved(page)).board.strokes[0]?.points[0]?.x).toBeGreaterThan(1000)
})

test('notas: pulsación mantenida, edición, borrado y lienzo centrado al redimensionar', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte')
  await page.getByLabel('Texto de nota rápida').press('Tab')
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(1)
  const before = (await saved(page)).board.quickNotes[0]!
  const note = page.locator('.quick-note > .quick-note-header'), rect = (await note.boundingBox())!
  await page.mouse.move(rect.x + 3, rect.y + rect.height / 2)
  await page.mouse.down(); await page.waitForTimeout(280)
  await page.mouse.move(rect.x + 3 + 20, rect.y + rect.height / 2 + 12, { steps: 5 }); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]!.position.x).toBeGreaterThan(before.position.x)
  const moved = (await saved(page)).board.quickNotes[0]!
  await page.getByLabel('Texto de nota rápida').fill('Acceso sur')
  await page.getByLabel('Texto de nota rápida').press('Tab')
  await expect(page.getByLabel('Texto de nota rápida')).toBeVisible()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]!.text).toBe('Acceso sur')
  const dimensions = await page.locator('.quick-note').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const handle = (await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + (320 - Number(await page.locator('[data-module="board"]').getAttribute('data-width'))) * scale, handle.y + handle.height / 2 + (220 - Number(await page.locator('[data-module="board"]').getAttribute('data-height'))) * scale, { steps: 10 }); await page.mouse.up()
  const frame = page.locator('[data-module="board"]')
  await expect(frame).toHaveAttribute('data-width', '320'); await expect(frame).toHaveAttribute('data-height', '220')
  expect((await saved(page)).board.quickNotes[0]!.position).toEqual(moved.position)
  expect(await page.locator('.quick-note').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))).toEqual(dimensions)
  const area = (await page.locator('.board-area').boundingBox())!, square = (await page.getByTestId('board-surface').boundingBox())!
  expect(square.width).toBeCloseTo(area.width, 1)
  expect(square.height).toBeCloseTo(area.height, 1)
  expect(square.x + square.width / 2).toBeCloseTo(area.x + area.width / 2, 1)
  expect(square.y + square.height / 2).toBeCloseTo(area.y + area.height / 2, 1)
  await page.screenshot({ path: info.outputPath('board-minimum.png') })
  await page.getByRole('button', { name: 'Eliminar nota', exact: true }).click()
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(0)
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
})

test('herramientas y notas en sitio accesibles con teclado', async ({ page }) => {
  const select = page.getByRole('radio', { name: 'Seleccionar/mover' })
  await select.focus(); await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Lápiz', exact: true })).toBeFocused()
  await page.keyboard.press('End'); await expect(page.getByRole('radio', { name: 'Goma', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).press('Enter')
  const body = page.getByLabel('Texto de nota rápida')
  await expect(body).toBeFocused(); await body.fill('Acceso norte'); await body.press('Tab')
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]?.text).toBe('Acceso norte')
  await select.focus(); await expect(select).toHaveCSS('outline-style', 'solid')
})
test('tacto: un dedo dibuja y mueve notas; dos dedos cancelan ambos sin cambios persistentes', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil Chromium')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  const p = await canvasPoint(page, 350, 350), q = await canvasPoint(page, 650, 350)
  await touch('touchStart', [{ ...p, id: 1 }]); await touch('touchMove', [{ ...q, id: 1 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await saved(page)).board.strokes.length).toBe(1)
  const before = (await saved(page)).board
  const initialScale = Number(await page.getByTestId('board-surface').getAttribute('data-scale'))
  const mainBefore = await page.getByTestId('mobile-viewport').getAttribute('data-scale')
  await touch('touchStart', [{ ...p, id: 1 }]); await touch('touchMove', [{ x: p.x + 4, y: p.y + 4, id: 1 }])
  await touch('touchStart', [{ x: p.x + 4, y: p.y + 4, id: 1 }, { ...q, id: 2 }])
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
  await touch('touchMove', [{ x: p.x - 10, y: p.y + 10, id: 1 }, { x: q.x + 10, y: q.y + 10, id: 2 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('board-surface').getAttribute('data-scale'))).toBeGreaterThan(initialScale)
  expect(await page.getByTestId('mobile-viewport').getAttribute('data-scale')).toBe(mainBefore)
  expect((await saved(page)).board).toEqual(before)
  await page.getByRole('button', { name: 'Encajar' }).click()
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  const center = await canvasPoint(page, 500, 500)
  await touch('touchStart', [{ ...center, id: 1 }]); await touch('touchEnd', [])
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte'); await page.getByLabel('Texto de nota rápida').press('Tab')
  const initialNote = (await saved(page)).board.quickNotes[0]!
  const note = (await page.locator('.quick-note > .quick-note-header').boundingBox())!
  const finger = { x: note.x + 3, y: note.y + note.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...finger, x: finger.x + 10 }]); await touch('touchEnd', [])
  const noteScale = Number(await page.getByTestId('board-surface').getAttribute('data-scale')) * Number(mainBefore)
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]?.position.x ?? 0).toBeCloseTo(initialNote.position.x + 10 / noteScale, 1)
  const noteBefore = (await saved(page)).board.quickNotes[0]!
  const current = (await page.getByLabel('Texto de nota rápida').boundingBox())!
  const a = { x: current.x + current.width / 2, y: current.y + current.height / 2, id: 1 }
  const beforeNoteScale = Number(await page.getByTestId('board-surface').getAttribute('data-scale'))
  await touch('touchStart', [a]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...a, x: a.x + 5 }])
  await touch('touchStart', [{ ...a, x: a.x + 5 }, { x: a.x + 30, y: a.y + 30, id: 2 }])
  await touch('touchMove', [{ x: a.x - 5, y: a.y + 5, id: 1 }, { x: a.x + 50, y: a.y + 50, id: 2 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('board-surface').getAttribute('data-scale'))).toBeGreaterThan(beforeNoteScale)
  expect((await saved(page)).board.quickNotes[0]).toEqual(noteBefore)
  const viewport = (await page.getByTestId('board-surface').boundingBox())!
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 600); await page.keyboard.up('Control')
  const resize = (await page.getByRole('button', { name: 'Redimensionar nota rápida' }).boundingBox())!
  const r = { x: resize.x + resize.width / 2, y: resize.y + resize.height / 2, id: 1 }
  expect(r.x).toBeGreaterThan(viewport.x); expect(r.x).toBeLessThan(viewport.x + viewport.width)
  expect(r.y).toBeGreaterThan(viewport.y); expect(r.y).toBeLessThan(viewport.y + viewport.height)
  await touch('touchStart', [r]); await touch('touchMove', [{ ...r, x: r.x + 4 }])
  await touch('touchStart', [{ ...r, x: r.x + 4 }, { x: r.x - 30, y: r.y - 30, id: 2 }])
  await touch('touchMove', [{ ...r, x: r.x + 8 }, { x: r.x - 40, y: r.y - 30, id: 2 }]); await touch('touchEnd', [])
  expect((await saved(page)).board.quickNotes[0]).toEqual(noteBefore)
  await session.detach()
})

test('nota: ancho y alto independientes y geometría recuperada desde JSON', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  const body = page.getByLabel('Texto de nota rápida')
  await body.fill('Ruta norte'); await body.press('Tab')
  const before = (await saved(page)).board.quickNotes[0]!
  const handle = (await page.getByRole('button', { name: 'Redimensionar nota rápida' }).boundingBox())!
  const surface = (await page.getByTestId('board-surface').boundingBox())!
  const scale = surface.width / Number(await page.getByTestId('board-surface').getAttribute('data-viewport-width')) * Number(await page.getByTestId('board-surface').getAttribute('data-scale'))
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2
  await page.mouse.move(x, y); await page.mouse.down()
  await page.mouse.move(x + before.width * scale / 2, y); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]?.width).toBeCloseTo(270, 1)
  const resized = (await saved(page)).board.quickNotes[0]!
  expect(resized.width).toBeCloseTo(270, 1); expect(resized.height).toBe(before.height); expect(resized.scale).toBe(before.scale)
  expect(resized.position.x - resized.width / 2).toBeCloseTo(before.position.x - 90, 1)
  expect(resized.position.y - resized.height / 2).toBeCloseTo(before.position.y - before.height / 2, 1)
  await expect(body).toHaveCSS('font-size', '16px')
  const vertical = (await page.getByRole('button', { name: 'Redimensionar nota rápida' }).boundingBox())!
  const vx = vertical.x + vertical.width / 2, vy = vertical.y + vertical.height / 2
  await page.mouse.move(vx, vy); await page.mouse.down(); await page.mouse.move(vx, vy + 50 * scale); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]?.height).toBeCloseTo(before.height + 50, 1)
  expect((await saved(page)).board.quickNotes[0]?.width).toBeCloseTo(270, 1)
  const finalNote = (await saved(page)).board.quickNotes[0]!
  const json = await exportDocument(page)
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'notas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(page.locator('.quick-note')).toHaveCSS('width', '270px')
  await page.reload(); await openBoard(page)
  expect((await saved(page)).board.quickNotes[0]).toEqual(finalNote)
  await expect(body).toHaveCSS('font-size', '16px')
  await page.screenshot({ path: info.outputPath('board-scaled-note.png') })
})
test('escena estable: notas heredadas y nuevas en ventanas horizontal y vertical; fondo completo y cámara temporal', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const document = createEmptyDocument()
  document.board.backgroundColor = '#223344'
  document.board.quickNotes = [
    { id: crypto.randomUUID(), title: '', scale: 1, text: 'Nota heredada', position: { x: 1500, y: 1300 }, width: 180, height: 80 },
    { id: crypto.randomUUID(), title: '', scale: 1, text: 'Nota nueva', position: { x: 1550, y: 1390 }, width: 220, height: 96 },
  ]
  const size = await page.getByTestId('mobile-viewport').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  document.moduleLayouts.board = { x: 0, y: 0, width: 702, height: 374, referenceSize: size }
  const load = () => page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'escena.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await load()
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-scale', '1')
  for (const shape of ['horizontal', 'vertical']) {
    if (shape === 'vertical') { document.moduleLayouts.board = { x: 0, y: 0, width: 320, height: 780, referenceSize: size }; await load() }
    const area = (await page.locator('.board-area').boundingBox())!, surface = (await page.getByTestId('board-surface').boundingBox())!
    expect(surface.width).toBeCloseTo(area.width, 1); expect(surface.height).toBeCloseTo(area.height, 1)
    await expect(page.getByLabel('Texto de nota rápida').nth(0)).toBeVisible()
    await expect(page.getByLabel('Texto de nota rápida').nth(1)).toBeVisible()
    expect(await page.getByTestId('board-surface').evaluate(el => {
      const canvas = el.querySelector('canvas')!, ctx = canvas.getContext('2d')!
      return [[1, 1], [canvas.width - 2, canvas.height - 2]].map(([x, y]) => [...ctx.getImageData(x!, y!, 1, 1).data])
    })).toEqual([[34, 51, 68, 255], [34, 51, 68, 255]])
    expect((await saved(page)).board).toEqual(document.board)
    await page.screenshot({ path: info.outputPath(`board-notes-${shape}.png`) })
  }
  const json = await exportDocument(page)
  expect(json.board).toEqual(document.board)
  expect(Object.keys(json)).toHaveLength(8)
})


test('imagen editable: origen, movimiento negativo, escala proporcional y limpieza independiente', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const surface = page.getByTestId('board-surface')
  await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).fill('25')
  await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).press('Enter')
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 800, 400))
  await expect(surface).toHaveAttribute('data-image-display-width', '1000')
  await expect(surface).toHaveAttribute('data-image-display-height', '500')
  await expect(surface).toHaveAttribute('data-image-x', '0')
  await expect(surface).toHaveAttribute('data-image-y', '0')
  await expect.poll(() => pixel(page, 0, 5, 5)).toEqual([54, 128, 160, 255])
  await page.getByRole('radio', { name: 'Mover y redimensionar imagen' }).click()
  const from = await canvasPoint(page, 150, 150), to = await canvasPoint(page, 50, 100)
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up()
  await expect.poll(async () => Number(await surface.getAttribute('data-image-x'))).toBeCloseTo(-100, 0)
  await expect.poll(async () => Number(await surface.getAttribute('data-image-y'))).toBeCloseTo(-50, 0)
  const handle = (await page.getByRole('button', { name: 'Redimensionar imagen se' }).boundingBox())!
  const rect = (await surface.boundingBox())!, ratio = rect.width / Number(await surface.getAttribute('data-viewport-width'))
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 200 * ratio, y - 100 * ratio, { steps: 5 }); await page.mouse.up()
  await expect.poll(async () => Number(await surface.getAttribute('data-image-display-width'))).toBeCloseTo(800, 0)
  await expect.poll(async () => Number(await surface.getAttribute('data-image-display-height'))).toBeCloseTo(400, 0)
  await page.screenshot({ path: info.outputPath('imagen-editable.png') })
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  await draw(page, [80, 120], [180, 120])
  await expect.poll(() => pixel(page, 1, 120, 120)).toEqual([214, 58, 58, 255])
  await expect(page.locator('.board-tool-cursor')).toHaveCSS('box-shadow', /rgb\(255, 255, 255\).*rgb\(0, 0, 0\)/)
  await page.getByRole('radio', { name: 'Goma', exact: true }).click()
  const cursorPoint = await canvasPoint(page, 200, 200)
  await page.mouse.move(cursorPoint.x, cursorPoint.y)
  await expect(page.locator('.board-tool-cursor')).toHaveCSS('box-shadow', /rgb\(255, 255, 255\).*rgb\(0, 0, 0\)/)
  await page.screenshot({ path: info.outputPath('cursor-contraste.png') })
  await page.getByRole('button', { name: 'Borrar todos los trazos' }).click()
  await expect.poll(() => pixel(page, 1, 120, 120)).toEqual([0, 0, 0, 0])
  await expect.poll(() => pixel(page, 0, 120, 120)).toEqual([54, 128, 160, 255])
  await expect.poll(async () => (await saved(page)).board.strokes).toEqual([])
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click(); await openBoard(page)
  await expect.poll(async () => Number(await surface.getAttribute('data-image-x'))).toBeCloseTo(-100, 0)
  await expect.poll(async () => Number(await surface.getAttribute('data-image-display-width'))).toBeCloseTo(800, 0)
  expect(errors).toEqual([])
})


test('imagen táctil: un dedo mueve y dos dedos cancelan la edición pendiente', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil Chromium')
  await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).fill('25')
  await page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true }).press('Enter')
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 800, 400))
  const surface = page.getByTestId('board-surface')
  await expect(surface).toHaveAttribute('data-image-width', '800')
  await page.getByRole('radio', { name: 'Mover y redimensionar imagen' }).click()
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const p = await canvasPoint(page, 250, 250), q = await canvasPoint(page, 150, 150)
  await touch('touchStart', [{ ...p, id: 1 }]); await touch('touchMove', [{ ...q, id: 1 }]); await touch('touchEnd', [])
  await expect.poll(async () => Number(await surface.getAttribute('data-image-x'))).toBeCloseTo(-100, 0)
  await expect.poll(async () => Number(await surface.getAttribute('data-image-y'))).toBeCloseTo(-100, 0)
  const before = await surface.evaluate(el => [el.getAttribute('data-image-x'), el.getAttribute('data-image-y'), el.getAttribute('data-image-display-width'), el.getAttribute('data-image-display-height')])
  const a = { ...await canvasPoint(page, 150, 150), id: 1 }
  const moved = { ...a, x: a.x + 20, y: a.y + 10 }, b = { x: a.x + 60, y: a.y + 40, id: 2 }
  await touch('touchStart', [a]); await touch('touchMove', [moved])
  await expect.poll(async () => Number(await surface.getAttribute('data-image-x'))).toBeGreaterThan(-100)
  await touch('touchStart', [moved, b])
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
  await touch('touchMove', [{ ...moved, x: moved.x - 10 }, { ...b, x: b.x + 10 }]); await touch('touchEnd', [])
  expect(await surface.evaluate(el => [el.getAttribute('data-image-x'), el.getAttribute('data-image-y'), el.getAttribute('data-image-display-width'), el.getAttribute('data-image-display-height')])).toEqual(before)
  await session.detach()
})
