import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createEmptyDocument } from '../../src/domain/document/defaultDocument'
import { noPageScroll } from './acceptance-helpers'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Calculadora', exact: true }).click()
})

test('operaciones y porcentajes con teclado, errores y botones sin conexión', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const module = page.getByRole('region', { name: 'Calculadora', exact: true })
  const input = module.getByRole('textbox', { name: 'Operación' })
  await expect(input).toBeVisible()
  await context.setOffline(true)
  for (const [expression, result] of [
    ['10 %', '0,1'], ['200 + 10 %', '220'], ['200 - 10 %', '180'],
    ['200 × 10 %', '20'], ['200 ÷ 10 %', '2000'], ['80 + 12,5 %', '90'],
    ['(200 + 10 %) × 2', '440'], ['2 + 3 × 4', '14'], ['0,1+0,2', '0,3'],
  ] as const) {
    await input.fill(expression); await input.press('Enter')
    await expect(module.getByLabel('Resultado', { exact: true })).toHaveText(result)
  }
  await input.fill('200 ÷ 0 %'); await input.press('=')
  await expect(input).toHaveValue('200 ÷ 0 %')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(module.getByRole('alert')).toHaveText('División por cero')
  await expect(module.getByLabel('Resultado', { exact: true })).toBeEmpty()
  await module.getByRole('button', { name: 'Limpiar', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('')
  await expect(module.getByRole('alert')).toHaveCount(0)
  const activate = async (name: string) => {
    const button = module.getByRole('button', { name, exact: true })
    if (info.project.name === 'mobile') await button.tap()
    else await button.click()
  }
  for (const key of ['Abrir paréntesis', '8', '0', 'Sumar', '1', '2', 'Separador decimal', '5', 'Porcentaje', 'Cerrar paréntesis', 'Calcular']) await activate(key)
  await expect(module.getByLabel('Resultado', { exact: true })).toHaveText('90')
  await activate('Borrar último carácter')
  await expect(input).toHaveValue('(80+12,5%')
  await expect(module.getByLabel('Resultado', { exact: true })).toBeEmpty()
  await activate('Cerrar paréntesis'); await activate('Calcular')
  await expect(module.getByLabel('Resultado', { exact: true })).toHaveText('90')
  await page.screenshot({ path: info.outputPath('calculator.png') })
  expect(errors).toEqual([])
})

test('cifras adaptables y etiqueta compacta en tamaños mínimo, inicial y ampliado', async ({ page }, info) => {
  const module = page.getByRole('region', { name: 'Calculadora', exact: true })
  const fonts: { input: number; result: number; key: number }[] = []
  for (const [width, height] of [[220, 280], [280, 360], [380, 540]]) {
    const document = createEmptyDocument('Calculadora adaptable')
    document.moduleLayouts.calculator = { x: 0, y: 0, width: width!, height: height!, referenceSize: { width: 1440, height: 900 } }
    await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'calculator.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
    const input = module.getByRole('textbox', { name: 'Operación', exact: true })
    await expect(module.getByText('Operación', { exact: true })).toHaveCount(0)
    await input.fill('200 + 10 %'); await input.press('Enter')
    const result = module.getByLabel('Resultado', { exact: true }), key = module.getByRole('button', { name: '7', exact: true })
    await expect(result).toHaveText('220')
    fonts.push({ input: await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize)), result: await result.evaluate(el => parseFloat(getComputedStyle(el).fontSize)), key: await key.evaluate(el => parseFloat(getComputedStyle(el).fontSize)) })
    for (const button of await module.getByRole('button').all()) await expect(button).toBeInViewport()
    await noPageScroll(page)
    await page.screenshot({ path: info.outputPath(`calculator-${width}.png`) })
  }
  for (const role of ['input', 'result', 'key'] as const) {
    expect(fonts[2]![role]).toBeGreaterThan(fonts[1]![role])
    expect(fonts[1]![role]).toBeGreaterThan(fonts[0]![role])
  }
})

test('operación y resultado no se exportan ni se autoguardan; recarga y reapertura vacías', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Operación' })
  await input.fill('987654+321'); await input.press('Enter')
  await expect(page.getByLabel('Resultado', { exact: true })).toHaveText('987975')
  await page.getByRole('textbox', { name: 'Título del documento' }).fill('Calculadora Task 10')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Archivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Guardar', exact: true }).click()
  const jsonText = await readFile((await (await downloading).path())!, 'utf8')
  const exported = JSON.parse(jsonText)
  expect(Object.keys(exported)).toHaveLength(8)
  const referenceSize = await page.locator('.logical-workspace').evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))
  expect(exported.moduleLayouts.calculator).toEqual({ x: 0, y: 0, width: 280, height: 360, referenceSize })
  for (const temporary of ['987654', '987975', 'expression', 'calculation']) expect(jsonText).not.toContain(temporary)
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('angie-dashboard')
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction('documents', 'readonly').objectStore('documents').get('active')
        request.onsuccess = () => resolve(JSON.stringify(request.result?.document ?? null))
        request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  })).toBe(JSON.stringify(exported))
  await page.getByRole('button', { name: 'Cerrar Calculadora', exact: true }).click()
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Calculadora', exact: true }).click()
  await expect(input).toHaveValue('')
  await input.fill('5+5'); await input.press('Enter')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Título del documento' })).toHaveValue('Calculadora Task 10')
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Calculadora', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(page.getByLabel('Resultado', { exact: true })).toBeEmpty()
})

test('tamaño mínimo sin scroll de página, controles accesibles y foco visible', async ({ page }, info) => {
  const document = createEmptyDocument('Mínimo Calculadora')
  document.moduleLayouts.calculator = { x: 0, y: 0, width: 220, height: 280, referenceSize: { width: 1600, height: 1000 } }
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'minimum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  const module = page.getByRole('region', { name: 'Calculadora', exact: true })
  await expect(page.getByRole('textbox', { name: 'Título del documento' })).toHaveValue('Mínimo Calculadora')
  for (const button of await module.getByRole('button').all()) {
    await expect(button).toHaveAccessibleName(/.+/)
    await expect(button).toBeInViewport()
  }
  const calculate = module.getByRole('button', { name: 'Calcular', exact: true })
  await calculate.focus()
  expect(await calculate.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none')
  await module.getByRole('textbox', { name: 'Operación' }).fill('(200+10%)')
  await calculate.focus(); await page.keyboard.press('Enter')
  await expect(module.getByLabel('Resultado', { exact: true })).toHaveText('220')
  const contentBounds = (await module.locator('.module-content').boundingBox())!
  const calculateBounds = (await calculate.boundingBox())!
  expect(calculateBounds.y).toBeGreaterThanOrEqual(contentBounds.y)
  expect(calculateBounds.y + calculateBounds.height).toBeLessThanOrEqual(contentBounds.y + contentBounds.height + 1)
  await expect(page.locator('[data-module="calculator"]')).toHaveAttribute('data-height', '280')
  expect(await page.evaluate(() => [window.document.documentElement.scrollWidth, window.document.documentElement.scrollHeight])).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
  await page.screenshot({ path: info.outputPath('calculator-minimum.png') })
  await page.getByRole('button', { name: 'Cerrar Calculadora', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(module).toHaveCount(0)
})
