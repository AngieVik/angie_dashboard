import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AngieDocument } from '../../src/domain/document/types'

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
  const rect = (await page.getByTestId('board-surface').boundingBox())!
  return { x: rect.x + x * rect.width / 1000, y: rect.y + y * rect.height / 1000 }
}
async function draw(page: Page, from: [number, number], to: [number, number]) {
  const start = await canvasPoint(page, ...from), end = await canvasPoint(page, ...to)
  await page.mouse.move(start.x, start.y); await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 10 }); await page.mouse.up()
}
async function pixel(page: Page, layer: number, x: number, y: number) {
  return page.getByTestId('board-surface').locator('canvas').nth(layer).evaluate((canvas: HTMLCanvasElement, point) => {
    const rgba = canvas.getContext('2d')!.getImageData(Math.round(point.x * canvas.width / 1000), Math.round(point.y * canvas.height / 1000), 1, 1).data
    return [...rgba]
  }, { x, y })
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
})

test('canvas real: fondo, lápiz, goma, notas, JSON y recuperación', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.getByLabel('Color de fondo').fill('#ffffff')
  await expect.poll(() => pixel(page, 0, 500, 500)).toEqual([255, 255, 255, 255])
  const image = await localImage(page, 800, 400)
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(image)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await expect.poll(() => pixel(page, 0, 500, 500)).toEqual([54, 128, 160, 255])
  await page.getByRole('radio', { name: 'Nota rápida', exact: true }).click()
  const position = await canvasPoint(page, 500, 500)
  await page.mouse.click(position.x, position.y)
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte')
  await page.getByRole('button', { name: 'Crear nota', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Seleccionar/mover' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(1)
  const noteBefore = (await saved(page)).board.quickNotes[0]!
  expect(Math.abs(noteBefore.position.x - 500)).toBeLessThan(8)
  expect(Math.abs(noteBefore.position.y - 500)).toBeLessThan(8)
  await page.getByRole('radio', { name: 'Lápiz', exact: true }).click()
  await page.getByLabel('Grosor').fill('40')
  await draw(page, [300, 500], [700, 500])
  await expect.poll(() => pixel(page, 1, 400, 500)).toEqual([214, 58, 58, 255])
  await expect(page.getByRole('button', { name: 'Acceso norte', exact: true })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Acceso norte', exact: true })).toBeVisible()
  expect((await saved(page)).board).toEqual(json.board)
  expect(errors).toEqual([])
})

test('imagen local: reducción real, fondo anterior ante errores y descarte al cargar/Nuevo', async ({ page }) => {
  const network: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) network.push(request.url()) })
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 6000, 3000, 'image/jpeg'))
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '4096')
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-height', '2048')
  const before = await pixel(page, 0, 500, 500)
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'dañado.png', mimeType: 'image/png', buffer: Buffer.from('archivo dañado') })
  await expect(page.getByRole('alert')).toContainText('Se conserva el fondo anterior')
  expect(await pixel(page, 0, 500, 500)).toEqual(before)
  await page.getByRole('button', { name: 'Cerrar Pizarra' }).click(); await openBoard(page)
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '4096')
  const json = await exportDocument(page)
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'mismo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '0')
  await page.getByLabel('Cargar imagen de fondo').setInputFiles(await localImage(page, 800, 400))
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo', exact: true }).click()
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '0')
  expect(network).toEqual([])
})

test('notas: pulsación mantenida, edición, borrado y lienzo centrado al redimensionar', async ({ page }, info) => {
  await page.getByRole('radio', { name: 'Nota rápida', exact: true }).click()
  const location = await canvasPoint(page, 500, 500)
  await page.mouse.click(location.x, location.y)
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte')
  await page.getByRole('button', { name: 'Crear nota', exact: true }).click()
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(1)
  const before = (await saved(page)).board.quickNotes[0]!
  const note = page.getByRole('button', { name: 'Acceso norte', exact: true }), rect = (await note.boundingBox())!
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down(); await page.waitForTimeout(280)
  await page.mouse.move(rect.x + rect.width / 2 + 20, rect.y + rect.height / 2 + 12, { steps: 5 }); await page.mouse.up()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]!.position.x).toBeGreaterThan(before.position.x)
  const moved = (await saved(page)).board.quickNotes[0]!
  await page.getByRole('button', { name: 'Editar nota', exact: true }).click()
  await page.getByLabel('Texto de nota rápida').fill('Acceso sur')
  await page.getByRole('button', { name: 'Guardar nota', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Acceso sur', exact: true })).toBeVisible()
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]!.text).toBe('Acceso sur')
  const dimensions = await page.locator('.quick-note').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))
  const scale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  const handle = (await page.locator('[data-module="board"] .react-resizable-handle-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(handle.x - 500 * scale, handle.y - 400 * scale, { steps: 10 }); await page.mouse.up()
  const frame = page.locator('[data-module="board"]')
  await expect(frame).toHaveAttribute('data-width', '320'); await expect(frame).toHaveAttribute('data-height', '220')
  expect((await saved(page)).board.quickNotes[0]!.position).toEqual(moved.position)
  expect(await page.locator('.quick-note').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))).toEqual(dimensions)
  const area = (await page.locator('.board-area').boundingBox())!, square = (await page.getByTestId('board-surface').boundingBox())!
  expect(square.width).toBeCloseTo(square.height, 1)
  expect(square.x + square.width / 2).toBeCloseTo(area.x + area.width / 2, 1)
  expect(square.y + square.height / 2).toBeCloseTo(area.y + area.height / 2, 1)
  await page.screenshot({ path: info.outputPath('board-minimum.png') })
  await page.getByRole('button', { name: 'Eliminar nota', exact: true }).click()
  await expect.poll(async () => (await saved(page)).board.quickNotes.length).toBe(0)
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
})

test('herramientas y editor de notas accesibles con teclado', async ({ page }) => {
  const select = page.getByRole('radio', { name: 'Seleccionar/mover' })
  await select.focus(); await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Lápiz', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('radio', { name: 'Nota rápida', exact: true })).toHaveAttribute('aria-checked', 'true')
  const position = await canvasPoint(page, 500, 500); await page.mouse.click(position.x, position.y)
  await expect(page.getByLabel('Texto de nota rápida')).toBeFocused()
  await page.keyboard.type('Acceso norte'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Acceso norte', exact: true })).toBeVisible()
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
  const initialScale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  await touch('touchStart', [{ ...p, id: 1 }]); await touch('touchMove', [{ x: p.x + 4, y: p.y + 4, id: 1 }])
  await touch('touchStart', [{ x: p.x + 4, y: p.y + 4, id: 1 }, { ...q, id: 2 }])
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
  await touch('touchMove', [{ x: p.x - 10, y: p.y + 10, id: 1 }, { x: q.x + 10, y: q.y + 10, id: 2 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))).toBeGreaterThan(initialScale)
  expect((await saved(page)).board).toEqual(before)
  await page.getByRole('button', { name: 'Encajar' }).click()
  await page.getByRole('radio', { name: 'Nota rápida', exact: true }).click()
  const center = await canvasPoint(page, 500, 500)
  await touch('touchStart', [{ ...center, id: 1 }]); await touch('touchEnd', [])
  await page.getByLabel('Texto de nota rápida').fill('Acceso norte'); await page.getByRole('button', { name: 'Crear nota', exact: true }).click()
  const note = (await page.getByRole('button', { name: 'Acceso norte', exact: true }).boundingBox())!
  const finger = { x: note.x + note.width / 2, y: note.y + note.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...finger, x: finger.x + 10 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await saved(page)).board.quickNotes[0]?.position.x ?? 0).toBeGreaterThan(550)
  const noteBefore = (await saved(page)).board.quickNotes[0]!
  const current = (await page.getByRole('button', { name: 'Acceso norte', exact: true }).boundingBox())!
  const a = { x: current.x + current.width / 2, y: current.y + current.height / 2, id: 1 }
  const beforeNoteScale = Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))
  await touch('touchStart', [a]); await page.waitForTimeout(280)
  await touch('touchMove', [{ ...a, x: a.x + 5 }])
  await touch('touchStart', [{ ...a, x: a.x + 5 }, { x: a.x + 30, y: a.y + 30, id: 2 }])
  await touch('touchMove', [{ x: a.x - 5, y: a.y + 5, id: 1 }, { x: a.x + 50, y: a.y + 50, id: 2 }]); await touch('touchEnd', [])
  expect(Number(await page.getByTestId('mobile-viewport').getAttribute('data-scale'))).toBeGreaterThan(beforeNoteScale)
  expect((await saved(page)).board.quickNotes[0]).toEqual(noteBefore)
})
