import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { bringModuleToFront, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'

async function setup(page: Page, content = false, width = 600) {
  await page.goto('/')
  const fixture = createEmptyDocument('Herramientas')
  const size = await page.getByTestId('mobile-viewport').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
  fixture.moduleLayouts.board = { x: 0, y: 0, width: Math.min(width, size.width), height: Math.min(560, size.height), referenceSize: size }
  if (content) {
    fixture.elements.push({ id: '00000000-0000-4000-8000-000000000001', name: 'Referencia', information: 'Acceso norte', isUnit: false, operational: null,
      pinVisible: true, visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 } })
    fixture.board.quickNotes.push({ id: '00000000-0000-4000-8000-000000000002', title: '', scale: 1, text: 'Ruta', position: { x: 250, y: 180 }, width: 180, height: 80 })
    fixture.board.strokes.push({ id: '00000000-0000-4000-8000-000000000003', tool: 'pen', color: '#FFFFFF', width: 4, points: [{ x: 30, y: 30 }] })
    fixture.board.backgroundColor = '#223344'
  }
  await loadDocument(page, fixture); await openModule(page, 'Pizarra')
  return fixture
}
async function zoom(page: Page, value: number, name = 'Zoom actual') {
  const input = page.getByRole('spinbutton', { name, exact: true })
  await input.fill(String(value)); await input.press('Enter')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function thickness(page: Page, end = true) {
  await page.getByRole('button', { name: 'Abrir deslizador: Grosor', exact: true }).click()
  await page.getByRole('slider', { name: 'Grosor', exact: true }).press(end ? 'End' : 'Home')
  await page.keyboard.press('Escape')
}

async function visibleBoardPoint(page: Page) {
  return page.getByTestId('board-surface').evaluate(el => {
    const board = el.getBoundingClientRect(), clip = el.closest('.module-content')!.getBoundingClientRect()
    const left = Math.max(board.left, clip.left, 0), right = Math.min(board.right, clip.right, innerWidth)
    const top = Math.max(board.top, clip.top, 0), bottom = Math.min(board.bottom, clip.bottom, innerHeight)
    return { x: (left + right) / 2, y: (top + bottom) / 2 }
  })
}

test('barra compacta: orden, iconos, listas sin creación y slider en borde escalado', async ({ page, isMobile }, info) => {
  const fixture = await setup(page, true, 320)
  const pin = page.getByRole('button', { name: 'Seleccionar Referencia', exact: true })
  await pin.click()
  const toolbar = page.locator('.board-toolbar')
  const controls = toolbar.locator('button')
  expect(await controls.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual([
    'Seleccionar/mover', 'Lápiz', 'Goma', 'Abrir deslizador: Grosor', 'Elegir color del lápiz',
    'Nota rápida', 'Abrir Dotaciones', 'Abrir Elementos', 'Elegir color de fondo', 'Elegir imagen de fondo', 'Borrar imagen de fondo',
  ])
  expect(await controls.evaluateAll(nodes => nodes.map(node => node.querySelector('svg')?.getAttribute('class')))).toEqual([
    'lucide lucide-pointer', 'lucide lucide-pencil', 'lucide lucide-eraser', 'lucide lucide-git-commit-vertical', 'lucide lucide-palette',
    'lucide lucide-sticky-note', 'lucide lucide-ambulance', 'lucide lucide-package', 'lucide lucide-paint-roller', 'lucide lucide-file-image', 'lucide lucide-image-off',
  ])
  const rows = await controls.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
  expect(Math.max(...rows) - Math.min(...rows)).toBeLessThan(1)
  for (const name of ['Dotaciones', 'Elementos', 'Dotaciones']) {
    await bringModuleToFront(page, 'Pizarra')
    const action = page.getByRole('button', { name: 'Abrir ' + name, exact: true })
    if (isMobile) await action.tap(); else await action.click()
    const id = name === 'Dotaciones' ? 'dotations' : 'elements'
    await expect(page.locator('[data-module="' + id + '"] .module-frame')).toHaveAttribute('data-active', 'true')
    expect(await savedDocument(page)).toEqual(fixture)
    await expect(page.locator('.board-pin-visual')).toHaveAttribute('aria-pressed', 'true')
  }
  await bringModuleToFront(page, 'Dotaciones')
  await page.getByRole('button', { name: 'Cerrar Dotaciones', exact: true }).click()
  await bringModuleToFront(page, 'Elementos')
  await page.getByRole('button', { name: 'Cerrar Elementos', exact: true }).click()
  await bringModuleToFront(page, 'Pizarra')
  await zoom(page, 200, 'Zoom de Pizarra')
  const trigger = page.getByRole('button', { name: 'Abrir deslizador: Grosor', exact: true })
  await trigger.click()
  const popover = page.getByRole('dialog', { name: 'Grosor', exact: true })
  await expect(popover).toBeVisible()
  const rect = (await popover.boundingBox())!
  const viewport = page.viewportSize()!
  expect(rect.x).toBeGreaterThanOrEqual(7); expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - 7)
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - 7)
  await page.getByRole('slider', { name: 'Grosor' }).press('End')
  await expect(page.getByRole('slider', { name: 'Grosor' })).toHaveAttribute('aria-valuenow', '40')
  await page.screenshot({ path: info.outputPath('toolbar-slider-edge.png') })
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  if (isMobile) {
    await zoom(page, 100, 'Zoom de Pizarra')
    await toolbar.evaluate(el => { el.scrollLeft = el.scrollWidth })
    await expect(page.getByRole('button', { name: 'Borrar imagen de fondo' })).toBeInViewport()
    expect(await toolbar.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  }
  await noPageScroll(page)
})

for (const [general, moduleZoom, boardZoom] of [[25, 25, .25], [100, 100, 1], [200, 50, 1.5], [50, 200, .5], [400, 400, 4]]) {
  test('cursor circular bajo zooms ' + general + '/' + moduleZoom + '/' + boardZoom, async ({ page }, info) => {
    await setup(page)
    await thickness(page)
    await page.getByLabel('Color del lápiz', { exact: true }).fill('#12ab34')
    await zoom(page, moduleZoom!, 'Zoom de Pizarra'); await zoom(page, general!)
    const surface = page.getByTestId('board-surface')
    const point = await visibleBoardPoint(page)
    await page.mouse.move(point.x, point.y)
    // Invoke the real wheel handler directly: mobile CDP Ctrl+wheel scales delta by DPR.
    await surface.dispatchEvent('wheel', { deltaY: -Math.log(boardZoom!) / .002, ctrlKey: true, clientX: point.x, clientY: point.y })
    await expect.poll(async () => Number(await surface.getAttribute('data-scale'))).toBeCloseTo(boardZoom!, 5)
    for (const name of ['Lápiz', 'Goma']) {
      // Focus scrolls the tool into its own toolbar, without changing geometry.
      await page.getByRole('radio', { name, exact: true }).focus(); await page.keyboard.press('Space')
      const activePoint = await visibleBoardPoint(page)
      await page.mouse.move(activePoint.x + 1, activePoint.y + 1)
      const cursor = page.locator('.board-tool-cursor')
      await expect(cursor).toBeVisible()
      const box = (await cursor.boundingBox())!
      expect(Math.abs(box.width - 40 * boardZoom! * moduleZoom! / 100 * general! / 100)).toBeLessThan(.1)
      expect(box.height).toBeCloseTo(box.width, 1)
      expect(box.x + box.width / 2).toBeCloseTo(activePoint.x + 1, 0)
      expect(box.y + box.height / 2).toBeCloseTo(activePoint.y + 1, 0)
      await expect(surface).toHaveCSS('cursor', 'none')
      await expect(cursor).toHaveCSS('background-color', name === 'Lápiz' ? 'rgb(18, 171, 52)' : 'rgba(0, 0, 0, 0)')
      await page.screenshot({ path: info.outputPath(name === 'Lápiz' ? 'cursor-pen.png' : 'cursor-eraser.png') })
    }
    await noPageScroll(page)
  })
}

test('retirar imagen conserva color, trazos, pines y notas; color vuelve al fondo', async ({ page }, info) => {
  const fixture = await setup(page, true), surface = page.getByTestId('board-surface')
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const ctx = c.getContext('2d')!; ctx.fillStyle = '#3680A0'; ctx.fillRect(0, 0, 800, 400); return c.toDataURL().split(',')[1]! })
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(surface).toHaveAttribute('data-image-width', '800')
  await page.getByRole('button', { name: 'Borrar imagen de fondo' }).click()
  await expect(surface).toHaveAttribute('data-image-width', '0')
  expect(await savedDocument(page)).toEqual(fixture)
  await expect(page.getByRole('button', { name: 'Seleccionar Referencia', exact: true })).toBeVisible()
  await expect(page.getByLabel('Texto de nota rápida')).toBeVisible()
  const corner = await surface.evaluate(el => [...el.querySelector('canvas')!.getContext('2d')!.getImageData(1, 1, 1, 1).data])
  expect(corner).toEqual([34, 51, 68, 255])
  await page.getByLabel('Cargar imagen de fondo').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(surface).toHaveAttribute('data-image-width', '800')
  await page.getByLabel('Color de fondo', { exact: true }).fill('#445566')
  await expect(surface).toHaveAttribute('data-image-width', '0')
  await expect.poll(async () => (await savedDocument(page))?.board.backgroundColor).toBe('#445566')
  const current = (await savedDocument(page))!
  expect(current.board.strokes).toEqual(fixture.board.strokes); expect(current.board.quickNotes).toEqual(fixture.board.quickNotes)
  expect(current.elements).toEqual(fixture.elements)
  await page.screenshot({ path: info.outputPath('background-contents.png') })
})

test('vacío deselecciona globalmente sin consumir dibujo, arrastre, edición ni controles', async ({ page }) => {
  await setup(page, true)
  const pin = page.getByRole('button', { name: 'Seleccionar Referencia', exact: true }), surface = page.getByTestId('board-surface')
  await pin.click(); await expect(pin).toHaveAttribute('aria-pressed', 'true')
  const box = (await surface.boundingBox())!, a = { x: box.x + 20, y: box.y + box.height - 30 }
  for (const name of ['Lápiz', 'Goma']) {
    await page.getByRole('radio', { name, exact: true }).click()
    await expect(pin).toHaveAttribute('aria-pressed', 'true')
    const before = (await savedDocument(page))!.board.strokes.length
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 30, a.y); await page.mouse.up()
    await expect.poll(async () => (await savedDocument(page))?.board.strokes.length).toBe(before + 1)
    await expect(pin).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.click(a.x, a.y)
    await expect(pin).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('radio', { name: 'Seleccionar/mover', exact: true }).click(); await pin.click()
  }
  const note = page.getByLabel('Texto de nota rápida')
  await note.click()
  await page.getByLabel('Texto de nota rápida').fill('Ruta conservada')
  await page.getByLabel('Texto de nota rápida').press('Tab')
  await expect(page.getByLabel('Texto de nota rápida')).toBeVisible()
  await pin.click()
  await page.getByRole('button', { name: 'Nota rápida', exact: true }).click()
  await expect(page.getByLabel('Texto de nota rápida').last()).toBeFocused()
  await page.mouse.click(a.x, a.y)
  await expect(pin).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('Texto de nota rápida').last()).toHaveValue('')
})

test('tacto: tap actúa una vez, consulta muestra ayuda y dibujo sin hover', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Requiere emulación táctil Chromium')
  await setup(page)
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const pen = page.getByRole('radio', { name: 'Lápiz', exact: true }), button = (await pen.boundingBox())!
  const finger = { x: button.x + button.width / 2, y: button.y + button.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(550)
  await expect(page.getByRole('tooltip')).toContainText('Lápiz')
  await touch('touchEnd', [])
  await expect(pen).toHaveAttribute('aria-checked', 'false')
  await touch('touchStart', [finger]); await touch('touchEnd', [])
  await expect(pen).toHaveAttribute('aria-checked', 'true')
  const area = (await page.getByTestId('board-surface').boundingBox())!, start = { x: area.x + 40, y: area.y + 40, id: 1 }
  await touch('touchStart', [start]); await touch('touchMove', [{ ...start, x: start.x + 30 }]); await touch('touchEnd', [])
  await expect.poll(async () => (await savedDocument(page))?.board.strokes.length).toBe(1)
  await expect(page.locator('.board-tool-cursor')).toHaveCount(0)
  await session.detach()
})

test('tacto: Grosor abre, cierra y permite arrastrar el slider sin modificar contenido', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Requiere emulación táctil Chromium')
  await setup(page)
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  const beforeSlider = await savedDocument(page)
  const trigger = page.getByRole('button', { name: 'Abrir deslizador: Grosor', exact: true })
  const triggerBox = (await trigger.boundingBox())!
  const finger = { x: triggerBox.x + triggerBox.width / 2, y: triggerBox.y + triggerBox.height / 2, id: 1 }
  await touch('touchStart', [finger]); await page.waitForTimeout(60); await touch('touchEnd', [])
  await expect(page.getByRole('dialog', { name: 'Grosor', exact: true })).toBeVisible()
  await touch('touchStart', [{ ...finger, id: 2 }]); await touch('touchEnd', [])
  await expect(page.getByRole('dialog', { name: 'Grosor', exact: true })).toHaveCount(0)
  await touch('touchStart', [{ ...finger, id: 3 }]); await touch('touchEnd', [])
  const track = (await page.locator('.ui-popover .ui-slider').boundingBox())!
  const handle = { x: track.x + 6, y: track.y + track.height / 2, id: 4 }
  await touch('touchStart', [handle]); await page.waitForTimeout(60)
  for (let step = 1; step <= 5; step++) {
    await touch('touchMove', [{ ...handle, x: handle.x + (track.width - 7) * step / 5 }]); await page.waitForTimeout(20)
  }
  await touch('touchEnd', [])
  await expect(page.getByRole('slider', { name: 'Grosor', exact: true })).toHaveAttribute('aria-valuenow', '40')
  expect(await savedDocument(page)).toEqual(beforeSlider)
  await session.detach()
})


test('goma de grosor mínimo conserva diámetro subpixel bajo zoom propio', async ({ page }) => {
  await setup(page); await thickness(page, false)
  await page.getByRole('radio', { name: 'Goma', exact: true }).click()
  const surface = page.getByTestId('board-surface'), rect = (await surface.boundingBox())!
  await surface.dispatchEvent('wheel', { deltaY: 10000, ctrlKey: true, clientX: rect.x + 30, clientY: rect.y + 30 })
  await expect(surface).toHaveAttribute('data-scale', '0.25')
  await page.mouse.move(rect.x + 30, rect.y + 30)
  const cursor = page.locator('.board-tool-cursor')
  await expect(cursor).toBeVisible()
  expect((await cursor.boundingBox())!.width).toBeCloseTo(.25, 2)
})


test('grosor cierra si el scroll exterior recorta su trigger aunque siga dentro del viewport', async ({ page }) => {
  const fixture = await setup(page, false, 320)
  fixture.moduleLayouts.board!.x = 200
  await loadDocument(page, fixture)
  await zoom(page, 200, 'Zoom de Pizarra')
  await page.getByRole('button', { name: 'Abrir deslizador: Grosor', exact: true }).click()
  const popover = page.getByRole('dialog', { name: 'Grosor', exact: true })
  await expect(popover).toBeVisible()
  await page.locator('[data-module="board"] .module-content').evaluate(el => { el.scrollLeft = el.scrollWidth })
  await expect(popover).toHaveCount(0)
})
