import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDocumentStore } from '../document/documentStore'
import { createElement } from '../elements/elementCommands'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { addManualTimelineEntry } from './timelineCommands'
import { TimelineModule } from './TimelineModule'

async function setup() {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  render(<TimelineModule store={store} />)
  return store
}
describe('Interfaz del registro', () => {
  it('revisa una actuación futura con hora real y comunica rechazo atómico si el reloj precede a la última revisión', async () => {
    const store = await setup()
    act(() => store.mutateDocument(document => {
      document.timeline = [{ id: crypto.randomUUID(), type: 'manual', text: 'Importada', occurredAt: '2099-01-01T00:00:00Z', revisions: [] }]
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar entrada' }))
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Revisión actual' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrada' }))
    expect(screen.getByText('Revisión actual')).toBeInTheDocument()
    expect(store.getSnapshot().document.timeline[0]!.occurredAt).toBe('2099-01-01T00:00:00Z')
    act(() => store.mutateDocument(document => { document.timeline[0]!.revisions[0]!.recordedAt = '2099-01-01T00:00:00Z' }))
    const before = store.getSnapshot().document
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar entrada' }))
    expect(screen.getByRole('alert')).toHaveTextContent('recordedAt')
    expect(store.getSnapshot().document).toBe(before)
  })
  it('crea, edita y elimina una entrada manual sin pedir hora', async () => {
    const store = await setup()
    fireEvent.change(screen.getByLabelText('Acontecimiento'), { target: { value: 'Acceso norte cerrado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir entrada' }))
    const original = store.getSnapshot().document.timeline[0]!
    expect(original).toMatchObject({ type: 'manual', revisions: [], text: 'Acceso norte cerrado' })
    expect(screen.getByText('Acceso norte cerrado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar entrada' }))
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Acceso abierto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrada' }))
    expect(store.getSnapshot().document.timeline[0]).toMatchObject({ occurredAt: original.occurredAt, text: 'Acceso norte cerrado', revisions: [{ kind: 'text', text: 'Acceso abierto' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar entrada' }))
    expect(store.getSnapshot().document.timeline[0]).toMatchObject({ revisions: [{ kind: 'text' }, { kind: 'delete' }] })
    expect(screen.queryByText('Acceso abierto')).not.toBeInTheDocument()
  })
  it('ofrece Deshacer solo en la última entrada elegible y conserva el nombre histórico', async () => {
    const store = await setup()
    let id = ''
    act(() => store.mutateDocument(document => { id = createElement(document, { name: 'Tango', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' }).id }))
    act(() => store.mutateDocument(document => Object.assign(document, changeElementStatus(document, id, 'Activada', new Date()))))
    act(() => store.mutateDocument(document => Object.assign(document, changeElementStatus(document, id, 'Aproximandose', new Date()))))
    expect(screen.getAllByRole('button', { name: 'Deshacer' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Editar entrada' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(store.getSnapshot().document.elements[0]?.operational?.status).toBeNull()
    act(() => store.mutateDocument(document => { document.elements = [] }))
    expect(screen.getAllByText(/Tango/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
  })
  it('sigue nuevas entradas solo cuando se estaba leyendo el final', async () => {
    const store = await setup(), list = screen.getByRole('log')
    let height = 300
    Object.defineProperties(list, { scrollHeight: { get: () => height }, clientHeight: { value: 100 }, scrollTop: { value: 200, writable: true } })
    fireEvent.scroll(list)
    height = 350
    act(() => store.mutateDocument(document => { addManualTimelineEntry(document, 'Nueva 1', new Date()) }))
    expect(list.scrollTop).toBe(350)
    list.scrollTop = 20
    fireEvent.scroll(list)
    height = 400
    act(() => store.mutateDocument(document => { addManualTimelineEntry(document, 'Nueva 2', new Date()) }))
    expect(list.scrollTop).toBe(20)
  })
  it('presenta una entrada importada con segundo intercalar y fecha española completa', async () => {
    const store = await setup()
    act(() => store.mutateDocument(document => {
      document.timeline = [{ id: crypto.randomUUID(), type: 'manual', revisions: [], text: 'Importada', occurredAt: '2016-12-31T23:59:60Z' }]
    }))
    const time = screen.getByText('00:59:60')
    expect(time).toHaveAttribute('datetime', '2016-12-31T23:59:60Z')
    expect(time.getAttribute('title')).toContain('01/01/2017')
    expect(time.getAttribute('title')).toContain('00:59:60')
  })
})
