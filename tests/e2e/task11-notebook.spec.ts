import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import type { AngieDocumentV1 } from '../../src/domain/document/types'

async function open(page: Page) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Cuaderno', exact: true }).click()
}
async function add(page: Page, type: 'Nota' | 'Checklist') {
  await page.getByRole('button', { name: 'Añadir bloque', exact: true }).click()
  await page.getByRole('menuitem', { name: type, exact: true }).click()
}
async function saved(page: Page): Promise<AngieDocumentV1> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('angie-dashboard')
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<AngieDocumentV1>((resolve, reject) => {
        const request = db.transaction('documents', 'readonly').objectStore('documents').get('active')
        request.onsuccess = () => resolve(request.result.document); request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  })
}

test.beforeEach(async ({ page, context, isMobile }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await open(page)
  if (isMobile) {
    // Exercise the same layout at a usable zoom using real two-finger input.
    const viewport = page.getByTestId('mobile-viewport')
    const start = await viewport.evaluate(node => ({ scale: Number(node.getAttribute('data-scale')), x: Number(node.getAttribute('data-offset-x')), y: Number(node.getAttribute('data-offset-y')), top: node.getBoundingClientRect().top, width: node.clientWidth, height: node.clientHeight }))
    const session = await context.newCDPSession(page)
    const x = start.x + 180 * start.scale, y = start.top + start.y + 210 * start.scale
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 20, y, id: 2 }] })
    const centerX = start.width / 2, centerY = start.top + start.height / 2, half = 20 / start.scale
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centerX - half, y: centerY, id: 1 }, { x: centerX + half, y: centerY, id: 2 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Number(await viewport.getAttribute('data-scale'))).toBeGreaterThan(0.9)
    await session.detach()
  }
})

test('CRUD sin conexión, teclado, autoguardado, exportación, recarga y carga conservan texto y marcas', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  const module = page.getByRole('region', { name: 'Cuaderno', exact: true })
  await module.getByRole('button', { name: 'Añadir bloque' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem')).toHaveText(['Nota', 'Checklist'])
  await page.getByRole('menuitem', { name: 'Nota', exact: true }).focus()
  await expect(page.getByRole('menuitem', { name: 'Nota', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await module.getByRole('textbox', { name: 'Texto de nota' }).fill('Preparación\n⚠ Acceso norte → sur\n📻 Radio')
  await add(page, 'Checklist')
  const checklist = module.locator('[data-block-type="checklist"]')
  await checklist.getByRole('button', { name: 'Añadir elemento' }).focus(); await page.keyboard.press('Enter')
  await checklist.getByRole('textbox', { name: 'Texto del elemento 1' }).fill('Comprobar canal 📻')
  const checkbox = checklist.getByRole('checkbox', { name: 'Marcar elemento 1' })
  await checkbox.focus(); await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
  await page.keyboard.press('Space'); await expect(checkbox).not.toBeChecked()
  await page.keyboard.press('Space')
  await checklist.getByRole('button', { name: 'Añadir elemento' }).click()
  await checklist.getByRole('textbox', { name: 'Texto del elemento 2' }).fill('Borrar este elemento')
  await checklist.getByRole('button', { name: 'Eliminar elemento 2' }).click()
  await module.getByRole('button', { name: 'Reordenar bloque 2' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(module.locator('[data-block-type]').first()).toHaveAttribute('data-block-type', 'checklist')
  await add(page, 'Nota')
  await module.getByRole('textbox', { name: 'Texto de nota' }).last().fill('Bloque temporal')
  await module.locator('[data-block-id]').last().getByRole('button', { name: 'Eliminar bloque' }).click()
  await expect(module.locator('[data-block-id]')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Título del documento' }).fill('Cuaderno Task 11')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  const jsonText = await readFile((await (await downloading).path())!, 'utf8')
  const exported: AngieDocumentV1 = JSON.parse(jsonText)
  expect(exported.notebook).toEqual([
    { id: expect.any(String), type: 'checklist', items: [{ id: expect.any(String), text: 'Comprobar canal 📻', checked: true }] },
    { id: expect.any(String), type: 'note', text: 'Preparación\n⚠ Acceso norte → sur\n📻 Radio' },
  ])
  expect(Object.keys(exported)).toHaveLength(9)
  await expect.poll(async () => (await saved(page)).notebook).toEqual(exported.notebook)
  await page.screenshot({ path: info.outputPath('notebook.png') })
  await module.screenshot({ path: info.outputPath('notebook-detail.png') })
  await page.getByRole('button', { name: 'Cerrar Cuaderno' }).click(); await open(page)
  await expect(checkbox).toBeChecked()
  await expect(module.getByRole('textbox', { name: 'Texto de nota' })).toHaveValue('Preparación\n⚠ Acceso norte → sur\n📻 Radio')
  await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Título del documento' })).toHaveValue('Cuaderno Task 11')
  await open(page)
  await expect(checkbox).toBeChecked()
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo', exact: true }).click()
  await expect(module.locator('[data-block-id]')).toHaveCount(0)
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'notebook.json', mimeType: 'application/json', buffer: Buffer.from(jsonText) })
  await expect(module.locator('[data-block-id]')).toHaveCount(2)
  await expect(checkbox).toBeChecked()
  await expect.poll(async () => (await saved(page)).notebook).toEqual(exported.notebook)
  expect(errors).toEqual([])
})

test('reordena con ratón o tacto solo desde el tirador sin mover el módulo', async ({ page, context, isMobile }) => {
  await add(page, 'Nota'); await add(page, 'Checklist')
  const module = page.locator('[data-module="notebook"]')
  const before = await module.evaluate(node => [node.getAttribute('data-x'), node.getAttribute('data-y'), node.getAttribute('data-width'), node.getAttribute('data-height')])
  const first = await module.getByRole('button', { name: 'Reordenar bloque 1' }).boundingBox()
  const second = await module.getByRole('button', { name: 'Reordenar bloque 2' }).boundingBox()
  const targetBlock = await module.locator('[data-block-id]').last().boundingBox()
  const endY = targetBlock!.y + targetBlock!.height - 8
  const session = await context.newCDPSession(page)
  const drag = async (x: number, y: number, toY: number) => {
    if (isMobile) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: toY, id: 1 }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else {
      await page.mouse.move(x, y); await page.mouse.down()
      await page.mouse.move(x, toY, { steps: 6 }); await page.mouse.up()
    }
  }
  const content = await module.getByRole('textbox', { name: 'Texto de nota' }).boundingBox()
  await drag(content!.x + content!.width / 2, content!.y + 10, endY)
  await expect(module.locator('[data-block-type]').first()).toHaveAttribute('data-block-type', 'note')
  await drag(first!.x + first!.width / 2, first!.y + first!.height / 2, endY)
  await expect(module.locator('[data-block-type]').first()).toHaveAttribute('data-block-type', 'checklist')
  await expect.poll(async () => (await saved(page)).notebook.map(block => block.type)).toEqual(['checklist', 'note'])
  expect(await module.evaluate(node => [node.getAttribute('data-x'), node.getAttribute('data-y'), node.getAttribute('data-width'), node.getAttribute('data-height')])).toEqual(before)
  expect(second).not.toBeNull()
  await session.detach()
})

test('tamaño mínimo, lista con scroll interno, nombres accesibles y foco visible', async ({ page, context, isMobile }, info) => {
  const document = createEmptyDocument('Mínimo Cuaderno')
  document.moduleLayouts.notebook = { x: 0, y: 0, width: 260, height: 220 }
  document.notebook = Array.from({ length: 8 }, (_, index) => ({ id: crypto.randomUUID(), type: 'note', text: `Bloque ${index + 1}\n📻 Preparación` }))
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await expect(page.getByRole('textbox', { name: 'Título del documento' })).toHaveValue('Mínimo Cuaderno')
  const module = page.getByRole('region', { name: 'Cuaderno', exact: true }), list = module.getByRole('list', { name: 'Bloques del Cuaderno' })
  expect(await list.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await module.locator('.module-content').evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true)
  for (const control of await module.locator('button,textarea').all()) await expect(control).toHaveAccessibleName(/.+/)
  const addButton = module.getByRole('button', { name: 'Añadir bloque' })
  await expect(addButton).toBeInViewport()
  await addButton.focus()
  expect(await addButton.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none')
  const ids = document.notebook.map(block => block.id)
  if (isMobile) {
    const rect = await list.locator('.notebook-kind').first().boundingBox(), session = await context.newCDPSession(page)
    // Scroll from block content, away from block and module resize handles.
    const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 25, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 65, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await list.hover(); await page.mouse.wheel(0, 180)
  }
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  expect(await module.locator('[data-block-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-block-id')))).toEqual(ids)
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('notebook-minimum.png') })
})

test('dos dedos cancelan el reordenado sin perder datos', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'requiere emulación táctil Chromium')
  await add(page, 'Nota'); await add(page, 'Checklist')
  const module = page.locator('[data-module="notebook"]'), session = await context.newCDPSession(page)
  const ids = await module.locator('[data-block-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-block-id')))
  const rect = await module.getByRole('button', { name: 'Reordenar bloque 1' }).boundingBox()
  const target = await module.locator('[data-block-id]').last().boundingBox()
  const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height / 2, toY = target!.y + target!.height - 8
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: toY, id: 1 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: toY, id: 1 }, { x: x + 80, y: toY, id: 2 }] })
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'true')
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 10, y: toY, id: 1 }, { x: x + 100, y: toY, id: 2 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-gesturing', 'false')
  expect(await module.locator('[data-block-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-block-id')))).toEqual(ids)
  await expect(module.getByRole('textbox', { name: 'Texto de nota' })).toHaveValue('')
  await session.detach()
})
