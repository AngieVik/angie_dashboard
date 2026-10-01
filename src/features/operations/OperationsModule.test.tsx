import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { createDocumentStore } from '../document/documentStore'
import { createElement } from '../elements/elementCommands'
import { OperationsModule } from './OperationsModule'

async function setup() {
  let saved: unknown
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async document => { saved = structuredClone(document) }, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  store.mutateDocument(document => {
    createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
    const b = createElement(document, { name: 'Tango 2', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
    if (b.isUnit) b.operational.status = 'En destino'
    createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, isUnit: false, information: '' })
  })
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <OperationsModule store={store} selectedId={selectedId} onSelect={onSelect} />
  }
  render(<Harness />)
  return { store, saved: () => saved }
}
describe('Operativo', () => {
  it('muestra solo contadores no vacíos en orden, un despliegue a la vez y ocho estados seleccionables', async () => {
    const { store } = await setup()
    expect(screen.getAllByRole('button').map(node => node.textContent)).toEqual(['🟢 1 Disponible', '🟠 1 En destino'])
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🟠 1 En destino' }))
    expect(screen.queryByRole('button', { name: 'Seleccionar Tango 1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 2' }))
    const states = within(screen.getByRole('group', { name: 'Estado operativo' }))
    expect(states.getAllByRole('button')).toHaveLength(8)
    expect(states.getByRole('button', { name: 'En destino' })).toHaveAttribute('aria-pressed', 'true')
    const before = store.getSnapshot().document
    fireEvent.click(states.getByRole('button', { name: 'En destino' }))
    expect(store.getSnapshot().document).toBe(before)
    fireEvent.click(states.getByRole('button', { name: 'Disponible' }))
    expect(store.getSnapshot().document.timeline).toHaveLength(1)
  })
  it('anotaciones y chips con botón/Enter, edición en línea, errores y eliminación se autoguardan sin entradas', async () => {
    const { store, saved } = await setup()
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    fireEvent.change(screen.getByLabelText('Anotación'), { target: { value: 'Revisar radio\nCanal 4' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: ' Sector norte ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: 'Radio' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Nueva etiqueta' }))
    expect(store.getSnapshot().document.elements[0]?.operational?.tags).toEqual(['Sector norte', 'Radio'])
    fireEvent.click(screen.getByRole('button', { name: 'Editar etiqueta Sector norte' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Editar etiqueta' }), { target: { value: ' Sector sur ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Editar etiqueta' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: 'sector SUR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(screen.getByRole('alert')).toHaveTextContent('duplicada')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(screen.getByRole('alert')).toHaveTextContent('vacía')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar etiqueta Radio' }))
    const document = store.getSnapshot().document
    expect(document.elements[0]?.operational).toEqual({ status: 'Disponible', notes: 'Revisar radio\nCanal 4', tags: ['Sector sur'] })
    expect(document.timeline).toEqual([])
    await store.flushAutosave()
    expect(saved()).toEqual(document)
  })
})
