import { expect, test } from '@playwright/test'
import { watchAppErrors } from './acceptance-helpers'

test('Arranque: carga la interfaz sin errores ni recursos esenciales fallidos', async ({ page }) => {
  const errors = watchAppErrors(page)
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('main', { name: 'Espacio de trabajo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archivo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver', exact: true })).toBeVisible()
  const logo = page.getByRole('img', { name: 'Angie Dashboard' })
  await expect(logo).toBeVisible()
  await logo.evaluate(image => (image as HTMLImageElement).decode())
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForLoadState('networkidle')
  expect(errors).toEqual([])
})
