import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../../components/ui/tooltip'
import { createDocumentStore } from '../document/documentStore'
import { createElement } from '../elements/elementCommands'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { OperationsModule } from './OperationsModule'

async function setup() {
  let saved: unknown
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async document => { saved = structuredClone(document) }, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  store.mutateDocument(document => {
    const a = createElement(document, { name: 'Tango 1', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
    const b = createElement(document, { name: 'Tango 2', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
    Object.assign(document, changeElementStatus(document, a.id, 'Disponible', new Date()))
    Object.assign(document, changeElementStatus(document, b.id, 'Transfiriendo', new Date()))
    createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, isUnit: false, information: '' })
  })
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <OperationsModule store={store} selectedId={selectedId} onSelect={onSelect} />
  }
  render(<TooltipProvider><Harness /></TooltipProvider>)
  return { store, saved: () => saved }
}
describe('Operativo', () => {
  afterEach(() => vi.useRealTimers())
  it('consulta táctil del estado y fase sin transición; el siguiente tap cambia una sola vez', async () => {
    const { store } = await setup()
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    vi.useFakeTimers()
    const button = screen.getByRole('button', { name: 'Interviniendo' })
    function touch(type: string) {
      const event = new Event(type, { bubbles: true })
      Object.assign(event, { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10 })
      fireEvent(button, event)
    }
    const before = store.getSnapshot().document
    touch('pointerdown')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Interviniendo · Fase: Asistencia')
    touch('pointerup'); fireEvent.click(button)
    expect(store.getSnapshot().document).toBe(before)
    touch('pointerdown'); touch('pointerup'); fireEvent.click(button)
    expect(store.getSnapshot().document.elements[0]?.operational?.status).toBe('Interviniendo')
    expect(store.getSnapshot().document.timeline).toHaveLength(before.timeline.length + 1)
    fireEvent.click(button)
    expect(store.getSnapshot().document.timeline).toHaveLength(before.timeline.length + 1)
  })
  it('anotación de una fila y Etiqueta con Check; error expira y reintentar reinicia cinco segundos', async () => {
    const { store } = await setup()
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    expect(screen.getByRole('textbox', { name: 'Anotación' })).toHaveAttribute('rows', '1')
    expect(screen.getByRole('textbox', { name: 'Anotación' })).toHaveAttribute('placeholder', 'anotación')
    const input = screen.getByRole('textbox', { name: 'Nueva etiqueta' })
    expect(input).toHaveAttribute('placeholder', 'Etiqueta')
    vi.useFakeTimers()
    const before = store.getSnapshot().document
    fireEvent.click(screen.getByRole('button', { name: 'Añadir etiqueta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('vacía')
    act(() => vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir etiqueta' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(store.getSnapshot().document).toBe(before)
  })
  it('comunica una selección incoherente por reloj anterior al historial y conserva el documento completo', async () => {
    const { store } = await setup()
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    const id = store.getSnapshot().document.elements[0]!.id
    act(() => store.mutateDocument(document => Object.assign(document, changeElementStatus(document, id, 'Activada', new Date('2099-01-01T00:00:00Z')))))
    const before = store.getSnapshot().document
    fireEvent.click(screen.getByRole('button', { name: 'Inoperativa' }))
    expect(screen.getByRole('alert')).toHaveTextContent('currentEntryId')
    expect(store.getSnapshot().document).toBe(before)
  })
  it('muestra solo contadores no vacíos en orden, un despliegue a la vez y ocho estados seleccionables', async () => {
    const { store } = await setup()
    expect(screen.getAllByRole('button').map(node => node.textContent)).toEqual(['🟢 1 Disponible', '🟠 1 Transfiriendo'])
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    expect(screen.getByRole('button', { name: 'Seleccionar Tango 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🟠 1 Transfiriendo' }))
    expect(screen.queryByRole('button', { name: 'Seleccionar Tango 1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 2' }))
    const states = within(screen.getByRole('group', { name: 'Estado operativo' }))
    expect(states.getAllByRole('button')).toHaveLength(8)
    expect(states.getByRole('button', { name: 'Transfiriendo' })).toHaveAttribute('aria-pressed', 'true')
    const before = store.getSnapshot().document
    fireEvent.click(states.getByRole('button', { name: 'Transfiriendo' }))
    expect(store.getSnapshot().document).toBe(before)
    fireEvent.click(states.getByRole('button', { name: 'Disponible' }))
    expect(store.getSnapshot().document.timeline).toHaveLength(3)
  })
  it('anotaciones y chips con botón/Enter, edición en línea, errores y eliminación se autoguardan sin entradas', async () => {
    const { store, saved } = await setup()
    fireEvent.click(screen.getByRole('button', { name: '🟢 1 Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Tango 1' }))
    fireEvent.change(screen.getByLabelText('Anotación'), { target: { value: 'Revisar radio\nCanal 4' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: ' Sector norte ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir etiqueta' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: 'Radio' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Nueva etiqueta' }))
    expect(store.getSnapshot().document.elements[0]?.operational?.tags).toEqual(['Sector norte', 'Radio'])
    fireEvent.click(screen.getByRole('button', { name: 'Editar etiqueta Sector norte' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Editar etiqueta' }), { target: { value: ' Sector sur ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Editar etiqueta' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: 'sector SUR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir etiqueta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('duplicada')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva etiqueta' }), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir etiqueta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('vacía')
    expect(screen.getByRole('textbox', { name: 'Nueva etiqueta' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Nueva etiqueta' })).toHaveAccessibleDescription(screen.getByRole('alert').textContent!)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar etiqueta Radio' }))
    const document = store.getSnapshot().document
    expect(document.elements[0]?.operational).toEqual({ status: 'Disponible', currentEntryId: document.timeline[0]!.id, notes: 'Revisar radio\nCanal 4', tags: ['Sector sur'] })
    expect(document.timeline).toHaveLength(2)
    await store.flushAutosave()
    expect(saved()).toEqual(document)
  })
})
