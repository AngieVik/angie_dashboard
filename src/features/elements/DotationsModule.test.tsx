import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { createDocumentStore } from '../document/documentStore'
import { ElementsModule } from './ElementsModule'
import { createElement } from './elementCommands'

it('separa listas y creador por tipo conservando selección global y CRUD compartido', async () => {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  store.mutateDocument(document => {
    createElement(document, { name: 'Tango', isUnit: true, information: '', visual: { type: 'asset', assetId: 'warning', scale: 1 } })
    createElement(document, { name: 'Acceso', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 } })
  })
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <><section aria-label="Lista de generales"><ElementsModule {...{ store, selectedId, onSelect }} /></section>
      <section aria-label="Lista de dotaciones"><ElementsModule {...{ store, selectedId, onSelect }} isUnit /></section>
      <output aria-label="Selección">{selectedId}</output></>
  }
  render(<Harness />)
  const generals = within(screen.getByRole('region', { name: 'Lista de generales' }))
  const units = within(screen.getByRole('region', { name: 'Lista de dotaciones' }))
  expect(generals.queryByRole('button', { name: 'Seleccionar Tango' })).not.toBeInTheDocument()
  expect(units.queryByRole('button', { name: 'Seleccionar Acceso' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Selección')).toBeEmptyDOMElement()
  fireEvent.click(units.getByRole('button', { name: 'Seleccionar Tango' }))
  const unitId = store.getSnapshot().document.elements[0]!.id
  expect(screen.getByLabelText('Selección')).toHaveTextContent(unitId)
  expect(generals.getByRole('button', { name: 'Modificar' })).toBeDisabled()
  fireEvent.click(units.getByRole('button', { name: 'Modificar' }))
  expect(units.getByLabelText('Icono')).toHaveValue('warning')
  fireEvent.change(units.getByLabelText('Nombre'), { target: { value: 'Tango norte' } })
  fireEvent.click(units.getByRole('button', { name: 'Guardar elemento' }))
  expect(store.getSnapshot().document.elements[0]!.visual).toMatchObject({ assetId: 'warning' })
  fireEvent.click(units.getByRole('button', { name: 'Añadir' }))
  expect(units.queryByRole('checkbox', { name: 'Dotación' })).not.toBeInTheDocument()
  fireEvent.change(units.getByLabelText('Nombre'), { target: { value: 'Tango nuevo' } })
  fireEvent.click(units.getByRole('button', { name: 'Crear elemento' }))
  expect(store.getSnapshot().document.elements[2]).toMatchObject({ isUnit: true, operational: { status: null, currentEntryId: null } })
  expect(store.getSnapshot().document.timeline).toEqual([])
  act(() => store.newDocument())
  expect(units.queryByRole('button', { name: 'Seleccionar Tango norte' })).not.toBeInTheDocument()
})
