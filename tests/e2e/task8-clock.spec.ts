import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { noPageScroll } from './acceptance-helpers'

type AudioProbeWindow = Window & { task8Audio: { element: HTMLMediaElement | null; playCalls: number; resolved: boolean } }
function playback(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as AudioProbeWindow).task8Audio
    return { calls: probe.playCalls, resolved: probe.resolved, loop: probe.element?.loop, paused: probe.element?.paused, src: probe.element?.currentSrc }
  })
}

async function openClock(page: Page) {
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Reloj', exact: true }).click()
}
async function save(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'))
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true })
    const probe = { element: null as HTMLMediaElement | null, playCalls: 0, resolved: false }
    ;(window as unknown as AudioProbeWindow).task8Audio = probe
    const nativePlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      probe.element = this; probe.playCalls++; probe.resolved = false
      return nativePlay.call(this).then(() => { probe.resolved = true })
    }
  })
  await page.goto('/')
})

test('composición táctica y separadores alineados en tamaños mínimo, inicial y ampliado', async ({ page, isMobile }, info) => {
  await page.clock.install({ time: new Date('2026-01-01T12:04:05Z') })
  await page.clock.pauseAt(new Date('2026-01-01T12:04:06Z'))
  await openClock(page)
  const clock = page.getByRole('region', { name: 'Reloj', exact: true })
  const observations: object[] = []
  for (const [orientation, viewport] of isMobile
    ? [['vertical', { width: 412, height: 915 }], ['horizontal', { width: 915, height: 412 }]] as const
    : [['desktop', { width: 1440, height: 900 }]] as const) {
    await page.setViewportSize(viewport)
    const fonts: number[] = []
    for (const [size, width, height] of [['minimum', 320, 260], ['initial', 440, 480], ['expanded', 640, 640]] as const) {
      const clockDocument = createEmptyDocument('Reloj adaptable')
      clockDocument.moduleLayouts.clock = { x: 0, y: 0, width, height, referenceSize: { width: 1440, height: 900 } }
      await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'clock.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(clockDocument)) })
      await expect(clock.locator('.clock-reference')).toHaveText('Digital Watch | UTC+2 [ST] | UTC+1 [WT] ESP')
      await expect(clock.getByLabel('Hora española')).toHaveText('13:04:06')
      await expect(clock.getByLabel('Hora Zulu')).toHaveText('12:04')
      await expect(clock.getByText('Zulu Time', { exact: true })).toBeVisible()
      await expect(clock.getByText('UTC+1 [WT]', { exact: true })).toHaveClass('clock-season-active')
      await page.evaluate(() => document.fonts.ready)
      const measure = await clock.evaluate(node => {
        const esp = node.querySelector('.clock-esp')!, zulu = node.querySelector('.clock-zulu output')!
        const center = (separator: Element) => {
          const range = document.createRange(); range.selectNodeContents(separator)
          const rect = range.getBoundingClientRect(); return rect.x + rect.width / 2
        }
        const actions = Array.from(node.querySelectorAll('.clock-add-controls button')).map(button => {
          const box = button.getBoundingClientRect(); return { x: box.x, right: box.right, top: box.top, bottom: box.bottom }
        })
        const reference = node.querySelector('.clock-reference')!
        return { difference: Math.abs(center(esp.querySelector('.clock-separator')!) - center(zulu.querySelector('.clock-separator')!)), espFont: parseFloat(getComputedStyle(esp).fontSize), zuluFont: parseFloat(getComputedStyle(zulu).fontSize), actions, referenceFits: reference.scrollWidth <= reference.clientWidth, technicalFont: getComputedStyle(esp).fontFamily }
      })
      expect(measure.difference).toBeLessThanOrEqual(1)
      expect(measure.zuluFont).toBeLessThan(measure.espFont)
      expect(measure.technicalFont).toContain('monospace')
      expect(measure.referenceFits).toBe(true)
      expect(measure.actions).toHaveLength(4)
      expect(Math.max(...measure.actions.map(action => action.top)) - Math.min(...measure.actions.map(action => action.top))).toBeLessThanOrEqual(1)
      for (let index = 1; index < measure.actions.length; index++) expect(measure.actions[index]!.x).toBeGreaterThanOrEqual(measure.actions[index - 1]!.right)
      const actionRow = await clock.locator('.clock-add-controls').boundingBox()
      expect(Math.abs(measure.actions[3]!.right - (actionRow!.x + actionRow!.width))).toBeLessThanOrEqual(1)
      for (const name of ['T-Zero', 'T-Minus', 'Advisories']) await expect(clock.getByRole('button', { name, exact: true })).toHaveText(name)
      await expect(clock.getByRole('button', { name: 'Reproducir prueba de sonido', exact: true })).toHaveText('▶ Sonido')
      await noPageScroll(page)
      for (const button of await clock.locator('.clock-add-controls button').all()) await expect(button).toBeInViewport()
      fonts.push(measure.espFont); observations.push({ orientation, size, ...measure })
      await page.screenshot({ path: info.outputPath(`clock-${orientation}-${size}.png`) })
    }
    expect(fonts[1]!).toBeGreaterThan(fonts[0]!)
    if (orientation === 'vertical') expect(fonts[2]!).toBeGreaterThanOrEqual(fonts[1]!) // width is capped by the physical viewport
    else expect(fonts[2]!).toBeGreaterThan(fonts[1]!)
  }
  await page.clock.setSystemTime(new Date('2026-07-01T12:04:06Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(clock.getByLabel('Hora española')).toHaveText('14:04:06')
  await expect(clock.getByLabel('Hora Zulu')).toHaveText('12:04')
  await expect(clock.getByText('UTC+2 [ST]', { exact: true })).toHaveClass('clock-season-active')
  await info.attach('clock-measurements.json', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' })
})

test('Sonido cambia su acción y cede el MP3 real a una alarma', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'))
  await openClock(page)
  const clock = page.getByRole('region', { name: 'Reloj', exact: true })
  await clock.getByRole('button', { name: 'T-Minus', exact: true }).click()
  const timer = clock.getByRole('group', { name: 'T-Minus 1', exact: true })
  await timer.getByLabel('Nota', { exact: true }).fill('Radio')
  await clock.getByRole('button', { name: 'Reproducir prueba de sonido', exact: true }).press('Enter')
  const stopping = clock.getByRole('button', { name: 'Detener prueba de sonido', exact: true })
  await expect(stopping).toHaveText('⏸ Sonido'); await expect(stopping).toHaveAttribute('aria-pressed', 'true')
  await expect(timer.getByText('Inactivo', { exact: true })).toBeVisible()
  await expect(timer.getByLabel('Nota', { exact: true })).toHaveValue('Radio')
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  await timer.getByRole('button', { name: 'Iniciar', exact: true }).click(); await page.clock.runFor(1100)
  const playing = clock.getByRole('button', { name: 'Reproducir prueba de sonido', exact: true })
  await expect(playing).toHaveText('▶ Sonido'); await expect(playing).toBeDisabled()
  await expect(timer).toHaveAttribute('data-alert', 'true')
  await expect.poll(() => playback(page)).toMatchObject({ calls: 2, resolved: true, loop: true, paused: false })
  await timer.getByRole('button', { name: 'Reconocer alerta', exact: true }).press('Enter')
  await expect(playing).toBeEnabled(); await expect.poll(() => playback(page)).toMatchObject({ paused: true })
})

test('reloj, controles por teclado, normalización, pausa y mínimo con scroll interno', async ({ page }, info) => {
  await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  await expect(clock.getByLabel('Hora española')).toHaveText(/\d{2}:\d{2}:\d{2}/)
  await expect(clock.getByLabel('Hora Zulu')).toHaveText(/^\d{2}:\d{2}$/)
  await clock.getByRole('button', { name: 'T-Zero', exact: true }).focus(); await page.keyboard.press('Enter')
  const zero = clock.getByRole('group', { name: 'T-Zero 1', exact: true })
  await zero.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(zero.getByLabel('Tiempo')).not.toHaveText('00:00:00')
  await zero.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(zero.getByText('Pausado', { exact: true })).toBeVisible()
  await clock.getByRole('button', { name: 'T-Minus', exact: true }).click()
  const minus = clock.getByRole('group', { name: 'T-Minus 1', exact: true })
  await minus.getByLabel('Segundos', { exact: true }).fill('0'); await minus.getByLabel('Minutos', { exact: true }).fill('90')
  await minus.getByLabel('Nota', { exact: true }).click()
  await expect(minus.getByLabel('Horas', { exact: true })).toHaveValue('01')
  await expect(minus.getByLabel('Minutos', { exact: true })).toHaveValue('30')
  await minus.getByLabel('Segundos', { exact: true }).fill('abc')
  await expect(minus.getByLabel('Segundos', { exact: true })).toHaveValue('01')
  await minus.getByLabel('Nota', { exact: true }).fill('Canal 4')
  await clock.getByRole('button', { name: 'Advisories', exact: true }).click()
  await expect(clock.getByRole('group', { name: 'Advisory 1', exact: true }).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('clock.png') })
  const document = createEmptyDocument()
  document.moduleLayouts.clock = { x: 0, y: 0, width: 320, height: 260, referenceSize: { width: 1600, height: 1000 } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  expect(await clock.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('clock-minimum.png') })
})

test('prueba con MP3 real en bucle se detiene al cerrar; JSON y recarga conservan temporizadores aparte', async ({ page }) => {
  await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  const preview = clock.getByRole('button', { name: /^(Reproducir|Detener) prueba de sonido$/, exact: true })
  await preview.click(); await expect(preview).toHaveText('⏸ Sonido')
  await expect(preview).toHaveAccessibleName('Detener prueba de sonido')
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  expect((await playback(page)).src).toContain('/assets/audio/alarm.mp3')
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar Reloj', exact: true }).click()
  await expect.poll(() => playback(page)).toMatchObject({ paused: true })
  await openClock(page); await expect(preview).toHaveText('▶ Sonido')
  await expect(preview).toHaveAccessibleName('Reproducir prueba de sonido')
  await clock.getByRole('button', { name: 'T-Minus', exact: true }).click()
  const timer = clock.getByRole('group', { name: 'T-Minus 1', exact: true })
  await timer.getByLabel('Segundos', { exact: true }).fill('30')
  await timer.getByLabel('Nota', { exact: true }).fill('Radio')
  await timer.getByRole('button', { name: 'Iniciar', exact: true }).click()
  const json = await save(page)
  expect(Object.keys(json)).toHaveLength(8); expect(JSON.stringify(json)).not.toContain('Radio')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.getByRole('menuitem', { name: 'Nuevo', exact: true }).click()
  await expect(timer.getByText('En marcha', { exact: true })).toBeVisible()
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await expect(timer.getByLabel('Nota', { exact: true })).toHaveValue('Radio')
  await page.reload(); await expect(page.locator('[data-module]')).toHaveCount(0)
  await openClock(page); await expect(timer.getByText('En marcha', { exact: true })).toBeVisible()
  await expect(timer.getByLabel('Nota', { exact: true })).toHaveValue('Radio')
  const resource = await page.request.get('/assets/audio/alarm.mp3')
  expect(resource.ok()).toBe(true); expect((await resource.body()).byteLength).toBe(13859)
})

test('alertas simultáneas, suspensión por marcas de tiempo, desactivar y reconocer', async ({ page }, info) => {
  await openClock(page)
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'))
  const clock = page.locator('[data-module="clock"]')
  for (const name of ['T-Minus', 'Advisories']) await clock.getByRole('button', { name, exact: true }).click()
  for (const name of ['T-Minus 1', 'Advisory 1']) {
    const row = clock.getByRole('group', { name, exact: true })
    await row.getByLabel('Nota', { exact: true }).fill(name)
    await row.getByRole('button', { name: 'Iniciar', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Cerrar Reloj', exact: true }).click()
  await page.clock.setSystemTime(new Date('2026-01-01T12:00:11Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await openClock(page)
  await expect(clock.locator('.timer-row[data-alert="true"]')).toHaveCount(2)
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  await expect(clock.getByRole('button', { name: /^(Reproducir|Detener) prueba de sonido$/, exact: true })).toBeDisabled()
  const minus = clock.getByRole('group', { name: 'T-Minus 1', exact: true }), advisory = clock.getByRole('group', { name: 'Advisory 1', exact: true })
  await expect(minus).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  await expect(minus).toHaveCSS('animation-duration', '0.5s')
  await page.screenshot({ path: info.outputPath('clock-alarms.png') })
  await advisory.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await expect(advisory.getByLabel('Tiempo')).toHaveText('00:00:00')
  await expect(clock.locator('.timer-row[data-alert="true"]')).toHaveCount(1)
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, paused: false })
  await minus.getByRole('button', { name: 'Reconocer alerta', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(minus.getByRole('button', { name: 'Reiniciar', exact: true })).toBeFocused()
  await expect(minus.getByText('Finalizado', { exact: true })).toBeVisible()
  await expect(clock.locator('.timer-row[data-alert="true"]')).toHaveCount(0)
  await expect.poll(() => playback(page)).toMatchObject({ paused: true })
  await expect(clock.getByRole('button', { name: /^(Reproducir|Detener) prueba de sonido$/, exact: true })).toBeEnabled()
})

test('reloj y MP3 real funcionan sin conexión después de la primera carga', async ({ page, context }) => {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await page.reload(); await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  await expect(clock.getByLabel('Hora española')).toHaveText(/\d{2}:\d{2}:\d{2}/)
  await clock.getByRole('button', { name: /^(Reproducir|Detener) prueba de sonido$/, exact: true }).click()
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await clock.getByRole('button', { name: /^(Reproducir|Detener) prueba de sonido$/, exact: true }).click()
  await expect.poll(() => playback(page)).toMatchObject({ paused: true })
})

test('bloqueo de audio deja alerta visual, Activar sonido reintenta desde interacción directa', async ({ page }) => {
  await page.addInitScript(() => {
    let blocked = true
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (blocked) { blocked = false; return Promise.reject(new DOMException('blocked', 'NotAllowedError')) }
      return play.call(this)
    }
  })
  await page.reload(); await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  await clock.getByRole('button', { name: 'T-Minus', exact: true }).click()
  await clock.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(clock.getByRole('alert')).toContainText('Sonido bloqueado')
  await expect(clock.locator('.timer-row[data-alert="true"]')).toHaveCount(1)
  await clock.getByRole('button', { name: 'Activar sonido', exact: true }).click()
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await expect(clock.getByRole('button', { name: 'Reconocer alerta', exact: true })).toBeVisible()
})
