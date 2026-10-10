import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { AngieDocument } from '../../src/domain/document/types'
import { bringModuleToFront, downloadDocument, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'

test('base común, selección y zoom conservan el documento completo', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  const fixture = JSON.parse(await readFile('src/domain/document/fixtures/v3-complete.json', 'utf8')) as AngieDocument
  fixture.moduleLayouts.dotations = { x: 660, y: 0, width: 300, height: 420, referenceSize: { width: 1440, height: 866 } }
  fixture.moduleLayouts.information = { x: 0, y: 0, width: 320, height: 240, referenceSize: { width: 1440, height: 866 } }
  fixture.moduleLayouts.operations = { x: 330, y: 0, width: 320, height: 420, referenceSize: { width: 1440, height: 866 } }
  await loadDocument(page, fixture)
  await expect.poll(() => savedDocument(page)).toEqual(fixture)
  await openModule(page, 'Dotaciones')
  await page.getByRole('button', { name: `Seleccionar ${fixture.elements[0]!.name}`, exact: true }).click()
  await openModule(page, 'Operativo')
  await openModule(page, 'Información')
  const panel = page.getByRole('region', { name: 'Información', exact: true })
  const state = panel.getByLabel('Estado operativo')
  await expect(state).toContainText(fixture.elements[0]!.operational!.status!)
  await expect(panel.getByLabel('Etiquetas')).toContainText(fixture.elements[0]!.operational!.tags[0]!)
  const before = await savedDocument(page)
  const setZoom = async (value: number, label: string) => {
    const input = page.getByRole('spinbutton', { name: label, exact: true })
    await input.fill(String(value)); await input.press('Enter')
    await expect(input).toHaveValue(String(value))
  }
  for (const value of [25, 100, 200, 400]) {
    await setZoom(value, 'Zoom actual')
    await noPageScroll(page)
    await expect(state).toContainText(fixture.elements[0]!.operational!.status!)
    expect(await savedDocument(page)).toEqual(before)
    await page.screenshot({ path: info.outputPath(`global-${value}.png`) })
  }
  await setZoom(100, 'Zoom actual')
  for (const value of [25, 100, 200, 400]) {
    await setZoom(value, 'Zoom de Información')
    await noPageScroll(page)
    expect(await savedDocument(page)).toEqual(before)
    await page.screenshot({ path: info.outputPath(`module-${value}.png`) })
  }
  await setZoom(100, 'Zoom de Información')
  await panel.getByRole('button', { name: 'Cerrar Información' }).focus()
  await page.screenshot({ path: info.outputPath('focus-active-inactive.png') })
  await panel.getByRole('button', { name: 'Cerrar Información' }).hover()
  await page.screenshot({ path: info.outputPath('hover.png') })
  await setZoom(25, 'Zoom actual')
  await openModule(page, 'Elementos')
  await expect(page.getByRole('region', { name: 'Elementos', exact: true }).getByRole('button', { name: 'Modificar', exact: true })).toBeEnabled()
  await page.screenshot({ path: info.outputPath('disabled.png') })
  await bringModuleToFront(page, 'Dotaciones')
  await expect(page.getByRole('button', { name: `Seleccionar ${fixture.elements[0]!.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect((await downloadDocument(page)).document).toEqual(before)
})
