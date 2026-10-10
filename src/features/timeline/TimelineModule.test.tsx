import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  it('asocia el rechazo de una entrada al campo sin guardar el borrador', async () => {
    const store = await setup()
    vi.spyOn(store, 'mutateDocument').mockImplementation(() => { throw new Error('Entrada rechazada.') })
    fireEvent.change(screen.getByRole('textbox', { name: 'Acontecimiento' }), { target: { value: 'Acceso norte' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir entrada' }))
    expect(screen.getByRole('textbox', { name: 'Acontecimiento' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Acontecimiento' })).toHaveAccessibleDescription(screen.getByRole('alert').textContent!)
    expect(store.getSnapshot().document.timeline).toHaveLength(0)
  })
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
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar entrada' }))
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
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar entrada' }))
    expect(store.getSnapshot().document.timeline[0]).toMatchObject({ revisions: [{ kind: 'text' }, { kind: 'delete' }] })
    expect(screen.queryByText('Acceso abierto')).not.toBeInTheDocument()
  })
  it('conserva el nombre histórico tras eliminar la unidad sin ofrecer corrección', async () => {
    const store = await setup()
    act(() => store.mutateDocument(document => {
      const unit = createElement(document, { name: 'Tango', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
      Object.assign(document, changeElementStatus(document, unit.id, 'Activada', new Date()))
      Object.assign(document, changeElementStatus(document, unit.id, 'Aproximandose', new Date()))
      document.elements = []
    }))
    expect(screen.getAllByText(/Tango/)).toHaveLength(2)
    expect(screen.queryByText('Actual', { exact: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar entrada' })[1]!)
    expect(screen.queryByRole('button', { name: 'Corregir estado actual' })).not.toBeInTheDocument()
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

describe('entrega 9: editor y confirmaciones', () => {
  async function automatic() {
    const store = await setup()
    act(() => store.mutateDocument(document => {
      const unit = createElement(document, { name: 'Tango 9', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: '' })
      Object.assign(document, changeElementStatus(document, unit.id, 'Disponible', new Date()))
      Object.assign(document, changeElementStatus(document, unit.id, 'Activada', new Date()))
      addManualTimelineEntry(document, 'Radio comprobada', new Date())
    }))
    return store
  }
  it('marca Actual por referencia, edita automáticas sin transición y cancela borrado sin revisión', async () => {
    const store = await automatic(), before = store.getSnapshot().document
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Actual', { exact: true })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Editar entrada' })).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar entrada' })[0]!)
    expect(screen.queryByRole('button', { name: 'Corregir estado actual' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Primer aviso por radio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrada' }))
    expect(screen.getByText('Primer aviso por radio')).toBeInTheDocument()
    expect(store.getSnapshot().document.elements).toEqual(before.elements)
    const revised = store.getSnapshot().document
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar entrada' })[1]!)
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Tango 9')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sin estado')
    expect(store.getSnapshot().document).toBe(revised)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))
    expect(store.getSnapshot().document).toBe(revised)
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar entrada' })[1]!)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar entrada' }))
    expect(store.getSnapshot().document.elements[0]?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(screen.queryByText('Actual', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('Primer aviso por radio')).toBeInTheDocument()
  })
  it('previsualiza corrección separada del texto, cancela y rechaza confirmación concurrente', async () => {
    const store = await automatic()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar entrada' })[1]!)
    const before = store.getSnapshot().document
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Borrador sin guardar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Corregir estado actual' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Tango 9')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sin estado')
    expect(store.getSnapshot().document).toBe(before)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))
    expect(store.getSnapshot().document).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir estado actual' }))
    act(() => store.mutateDocument(document => Object.assign(document, changeElementStatus(document, document.elements[0]!.id, 'Interviniendo', new Date()))))
    const concurrent = store.getSnapshot().document
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar corrección' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/cambió|vigente|Actual/)
    expect(store.getSnapshot().document).toBe(concurrent)
  })
  it('confirma corrección sin guardar borrador y permite editar después el texto corregido', async () => {
    const store = await automatic()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar entrada' })[1]!)
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Borrador sin guardar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Corregir estado actual' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar corrección' }))
    expect(store.getSnapshot().document.elements[0]?.operational).toMatchObject({ status: null, currentEntryId: null })
    expect(store.getSnapshot().document.timeline[1]!.revisions).toMatchObject([{ kind: 'correction' }])
    expect(screen.getByText('Corregida', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Borrador sin guardar')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar entrada' })[1]!)
    expect(screen.queryByRole('button', { name: 'Corregir estado actual' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Texto de entrada'), { target: { value: 'Aviso corregido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrada' }))
    expect(screen.getByText('Aviso corregido')).toBeInTheDocument()
  })
})
