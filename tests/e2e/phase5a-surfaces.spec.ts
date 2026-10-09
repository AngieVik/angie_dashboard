import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { loadDocument, openModule, savedDocument, downloadDocument, noPageScroll } from './acceptance-helpers'

const geometry = (page: Page, id: string) => page.locator(`[data-module="${id}"]`).evaluate(el => ({
  x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')),
  width: Number(el.getAttribute('data-width')), height: Number(el.getAttribute('data-height')),
}))
const extent = (page: Page) => page.locator('.logical-workspace').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
async function zoom(page: Page, value: number, label = 'Zoom actual') {
  const field = page.getByLabel(label, { exact: true })
  await field.fill(String(value)); await field.press('Enter')
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
})
for (const scale of [25, 100, 200, 400]) {
  test(`Puzzle ordena solo abiertos a ${scale} %, mantiene selección, capas y tamaño manual`, async ({ page }, info) => {
    await page.goto('/')
    const fixture = createEmptyDocument('Puzzle')
    const ref = { width: 1600, height: 1000 }
    fixture.moduleLayouts = {
      board: { x: 0, y: 0, width: 720, height: 480, referenceSize: ref },
      elements: { x: 0, y: 0, width: 300, height: 420, referenceSize: ref },
      information: { x: 0, y: 0, width: 320, height: 240, referenceSize: ref },
      clock: { x: 900, y: 700, width: 440, height: 260, referenceSize: ref },
    }
    fixture.elements.push({ id: '00000000-0000-4000-8000-000000000001', name: 'Referencia', information: 'Canal 4', pinVisible: true,
      visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 }, isUnit: false, operational: null })
    await loadDocument(page, fixture)
    await openModule(page, 'Información'); await openModule(page, 'Pizarra'); await openModule(page, 'Elementos')
    await page.locator('[data-module="elements"]').getByRole('button', { name: 'Seleccionar Referencia', exact: true }).click()
    await zoom(page, scale)
    const layers = await page.locator('[data-module]').evaluateAll(els => els.map(el => (el as HTMLElement).style.zIndex))
    const widths = await Promise.all(['board', 'elements', 'information'].map(id => geometry(page, id)))
    const visible = await page.getByTestId('mobile-viewport').evaluate(el => el.clientWidth)
    await page.getByRole('button', { name: 'Encajar', exact: true }).click()
    const ordered = await Promise.all(['board', 'elements', 'information'].map(id => geometry(page, id)))
    expect(ordered[0]).toEqual({ ...widths[0], x: 12, y: 12 })
    const rowWidth = visible / (scale / 100)
    let x = 12, y = 12, height = 0
    for (let i = 0; i < widths.length; i++) {
      const size = widths[i]!
      if (x > 12 && x + size.width + 12 > rowWidth) { x = 12; y += height + 12; height = 0 }
      expect(ordered[i]).toEqual({ ...size, x, y })
      x += size.width + 12; height = Math.max(height, size.height)
    }
    await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-scale', String(scale / 100))
    await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-offset-x', '0')
    expect(await page.locator('[data-module]').evaluateAll(els => els.map(el => (el as HTMLElement).style.zIndex))).toEqual(layers)
    await expect(page.locator('[data-module="elements"]').getByRole('button', { name: 'Seleccionar Referencia', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const saved = (await downloadDocument(page)).document
    expect(saved.moduleLayouts.clock).toEqual(fixture.moduleLayouts.clock)
    for (const id of ['board', 'elements', 'information'] as const) {
      expect(saved.moduleLayouts[id]!.width).toBe(fixture.moduleLayouts[id]!.width)
      expect(saved.moduleLayouts[id]!.height).toBe(fixture.moduleLayouts[id]!.height)
    }
    expect(saved.board).toEqual(fixture.board); expect(saved.elements).toEqual(fixture.elements)
    await noPageScroll(page)
    await page.screenshot({ path: info.outputPath(`puzzle-${scale}.png`) })
    const persisted = saved.moduleLayouts
    await page.setViewportSize({ width: 915, height: 412 })
    expect((await downloadDocument(page)).document.moduleLayouts).toEqual(persisted)
  })
}
test('extensión reconstruida desde cerrados y sin compactar al cerrar, zoom o resize; Nuevo reinicia', async ({ page }) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Cerrados')
  fixture.moduleLayouts.information = { x: 1700, y: 1200, width: 320, height: 240, referenceSize: { width: 2200, height: 1600 } }
  await loadDocument(page, fixture)
  expect(await extent(page)).toEqual({ width: 2200, height: 1600 })
  await openModule(page, 'Información')
  const before = await extent(page)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Información', exact: true }).click()
  await zoom(page, 200); await page.setViewportSize({ width: 412, height: 915 })
  expect(await extent(page)).toEqual(before)
  await page.getByRole('button', { name: 'Encajar' }).click()
  expect(await extent(page)).toEqual(before)
  expect((await downloadDocument(page)).document).toEqual(fixture)
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo', exact: true }).click()
  await expect.poll(async () => (await extent(page)).width).toBeLessThan(2200)
})
test('extends_workspace_before_grid_clamps_candidate: arrastre y tirador cruzan ambos bordes sin salto', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 })
  await page.goto('/')
  await openModule(page, 'Información')
  await zoom(page, 25)
  const original = await geometry(page, 'information'), initial = await extent(page)
  const header = (await page.locator('[data-module="information"] .module-header').boundingBox())!
  const x = header.x + 10, y = header.y + 3
  const dx = initial.width + 100, dy = initial.height + 100
  await page.mouse.move(x, y); await page.mouse.down()
  await page.mouse.move(x + dx * .25, y + dy * .25, { steps: 25 })
  await page.mouse.up()
  const moved = await geometry(page, 'information')
  expect(moved).toEqual({ ...original, x: original.x + dx, y: original.y + dy })
  const grown = await extent(page)
  expect(grown.width).toBeGreaterThan(moved.x + moved.width)
  expect(grown.height).toBeGreaterThan(moved.y + moved.height)
  // Reposition makes the handle visible; it does not change the manual size.
  await page.getByRole('button', { name: 'Encajar' }).click()
  const originBox = (await page.getByTestId('mobile-viewport').boundingBox())!
  await expect.poll(async () => (await page.locator('[data-module="information"]').boundingBox())!.x).toBeCloseTo(originBox.x + 3, 0)
  await expect.poll(async () => (await page.locator('[data-module="information"]').boundingBox())!.y).toBeCloseTo(originBox.y + 3, 0)
  const handle = (await page.locator('[data-module="information"] .react-resizable-handle').boundingBox())!
  const placed = await geometry(page, 'information'), beforeResize = await extent(page)
  const dw = beforeResize.width + 100, dh = beforeResize.height + 100
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
  for (const fraction of [.25, .5, .75, 1]) {
    await page.mouse.move(handle.x + handle.width / 2 + dw * .25 * fraction, handle.y + handle.height / 2 + dh * .25 * fraction, { steps: 5 })
    await expect.poll(async () => Math.abs((await page.locator('[data-module="information"]').boundingBox())!.width - (placed.width + dw * fraction) * .25)).toBeLessThanOrEqual(1)
  }
  await page.mouse.up()
  expect(await geometry(page, 'information')).toEqual({ ...placed, width: placed.width + dw, height: placed.height + dh })
  const originHeader = (await page.locator('[data-module="information"] .module-header').boundingBox())!
  await page.mouse.move(originHeader.x + 10, originHeader.y + 3); await page.mouse.down()
  await page.mouse.move(originHeader.x - 100, originHeader.y - 100, { steps: 5 }); await page.mouse.up()
  expect(await geometry(page, 'information')).toMatchObject({ x: 0, y: 0 })
  const saved = (await downloadDocument(page)).document
  expect(saved.moduleLayouts.information!.width).toBe(placed.width + dw)
  await page.reload()
  expect((await downloadDocument(page)).document.moduleLayouts).toEqual(saved.moduleLayouts)
  const rebuilt = await extent(page)
  expect(rebuilt.width).toBeGreaterThanOrEqual(saved.moduleLayouts.information!.x + saved.moduleLayouts.information!.width)
  await noPageScroll(page)
})
test('Pizarra explora vacío repetidamente, origen firme, imagen y cámaras separadas bajo tres zooms', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Pizarra')
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const ctx = c.getContext('2d')!; ctx.fillStyle = '#3680a0'; ctx.fillRect(0, 0, 800, 400); return c.toDataURL().split(',')[1]! })
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'fondo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByTestId('board-surface')).toHaveAttribute('data-image-width', '800')
  await zoom(page, 200, 'Zoom de Pizarra')
  await zoom(page, 25)
  const surface = page.getByTestId('board-surface')
  const initial = (await downloadDocument(page)).document
  const bounds = (await surface.boundingBox())!
  await page.mouse.move(bounds.x + 20, bounds.y + 20)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 10000); await page.keyboard.up('Control')
  await expect(surface).toHaveAttribute('data-scale', '0.25')
  const imagePixel = () => surface.evaluate(el => {
    const canvas = el.querySelector('canvas')!, scale = Number(el.getAttribute('data-scale'))
    return [...canvas.getContext('2d')!.getImageData((500 * scale + Number(el.getAttribute('data-offset-x'))) * canvas.width / el.clientWidth, (500 * scale + Number(el.getAttribute('data-offset-y'))) * canvas.height / el.clientHeight, 1, 1).data]
  })
  expect(await imagePixel()).toEqual([54, 128, 160, 255])
  for (let i = 0; i < 6; i++) await page.mouse.wheel(200, 200)
  await expect.poll(async () => Number(await surface.getAttribute('data-offset-y'))).toBeLessThan(-500)
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-offset-y', '0')
  const explored = Number(await surface.getAttribute('data-extent-height'))
  await page.mouse.wheel(-100000, -100000)
  await expect(surface).toHaveAttribute('data-offset-x', '0')
  await expect(surface).toHaveAttribute('data-offset-y', '0')
  expect(Number(await surface.getAttribute('data-extent-height'))).toBeGreaterThanOrEqual(explored)
  expect((await downloadDocument(page)).document).toEqual(initial)
  expect(await imagePixel()).toEqual([54, 128, 160, 255])
  await page.screenshot({ path: info.outputPath('board-origin.png') })
})
test('segunda pulsación táctil cancela arrastre y resize sin persistir ni desmontar contenido', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Cancelación con eventos táctiles Chromium')
  await page.goto('/'); await openModule(page, 'Calculadora')
  await page.getByLabel('Operación', { exact: true }).fill('12+3')
  const initial = await geometry(page, 'calculator')
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  for (const selector of ['.module-header', '.react-resizable-handle']) {
    const box = (await page.locator('[data-module="calculator"] ' + selector).boundingBox())!
    const a = { x: box.x + Math.min(15, box.width / 2), y: box.y + box.height / 2, id: 1 }
    const b = { x: Math.min(390, a.x + 30), y: Math.min(750, a.y + 30), id: 2 }
    await touch('touchStart', [a]); await touch('touchMove', [{ ...a, x: a.x + 15, y: a.y + 10 }])
    await touch('touchStart', [{ ...a, x: a.x + 15, y: a.y + 10 }, b]); await touch('touchEnd', [])
    expect(await geometry(page, 'calculator')).toEqual(initial)
    const actual = (await page.locator('[data-module="calculator"]').boundingBox())!
    expect(actual.width).toBeCloseTo(initial.width, 0); expect(actual.height).toBeCloseTo(initial.height, 0)
    const viewport = (await page.getByTestId('mobile-viewport').boundingBox())!
    expect(actual.x - viewport.x).toBeCloseTo(initial.x, 0); expect(actual.y - viewport.y).toBeCloseTo(initial.y, 0)
    await expect(page.getByLabel('Operación', { exact: true })).toHaveValue('12+3')
    expect((await savedDocument(page))?.moduleLayouts.calculator).toBeUndefined()
  }
  await session.detach()
})
test('mover guarda referencia propia y Puzzle sin layout conserva base manual y medida presentada', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 }); await page.goto('/')
  const fixture = createEmptyDocument('Referencia independiente')
  fixture.moduleLayouts.clock = { x: 4000, y: 3000, width: 440, height: 260, referenceSize: { width: 5000, height: 4000 } }
  await loadDocument(page, fixture); await openModule(page, 'Información')
  const header = (await page.locator('[data-module="information"] .module-header').boundingBox())!
  await page.mouse.move(header.x + 70, header.y + 5); await page.mouse.down()
  await page.mouse.move(header.x + 100, header.y + 20, { steps: 5 }); await page.mouse.up()
  const saved = (await downloadDocument(page)).document
  expect(saved.moduleLayouts.information!.referenceSize.width).toBe(412)
  expect(saved.moduleLayouts.clock).toEqual(fixture.moduleLayouts.clock)
  await openModule(page, 'Pizarra')
  const presented = await geometry(page, 'board')
  await page.getByRole('button', { name: 'Encajar' }).click()
  expect((await geometry(page, 'board')).width).toBe(presented.width)
  expect((await downloadDocument(page)).document.moduleLayouts.board!.width).toBe(720)
})

test('importados junto al origen conservan cajas y datos, permiten selección, edición y movimiento', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Origen importado')
  fixture.elements.push({ id: '00000000-0000-4000-8000-000000000001', name: 'Borde', information: '', pinVisible: true, visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 1, y: 1 }, isUnit: false, operational: null })
  fixture.board.quickNotes.push({ id: '00000000-0000-4000-8000-000000000002', title: '', scale: 1, text: 'Nota borde', position: { x: 1, y: 100 }, width: 220, height: 96 })
  await loadDocument(page, fixture); await openModule(page, 'Pizarra')
  const surface = page.getByTestId('board-surface'), box = (await surface.boundingBox())!
  await expect(surface).toHaveAttribute('data-offset-x', '0'); await expect(surface).toHaveAttribute('data-offset-y', '0')
  expect((await downloadDocument(page)).document).toEqual(fixture)
  await page.mouse.click(box.x + 6, box.y + 6)
  await expect(page.getByRole('button', { name: 'Seleccionar Borde', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Texto de nota rápida').click()
  await page.screenshot({ path: info.outputPath('imported-origin-actions.png') })
  await page.getByLabel('Texto de nota rápida').fill('Nota editada')
  await page.getByLabel('Texto de nota rápida').press('Tab')
  await page.mouse.move(box.x + 6, box.y + 6); await page.mouse.down()
  await page.waitForTimeout(280)
  await page.mouse.move(box.x + 86, box.y + 46, { steps: 5 }); await page.mouse.up()
  const saved = (await downloadDocument(page)).document
  expect(saved.elements[0]!.position!.x).toBeGreaterThan(1)
  const edited = saved.board.quickNotes[0]!
  expect(edited).toMatchObject({ id: fixture.board.quickNotes[0]!.id, title: '', text: 'Nota editada', width: 220, scale: 1 })
  expect(edited.height).toBeGreaterThan(0)
  expect(edited.height).toBeLessThan(96)
  expect(edited.position.x).toBe(1)
  expect(edited.position.y - edited.height / 2).toBe(52)
})
