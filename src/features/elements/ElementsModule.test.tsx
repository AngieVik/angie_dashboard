import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { createDocumentStore } from '../document/documentStore'
import { ElementsModule } from './ElementsModule'
import { createElement, updateElement } from './elementCommands'

async function setup() {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <ElementsModule store={store} selectedId={selectedId} onSelect={onSelect} />
  }
  render(<Harness />)
  const action = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Configurar elementos' }))
    fireEvent.click(screen.getByRole('button', { name }))
  }
  return { store, action }
}
describe('Elementos y configuración', () => {
  it('crea con checkbox, separa listas, edita como solo lectura, duplica y elimina', async () => {
    const { store, action } = await setup()
    action('Añadir')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tango 1' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dotación' }))
    fireEvent.change(screen.getByLabelText('Información'), { target: { value: 'Canal 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear elemento' }))
    const unit = store.getSnapshot().document.elements[0]!
    expect(unit.isUnit).toBe(true)
    expect(within(screen.getByRole('region', { name: 'Dotaciones' })).getByRole('button', { name: 'Seleccionar Tango 1' })).toHaveAttribute('aria-pressed', 'true')
    action('Modificar')
    expect(screen.queryByRole('checkbox', { name: 'Dotación' })).not.toBeInTheDocument()
    expect(screen.getByText('Tipo: Dotación')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tango 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar elemento' }))
    action('Duplicar')
    expect(store.getSnapshot().document.elements.map(e => e.name)).toEqual(['Tango 2', 'Tango 2 copia'])
    action('Quitar')
    expect(store.getSnapshot().document.elements.map(e => e.id)).toEqual([unit.id])
    action('Añadir')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ruta' } })
    fireEvent.change(screen.getByLabelText('Representación'), { target: { value: 'emoji' } })
    fireEvent.change(screen.getByLabelText('Emoji'), { target: { value: '🚴🏽‍♂️' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear elemento' }))
    expect(within(screen.getByRole('region', { name: 'Generales' })).getByRole('button', { name: 'Seleccionar Ruta' })).toBeInTheDocument()
    action('Modificar'); expect(screen.getByText('Tipo: General')).toBeInTheDocument()
    expect(screen.queryByLabelText('Escala del icono')).not.toBeInTheDocument()
  })
  it('deslizador y cambios externos del tirador comparten la misma escala persistente', async () => {
    const { store, action } = await setup()
    act(() => store.mutateDocument(document => { createElement(document, { name: 'CP norte', visual: { type: 'asset', assetId: 'checkpoint', scale: 1 }, information: '', isUnit: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar CP norte' }))
    action('Modificar')
    fireEvent.change(screen.getByLabelText('Escala del icono'), { target: { value: '2' } })
    expect(store.getSnapshot().document.elements[0]?.visual).toMatchObject({ scale: 2 })
    const id = store.getSnapshot().document.elements[0]!.id
    act(() => store.mutateDocument(document => updateElement(document, id, { visual: { type: 'asset', assetId: 'checkpoint', scale: 3 } })))
    expect(screen.getByLabelText('Escala del icono')).toHaveValue('3')
    expect(screen.getByLabelText('Escala actual')).toHaveTextContent('300 %')
  })
  it('muestra todas las dotaciones y generales sin controles de filtro ni pérdida de datos', async () => {
    const { store } = await setup()
    act(() => store.mutateDocument(document => {
      createElement(document, { name: 'Tango', visual: { type: 'emoji', value: '🚑', scale: 1 }, information: '', isUnit: true })
      createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, information: '', isUnit: false })
    }))
    const before = structuredClone(store.getSnapshot().document.elements)
    expect(screen.queryByRole('group', { name: 'Filtrar dotaciones por estado' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar Ruta' })).toBeInTheDocument()
    expect(store.getSnapshot().document.elements).toEqual(before)
  })
})
