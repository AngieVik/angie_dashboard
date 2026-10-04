import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fit, clamp, zoomAt, resizeViewport } from './viewportMath'
import { ModuleFrame } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import { createEmptyDocument } from '../domain/document/defaultDocument'
import { serializeDocument } from '../domain/document/serializeDocument'
import { validateDocument } from '../domain/document/validateDocument'
import { CoordinatesModule } from '../features/coordinates/CoordinatesModule'
import { ElementEditor } from '../features/elements/ElementEditor'

describe('interfaz compacta aprobada', () => {
  const size = { width: 800, height: 600 }
  it('admite 25–400 %, sin huecos positivos ni recientes al cambiar el área', () => {
    expect(zoomAt(fit(size), 0.5, { x: 0, y: 0 }, size)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 })
    expect(zoomAt(fit(size), 0.01, { x: 0, y: 0 }, size).scale).toBe(0.25)
    expect(zoomAt(fit(size), 10, { x: 0, y: 0 }, size).scale).toBe(4)
    expect(clamp({ scale: 1, offsetX: 80, offsetY: 60 }, size)).toEqual(fit(size))
    expect(fit(size, { width: 1200, height: 1000 })).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(resizeViewport({ scale: 2, offsetX: -50, offsetY: -60 }, size, { width: 600, height: 800 })).toEqual({ scale: 2, offsetX: -50, offsetY: -60 })
  })
  it('no propaga NaN ni infinitos desde la entrada de zoom', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) expect(zoomAt(fit(size), invalid, { x: 0, y: 0 }, size)).toEqual(fit(size))
  })
  it('exporta ventanas menores que los antiguos mínimos, sin aceptar cero', () => {
    const document = createEmptyDocument()
    for (const id of Object.keys(MODULE_REGISTRY) as (keyof typeof MODULE_REGISTRY)[]) {
      expect(MODULE_REGISTRY[id].minimum).toEqual([1, 1])
      document.moduleLayouts[id] = { x: 0, y: 0, width: 100, height: 80, referenceSize: size }
    }
    expect(validateDocument(document).success).toBe(true)
    expect(JSON.parse(serializeDocument(document))).toEqual(document)
    document.moduleLayouts.board!.width = 0
    expect(validateDocument(document).success).toBe(false)
  })
  it('separa arrastre, cierre y zoom; escala cada contenido independientemente', () => {
    const close = vi.fn()
    render(<><ModuleFrame id="elements" active onClose={close}><button>Herramienta</button></ModuleFrame>
      <ModuleFrame id="clock" active={false} onClose={vi.fn()}>Reloj</ModuleFrame></>)
    const elements = screen.getByRole('region', { name: 'Elementos' })
    expect(elements.querySelector('.module-header')!.querySelectorAll('button,input')).toHaveLength(0)
    const zoom = within(elements).getByRole('spinbutton', { name: 'Zoom de Elementos' })
    fireEvent.change(zoom, { target: { value: '50' } }); fireEvent.keyDown(zoom, { key: 'Enter' })
    expect(elements.querySelector('.module-scaled-content')).toHaveAttribute('data-scale', '0.5')
    expect(screen.getByRole('region', { name: 'Reloj' }).querySelector('.module-scaled-content')).toHaveAttribute('data-scale', '1')
    fireEvent.change(zoom, { target: { value: '' } }); fireEvent.blur(zoom)
    expect(zoom).toHaveValue(50)
    fireEvent.click(within(elements).getByRole('button', { name: 'Cerrar Elementos' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('mantiene los cuatro formatos vacíos e impide copiarlos', () => {
    render(<CoordinatesModule />)
    for (const format of ['DD', 'DMS', 'DMM', 'UTM']) {
      expect(screen.getByText(format)).toBeVisible()
      expect(screen.getByLabelText(`Resultado ${format}`)).toHaveTextContent('')
      expect(screen.queryByRole('button', { name: `Copiar ${format}` })).not.toBeInTheDocument()
    }
  })
  it('información de Elementos comienza en una fila y conserva el borrador', () => {
    const save = vi.fn()
    render(<ElementEditor onSave={save} onCancel={vi.fn()} />)
    expect(screen.queryByText('Añadir elemento')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Información' })).toHaveAttribute('rows', '1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Punto norte' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Información' }), { target: { value: 'Uno\nDos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear elemento' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Punto norte', information: 'Uno\nDos' }))
  })
})
