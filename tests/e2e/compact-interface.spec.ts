import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { MODULE_REGISTRY } from '../../src/layout/moduleRegistry'
import { createElement } from '../../src/features/elements/elementCommands'
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
  await input.fill('30I 588700 4101800'); await page.getByRole('button', { name: 'Validar coordenadas y mostrar formatos', exact: true }).click()
  await page.clock.fastForward(4999); await expect(input).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Validar coordenadas y mostrar formatos', exact: true }).click()
  await page.clock.fastForward(4999); await expect(input).toHaveAttribute('aria-invalid', 'true')
  await page.clock.fastForward(1); await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(input).toHaveValue('30I 588700 4101800')
  await expect(page.getByRole('button', { name: /^Copiar / })).toHaveCount(0)
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
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts.information).toMatchObject({ x: 0, y: 0, width: 320, height: 240 })
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
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('combined-zoom.png') })
})

test('Elementos ajusta preview e información sin alturas vacías ni scroll innecesario', async ({ page }, info) => {
  await page.goto('/'); await openModule(page, 'Elementos')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await expect(page.locator('.element-editor legend')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Punto norte')
  const information = page.getByRole('textbox', { name: 'Información', exact: true })
  const initial = (await information.boundingBox())!.height
  expect(initial).toBeLessThan(36)
  await information.fill('Uno\nDos\nTres\nCuatro')
  await expect.poll(async () => (await information.boundingBox())!.height).toBeGreaterThan(initial * 2)
  await information.fill('')
  await expect.poll(async () => (await information.boundingBox())!.height).toBe(initial)
  const scale = page.getByRole('spinbutton', { name: 'Escala', exact: true })
  await scale.fill('49'); await scale.press('Tab')
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
test('regresión zoom compartido: reducir y ampliar conserva el área útil en todos los módulos', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Zoom sin desbordamiento')
  for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) {
    fixture.moduleLayouts[id] = { x: 0, y: 0, width: 600, height: 480, referenceSize: { width: 1440, height: 864 } }
  }
  await loadDocument(page, fixture)
  for (const [id, definition] of Object.entries(MODULE_REGISTRY)) {
    await openModule(page, definition.name)
    const region = page.locator('.module-frame').filter({ has: page.getByRole('heading', { name: definition.name, exact: true }) })
    if (id === 'clock') await region.getByRole('button', { name: 'T-Minus', exact: true }).press('Enter')
    for (const percent of ['clock', 'calculator', 'board'].includes(id) ? [100, 75, 50, 125, 100] : [75, 100]) {
      await zoom(page, percent, `Zoom de ${definition.name}`)
      await expect.poll(() => region.evaluate(node => {
        const content = node.querySelector('.module-content')!, inner = node.querySelector('.module-scaled-content')!
        return Math.abs(inner.getBoundingClientRect().width - content.clientWidth)
      })).toBeLessThanOrEqual(1)
      expect(await region.locator('.module-content').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
    }
    if (id === 'clock') {
      const enlarged = structuredClone(fixture)
      enlarged.moduleLayouts.clock!.width = 800
      await zoom(page, 75, 'Zoom de Reloj'); await loadDocument(page, enlarged)
      expect(await region.locator('.module-content').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
      await loadDocument(page, fixture)
    }
    if (['clock', 'calculator', 'board'].includes(id)) {
      await zoom(page, 75, `Zoom de ${definition.name}`)
      await region.screenshot({ path: info.outputPath(`${id}-75.png`) })
    }
    await page.getByRole('button', { name: `Cerrar ${definition.name}`, exact: true }).press('Enter')
  }
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts).toEqual(fixture.moduleLayouts)
  await noPageScroll(page)
})

test('regresión Pizarra: lienzo cubre su ventana y rueda comparte zoom con el pie', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Pizarra y zoom')
  fixture.moduleLayouts.board = { x: 0, y: 0, width: 600, height: 480, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture); await openModule(page, 'Pizarra')
  const region = page.getByRole('region', { name: 'Pizarra', exact: true }), surface = region.getByTestId('board-surface')
  for (const value of [100, 146, 41, 100]) {
    await zoom(page, value, 'Zoom de Pizarra')
    await expect.poll(() => surface.evaluate(node => {
      const content = node.closest('.module-content')!, canvas = node.querySelector('canvas')!
      return Math.abs(canvas.getBoundingClientRect().width - content.clientWidth)
    })).toBeLessThanOrEqual(1)
    await expect.poll(() => surface.evaluate(node => Math.abs(node.querySelector('canvas')!.getBoundingClientRect().height - node.parentElement!.getBoundingClientRect().height))).toBeLessThanOrEqual(1)
    if (value === 146 || value === 41) await region.screenshot({ path: info.outputPath(`board-${value}.png`) })
  }
  const box = (await surface.boundingBox())!
  await surface.dispatchEvent('wheel', { deltaY: -Math.log(1.5) / .002, clientX: box.x + 30, clientY: box.y + 30 })
  await expect(page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true })).toHaveValue('150')
  await expect(page.getByRole('spinbutton', { name: 'Zoom actual', exact: true })).toHaveValue('100')
  await zoom(page, 75, 'Zoom de Pizarra')
  await surface.dispatchEvent('wheel', { deltaY: Math.log(1.5) / .002, ctrlKey: true, clientX: box.x + 30, clientY: box.y + 30 })
  await expect(page.getByRole('spinbutton', { name: 'Zoom de Pizarra', exact: true })).toHaveValue('50')
  await expect(surface).toHaveAttribute('data-scale', '1')
  await expect.poll(async () => (await savedDocument(page))?.moduleLayouts).toEqual(fixture.moduleLayouts)
  await noPageScroll(page)
})


test('dashboard común: Proportions ajusta los módulos y deja el zoom inferior sin barras', async ({ page, isMobile }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const fixture = createEmptyDocument('Ajuste compacto')
  createElement(fixture, { name: 'Punto norte', information: 'Referencia de prueba', isUnit: false, visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 100, y: 100 } })
  createElement(fixture, { name: 'Equipo uno', information: '', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 }, position: { x: 200, y: 150 } })
  fixture.notebook.push({ id: crypto.randomUUID(), type: 'note', title: 'Prueba', text: 'Primera línea\nSegunda línea' })
  for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) fixture.moduleLayouts[id] = { x: 0, y: 0, width: 600, height: 600, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture)
  if (isMobile) await zoom(page, 50)
  await openModule(page, 'Elementos'); await page.getByRole('button', { name: 'Seleccionar Punto norte', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar Elementos', exact: true }).click()
  for (const [id, definition] of Object.entries(MODULE_REGISTRY)) {
    const name = definition.name
    await openModule(page, name)
    if (id === 'clock') await page.getByRole('button', { name: 'T-Zero', exact: true }).click()
    const node = page.locator('[data-module="' + id + '"]')
    await page.getByRole('button', { name: 'Ajustar ventana de ' + name + ' al contenido', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: 'Zoom de ' + name, exact: true })).toHaveValue('100')
    await expect.poll(async () => node.evaluate(node => [...node.querySelectorAll<HTMLElement>('.module-content,.elements-list,.notebook-list,.timeline-entries')].map(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight })))).toEqual(expect.arrayContaining([expect.objectContaining({ x: 0, y: 0 })]))
    const overflows = await node.evaluate(node => [...node.querySelectorAll<HTMLElement>('.module-content,.elements-list,.notebook-list,.timeline-entries')].map(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight })))
    for (const overflow of overflows) { expect(overflow.x, name).toBeLessThanOrEqual(1); expect(overflow.y, name).toBeLessThanOrEqual(1) }
    expect(await node.locator('.module-controls').evaluate(el => [getComputedStyle(el).overflowX, getComputedStyle(el).overflowY])).toEqual(['hidden', 'hidden'])
    const fitted = [Number(await node.getAttribute('data-width')), Number(await node.getAttribute('data-height'))] as const
    await page.getByRole('button', { name: 'Ajustar ventana de ' + name + ' al contenido', exact: true }).click()
    expect(Math.abs(Number(await node.getAttribute('data-width')) - fitted[0]), name + ' ancho estable').toBeLessThanOrEqual(1)
    expect(Math.abs(Number(await node.getAttribute('data-height')) - fitted[1]), name + ' alto estable').toBeLessThanOrEqual(1)
    expect(await node.locator('h2').evaluate(el => {
      const text = document.createRange(); text.selectNodeContents(el)
      return el.getBoundingClientRect().width + .01 >= text.getBoundingClientRect().width
    }), name + ' título completo').toBe(true)
    if (id === 'notebook') expect(Number(await node.getAttribute('data-width'))).toBeLessThan(400)
    if (id === 'clock') expect(Number(await node.getAttribute('data-width'))).toBeLessThan(500)
    await page.screenshot({ path: info.outputPath('ajuste-' + id + '.png') })
    if (id === 'dotations') await page.getByRole('button', { name: 'Seleccionar Equipo uno', exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar ' + name, exact: true }).click()
  }
  await noPageScroll(page)
  expect(errors).toEqual([])
})

test('dashboard común: el ajuste respeta zoom individual y compacta las tarjetas', async ({ page, isMobile }) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Tarjetas')
  createElement(fixture, { name: 'Punto de prueba', information: '', isUnit: false, visual: { type: 'emoji', value: '📍', scale: 1 } })
  fixture.moduleLayouts.elements = { x: 0, y: 0, width: 600, height: 500, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture)
  if (isMobile) await zoom(page, 50)
  await openModule(page, 'Elementos')
  const node = page.locator('[data-module="elements"]')
  for (const value of [50, 200]) {
    await zoom(page, value, 'Zoom de Elementos')
    await page.getByRole('button', { name: 'Ajustar ventana de Elementos al contenido', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: 'Zoom de Elementos', exact: true })).toHaveValue(String(value))
    const metrics = await node.evaluate(node => {
      const content = node.querySelector<HTMLElement>('.module-content')!, list = node.querySelector<HTMLElement>('.elements-list')!, row = node.querySelector<HTMLElement>('.element-row')!
      return { x: content.scrollWidth - content.clientWidth, y: content.scrollHeight - content.clientHeight, lx: list.scrollWidth - list.clientWidth, ly: list.scrollHeight - list.clientHeight, padding: getComputedStyle(row).padding, gap: getComputedStyle(row).gap }
    })
    expect(metrics).toEqual({ x: 0, y: 0, lx: 0, ly: 0, padding: '0px', gap: '0px' })
  }
})

test('dashboard común: el imán une ventanas cercanas y se puede desactivar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'arrastre con ratón')
  await page.goto('/')
  const fixture = createEmptyDocument('Imán')
  fixture.moduleLayouts.information = { x: 0, y: 0, width: 250, height: 200, referenceSize: { width: 1440, height: 864 } }
  fixture.moduleLayouts.coordinates = { x: 350, y: 0, width: 300, height: 250, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture); await openModule(page, 'Información'); await openModule(page, 'Coordenadas')
  await page.getByRole('button', { name: 'Imán de módulos', exact: true }).click()
  const heading = await page.getByRole('heading', { name: 'Coordenadas', exact: true }).boundingBox()
  await page.mouse.move(heading!.x + 30, heading!.y + 6); await page.mouse.down(); await page.mouse.move(heading!.x + 30 - 96, heading!.y + 6, { steps: 8 }); await page.mouse.up()
  await expect(page.locator('[data-module="coordinates"]')).toHaveAttribute('data-x', '250')
  await page.getByRole('button', { name: 'Imán de módulos', exact: true }).click()
  const next = await page.getByRole('heading', { name: 'Coordenadas', exact: true }).boundingBox()
  await page.mouse.move(next!.x + 30, next!.y + 6); await page.mouse.down(); await page.mouse.move(next!.x + 34, next!.y + 6); await page.mouse.up()
  await expect(page.locator('[data-module="coordinates"]')).toHaveAttribute('data-x', '254')
})

test('dashboard común: una zona libre de otro módulo deselecciona notas y pines', async ({ page, isMobile }) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Selección')
  createElement(fixture, { name: 'Punto de prueba', information: '', isUnit: false, visual: { type: 'emoji', value: '📍', scale: 1 }, position: { x: 80, y: 80 } })
  fixture.board.quickNotes.push({ id: crypto.randomUUID(), title: 'Nota', text: 'Referencia', position: { x: 260, y: 130 }, width: 180, height: 70, scale: 1 })
  fixture.moduleLayouts.board = { x: 0, y: 0, width: 400, height: 300, referenceSize: { width: 1440, height: 864 } }
  fixture.moduleLayouts.information = { x: 430, y: 0, width: 220, height: 200, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture)
  if (isMobile) await zoom(page, 50)
  await openModule(page, 'Pizarra'); await openModule(page, 'Información')
  await page.getByRole('button', { name: 'Seleccionar Punto de prueba', exact: true }).click()
  await expect(page.locator('.board-pin')).toHaveAttribute('data-selected', 'true')
  await page.getByRole('button', { name: 'Seleccionar módulo Información', exact: true }).click()
  await page.locator('[data-module="information"] .module-content').click({ position: { x: 10, y: 40 } })
  await expect(page.locator('.board-pin')).toHaveAttribute('data-selected', 'false')
  await page.getByRole('button', { name: 'Seleccionar módulo Pizarra', exact: true }).click()
  await page.getByLabel('Texto de nota rápida', { exact: true }).click()
  await expect(page.locator('.quick-note')).toHaveAttribute('data-selected', 'true')
  await page.getByRole('button', { name: 'Seleccionar módulo Información', exact: true }).click()
  await page.locator('[data-module="information"] .module-content').click({ position: { x: 10, y: 40 } })
  await expect(page.locator('.quick-note')).toHaveAttribute('data-selected', 'false')
})


test('herramientas uniformes y foco de textarea sin borde amarillo', async ({ page, isMobile }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Herramientas')
  const referenceSize = { width: 1440, height: 864 }
  fixture.moduleLayouts.board = { x: 0, y: 0, width: 550, height: 350, referenceSize }
  fixture.moduleLayouts.clock = { x: 550, y: 0, width: 350, height: 350, referenceSize }
  fixture.moduleLayouts.notebook = { x: 0, y: 350, width: 550, height: 300, referenceSize }
  fixture.moduleLayouts.coordinates = { x: 900, y: 0, width: 350, height: 350, referenceSize }
  await loadDocument(page, fixture)
  if (isMobile) await zoom(page, 25)
  for (const name of ['Pizarra', 'Reloj', 'Cuaderno', 'Coordenadas']) await openModule(page, name)
  await page.locator('[data-module="clock"]').getByRole('button', { name: 'T-Zero', exact: true }).click()
  await page.locator('[data-module="notebook"]').getByRole('button', { name: 'Nota', exact: true }).click()
  await page.locator('[data-module="notebook"]').getByRole('button', { name: 'Checklist', exact: true }).click()
  const icons = await page.locator('.app-shell .lucide').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node)
    return { width: style.width, height: style.height, stroke: style.strokeWidth, cap: style.strokeLinecap }
  }))
  expect(icons.length).toBeGreaterThan(20)
  for (const icon of icons) expect(icon).toEqual({ width: '15px', height: '15px', stroke: '2px', cap: 'round' })
  for (const selector of ['.board-toolbar button[aria-label="Lápiz"]', '.timer-controls button[aria-label="Iniciar"]', '.coordinates-entry button', '.module-close', '.zoom-trigger']) {
    const button = page.locator(selector).first()
    await expect(button).toHaveCSS('width', '25px'); await expect(button).toHaveCSS('height', '25px')
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  const textareas = page.locator('.notebook-module textarea, .clock-module textarea')
  for (const textarea of await textareas.all()) {
    await textarea.focus()
    await expect(textarea).toHaveCSS('outline-style', 'none')
    await expect(textarea).toHaveCSS('border-color', 'rgb(117, 131, 141)')
  }
  await page.screenshot({ path: info.outputPath('herramientas-y-foco.png') })
  await noPageScroll(page)
})


test('mejoras compactas: Cuaderno, Información y separación de coordenadas', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  const fixture = createEmptyDocument('Comprobación de mejoras')
  const unit = createElement(fixture, { name: 'Equipo demo', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: 'Canal de pruebas' })
  await loadDocument(page, fixture)
  await openModule(page, 'Cuaderno')
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  await page.getByLabel('Texto de nota', { exact: true }).fill('Preparación de material')
  await page.getByRole('button', { name: 'Checklist', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir elemento', exact: true }).click()
  await page.getByLabel('Texto del elemento 1').fill('Comprobar radio')
  await expect(page.getByLabel(/Título del bloque/)).toHaveCount(0)
  const row = page.locator('.notebook-checklist li').first()
  const field = await row.locator('textarea').boundingBox()
  const plus = await row.getByRole('button', { name: 'Añadir elemento después de 1' }).boundingBox()
  const minus = await row.getByRole('button', { name: 'Eliminar elemento 1' }).boundingBox()
  expect(plus!.x).toBeGreaterThanOrEqual(field!.x + field!.width - 1)
  expect(minus!.width).toBe(plus!.width); expect(minus!.height).toBe(plus!.height)
  expect(minus!.x).toBeGreaterThanOrEqual(plus!.x + plus!.width - 1)
  expect(await row.locator('textarea').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
  await expect(row.locator('.lucide-trash')).toHaveCount(0)
  const close = page.locator('.notebook-delete').first()
  expect(await close.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  await page.screenshot({ path: info.outputPath('cuaderno-compacto.png') })
  await openModule(page, 'Información')
  await page.getByRole('button', { name: 'Seleccionar Equipo demo', exact: true }).click()
  await expect(page.getByLabel('Pin visible', { exact: true })).toHaveText('')
  await expect(page.locator('.information-pin svg')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('informacion-icono.png') })
  await openModule(page, 'Coordenadas')
  await page.getByRole('textbox', { name: 'Coordenadas', exact: true }).fill('37, -2')
  await page.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }).click()
  for (const format of ['DD', 'DMS', 'DMM', 'UTM', 'Maps']) {
    const result = page.getByRole('button', { name: 'Copiar ' + format, exact: true })
    const separation = await result.evaluate(el => {
      const label = el.querySelector('dt')!, value = el.querySelector('dd')!
      return { actual: value.getBoundingClientRect().x - label.getBoundingClientRect().right, expected: parseFloat(getComputedStyle(el).columnGap) }
    })
    expect(separation.actual).toBeGreaterThan(10)
    await result.click()
    await expect(page.getByRole('status')).toHaveText(format === 'Maps' ? 'Enlace copiado' : 'Coordenada copiada')
  }
  await page.screenshot({ path: info.outputPath('coordenadas-separacion.png') })
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 4000 })
  expect((await savedDocument(page))!.elements[0]!.id).toBe(unit.id)
})

test('mejoras compactas: Puzzle mantiene todos los módulos visibles sin superponer a zoom alto', async ({ page }, info) => {
  await page.goto('/')
  await loadDocument(page, createEmptyDocument('Puzzle demo'))
  for (const module of Object.values(MODULE_REGISTRY)) await openModule(page, module.name)
  await zoom(page, 200)
  await page.getByRole('button', { name: 'Encajar', exact: true }).click()
  const workspace = (await page.locator('.dashboard-workspace').boundingBox())!
  const boxes = await page.locator('.module-frame').evaluateAll(nodes => nodes.map(el => {
    const box = el.getBoundingClientRect()
    return { x: box.x, y: box.y, right: box.right, bottom: box.bottom }
  }))
  expect(boxes).toHaveLength(10)
  for (const a of boxes) {
    expect(a.x).toBeGreaterThanOrEqual(workspace.x - 1); expect(a.y).toBeGreaterThanOrEqual(workspace.y - 1)
    expect(a.right).toBeLessThanOrEqual(workspace.x + workspace.width + 1)
    expect(a.bottom).toBeLessThanOrEqual(workspace.y + workspace.height + 1)
    for (const b of boxes) if (a !== b) expect(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('puzzle-compacto.png') })
  await noPageScroll(page)
})


test('estilos generales: acciones y campos uniformes, pie integrado y tirador Lucide', async ({ page, isMobile }, info) => {
  await page.goto('/')
  expect(await page.locator('.app-header .zoom-control > :first-child').getAttribute('aria-label')).toBe('Zoom actual')
  const fixture = createEmptyDocument('Estilos comunes')
  createElement(fixture, { name: 'Equipo de pruebas', information: '', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 } })
  for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) fixture.moduleLayouts[id] = { x: 0, y: 0, width: 500, height: 500, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture)
  if (isMobile) await zoom(page, 50)
  const buttonStyle = (node: Element) => {
    const s = getComputedStyle(node)
    return [s.height, s.fontSize, s.fontFamily, s.lineHeight, s.padding, s.borderRadius, s.borderWidth, s.backgroundImage, s.boxShadow]
  }
  const fieldStyle = (node: Element) => {
    const s = getComputedStyle(node), surface = getComputedStyle(node.closest('.ui-input-group') ?? node)
    return [s.fontSize, s.fontFamily, s.lineHeight, s.padding, surface.borderRadius, surface.borderWidth, surface.backgroundColor, surface.boxShadow]
  }
  await openModule(page, 'Cuaderno')
  const reference = await page.getByRole('button', { name: 'Nota', exact: true }).evaluate(buttonStyle)
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  await page.getByRole('button', { name: 'Checklist', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir elemento', exact: true }).click()
  const note = page.getByLabel('Texto de nota', { exact: true })
  await note.fill('Una línea de prueba')
  await page.getByRole('button', { name: 'Cerrar Cuaderno', exact: true }).click()
  await openModule(page, 'Dotaciones')
  await page.getByRole('button', { name: 'Seleccionar Equipo de pruebas', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar Dotaciones', exact: true }).click()
  await openModule(page, 'Operativo')
  const annotation = page.getByLabel('Anotación', { exact: true })
  await annotation.fill('Anotación de referencia')
  const inputReference = await annotation.evaluate(fieldStyle)
  await page.getByRole('button', { name: 'Cerrar Operativo', exact: true }).click()
  for (const name of ['Cuaderno', 'Reloj', 'Elementos', 'Dotaciones', 'Calculadora', 'Coordenadas']) {
    await openModule(page, name)
    const region = page.getByRole('region', { name, exact: true })
    if (name === 'Reloj') await region.getByRole('button', { name: 'T-Minus', exact: true }).click()
    if (['Elementos', 'Dotaciones'].includes(name)) {
      await expect(region.getByRole('button', { name: 'Crear', exact: true })).toHaveCSS('height', reference[0]!)
      await region.getByRole('button', { name: 'Crear', exact: true }).click()
      await region.getByLabel('Escala', { exact: true }).fill('125')
      await region.getByLabel('Escala', { exact: true }).press('Tab')
      await expect(region.getByLabel('Escala', { exact: true })).toHaveValue('125')
    }
    await page.mouse.move(0, 0)
    for (const button of await region.locator('[data-slot="button"]').all()) {
      const text = await button.textContent()
      if (text?.trim()) expect(await button.evaluate(buttonStyle), name + ': ' + text).toEqual(reference)
    }
    for (const field of await region.locator('input:not([type="checkbox"]):not([type="radio"]), textarea, select').all()) {
      if (await field.evaluate(el => !!el.closest('.zoom-control'))) continue
      const expected = [...inputReference]
      // Native selects keep the browser's line-height; their box shares the field height.
      if (await field.evaluate(el => el.tagName === 'SELECT')) expected[2] = 'normal'
      expect(await field.evaluate(fieldStyle), name + ': ' + await field.getAttribute('aria-label')).toEqual(expected)
      if (await field.evaluate(el => el.tagName === 'TEXTAREA')) {
        await field.focus()
        await expect(field).toHaveCSS('outline-style', 'none')
        await expect(field).toHaveCSS('border-color', 'rgb(117, 131, 141)')
      }
    }
    if (name === 'Calculadora') {
      await region.getByLabel('Operación', { exact: true }).fill('7+5')
      await region.getByLabel('Operación', { exact: true }).press('Enter')
      await expect(region.getByLabel('Resultado', { exact: true })).toHaveText('12')
    }
    expect(await region.locator('.module-content').evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').height)).toBe('0px')
    const footer = region.locator('.module-controls')
    await expect(footer).toHaveCSS('border-top-width', '0px')
    expect(await footer.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await region.evaluate(el => getComputedStyle(el).backgroundColor))
    expect(await footer.locator('.zoom-control > :first-child').getAttribute('aria-label')).toBe('Abrir deslizador: Zoom de ' + name)
    await expect(region.locator('..').locator('.react-resizable-handle-se .lucide-square-dimensions')).toHaveCount(1)
    await page.screenshot({ path: info.outputPath('estilos-' + name + '.png') })
    await page.getByRole('button', { name: 'Cerrar ' + name, exact: true }).click()
  }

  await openModule(page, 'Registro cronológico')
  const timeline = page.getByRole('region', { name: 'Registro cronológico', exact: true })
  await timeline.getByLabel('Acontecimiento', { exact: true }).fill('Revisión de material')
  await timeline.getByRole('button', { name: 'Añadir entrada', exact: true }).click()
  await timeline.getByRole('button', { name: 'Editar entrada', exact: true }).click()
  const entry = timeline.getByLabel('Texto de entrada', { exact: true })
  expect(await entry.evaluate(fieldStyle)).toEqual(inputReference)
  await entry.focus()
  await expect(entry).toHaveCSS('outline-style', 'none')
  await page.mouse.move(0, 0)
  for (const label of ['Guardar entrada', 'Cancelar']) expect(await timeline.getByRole('button', { name: label, exact: true }).evaluate(buttonStyle)).toEqual(reference)
  await timeline.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(timeline.locator('.timeline-add')).toHaveCSS('border-top-width', '0px')
  await timeline.getByRole('button', { name: 'Eliminar entrada', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await page.mouse.move(0, 0)
  for (const label of ['Eliminar entrada', 'Cancelar']) expect(await dialog.getByRole('button', { name: label, exact: true }).evaluate(buttonStyle)).toEqual(reference)
  await expect(dialog.locator('.window-resize .lucide-square-dimensions')).toHaveCount(1)
  const handle = (await dialog.getByRole('button', { name: 'Redimensionar diálogo' }).boundingBox())!
  const before = (await dialog.boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 10, handle.y + handle.height / 2 + 10); await page.mouse.up()
  expect((await dialog.boundingBox())!.width).toBeCloseTo(before.width + 10, 0)
  await page.screenshot({ path: info.outputPath('estilos-dialogo.png') })
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await noPageScroll(page)
})


test('correcciones visibles: referencia Nota, foco neutro, tarjetas y ausencia de barras horizontales', async ({ page }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Correcciones de interfaz')
  const units = ['Equipo norte', 'Equipo sur'].map(name => createElement(fixture, { name, information: 'Información de prueba', isUnit: true, visual: { type: 'emoji', value: '🚑', scale: 1 } }))
  for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) fixture.moduleLayouts[id] = { x: 0, y: 0, width: 300, height: 500, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture)
  await openModule(page, 'Cuaderno')
  const reference = page.getByRole('button', { name: 'Nota', exact: true })
  await expect(reference).toHaveCSS('font-size', '13px')
  await expect(reference).toHaveCSS('height', '22px')
  await reference.screenshot({ path: info.outputPath('boton-nota-referencia.png') })
  await page.getByRole('button', { name: 'Cerrar Cuaderno', exact: true }).click()
  for (const name of ['Reloj', 'Registro cronológico', 'Calculadora', 'Información', 'Elementos', 'Dotaciones', 'Coordenadas', 'Operativo']) {
    if (['Información', 'Operativo'].includes(name)) {
      await openModule(page, 'Dotaciones')
      await page.getByRole('button', { name: 'Seleccionar Equipo norte', exact: true }).click()
      await page.getByRole('button', { name: 'Cerrar Dotaciones', exact: true }).click()
    }
    await openModule(page, name)
    const region = page.getByRole('region', { name, exact: true })
    if (name === 'Reloj') await region.getByRole('button', { name: 'T-Minus', exact: true }).click()
    if (name === 'Coordenadas') {
      await region.getByRole('textbox', { name: 'Coordenadas', exact: true }).fill('37.099521, -2.367841')
      await region.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }).click()
      await expect(region.getByRole('button', { name: 'Copiar Maps', exact: true })).toBeVisible()
    }
    if (name === 'Registro cronológico') {
      await region.getByRole('textbox', { name: 'Acontecimiento', exact: true }).fill('Comprobar material, comunicaciones y punto de encuentro con el equipo norte.')
      await region.getByRole('button', { name: 'Añadir entrada', exact: true }).click()
    }
    if (['Elementos', 'Dotaciones'].includes(name)) await region.getByRole('button', { name: 'Crear', exact: true }).click()
    for (const field of await region.locator('input:not([type="checkbox"]):not([type="radio"]):not([aria-hidden="true"]), select, textarea').all()) {
      if (!await field.isVisible()) continue
      await field.focus()
      expect(await field.evaluate(el => {
        const own = getComputedStyle(el), group = el.closest('.ui-input-group')
        return own.outlineStyle === 'none' && (own.borderBottomWidth === '0px' || own.borderBottomColor === 'rgb(117, 131, 141)')
          && (!group || (getComputedStyle(group).outlineStyle === 'none' && getComputedStyle(group).borderColor === 'rgb(117, 131, 141)'))
      }), name + ': ' + await field.getAttribute('aria-label')).toBe(true)
    }
    const scrolling = region.locator('.module-content,.element-editor,.elements-list,.timeline-entries,.coordinates-results dd')
    for (const node of await scrolling.all()) {
      expect(await node.evaluate(el => ['hidden', 'clip'].includes(getComputedStyle(el).overflowX)), name).toBe(true)
      expect(await node.evaluate(el => el.scrollWidth - el.clientWidth), name).toBeLessThanOrEqual(1)
    }
    if (name === 'Operativo') {
      const cards = region.locator('.operations-cards')
      await expect(cards.getByLabel('Anotación', { exact: true })).toHaveAttribute('placeholder', 'Anotación')
      const note = cards.locator('.operations-notes'), tags = cards.locator('.operations-tags')
      const button = cards.getByRole('button', { name: 'Disponible', exact: true })
      for (const state of await cards.locator('.operations-states button').all()) {
        await expect(state).toHaveCSS('justify-content', 'flex-start')
        await expect(state).toHaveCSS('padding-left', '6px')
      }
      const rect = (await button.boundingBox())!, nr = (await note.boundingBox())!, tr = (await tags.boundingBox())!
      expect(nr.width).toBeCloseTo(rect.width, 0); expect(tr.width).toBeCloseTo(rect.width, 0)
      expect(nr.height).toBeCloseTo(rect.height, 0); expect(tr.height).toBeCloseTo(rect.height, 0)
      for (const label of await cards.locator('.operations-state-name').all()) await expect(label).toHaveCSS('font-size', '13px')
      const handle = page.locator('[data-module="operations"] .react-resizable-handle-se')
      const before = (await handle.boundingBox())!
      await page.mouse.move(before.x + 12, before.y + 12); await page.mouse.down()
      await page.mouse.move(before.x + 12 - 120, before.y + 12); await page.mouse.up()
      for (const label of await cards.locator('.operations-state-name').all()) await expect(label).toBeHidden()
      for (const label of await cards.locator('.operations-state-abbr').all()) {
        await expect(label).toBeVisible()
        await expect(label).toHaveCSS('font-size', '13px')
      }
      await expect(cards.getByText('RUTA', { exact: true })).toBeVisible()
      await region.screenshot({ path: info.outputPath('operativo-abreviaturas.png') })
      expect(await cards.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
      const small = (await handle.boundingBox())!
      await page.mouse.move(small.x + 12, small.y + 12); await page.mouse.down()
      await page.mouse.move(small.x + 12 + 120, small.y + 12); await page.mouse.up()
      for (const label of await cards.locator('.operations-state-name').all()) await expect(label).toHaveCSS('font-size', '13px')
      for (const label of await cards.locator('.operations-state-name').all()) await expect(label).toBeVisible()
      for (const label of await cards.locator('.operations-state-abbr').all()) await expect(label).toBeHidden()
      const annotation = cards.getByLabel('Anotación', { exact: true })
      await annotation.fill('Preparar material\nRevisar radio\nComprobar equipo')
      expect((await note.boundingBox())!.height).toBeGreaterThan(rect.height)
      expect((await tags.boundingBox())!.height).toBeCloseTo((await note.boundingBox())!.height, 0)
      await annotation.fill('')
      expect((await note.boundingBox())!.height).toBeCloseTo(rect.height, 0)
      expect((await tags.boundingBox())!.height).toBeCloseTo(rect.height, 0)
      await cards.getByRole('textbox', { name: 'Nueva etiqueta', exact: true }).fill('Radio')
      await cards.getByRole('textbox', { name: 'Nueva etiqueta', exact: true }).press('Enter')
      expect((await annotation.boundingBox())!.height).toBeCloseTo((await tags.boundingBox())!.height, 0)
      await annotation.fill('Preparar material\nRevisar radio\nComprobar equipo')
    }
    await region.screenshot({ path: info.outputPath('correccion-' + name + '.png') })
    await page.getByRole('button', { name: 'Cerrar ' + name, exact: true }).click()
  }
  await openModule(page, 'Operativo')
  for (let index = 0; index < 6; index++) {
    await openModule(page, 'Dotaciones')
    await page.getByRole('button', { name: 'Seleccionar ' + units[index % 2]!.name, exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar Dotaciones', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Anotación', exact: true })).toHaveCount(1)
    await expect(page.getByRole('textbox', { name: 'Nueva etiqueta', exact: true })).toHaveCount(1)
  }
  await noPageScroll(page)
})


test('dashboard: arrastrar fondo y volver al origen conserva módulos sin resalto amarillo', async ({ page, context, isMobile }, info) => {
  await page.goto('/')
  const fixture = createEmptyDocument('Navegación')
  fixture.moduleLayouts.information = { x: 0, y: 0, width: 250, height: 200, referenceSize: { width: 1440, height: 864 } }
  await loadDocument(page, fixture); await openModule(page, 'Información')
  const module = page.locator('[data-module="information"]'), frame = module.locator('.module-frame')
  const before = await savedDocument(page), geometry = await module.getAttribute('style')
  const decoration = () => frame.evaluate(el => ({ border: getComputedStyle(el).borderColor, shadow: getComputedStyle(el).boxShadow, indicator: getComputedStyle(el.querySelector('.module-header')!, '::before').backgroundColor }))
  const active = await decoration()
  expect(active.border).toBe('rgb(66, 77, 85)')
  expect(active.indicator).toBe('rgb(117, 131, 141)')
  await zoom(page, 150)
  const viewport = page.getByTestId('mobile-viewport'), rect = (await viewport.boundingBox())!
  const x = rect.x + rect.width - 20, y = rect.y + rect.height - 30
  if (isMobile) {
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y: y - 80, id: 1 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 70, y - 80, { steps: 8 }); await page.mouse.up()
  }
  await expect(viewport).toHaveAttribute('data-offset-x', '-70')
  await expect(viewport).toHaveAttribute('data-offset-y', '-80')
  const origin = page.getByRole('button', { name: 'Volver al origen', exact: true })
  await expect(origin.locator('.lucide-locate-fixed')).toBeVisible()
  await origin.click()
  await expect(viewport).toHaveAttribute('data-offset-x', '0')
  await expect(viewport).toHaveAttribute('data-offset-y', '0')
  await expect(page.getByRole('spinbutton', { name: 'Zoom actual', exact: true })).toHaveValue('150')
  expect(await savedDocument(page)).toEqual(before)
  expect(await module.getAttribute('style')).toBe(geometry)
  await zoom(page, 100)
  await page.mouse.click(rect.x + rect.width - 20, rect.y + rect.height - 30)
  expect(await decoration()).toEqual(active)
  await expect(frame.locator('.module-close .lucide-x')).toBeVisible()
  await expect(frame.locator('.module-close .lucide-square-x')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('dashboard-origen-sin-resalto.png') })
})

test('dashboard: sliders enganchan decenas y permiten porcentajes exactos', async ({ page, context, isMobile }, info) => {
  await page.goto('/'); await openModule(page, 'Información')
  for (const label of ['Zoom actual', 'Zoom de Información']) {
    const field = page.getByRole('spinbutton', { name: label, exact: true })
    await page.getByRole('button', { name: `Abrir deslizador: ${label}`, exact: true }).click()
    await page.getByRole('slider', { name: label, exact: true }).press('ArrowRight')
    await expect(field).toHaveValue('101')
    const track = page.getByRole('dialog', { name: label, exact: true }).locator('.ui-slider'), box = (await track.boundingBox())!
    const x = box.x + box.width * (138 - 25) / 375, y = box.y + box.height / 2
    const thumb = (await page.getByRole('slider', { name: label, exact: true }).boundingBox())!
    const startX = thumb.x + thumb.width / 2, startY = thumb.y + thumb.height / 2
    if (isMobile) {
      const session = await context.newCDPSession(page)
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 1 }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await session.detach()
    } else {
      await page.mouse.move(startX, startY); await page.mouse.down(); await page.mouse.move(x, y, { steps: 6 }); await page.mouse.up()
    }
    await expect(field).toHaveValue('140')
    await page.screenshot({ path: info.outputPath(label === 'Zoom actual' ? 'zoom-general.png' : 'zoom-modulo.png') })
    await page.keyboard.press('Escape')
    await field.fill('138'); await field.press('Enter')
    await expect(field).toHaveValue('138')
    await field.fill('100'); await field.press('Enter')
  }
})
