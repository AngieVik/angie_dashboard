import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { createElement } from '../../src/features/elements/elementCommands'
import { bringModuleToFront, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'

const LONG_INFO = 'Canal 4\nAcceso norte\n'.repeat(8)

function fixture(width = 340, infoFirst = false) {
  const document = createEmptyDocument(`Entrega 8 · ${width}`)
  const unit = createElement(document, { name: 'Tango 8', isUnit: true, visual: { type: 'asset', assetId: 'ambulance', scale: 1 }, information: infoFirst ? LONG_INFO : 'Canal 4\nAcceso norte' })
  unit.pinVisible = false
  createElement(document, { name: 'Acceso', isUnit: false, visual: { type: 'emoji', value: '📍', scale: 1 }, information: 'Puerta norte' })
  const referenceSize = { width: 1440, height: 900 }
  document.moduleLayouts = {
    operations: { x: 0, y: infoFirst ? 360 : 0, width, height: 350, referenceSize },
    information: { x: 0, y: infoFirst ? 0 : 360, width: 340, height: 300, referenceSize },
    elements: { x: 350, y: 0, width: 300, height: 420, referenceSize },
  }
  return document
}
async function setup(page: Page, width = 340, infoFirst = false) {
  await page.goto('/')
  await loadDocument(page, fixture(width, infoFirst))
  await openModule(page, 'Información')
  await openModule(page, 'Operativo')
  await bringModuleToFront(page, 'Información')
  await page.getByRole('button', { name: 'Seleccionar Tango 8', exact: true }).click()
  await bringModuleToFront(page, 'Operativo')
}
async function zoom(page: Page, label: string, value: number) {
  const input = page.getByRole('spinbutton', { name: label, exact: true })
  await input.fill(String(value)); await input.press('Enter')
}

test('entrega 8: selectores iguales, 1–8 columnas, abreviaturas y ambos zooms', async ({ page, isMobile }, info) => {
  await setup(page)
  const ops = page.getByRole('region', { name: 'Operativo', exact: true })
  const grid = ops.getByRole('group', { name: 'Estado operativo' })
  const sizes = isMobile ? [[250, 1], [340, 2]] : [[250, 1], [300, 2], [450, 3], [650, 4], [800, 5], [950, 6], [1110, 7], [1270, 8], [340, 2]]
  for (const [width, columns] of sizes) {
    await loadDocument(page, fixture(width))
    await bringModuleToFront(page, 'Información')
    await page.getByRole('button', { name: 'Seleccionar Tango 8', exact: true }).click()
    await bringModuleToFront(page, 'Operativo')
    await expect.poll(() => grid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(columns)
    const rects = await grid.getByRole('button').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect()
      return { width: rect.width, height: rect.height, fits: node.scrollWidth <= node.clientWidth }
    }))
    expect(rects).toHaveLength(8)
    expect(Math.max(...rects.map(r => r.width)) - Math.min(...rects.map(r => r.width))).toBeLessThan(1)
    expect(new Set(rects.map(r => r.height)).size).toBe(1)
    expect(rects.every(r => r.fits)).toBe(true)
  }
  await expect(grid.locator('.operations-state-name').first()).toBeVisible()
  const notes = ops.getByRole('textbox', { name: 'Anotación' })
  const initialHeight = await notes.evaluate(node => node.getBoundingClientRect().height)
  await notes.fill('Revisar radio\nCanal 4\nAcceso norte')
  await expect.poll(() => notes.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(initialHeight * 1.5)
  await notes.fill('')
  await expect.poll(() => notes.evaluate(node => node.getBoundingClientRect().height)).toBe(initialHeight)
  await page.screenshot({ path: info.outputPath('operations-100.png') })
  await zoom(page, 'Zoom de Operativo', 150)
  await zoom(page, 'Zoom actual', 75)
  await expect(grid.locator('.operations-state-abbr').first()).toBeVisible()
  await expect(grid.locator('.operations-state-name').first()).toBeHidden()
  await expect(grid.getByRole('button', { name: 'Disponible', exact: true })).toContainText('DISP')
  await expect(grid.getByRole('button', { name: 'Operativa', exact: true })).toContainText('REAC')
  await expect(grid.getByRole('button', { name: 'Inoperativa', exact: true })).toContainText('⚫')
  await page.screenshot({ path: info.outputPath('operations-narrow-zoom.png') })
  await notes.scrollIntoViewIfNeeded()
  await expect(notes).toBeInViewport()
  await noPageScroll(page)
  await expect.poll(async () => (await savedDocument(page))?.timeline.length).toBe(0)
})

test('entrega 8: consulta táctil de estado/fase no cambia datos y tap corto cambia una vez', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'Emulación táctil Chromium')
  await setup(page)
  const button = page.getByRole('region', { name: 'Operativo', exact: true }).getByRole('button', { name: 'Interviniendo', exact: true })
  const rect = (await button.boundingBox())!
  const finger = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }
  const session = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
  await touch('touchStart', [finger]); await page.waitForTimeout(550)
  await expect(page.getByRole('tooltip')).toContainText('Interviniendo · Fase: Asistencia')
  await touch('touchEnd', [])
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await savedDocument(page))?.timeline.length).toBe(0)
  await touch('touchStart', [finger]); await touch('touchEnd', [])
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await savedDocument(page))?.timeline.length).toBe(1)
  await touch('touchStart', [finger]); await touch('touchEnd', [])
  await expect.poll(async () => (await savedDocument(page))?.timeline.length).toBe(1)
  await session.detach()
})

test('entrega 8: Información conserva identidad, descripción fija, texto libre y etiquetas', async ({ page }, info) => {
  await setup(page, 340, true)
  const ops = page.getByRole('region', { name: 'Operativo', exact: true })
  const panel = page.getByRole('region', { name: 'Información', exact: true })
  await ops.getByRole('button', { name: 'Interviniendo', exact: true }).click()
  await ops.getByRole('textbox', { name: 'Nueva etiqueta' }).fill('Sector norte')
  await ops.getByRole('button', { name: 'Añadir etiqueta', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.elements[0]?.operational?.tags).toEqual(['Sector norte'])
  await bringModuleToFront(page, 'Información')
  await expect(panel.locator('.information-identity img')).toHaveAttribute('src', '/assets/elements/icon_medical.png')
  await expect(panel.getByLabel('Pin oculto')).toBeVisible()
  await expect(panel.locator('.information-description')).toHaveText('Aislamiento y control, triaje, soporte vital y estabilización.')
  await expect(panel.locator('.information-text')).toHaveText(LONG_INFO)
  await expect(panel.getByLabel('Etiquetas')).toHaveText('Sector norte')
  await page.screenshot({ path: info.outputPath('information-100.png') })
  await bringModuleToFront(page, 'Operativo')
  await ops.getByRole('button', { name: 'Operativa', exact: true }).click()
  await expect(panel.locator('.information-description')).toHaveText('Reactivación del recurso y retorno a su punto de cobertura.')
  await expect(panel.locator('.information-text')).toHaveText(LONG_INFO)
  await zoom(page, 'Zoom de Información', 150)
  await zoom(page, 'Zoom actual', 75)
  await bringModuleToFront(page, 'Información')
  await noPageScroll(page)
  await page.screenshot({ path: info.outputPath('information-narrow-zoom.png') })
  await panel.getByLabel('Etiquetas').scrollIntoViewIfNeeded()
  await expect(panel.getByLabel('Etiquetas')).toBeInViewport()
  await expect.poll(async () => (await savedDocument(page))?.timeline.length).toBe(2)
})
