import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { createDocumentStore } from '../document/documentStore'
import { ElementsModule } from './ElementsModule'
import { createElement, updateElement } from './elementCommands'

async function setup(placementPosition?: { x: number; y: number }) {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <ElementsModule store={store} selectedId={selectedId} onSelect={onSelect} {...{ placementPosition }} />
  }
  render(<Harness />)
  const action = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name }))
  }
  return { store, action }
}
describe('Elementos y configuración', () => {
  it('crear usa el centro visible recibido sin mover el contenido anterior', async () => {
    const { store, action } = await setup({ x: 1400, y: 1800 })
    act(() => store.mutateDocument(document => { createElement(document, { name: 'Anterior', visual: { type: 'emoji', value: '📍', scale: 1 }, information: '', isUnit: false }) }))
    const previous = structuredClone(store.getSnapshot().document.elements[0])
    action('Añadir')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear elemento' }))
    expect(store.getSnapshot().document.elements[1]?.position).toEqual({ x: 1400, y: 1800 })
    expect(store.getSnapshot().document.elements[0]).toEqual(previous)
  })
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
    expect(screen.getByLabelText('Escala del icono')).toBeInTheDocument()
  })
  it('Cancelar descarta nombre, información, representación y escala; guardar aplica el borrador conjuntamente', async () => {
    const { store, action } = await setup()
    act(() => store.mutateDocument(document => { createElement(document, { name: 'CP norte', visual: { type: 'asset', assetId: 'checkpoint', scale: 1 }, information: '', isUnit: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar CP norte' }))
    action('Modificar')
    const before = structuredClone(store.getSnapshot().document)
    fireEvent.change(screen.getByLabelText('Escala del icono'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo nombre' } })
    fireEvent.change(screen.getByLabelText('Información'), { target: { value: 'Nuevo texto' } })
    fireEvent.change(screen.getByLabelText('Representación'), { target: { value: 'emoji' } })
    fireEvent.change(screen.getByLabelText('Emoji'), { target: { value: '📍' } })
    expect(store.getSnapshot().document).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(store.getSnapshot().document).toEqual(before)
    expect(screen.getByRole('button', { name: 'Modificar' })).toHaveFocus()
    const id = store.getSnapshot().document.elements[0]!.id
    act(() => store.mutateDocument(document => updateElement(document, id, { visual: { type: 'asset', assetId: 'checkpoint', scale: 3 } })))
    action('Modificar')
    expect(screen.getByLabelText('Escala del icono')).toHaveValue('3')
    expect(screen.getByLabelText('Escala actual')).toHaveTextContent('300 %')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ruta' } })
    fireEvent.change(screen.getByLabelText('Escala del icono'), { target: { value: '.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar elemento' }))
    expect(store.getSnapshot().document.elements[0]).toMatchObject({ name: 'Ruta', visual: { scale: .5 } })
  })
  it('acciones directas permanecen visibles y solo Añadir está habilitada sin selección', async () => {
    const { action } = await setup()
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeEnabled()
    for (const name of ['Modificar', 'Duplicar', 'Quitar']) expect(screen.getByRole('button', { name })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Configurar elementos' })).not.toBeInTheDocument()
    action('Añadir')
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeVisible()
  })
  it('un resize directo del pin sincroniza la escala sin perder el resto del borrador', async () => {
    const { store, action } = await setup()
    act(() => store.mutateDocument(document => { createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, information: '', isUnit: false }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Ruta' }))
    action('Modificar')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre en borrador' } })
    fireEvent.change(screen.getByLabelText('Escala del icono'), { target: { value: '2' } })
    const id = store.getSnapshot().document.elements[0]!.id
    act(() => store.mutateDocument(document => updateElement(document, id, { visual: { type: 'emoji', value: '📍', scale: 3 } })))
    expect(screen.getByLabelText('Escala del icono')).toHaveValue('3')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Nombre en borrador')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(store.getSnapshot().document.elements[0]).toMatchObject({ name: 'Ruta', visual: { scale: 3 } })
  })
  it.each([undefined, { x: 1400, y: 1800 }])('preview responde al borrador y creación usa centro %j', async position => {
    const { store, action } = await setup(position)
    action('Añadir')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ruta norte' } })
    fireEvent.change(screen.getByLabelText('Representación'), { target: { value: 'emoji' } })
    fireEvent.change(screen.getByLabelText('Emoji'), { target: { value: '📍' } })
    fireEvent.change(screen.getByLabelText('Escala del icono'), { target: { value: '2' } })
    const preview = screen.getByRole('img', { name: 'Previsualización del elemento' })
    expect(within(preview).getByText('📍')).toHaveStyle({ fontSize: '96px' })
    expect(within(preview).getByText('Ruta norte')).toHaveStyle({ fontSize: '32px' })
    expect(store.getSnapshot().document.elements).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Crear elemento' }))
    expect(store.getSnapshot().document.elements[0]).toMatchObject({ position: position ?? { x: 500, y: 500 }, visual: { type: 'emoji', scale: 2 } })
    expect(screen.getByRole('button', { name: 'Añadir' })).toHaveFocus()
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
