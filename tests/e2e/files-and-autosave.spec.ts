import { expect, test } from '@playwright/test'
import {
  downloadDocument, expectDocumentTitle, fileCommand, loadDocument,
  openModule, savedDocument, setDocumentTitle, watchAppErrors,
} from './acceptance-helpers'

test('Guardado y recuperación: autoguardado, recarga, exportación e importación JSON', async ({ page }) => {
  const errors = watchAppErrors(page)
  // Reuse the real download path without automating a native OS file dialog.
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }))
  await page.goto('/')
  await setDocumentTitle(page, 'Documento ficticio E2E')
  await openModule(page, 'Cuaderno')
  const note = page.getByRole('textbox', { name: 'Texto de nota', exact: true })
  await page.getByRole('region', { name: 'Cuaderno', exact: true }).getByRole('button', { name: 'Nota', exact: true }).click()
  await note.fill('Preparación ficticia\nRevisar material 📻')
  await expect.poll(async () => (await savedDocument(page))?.notebook).toMatchObject([
    { type: 'note', text: 'Preparación ficticia\nRevisar material 📻' },
  ])
  const saved = (await savedDocument(page))!
  expect(saved.document.title).toBe('Documento ficticio E2E')

  await page.reload()
  await expectDocumentTitle(page, saved.document.title)
  await openModule(page, 'Cuaderno')
  await expect(note).toHaveValue('Preparación ficticia\nRevisar material 📻')
  const exported = await downloadDocument(page)
  expect(exported.document).toEqual(saved)

  await fileCommand(page, 'Nuevo')
  await expect(note).toHaveCount(0)
  // Import the actual exported bytes, rather than a reconstructed fixture.
  await loadDocument(page, exported.text)
  await expectDocumentTitle(page, saved.document.title)
  await expect(note).toHaveValue('Preparación ficticia\nRevisar material 📻')
  await expect.poll(() => savedDocument(page)).toEqual(exported.document)
  expect(errors).toEqual([])
})
