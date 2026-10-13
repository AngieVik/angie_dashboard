import { expect, test } from '@playwright/test'
import { expectDocumentTitle, openModule, savedDocument, setDocumentTitle, watchAppErrors } from './acceptance-helpers'

test('Offline: reabre, recupera y edita el documento con fuentes y recursos disponibles', async ({ page, context }) => {
  const onlineErrors = watchAppErrors(page)
  await page.goto('/')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await setDocumentTitle(page, 'Documento ficticio offline')
  await openModule(page, 'Cuaderno')
  await page.getByRole('region', { name: 'Cuaderno', exact: true }).getByRole('button', { name: 'Nota', exact: true }).click()
  await page.getByRole('textbox', { name: 'Texto de nota', exact: true }).fill('Preparación ficticia sin red')
  await expect.poll(async () => (await savedDocument(page))?.notebook).toMatchObject([
    { type: 'note', text: 'Preparación ficticia sin red' },
  ])
  const saved = (await savedDocument(page))!
  expect(saved.document.title).toBe('Documento ficticio offline')
  expect(onlineErrors).toEqual([])
  await page.close()

  await context.setOffline(true)
  const offlinePage = await context.newPage()
  const offlineErrors = watchAppErrors(offlinePage)
  const response = await offlinePage.goto('/')
  expect(response?.fromServiceWorker()).toBe(true)
  await expect(offlinePage.getByRole('main', { name: 'Espacio de trabajo' })).toBeVisible()
  await expectDocumentTitle(offlinePage, saved.document.title)
  await openModule(offlinePage, 'Cuaderno')
  const note = offlinePage.getByRole('textbox', { name: 'Texto de nota', exact: true })
  await expect(note).toHaveValue('Preparación ficticia sin red')
  await expect.poll(() => savedDocument(offlinePage)).toEqual(saved)

  await note.fill('Edición ficticia realizada sin red')
  await expect.poll(async () => (await savedDocument(offlinePage))?.notebook).toMatchObject([
    { type: 'note', text: 'Edición ficticia realizada sin red' },
  ])
  await offlinePage.reload()
  await expect(note).toHaveValue('Edición ficticia realizada sin red')

  const resources = [
    '/assets/fonts/roboto-condensed/roboto-condensed.css',
    '/assets/fonts/roboto-condensed/roboto-condensed-latin-variable.woff2',
    '/assets/fonts/roboto-condensed/roboto-condensed-latin-ext-variable.woff2',
    '/assets/fonts/roboto-condensed/roboto-condensed-latin-italic-variable.woff2',
    '/assets/fonts/roboto-condensed/roboto-condensed-latin-ext-italic-variable.woff2',
    '/assets/fonts/rajdhani/Rajdhani-SemiBold.ttf',
    '/assets/elements/icon_chincheta.png',
    '/assets/pwa/icon-192.png',
    '/assets/audio/alarm.mp3',
    '/manifest.webmanifest',
  ]
  const results = await offlinePage.evaluate(async paths => Promise.all(paths.map(async path => {
    // Bypass the HTTP cache: these resources must be served offline by the PWA.
    const response = await fetch(path, { cache: 'no-store' })
    return { path, ok: response.ok, size: (await response.arrayBuffer()).byteLength }
  })), resources)
  for (const result of results) {
    expect(result.ok, result.path).toBe(true)
    expect(result.size, result.path).toBeGreaterThan(0)
  }
  const fontsLoaded = await offlinePage.evaluate(async () => {
    const fonts = await Promise.all([
      document.fonts.load('400 16px "Roboto Condensed"', 'Angie Łąč'),
      document.fonts.load('italic 400 16px "Roboto Condensed"', 'Angie Łąč'),
      document.fonts.load('600 16px "Rajdhani"', '1234'),
    ])
    return fonts.every(faces => faces.length > 0 && faces.every(face => face.status === 'loaded'))
  })
  expect(fontsLoaded).toBe(true)
  expect(offlineErrors).toEqual([])
})
