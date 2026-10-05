import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { createDocumentStore } from '../document/documentStore'
import { createElement } from '../elements/elementCommands'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { DotationsModule } from '../elements/DotationsModule'
import { ElementsModule } from '../elements/ElementsModule'
import { OperationsModule } from '../operations/OperationsModule'
import { InformationModule } from './InformationModule'

describe('Información y selección compartida', () => {
  it.each([
    ['Disponible', 'Alerta', '🟢'], ['Activada', 'Alarma', '🟡'], ['Aproximandose', 'Aproximación', '🔵'],
    ['Interviniendo', 'Asistencia', '🔴'], ['Trasladando', 'Transporte', '💠'], ['Transfiriendo', 'Transferencia', '🟠'],
    ['Operativa', 'Reactivación', '🟢'], ['Inoperativa', 'Bloqueo', '⚫'],
  ] as const)('dotación %s muestra su estado con color y fase %s', async (status, phase, icon) => {
    const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
    await store.initialize()
    let id = ''
    store.mutateDocument(document => {
      const element = createElement(document, { name: 'Tango', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: 'Canal 4' })
      id = element.id
      Object.assign(document, changeElementStatus(document, element.id, status, new Date()))
    })
    render(<InformationModule store={store} selectedId={id} onSelect={() => {}} />)
    const state = screen.getByLabelText('Estado operativo')
    expect(state).toHaveTextContent(status)
    expect(within(state).getByText(icon)).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(phase)).toBeInTheDocument()
    expect(screen.getByText('Canal 4')).toBeInTheDocument()
  })
  it('sin dotaciones muestra solamente Sin dotaciones', async () => {
    const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
    await store.initialize()
    render(<InformationModule store={store} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('Sin dotaciones')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('lista solo nombres; selección desde Información, Elementos y Operativo comparte información, fase y etiquetas', async () => {
    const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
    await store.initialize()
    store.mutateDocument(document => {
      const a = createElement(document, { name: 'Tango', visual: { type: 'emoji', value: '🚑', scale: 1 }, isUnit: true, information: 'Canal 4\nAcceso norte' })
      if (a.isUnit) a.operational.tags = ['Sector norte']
      Object.assign(document, changeElementStatus(document, a.id, 'Disponible', new Date()))
      createElement(document, { name: 'Ruta', visual: { type: 'emoji', value: '📍', scale: 1 }, isUnit: false, information: 'Acceso sur' })
    })
    function Harness() {
      const [selectedId, onSelect] = useState<string | null>(null)
      return <><section aria-label="Info"><InformationModule store={store} selectedId={selectedId} onSelect={onSelect} /></section>
        <section aria-label="Ops"><OperationsModule store={store} selectedId={selectedId} onSelect={onSelect} /></section>
        <section aria-label="Elements"><ElementsModule store={store} selectedId={selectedId} onSelect={onSelect} /><DotationsModule store={store} selectedId={selectedId} onSelect={onSelect} /></section>
        <button onClick={() => onSelect(null)}>Deseleccionar</button></>
    }
    render(<Harness />)
    const info = within(screen.getByRole('region', { name: 'Info' })), ops = within(screen.getByRole('region', { name: 'Ops' })), elements = within(screen.getByRole('region', { name: 'Elements' }))
    expect(info.getAllByRole('button').map(node => node.textContent)).toEqual(['Tango'])
    expect(info.queryByLabelText('Estado operativo')).not.toBeInTheDocument()
    expect(info.queryByText('Alerta')).not.toBeInTheDocument()
    expect(info.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(info.getByRole('button', { name: 'Seleccionar Tango' }))
    expect(info.getByText('Canal 4 Acceso norte').textContent).toBe('Canal 4\nAcceso norte')
    expect(info.getByText('Alerta')).toBeInTheDocument()
    expect(info.getByText('Sector norte')).toBeInTheDocument()
    expect(elements.getByRole('button', { name: 'Seleccionar Tango' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(ops.getByRole('button', { name: 'Transfiriendo' }))
    expect(info.getByText('Transferencia')).toBeInTheDocument()
    fireEvent.click(elements.getByRole('button', { name: 'Seleccionar Ruta' }))
    expect(info.getByText('Acceso sur')).toBeInTheDocument()
    expect(info.queryByLabelText('Estado operativo')).not.toBeInTheDocument()
    expect(info.queryByText('Transferencia')).not.toBeInTheDocument()
    expect(info.queryByText('Sector norte')).not.toBeInTheDocument()
    fireEvent.click(ops.getByRole('button', { name: '🟠 1 Transfiriendo' }))
    fireEvent.click(ops.getByRole('button', { name: 'Seleccionar Tango' }))
    expect(info.getByText('Transferencia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deseleccionar' }))
    expect(info.getAllByRole('button').map(node => node.textContent)).toEqual(['Tango'])
    act(() => store.mutateDocument(document => { document.elements = [] }))
    expect(info.getByText('Sin dotaciones')).toBeInTheDocument()
  })
})
