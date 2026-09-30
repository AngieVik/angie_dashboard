import { expect, test } from '@playwright/test'

const fontRoot = '/assets/fonts/roboto-condensed/'
const fontFiles = [
  'roboto-condensed-latin-variable.woff2',
  'roboto-condensed-latin-ext-variable.woff2',
  'roboto-condensed-latin-italic-variable.woff2',
  'roboto-condensed-latin-ext-italic-variable.woff2',
]
const icons = [
  { file: 'favicon-16.png', size: 16, maskable: false },
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'apple-touch-icon-180.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
]

test('carga sin errores, con cabecera, fuentes locales y sin scroll', async ({ page }, testInfo) => {
  const errors: string[] = []
  const externalRequests: string[] = []
  const loadedFonts = new Set<string>()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('requestfailed', request => errors.push(request.url()))
  page.on('request', request => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url())
  })
  page.on('response', response => {
    if (response.url().endsWith('.woff2') && response.ok()) loadedFonts.add(new URL(response.url()).pathname)
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Angie Dashboard' })).toBeVisible()
  await expect(page.getByRole('main', { name: 'Espacio de trabajo' })).toBeEmpty()
  await expect(page.getByRole('heading', { name: 'Angie Dashboard' })).toHaveCSS('font-family', /Roboto Condensed/)

  const fonts = await page.evaluate(async () => {
    const results = []
    for (const style of ['normal', 'italic']) {
      for (const weight of [100, 400, 900]) {
        for (const sample of ['Angie áéñ', 'Łąč']) {
          const loaded = await document.fonts.load(`${style} ${weight} 16px "Roboto Condensed"`, sample)
          results.push(loaded.length > 0 && loaded.every(face => face.status === 'loaded'))
        }
      }
    }
    // A test fixture checks the technical style without adding a product module.
    const technical = document.createElement('code')
    technical.className = 'technical-data'
    document.body.append(technical)
    const technicalFamily = getComputedStyle(technical).fontFamily
    technical.remove()
    return { results, technicalFamily, faces: [...document.fonts].map(face => ({ style: face.style, weight: face.weight })) }
  })
  expect(fonts.results).toEqual(Array(12).fill(true))
  expect(fonts.technicalFamily).toContain('monospace')
  expect(fonts.faces).toEqual(expect.arrayContaining([
    { style: 'normal', weight: '100 900' },
    { style: 'italic', weight: '100 900' },
  ]))
  expect(loadedFonts.size).toBe(4)
  for (const file of fontFiles) {
    const stem = file.replace('.woff2', '')
    const loadedPath = [...loadedFonts].find(path => path === fontRoot + file || path.startsWith(`/assets/${stem}-`))
    expect(loadedPath, file).toBeDefined()
    const original = await page.request.get(fontRoot + file)
    const compiled = await page.request.get(loadedPath!)
    expect(await compiled.body()).toEqual(await original.body())
  }

  const bounds = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    header: document.querySelector('header')!.getBoundingClientRect().toJSON(),
    main: document.querySelector('main')!.getBoundingClientRect().toJSON(),
  }))
  expect(bounds.width).toBe(bounds.viewportWidth)
  expect(bounds.height).toBe(bounds.viewportHeight)
  expect(bounds.header.top).toBe(0)
  expect(bounds.main.top).toBe(bounds.header.bottom)
  expect(bounds.main.bottom).toBe(bounds.viewportHeight)
  expect(externalRequests).toEqual([])
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('shell.png') })
})

test('integra los siete iconos PWA con dimensiones, transparencia y zona segura correctas', async ({ page }) => {
  await page.goto('/')
  const manifestLink = page.locator('link[rel="manifest"]')
  const manifestResponse = await page.request.get(await manifestLink.getAttribute('href') ?? '')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    name: 'Angie Dashboard', short_name: 'Angie', theme_color: '#0C0D0E',
    background_color: '#0C0D0E', display: 'standalone', start_url: '/',
  })
  expect(manifest.icons).toHaveLength(7)
  for (const icon of icons) {
    expect(manifest.icons).toContainEqual({
      src: `/assets/pwa/${icon.file}`, sizes: `${icon.size}x${icon.size}`,
      type: 'image/png', purpose: icon.maskable ? 'maskable' : 'any',
    })
    const measured = await page.evaluate(async ({ file }) => {
      const image = new Image()
      image.src = `/assets/pwa/${file}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let transparent = 0
      let visible = 0
      let nonOpaque = 0
      let foreground = 0
      let outsideSafeZone = 0
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4
          const alpha = data[offset + 3]!
          if (alpha === 0) transparent++
          if (alpha > 0) visible++
          if (alpha !== 255) nonOpaque++
          if (data[offset] !== 12 || data[offset + 1] !== 13 || data[offset + 2] !== 14) {
            foreground++
            if (Math.hypot(x + 0.5 - canvas.width / 2, y + 0.5 - canvas.height / 2) > canvas.width * 0.4) {
              outsideSafeZone++
            }
          }
        }
      }
      return { width: canvas.width, height: canvas.height, transparent, visible, nonOpaque, foreground, outsideSafeZone }
    }, icon)
    expect(measured.width).toBe(icon.size)
    expect(measured.height).toBe(icon.size)
    expect(measured.visible).toBeGreaterThan(0)
    if (icon.maskable) {
      expect(measured.nonOpaque).toBe(0)
      expect(measured.foreground).toBeGreaterThan(0)
      expect(measured.outsideSafeZone).toBe(0)
    } else {
      expect(measured.transparent).toBeGreaterThan(0)
    }
  }
  await expect(page.locator('link[rel="icon"][sizes="16x16"]')).toHaveAttribute('href', '/assets/pwa/favicon-16.png')
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', '/assets/pwa/favicon-32.png')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/assets/pwa/apple-touch-icon-180.png')
})

test('el shell y todos los recursos aprobados siguen disponibles sin conexión', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const cachedFonts = await page.evaluate(async () => {
    const sheets = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
    const paths = sheets.filter(rule => rule instanceof CSSFontFaceRule).map(rule => {
      const source = (rule as CSSFontFaceRule).style.getPropertyValue('src')
      return source.match(/url\(["']?([^"')]+)["']?\)/)![1]!
    })
    return Promise.all(paths.map(async path => Boolean(await caches.match(path))))
  })
  expect(cachedFonts).toEqual([true, true, true, true])
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Angie Dashboard' })).toBeVisible()
  const resources = [
    ...fontFiles.map(file => fontRoot + file), fontRoot + 'roboto-condensed.css', fontRoot + 'OFL.txt',
    ...icons.map(icon => `/assets/pwa/${icon.file}`),
    ...['icon_chincheta', 'icon_cp', 'icon_eh', 'icon_finish', 'icon_medical', 'icon_peligro', 'icon_quad', 'icon_start', 'icon_vir']
      .map(file => `/assets/elements/${file}.png`),
    '/assets/audio/alarm.mp3', '/manifest.webmanifest',
  ]
  const results = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    const response = await fetch(path)
    const bytes = await response.arrayBuffer()
    return { path, ok: response.ok, size: bytes.byteLength }
  })), resources)
  for (const result of results) {
    expect(result.ok, result.path).toBe(true)
    expect(result.size, result.path).toBeGreaterThan(0)
  }
  const offlineFonts = await page.evaluate(async () => {
    const faces = await document.fonts.load('italic 900 16px "Roboto Condensed"', 'Angie Łąč')
    return faces.length > 0 && faces.every(face => face.status === 'loaded')
  })
  expect(offlineFonts).toBe(true)
})
