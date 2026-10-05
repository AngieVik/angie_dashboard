import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { bringModuleToFront, createElement, downloadDocument, loadDocument, noPageScroll, openModule, savedDocument } from './acceptance-helpers'
import type { AngieDocument } from '../../src/domain/document/types'

test('diez módulos, listas independientes, estado null, referencia explícita y recarga V3', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  const document = JSON.parse(await readFile('src/domain/document/fixtures/v3-complete.json', 'utf8')) as AngieDocument
  document.elements[0]!.pinVisible = false
  Object.assign(document.elements[0]!.operational!, { status: null, currentEntryId: null })
  document.board.quickNotes[0]!.title = 'Accesos'
  document.board.quickNotes[0]!.scale = 1.5
  document.moduleLayouts.elements = { x: 12, y: 12, width: 300, height: 420, referenceSize: { width: 1440, height: 850 } }
  document.moduleLayouts.dotations = { x: 324, y: 12, width: 300, height: 420, referenceSize: { width: 1440, height: 850 } }
  document.moduleLayouts.information = { x: 636, y: 12, width: 320, height: 240, referenceSize: { width: 1440, height: 850 } }
  await loadDocument(page, document)
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox')).toHaveCount(10)
  await page.keyboard.press('Escape')
  for (const name of ['Elementos', 'Dotaciones', 'Información']) await openModule(page, name)
  const elements = page.locator('[data-module="elements"]')
  const units = page.locator('[data-module="dotations"]')
  await expect(elements.getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveCount(0)
  await expect(units.getByRole('button', { name: 'Seleccionar Acceso' })).toHaveCount(0)
  await units.getByRole('button', { name: 'Seleccionar Tango 1' }).press('Enter')
  await expect(page.locator('[data-module="information"]').getByLabel('Estado operativo')).toHaveText('Sin estado')
  await expect(elements.getByRole('button', { name: 'Modificar', exact: true })).toBeDisabled()
  for (const zoom of [25, 100, 200, 400]) {
    await page.getByLabel('Zoom actual', { exact: true }).fill(String(zoom))
    await page.getByLabel('Zoom actual', { exact: true }).press('Enter')
    await noPageScroll(page)
  }
  await page.getByLabel('Zoom actual', { exact: true }).fill('100')
  await page.getByLabel('Zoom actual', { exact: true }).press('Enter')
  for (const zoom of [25, 100, 200, 400]) {
    await units.getByLabel('Zoom de Dotaciones', { exact: true }).fill(String(zoom))
    await units.getByLabel('Zoom de Dotaciones', { exact: true }).press('Enter')
    await noPageScroll(page)
  }
  await units.getByLabel('Zoom de Dotaciones', { exact: true }).fill('100')
  await units.getByLabel('Zoom de Dotaciones', { exact: true }).press('Enter')
  await page.screenshot({ path: info.outputPath('phase2-lists.png') })
  const before = await savedDocument(page)
  await createElement(page, 'Tango nuevo', true)
  await expect.poll(async () => (await savedDocument(page))?.timeline).toEqual(before!.timeline)
  await bringModuleToFront(page, 'Dotaciones')
  await units.getByRole('button', { name: 'Duplicar', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.elements[3]?.operational).toEqual({ status: null, currentEntryId: null, notes: '', tags: [] })
  await openModule(page, 'Operativo')
  const ops = page.locator('[data-module="operations"]')
  await ops.getByRole('button', { name: 'Disponible', exact: true }).click()
  const first = await savedDocument(page)
  await ops.getByRole('button', { name: 'Disponible', exact: true }).click()
  expect(await savedDocument(page)).toEqual(first)
  await ops.getByRole('button', { name: 'Activada', exact: true }).click()
  await openModule(page, 'Registro cronológico')
  const log = page.locator('[data-module="timeline"]')
  await log.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect.poll(async () => (await savedDocument(page))?.elements[3]?.operational).toEqual({ status: null, currentEntryId: null, notes: '', tags: [] })
  await expect(log.getByRole('button', { name: 'Deshacer' })).toHaveCount(0)
  const exported = await downloadDocument(page)
  expect(exported.document.formatVersion).toBe(3)
  expect(exported.document.board.quickNotes[0]).toMatchObject({ title: 'Accesos', scale: 1.5 })
  expect(exported.document.elements[0]!.pinVisible).toBe(false)
  expect(exported.document.moduleLayouts.elements).not.toEqual(exported.document.moduleLayouts.dotations)
  await loadDocument(page, exported.document)
  const invalid = structuredClone(exported.document)
  invalid.elements[3]!.operational!.currentEntryId = invalid.timeline[1]!.id
  await page.getByLabel('Cargar documento JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) })
  await expect(page.getByRole('alert')).toContainText('currentEntryId')
  expect(await savedDocument(page)).toEqual(exported.document)
  await page.reload()
  await expect(page.locator('[data-module]')).toHaveCount(0)
  await expect.poll(() => savedDocument(page)).toEqual(exported.document)
  await openModule(page, 'Pizarra')
  await expect(page.locator(`.board-pin[data-element-id="${document.elements[0]!.id}"]`)).toHaveCount(0)
  expect(errors).toEqual([])
})
