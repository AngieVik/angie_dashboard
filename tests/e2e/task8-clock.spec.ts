import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'

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

test('reloj, controles por teclado, normalización, pausa y mínimo con scroll interno', async ({ page }, info) => {
  await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  await expect(clock.getByLabel('Hora española')).toHaveText(/\d{2}:\d{2}:\d{2}/)
  await expect(clock.getByLabel('Hora Zulu')).toHaveText(/\d{2}:\d{2}:\d{2}/)
  await clock.getByRole('button', { name: '[+] T-Zero', exact: true }).focus(); await page.keyboard.press('Enter')
  const zero = clock.getByRole('group', { name: 'T-Zero 1', exact: true })
  await zero.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(zero.getByLabel('Tiempo')).not.toHaveText('00:00:00')
  await zero.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(zero.getByText('Pausado', { exact: true })).toBeVisible()
  await clock.getByRole('button', { name: '[+] T-Minus', exact: true }).click()
  const minus = clock.getByRole('group', { name: 'T-Minus 1', exact: true })
  await minus.getByLabel('Segundos', { exact: true }).fill('0'); await minus.getByLabel('Minutos', { exact: true }).fill('90')
  await minus.getByLabel('Nota', { exact: true }).click()
  await expect(minus.getByLabel('Horas', { exact: true })).toHaveValue('01')
  await expect(minus.getByLabel('Minutos', { exact: true })).toHaveValue('30')
  await minus.getByLabel('Segundos', { exact: true }).fill('abc')
  await expect(minus.getByLabel('Segundos', { exact: true })).toHaveValue('01')
  await minus.getByLabel('Nota', { exact: true }).fill('Canal 4')
  await clock.getByRole('button', { name: '[+] Advisories', exact: true }).click()
  await expect(clock.getByRole('group', { name: 'Advisory 1', exact: true }).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('clock.png') })
  const document = createEmptyDocument()
  document.moduleLayouts.clock = { x: 0, y: 0, width: 320, height: 260 }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  expect(await clock.locator('.module-content').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('clock-minimum.png') })
})

test('prueba con MP3 real en bucle se detiene al cerrar; JSON y recarga conservan temporizadores aparte', async ({ page }) => {
  await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  const preview = clock.getByRole('button', { name: 'Probar sonido', exact: true })
  await preview.click(); await expect(preview).toHaveText('⏸ Probar sonido')
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  expect((await playback(page)).src).toContain('/assets/audio/alarm.mp3')
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar Reloj', exact: true }).click()
  await expect.poll(() => playback(page)).toMatchObject({ paused: true })
  await openClock(page); await expect(preview).toHaveText('▶ Probar sonido')
  await clock.getByRole('button', { name: '[+] T-Minus', exact: true }).click()
  const timer = clock.getByRole('group', { name: 'T-Minus 1', exact: true })
  await timer.getByLabel('Segundos', { exact: true }).fill('30')
  await timer.getByLabel('Nota', { exact: true }).fill('Radio')
  await timer.getByRole('button', { name: 'Iniciar', exact: true }).click()
  const json = await save(page)
  expect(Object.keys(json)).toHaveLength(9); expect(JSON.stringify(json)).not.toContain('Radio')
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
  for (const name of ['[+] T-Minus', '[+] Advisories']) await clock.getByRole('button', { name, exact: true }).click()
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
  await expect(clock.getByRole('button', { name: 'Probar sonido', exact: true })).toBeDisabled()
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
  await expect(clock.getByRole('button', { name: 'Probar sonido', exact: true })).toBeEnabled()
})

test('reloj y MP3 real funcionan sin conexión después de la primera carga', async ({ page, context }) => {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await page.reload(); await openClock(page)
  const clock = page.locator('[data-module="clock"]')
  await expect(clock.getByLabel('Hora española')).toHaveText(/\d{2}:\d{2}:\d{2}/)
  await clock.getByRole('button', { name: 'Probar sonido', exact: true }).click()
  await expect.poll(() => playback(page)).toMatchObject({ calls: 1, resolved: true, loop: true, paused: false })
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await clock.getByRole('button', { name: 'Probar sonido', exact: true }).click()
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
  await clock.getByRole('button', { name: '[+] T-Minus', exact: true }).click()
  await clock.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(clock.getByRole('alert')).toContainText('Sonido bloqueado')
  await expect(clock.locator('.timer-row[data-alert="true"]')).toHaveCount(1)
  await clock.getByRole('button', { name: 'Activar sonido', exact: true }).click()
  await expect(clock.getByRole('alert')).toHaveCount(0)
  await expect(clock.getByRole('button', { name: 'Reconocer alerta', exact: true })).toBeVisible()
})
