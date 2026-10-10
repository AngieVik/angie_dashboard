import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TooltipProvider } from '../../components/ui/tooltip'
import { createDocumentStore } from '../document/documentStore'
import { ElementsModule } from './ElementsModule'
import { createElement, updateElement } from './elementCommands'

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))

async function setup(isUnit = false) {
  const store = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: () => {} } })
  await store.initialize()
  function Harness() {
    const [selectedId, onSelect] = useState<string | null>(null)
    return <TooltipProvider><ElementsModule {...{ store, selectedId, onSelect, isUnit }} placementPosition={{ x: 1400, y: 1800 }} /></TooltipProvider>
  }
  render(<Harness />)
  return store
}
function click(name: string) { fireEvent.click(screen.getByRole('button', { name })) }
function change(name: string, value: string) { fireEvent.change(name === 'Emoji' ? screen.getByRole('textbox', { name }) : screen.getByLabelText(name, { exact: true }), { target: { value } }) }

describe('listas y editor de entrega 6', () => {
  it.each([false, true])('reutiliza Crear en cabecera y descarta borrador con Atrás (%s)', async isUnit => {
    const store = await setup(isUnit)
    const create = screen.getByRole('button', { name: 'Crear' })
    click('Crear')
    expect(screen.getAllByRole('button', { name: 'Crear' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Crear' })).toBe(create)
    expect(screen.getByRole('button', { name: 'Atrás' }).parentElement).toBe(create.parentElement)
    expect(within(screen.getByRole('form')).queryByRole('button', { name: 'Crear' })).not.toBeInTheDocument()
    change('Nombre', 'Borrador'); fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar' }))
    click('Atrás')
    expect(store.getSnapshot().document.elements).toEqual([])
    click('Crear')
    expect(screen.getByRole('checkbox', { name: 'Ocultar' })).not.toBeChecked()
    click('Crear')
    expect(store.getSnapshot().document.elements[0]?.name).toBe(isUnit ? 'D1' : 'E1')
  })
  it('Ocultar afecta preview y se conserva al modificar sin ocultar la tarjeta', async () => {
    const store = await setup()
    click('Crear'); change('Nombre', 'Norte')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar' }))
    expect(within(screen.getByRole('img', { name: 'Previsualización del elemento' })).queryByText('Norte')).not.toBeInTheDocument()
    click('Crear')
    expect(store.getSnapshot().document.elements[0]?.nameHidden).toBe(true)
    expect(screen.getByText('Norte')).toBeVisible()
    click('Modificar')
    expect(screen.getByRole('checkbox', { name: 'Ocultar' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar' })); click('Guardar')
    expect(store.getSnapshot().document.elements[0]?.nameHidden).toBe(false)
  })
  it('tarjeta de dotación presenta dos líneas de seis caracteres sin estado ni fase', async () => {
    const store = await setup(true)
    act(() => store.mutateDocument(d => { createElement(d, { name: 'ABCDEFGHIJKLM', isUnit: true, information: '', visual: { type: 'asset', assetId: 'ambulance', scale: 1 } }) }))
    const row = screen.getByRole('button', { name: 'Seleccionar ABCDEFGHIJKLM' })
    expect(within(row).getByText('ABCDEF')).toBeVisible()
    expect(within(row).getByText('GHIJKL')).toBeVisible()
    expect(row.querySelector('strong')).toHaveAttribute('title', 'ABCDEFGHIJKLM')
    expect(row.querySelector('.element-row-status')).toBeNull()
    expect(row).not.toHaveTextContent('Sin estado')
  })
  it('crear permanece en lista sin acciones globales, crea por tipo en centro recibido', async () => {
    const store = await setup(true)
    expect(screen.queryByRole('button', { name: 'Modificar' })).not.toBeInTheDocument()
    click('Crear'); change('Nombre', 'Tango'); change('Información', 'Canal 4')
    expect(screen.queryByRole('checkbox', { name: 'Dotación' })).not.toBeInTheDocument()
    click('Crear')
    expect(store.getSnapshot().document.elements[0]).toMatchObject({ name: 'Tango', position: { x: 1400, y: 1800 }, isUnit: true, operational: { status: null, currentEntryId: null } })
    expect(screen.getByRole('button', { name: 'Seleccionar Tango' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Crear' })).toBeVisible()
    expect(store.getSnapshot().document.timeline).toEqual([])
  })
  it('acciones por fila afectan a su objeto y ocultar conserva selección y datos', async () => {
    const store = await setup()
    act(() => store.mutateDocument(d => {
      createElement(d, { name: 'Norte', isUnit: false, information: 'Radio', visual: { type: 'emoji', value: '📍', scale: 1 } })
      createElement(d, { name: 'Sur', isUnit: false, information: '', visual: { type: 'asset', assetId: 'checkpoint', scale: 1 } })
    }))
    click('Seleccionar Sur')
    const before = structuredClone(store.getSnapshot().document.elements)
    click('Ocultar pin de Sur')
    expect(store.getSnapshot().document.elements).toEqual([before[0], { ...before[1], pinVisible: false }])
    expect(screen.getByRole('button', { name: 'Seleccionar Sur' })).toHaveAttribute('aria-pressed', 'true')
    click('Mostrar pin de Sur'); expect(store.getSnapshot().document.elements).toEqual(before)
    const row = screen.getByRole('button', { name: 'Seleccionar Norte' }).closest('.element-row')!
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Duplicar' }))
    expect(store.getSnapshot().document.elements[2]).toMatchObject({ name: 'Norte copia', position: { x: 524, y: 524 } })
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Quitar' }))
    expect(store.getSnapshot().document.elements.map(e => e.name)).toEqual(['Sur', 'Norte copia'])
  })
  it('Atrás descarta todos los campos sin autoguardar y deselecciona', async () => {
    const store = await setup()
    act(() => store.mutateDocument(d => { createElement(d, { name: 'CP', isUnit: false, information: '', visual: { type: 'asset', assetId: 'checkpoint', scale: 1 } }) }))
    click('Modificar')
    const before = structuredClone(store.getSnapshot().document)
    change('Nombre', 'Borrador'); change('Información', 'Texto'); change('Escala', '200'); change('Tamaño de letra del nombre', '32')
    fireEvent.click(screen.getByRole('radio', { name: 'Emoji' })); change('Emoji', '📍')
    expect(store.getSnapshot().document).toEqual(before)
    click('Atrás'); expect(store.getSnapshot().document).toEqual(before)
    expect(screen.getByRole('button', { name: 'Seleccionar CP' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Crear' })).toHaveFocus()
  })
  it('permite borrar y teclear números sin limitar valores transitorios', async () => {
    await setup()
    click('Crear')
    change('Tamaño de letra del nombre', '')
    expect(screen.getByLabelText('Tamaño de letra del nombre')).toHaveValue(null)
    change('Tamaño de letra del nombre', '3')
    expect(screen.getByLabelText('Tamaño de letra del nombre')).toHaveValue(3)
    change('Tamaño de letra del nombre', '32')
    fireEvent.blur(screen.getByLabelText('Tamaño de letra del nombre'))
    expect(screen.getByLabelText('Tamaño de letra del nombre')).toHaveValue(32)
    change('Escala', '1'); expect(screen.getByLabelText('Escala')).toHaveValue(1)
    change('Escala', '100'); fireEvent.blur(screen.getByLabelText('Escala'))
    expect(screen.getByLabelText('Escala')).toHaveValue(100)
  })
  it('catálogo por módulo y legado conservado al guardar solo nombre', async () => {
    const store = await setup(true)
    act(() => store.mutateDocument(d => { createElement(d, { name: 'Legado', isUnit: true, information: '', visual: { type: 'asset', assetId: 'warning', scale: 1 } }) }))
    click('Modificar')
    expect(screen.getByLabelText('Pin')).toHaveValue('warning')
    expect(screen.getAllByRole('option').map(o => (o as HTMLOptionElement).value)).toEqual(['warning', 'ambulance', 'pathfinder', 'quad'])
    change('Nombre', 'Legado editado'); click('Guardar')
    expect(store.getSnapshot().document.elements[0]!.visual).toEqual({ type: 'asset', assetId: 'warning', scale: 1 })
    click('Crear'); expect(screen.getAllByRole('option')).toHaveLength(3)
  })
  it('preview, porcentaje y letra independientes; resize directo sincroniza solo escala', async () => {
    const store = await setup()
    act(() => store.mutateDocument(d => { createElement(d, { name: 'Ruta', isUnit: false, information: '', visual: { type: 'emoji', value: '📍', scale: 1 } }) }))
    click('Modificar'); change('Nombre', 'Ruta norte'); change('Escala', '200'); change('Tamaño de letra del nombre', '24')
    const preview = within(screen.getByRole('img', { name: 'Previsualización del elemento' }))
    expect(preview.getByText('📍')).toHaveStyle({ fontSize: '96px' })
    expect(preview.getByText('Ruta norte')).toHaveStyle({ fontSize: '24px' })
    const id = store.getSnapshot().document.elements[0]!.id
    act(() => store.mutateDocument(d => updateElement(d, id, { visual: { type: 'emoji', value: '📍', scale: 3 } })))
    expect(screen.getByLabelText('Escala', { exact: true })).toHaveValue(300)
    expect(screen.getByLabelText('Nombre', { exact: true })).toHaveValue('Ruta norte')
    click('Guardar'); expect(store.getSnapshot().document.elements[0]).toMatchObject({ name: 'Ruta norte', nameFontSize: 24, visual: { scale: 3 } })
  })
  it('vacío de lista deselecciona; cambiar documento descarta creador', async () => {
    const store = await setup()
    act(() => store.mutateDocument(d => { createElement(d, { name: 'CP', isUnit: false, information: '', visual: { type: 'asset', assetId: 'checkpoint', scale: 1 } }) }))
    click('Seleccionar CP')
    const list = document.querySelector('.elements-list')!
    fireEvent.pointerDown(list, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(list, { pointerId: 1, clientX: 80, clientY: 0 })
    fireEvent.click(list)
    expect(screen.getByRole('button', { name: 'Seleccionar CP' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(list)
    expect(screen.getByRole('button', { name: 'Seleccionar CP' })).toHaveAttribute('aria-pressed', 'false')
    click('Crear'); change('Nombre', 'No guardar'); act(() => store.newDocument())
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(store.getSnapshot().document.elements).toEqual([])
  })
})
