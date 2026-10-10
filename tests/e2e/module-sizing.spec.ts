import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { createElement } from '../../src/features/elements/elementCommands'
import { loadDocument, openModule, bringModuleToFront } from './acceptance-helpers'

async function zoom(page: Page, name: string, value: number) {
  const input = page.getByRole('spinbutton', { name, exact: true })
  await input.fill(String(value)); await input.press('Enter')
}
async function separate(buttons: Locator) {
  const rectangles = await buttons.evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }
  }))
  for (let a = 0; a < rectangles.length; a++) for (let b = a + 1; b < rectangles.length; b++) {
    const r = rectangles[a]!, s = rectangles[b]!
    expect(r.right <= s.x + 1 || s.right <= r.x + 1 || r.bottom <= s.y + 1 || s.bottom <= r.y + 1).toBe(true)
  }
}
test('reloj se ancla, amplía al añadir y separa controles incluso con zoom', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Reloj')
  const fixture = createEmptyDocument('Ajuste Reloj')
  fixture.moduleLayouts.clock = { x: 0, y: 0, width: 180, height: 150, referenceSize: { width: 1440, height: 900 } }
  await loadDocument(page, fixture)
  const clock = page.locator('[data-module="clock"]'), content = clock.locator('.clock-module')
  await page.evaluate(() => document.fonts.ready)
  expect(await content.evaluate(node => getComputedStyle(node.querySelector('.clock-esp')!).fontFamily)).toContain('Rajdhani')
  expect(await page.evaluate(() => document.fonts.check('600 16px Rajdhani'))).toBe(true)
  for (const width of [100, 180]) {
    await clock.evaluate((node, width) => { (node as HTMLElement).style.width = width + 'px' }, width)
    await separate(clock.locator('.clock-add-controls button'))
    for (const button of await clock.locator('.clock-add-controls button[data-text-button]').all()) {
      const fits = await button.evaluate(node => {
        const text = document.createRange(); text.selectNodeContents(node)
        return text.getBoundingClientRect().width <= node.clientWidth
      })
      expect(fits).toBe(true)
    }
  }
  const initial = await clock.getAttribute('data-height')
  for (const name of ['T-Zero', 'T-Minus', 'Advisories']) await clock.getByRole('button', { name, exact: true }).click()
  expect(Number(await clock.getAttribute('data-width'))).toBeGreaterThanOrEqual(302)
  expect(Number(await clock.getAttribute('data-height'))).toBeGreaterThan(Number(initial))
  await expect(clock.getByRole('textbox', { name: 'Nota' })).toHaveCount(0)
  const duration = clock.getByRole('group', { name: 'T-Minus 1', exact: true }).getByRole('textbox', { name: 'Duración inicial' })
  await duration.fill('00:90:00'); await duration.press('Tab'); await expect(duration).toHaveValue('01:30:00')
  await expect(duration).toHaveCSS('border-top-width', '0px')
  expect(await clock.locator('.module-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  const preview = clock.getByRole('button', { name: 'Reproducir prueba de sonido' })
  await expect(preview).toHaveText(''); await expect(preview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  for (const scale of [50, 100, 200]) {
    await zoom(page, 'Zoom de Reloj', scale)
    await separate(clock.locator('.clock-add-controls button'))
    for (const row of await clock.locator('.timer-row').all()) await separate(row.getByRole('button'))
  }
  await zoom(page, 'Zoom de Reloj', 100)
  const bounds = await clock.evaluate(node => {
    const content = node.querySelector('.clock-module')!.getBoundingClientRect(), footer = node.querySelector('.module-controls')!.getBoundingClientRect(), frame = node.querySelector('.module-frame')!.getBoundingClientRect()
    return { bottom: content.bottom - footer.top, right: content.right - frame.right, scroll: getComputedStyle(node.querySelector('.module-content')!).scrollbarWidth }
  })
  expect(Math.abs(bounds.bottom)).toBeLessThanOrEqual(1); expect(Math.abs(bounds.right)).toBeLessThanOrEqual(1)
  expect(bounds.scroll).toBe('none')
  await clock.screenshot({ path: info.outputPath('reloj.png') })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await page.context().setOffline(true); await page.reload(); await openModule(page, 'Reloj')
  await expect(clock.getByLabel('Hora española')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('600 16px Rajdhani'))).toBe(true)
})

test('calculadora ocupa el footer y Operativo ajusta columnas, letra y ancho', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Calculadora'); await openModule(page, 'Operativo'); await openModule(page, 'Dotaciones')
  const fixture = createEmptyDocument('Ajustes de módulos')
  createElement(fixture, { name: 'Unidad Demo', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, information: '', position: { x: 0, y: 0 } })
  const referenceSize = { width: 1440, height: 900 }
  fixture.moduleLayouts.dotations = { x: 0, y: 0, width: 250, height: 300, referenceSize }
  fixture.moduleLayouts.calculator = { x: 0, y: 0, width: 280, height: 360, referenceSize }
  fixture.moduleLayouts.operations = { x: 0, y: 0, width: 180, height: 400, referenceSize }
  await loadDocument(page, fixture); await bringModuleToFront(page, 'Dotaciones')
  await page.getByRole('region', { name: 'Dotaciones', exact: true }).getByRole('button', { name: 'Seleccionar Unidad Demo', exact: true }).click()
  await bringModuleToFront(page, 'Operativo')
  const ops = page.getByRole('region', { name: 'Operativo', exact: true })
  const sizes: { width: number; height: number; font: number; columns: number }[] = []
  for (const width of [180, 340, 700]) {
    await ops.evaluate((node, width) => { node.closest<HTMLElement>('[data-module]')!.style.width = width + 'px' }, width)
    const result = await ops.locator('.operations-state').first().evaluate(node => ({ width: node.clientWidth, height: node.clientHeight, font: parseFloat(getComputedStyle(node).fontSize), columns: getComputedStyle(node.parentElement!.parentElement!).gridTemplateColumns.split(' ').length }))
    sizes.push(result)
    await separate(ops.locator('.operations-state'))
  }
  expect(sizes[0]!.columns).toBe(1); expect(sizes[2]!.columns).toBeGreaterThan(1)
  expect(sizes[2]!.font).toBeGreaterThan(sizes[0]!.font)
  expect(sizes[2]!.height).toBeGreaterThanOrEqual(sizes[0]!.height)
  await ops.screenshot({ path: info.outputPath('operativo.png') })
  await bringModuleToFront(page, 'Calculadora')
  const calc = page.getByRole('region', { name: 'Calculadora', exact: true })
  for (const height of [200, 360, 520]) {
    await calc.evaluate((node, height) => { node.closest<HTMLElement>('[data-module]')!.style.height = height + 'px' }, height)
    const gap = await calc.evaluate(node => node.querySelector('.module-controls')!.getBoundingClientRect().top - node.querySelector('.calculator-keypad')!.getBoundingClientRect().bottom)
    expect(Math.abs(gap)).toBeLessThanOrEqual(1)
    await separate(calc.locator('.calculator-keypad button'))
  }
  await calc.screenshot({ path: info.outputPath('calculadora.png') })
})


test('reloj compacto reduce letras y tarjetas y recoge altura hacia arriba al cerrar', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Reloj')
  const fixture = createEmptyDocument('Reloj sin solapamientos')
  fixture.moduleLayouts.clock = { x: 0, y: 0, width: 320, height: 550, referenceSize: { width: 1440, height: 900 } }
  await loadDocument(page, fixture)
  const clock = page.locator('[data-module="clock"]')
  for (const name of ['T-Zero', 'T-Minus', 'Advisories']) await clock.getByRole('button', { name, exact: true }).click()
  const fonts: number[] = []
  for (const width of [60, 100, 180, 320]) {
    await clock.evaluate((node, width) => { (node as HTMLElement).style.width = width + 'px' }, width)
    await page.evaluate(() => document.fonts.ready)
    fonts.push(await clock.locator('.clock-reference').evaluate(node => parseFloat(getComputedStyle(node).fontSize)))
    const text = clock.locator('.clock-reference > span, .clock-zulu > *, .clock-add-controls button, .timer-heading > *, .timer-value, .timer-duration')
    const overflow = await text.evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className))
    expect(overflow).toEqual([])
    await separate(clock.locator('.clock-reference > span'))
    await separate(clock.locator('.clock-add-controls button'))
    for (const row of await clock.locator('.timer-row').all()) {
      await separate(row.locator('.timer-heading > *'))
      await separate(row.locator('.timer-value, .timer-controls'))
      await separate(row.getByRole('button'))
      expect(await row.evaluate(node => node.clientHeight)).toBeLessThan(80)
    }
    if (width === 60 || width === 320) await clock.screenshot({ path: info.outputPath('clock-compact-' + width + '.png') })
  }
  expect(fonts[0]!).toBeLessThan(fonts[1]!); expect(fonts[1]!).toBeLessThan(fonts[3]!)
  await clock.evaluate(node => { (node as HTMLElement).style.width = '320px' })
  const top = (await clock.boundingBox())!.y
  for (const scale of [100, 200]) {
    await loadDocument(page, fixture)
    await zoom(page, 'Zoom de Reloj', scale)
    const before = Number(await clock.getAttribute('data-height'))
    await clock.locator('.timer-close').first().click()
    await expect.poll(async () => Number(await clock.getAttribute('data-height'))).toBeLessThan(before)
    expect(Number(await clock.getAttribute('data-width'))).toBe(320)
    expect((await clock.boundingBox())!.y).toBe(top)
    if (scale === 100) expect(await clock.locator('.module-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  }
  await zoom(page, 'Zoom de Reloj', 100)
  await clock.locator('.timer-close').click()
  await expect(clock.locator('.timer-row')).toHaveCount(0)
  expect(await clock.locator('.module-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  await clock.screenshot({ path: info.outputPath('clock-collected.png') })
})
