import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { openModule, loadDocument, noPageScroll, savedDocument } from './acceptance-helpers'

async function zoom(page: Page, value: number, label = 'Zoom actual') {
  const field = page.getByRole('spinbutton', { name: label, exact: true })
  await field.fill(String(value)); await field.press('Enter')
  await expect(field).toHaveValue(String(value))
}

test('keeps_zoom_popover_visible_at_scaled_edge y restaura foco al cerrar', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Controles')
  fixture.moduleLayouts.information = { x: 0, y: 0, width: 140, height: 140, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture); await openModule(page, 'Información')
  for (const value of [25, 50, 100, 200, 400]) {
    await zoom(page, value)
    for (const label of ['Zoom actual', 'Zoom de Información']) {
      const trigger = page.getByRole('button', { name: `Abrir deslizador: ${label}`, exact: true })
      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const popup = page.getByRole('dialog', { name: label, exact: true })
      await expect(popup).toBeVisible()
      const box = (await popup.boundingBox())!, viewport = page.viewportSize()!
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      expect(await popup.evaluate(el => Number(getComputedStyle(el).zoom))).toBe(1)
      await page.screenshot({ path: info.outputPath(`${label === 'Zoom actual' ? 'general' : 'modulo'}-${value}.png`) })
      await page.getByRole('slider', { name: label, exact: true }).press('Escape')
      await expect(popup).toHaveCount(0); await expect(trigger).toBeFocused()
    }
  }
  await zoom(page, 100)
  const label = 'Zoom de Información', trigger = page.getByRole('button', { name: `Abrir deslizador: ${label}`, exact: true })
  await trigger.click()
  const slider = page.getByRole('slider', { name: label, exact: true })
  await slider.press('End'); await expect(page.getByRole('spinbutton', { name: label, exact: true })).toHaveValue('400')
  await slider.press('Home'); await expect(page.getByRole('spinbutton', { name: label, exact: true })).toHaveValue('25')
  const track = await page.locator('.ui-slider-track').boundingBox()
  await page.mouse.click(track!.x + track!.width / 2, track!.y + track!.height / 2)
  await expect.poll(() => page.getByRole('spinbutton', { name: label, exact: true }).inputValue()).not.toBe('25')
  await trigger.click(); await expect(page.getByRole('dialog', { name: label, exact: true })).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click(); await page.getByRole('heading', { name: 'Información', exact: true }).click()
  await expect(page.getByRole('dialog', { name: label, exact: true })).toHaveCount(0); await expect(trigger).toBeFocused()
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts).toEqual(fixture.moduleLayouts)
  await noPageScroll(page)
})

test('título no se autoextiende y el aviso expira sin validar coordenadas', async ({ page }) => {
  await page.goto('/')
  const title = page.getByRole('textbox', { name: 'Título del documento', exact: true })
  const initialWidth = (await title.boundingBox())!.width
  await title.fill('Título muy largo '.repeat(30))
  expect((await title.boundingBox())!.width).toBe(initialWidth)
  await openModule(page, 'Coordenadas')
  await page.clock.install({ time: new Date('2026-10-05T10:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-05T10:00:01Z'))
  const input = page.getByRole('textbox', { name: 'Coordenadas', exact: true })
  await input.fill('30I 588700 4101800'); await page.getByRole('button', { name: 'Convertir', exact: true }).click()
  await page.clock.fastForward(4999); await expect(input).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Convertir', exact: true }).click()
  await page.clock.fastForward(4999); await expect(input).toHaveAttribute('aria-invalid', 'true')
  await page.clock.fastForward(1); await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(input).toHaveValue('30I 588700 4101800')
  await expect(page.getByRole('button', { name: 'Copiar enlace', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Resultado DD', { exact: true })).toBeEmpty()
})

test('consulta táctil no cierra el módulo; tap corto cierra sin moverlo', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'consulta mediante touch en móvil emulado')
  await page.goto('/'); await openModule(page, 'Información')
  const node = page.locator('[data-module="information"]'), close = page.getByRole('button', { name: 'Cerrar Información', exact: true })
  const before = await savedDocument(page), rect = (await close.boundingBox())!
  const cdp = await context.newCDPSession(page)
  await page.clock.install()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }] })
  await page.clock.fastForward(501)
  await expect(page.getByRole('tooltip')).toHaveText('Cerrar Información')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(node).toBeVisible()
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts).toEqual(before!.moduleLayouts)
  await page.getByRole('heading', { name: 'Información', exact: true }).click()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await close.tap(); await expect(node).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver', exact: true })).toBeFocused()
  await cdp.detach()
})

test('segundo dedo cancela el popover y bloquea el control sin cambiar geometría', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'gesto de dos dedos en móvil emulado')
  await page.goto('/'); await openModule(page, 'Información')
  const trigger = page.getByRole('button', { name: 'Abrir deslizador: Zoom de Información', exact: true })
  await trigger.click(); await expect(page.getByRole('dialog', { name: 'Zoom de Información', exact: true })).toBeVisible()
  const before = await savedDocument(page), cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 500, id: 1 }, { x: 180, y: 500, id: 2 }] })
  await expect(trigger).toBeDisabled()
  await expect(page.getByRole('dialog', { name: 'Zoom de Información', exact: true })).toHaveCount(0)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(trigger).toBeEnabled()
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts).toEqual(before!.moduleLayouts)
  await cdp.detach()
})

test('cabecera de una fila y zoom 25–400 sin huecos ni alteración del documento', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('')
  fixture.moduleLayouts.information = { x: 0, y: 0, width: 320, height: 240, referenceSize: { width: 1440, height: 866 } }
  await loadDocument(page, fixture); await openModule(page, 'Información')
  await expect(page.getByRole('img', { name: 'Angie Dashboard' })).toBeVisible()
  const viewport = page.getByTestId('mobile-viewport')
  const original = await page.locator('[data-module="information"]').evaluate(el => [el.getAttribute('data-x'), el.getAttribute('data-y'), el.getAttribute('data-width'), el.getAttribute('data-height')])
  for (const value of [50, 25, 100, 200, 400, 100]) {
    await zoom(page, value)
    await expect(viewport).toHaveAttribute('data-scale', String(value / 100))
    await expect.poll(() => page.locator('.app-header').evaluate(el => Number(getComputedStyle(el).zoom))).toBe(value / 100)
    await expect(viewport).toHaveAttribute('data-offset-x', '0')
    await expect(viewport).toHaveAttribute('data-offset-y', '0')
    expect(await page.locator('.app-header').evaluate(el => getComputedStyle(el).flexWrap)).toBe('nowrap')
    expect(await page.locator('[data-module="information"]').evaluate(el => [el.getAttribute('data-x'), el.getAttribute('data-y'), el.getAttribute('data-width'), el.getAttribute('data-height')])).toEqual(original)
    await noPageScroll(page)
  }
  await zoom(page, 50)
  const input = page.getByRole('spinbutton', { name: 'Zoom actual', exact: true })
  await input.fill(''); await input.press('Tab'); await expect(input).toHaveValue('50')
  await page.getByRole('button', { name: 'Encajar', exact: true }).click()
  await expect(input).toHaveValue('50')
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts.information).toMatchObject({ x: 12, y: 12, width: 320, height: 240 })
  await page.screenshot({ path: info.outputPath('header.png') })
})

test('los diez módulos escalan herramientas y contenido sin escalar sus marcos', async ({ page }, info) => {
  await page.goto('/')
  for (const name of ['Pizarra', 'Elementos', 'Dotaciones', 'Información', 'Operativo', 'Coordenadas', 'Reloj', 'Calculadora', 'Cuaderno', 'Registro cronológico']) {
    await openModule(page, name)
    const module = page.locator('.module-frame').filter({ has: page.getByRole('heading', { name, exact: true }) })
    const frame = await module.boundingBox()
    await expect(module.locator('.module-header').getByRole('button', { name: `Cerrar ${name}`, exact: true })).toBeVisible()
    await expect(module.locator('.module-controls button.module-close')).toHaveCount(0)
    const content = module.locator('.module-scaled-content')
    for (const value of [50, 200, 100]) {
      await zoom(page, value, `Zoom de ${name}`)
      await expect(content).toHaveAttribute('data-scale', String(value / 100))
      expect(await content.evaluate(el => Number(getComputedStyle(el).zoom))).toBe(value / 100)
      const box = await module.boundingBox()
      expect(box!.width).toBe(frame!.width); expect(box!.height).toBe(frame!.height)
    }
    await page.getByRole('button', { name: `Cerrar ${name}`, exact: true }).click()
  }
  await openModule(page, 'Elementos')
  await zoom(page, 50)
  await zoom(page, 150, 'Zoom de Elementos')
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('combined-zoom.png') })
})

test('Elementos ajusta preview e información sin alturas vacías ni scroll innecesario', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Elementos')
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(page.locator('.element-editor legend')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Punto norte')
  const information = page.getByRole('textbox', { name: 'Información', exact: true })
  const initial = (await information.boundingBox())!.height
  expect(initial).toBeLessThan(36)
  await information.fill('Uno\nDos\nTres\nCuatro')
  await expect.poll(async () => (await information.boundingBox())!.height).toBeGreaterThan(initial * 2)
  await information.fill('')
  await expect.poll(async () => (await information.boundingBox())!.height).toBe(initial)
  const slider = page.getByRole('slider', { name: 'Escala del icono' })
  await slider.fill('0.49')
  await expect.poll(() => page.locator('.element-preview').evaluate(el => el.clientHeight)).toBeLessThan(70)
  const metrics = await page.locator('.element-preview').evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth, sw: el.scrollWidth }))
  expect(metrics.sh).toBeLessThanOrEqual(metrics.h); expect(metrics.sw).toBeLessThanOrEqual(metrics.w)
  await page.screenshot({ path: info.outputPath('element-editor.png') })
})

test('ventanas pequeñas se desplazan y conservan resize/posición con zoom reducido', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Ventanas pequeñas')
  fixture.moduleLayouts.elements = { x: 0, y: 0, width: 180, height: 140, referenceSize: { width: 1440, height: 866 } }
  await loadDocument(page, fixture); await openModule(page, 'Elementos')
  await expect(page.locator('[data-module="elements"]')).toHaveAttribute('data-width', '180')
  expect(await page.locator('[data-module="elements"] .module-content').evaluate(el => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight)).toBe(true)
  await zoom(page, 50)
  const header = await page.locator('[data-module="elements"] .module-header').boundingBox()
  await page.mouse.move(header!.x + 15, header!.y + 5); await page.mouse.down()
  await page.mouse.move(header!.x + 165, header!.y + 65, { steps: 12 }); await page.mouse.up()
  const node = page.locator('[data-module="elements"]')
  await expect(node).toHaveAttribute('data-x', '300'); await expect(node).toHaveAttribute('data-y', '120')
  const handle = await node.locator('.react-resizable-handle-se').boundingBox()
  await page.mouse.move(handle!.x + 3, handle!.y + 3); await page.mouse.down()
  await page.mouse.move(handle!.x + 23, handle!.y + 23, { steps: 6 }); await page.mouse.up()
  await expect(node).toHaveAttribute('data-width', '220'); await expect(node).toHaveAttribute('data-height', '180')
  await page.getByRole('button', { name: 'Cerrar Elementos', exact: true }).click()
  await openModule(page, 'Elementos')
  await expect(node).toHaveAttribute('data-x', '300'); await expect(node).toHaveAttribute('data-y', '120')
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts.elements?.width).toBe(220)
  await page.screenshot({ path: info.outputPath('small-window.png') })
})

test('el área navegable conserva módulos situados abajo al volver del 50 al 100', async ({ page, context, isMobile }) => {
  await page.goto('/'); await zoom(page, 50); await openModule(page, 'Elementos')
  const node = page.locator('[data-module="elements"]')
  const header = (await node.locator('.module-header').boundingBox())!
  await page.mouse.move(header.x + 15, header.y + 5); await page.mouse.down()
  await page.mouse.move(header.x + 15, header.y + 505, { steps: 12 }); await page.mouse.up()
  await expect(node).toHaveAttribute('data-y', '1000')
  await zoom(page, 100)
  await expect(node).toHaveAttribute('data-y', '1000')
  expect(await page.locator('.logical-workspace').evaluate(el => el.clientHeight)).toBeGreaterThanOrEqual(1420)
  if (isMobile) {
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 300, id: 1 }, { x: 140, y: 300, id: 2 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 100, id: 1 }, { x: 140, y: 100, id: 2 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Number(await page.getByTestId('mobile-viewport').getAttribute('data-offset-y'))).toBeLessThan(-100)
    const offset = await page.getByTestId('mobile-viewport').getAttribute('data-offset-y')
    await page.setViewportSize({ width: 412, height: 500 })
    await expect(page.getByTestId('mobile-viewport')).toHaveAttribute('data-offset-y', offset!)
    await session.detach()
  }
})

test('reloj compacto, formatos permanentes y Cuaderno con tirador fino', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Reloj')
  const reference = page.locator('.clock-reference')
  await expect(reference).not.toContainText('|')
  await expect(page.getByLabel('Hora Zulu')).toHaveText(/^\d\d:\d\d:\d\d$/)
  const typography = await page.locator('.clock-zulu').evaluate(el => {
    const label = el.querySelector('span')!, output = el.querySelector('output')!
    return [getComputedStyle(label).fontSize, getComputedStyle(output).fontSize]
  })
  expect(typography[0]).toBe(typography[1])
  await page.screenshot({ path: info.outputPath('clock.png') })
  await page.getByRole('button', { name: 'Cerrar Reloj', exact: true }).click()
  await openModule(page, 'Coordenadas')
  for (const format of ['DD', 'DMS', 'DMM', 'UTM']) await expect(page.getByText(format, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar Coordenadas', exact: true }).click()
  await openModule(page, 'Cuaderno')
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  expect(await page.locator('.notebook-handle').evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(10)
  await page.screenshot({ path: info.outputPath('notebook.png') })
})
