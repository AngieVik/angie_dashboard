import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CoordinatesModule } from './CoordinatesModule'
import { ViewportContext } from '../../layout/ViewportContext'

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  vi.restoreAllMocks()
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
function clipboardAccess(clipboard: Pick<Clipboard, 'writeText'>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clipboard })
}
function enter(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Coordenadas' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Convertir' }))
}

describe('Módulo de coordenadas', () => {
  it('conserva el campo accesible sin etiqueta ni indicación redundante', () => {
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toBeInTheDocument()
    expect(screen.queryByText('Coordenadas')).not.toBeInTheDocument()
    expect(screen.queryByText('DD · DMS · DMM · UTM')).not.toBeInTheDocument()
  })
  it.each([
    ['DD', '37.060234, -2.002295'], ['DMS', '37°03\'36.8"N 2°00\'08.3"W'],
    ['DMM', "37°03.614'N 2°00.138'W"],
  ])('la fila %s copia su valor canónico por clic sin texto añadido', async (format, expected) => {
    let copied = ''
    clipboardAccess({ writeText: async value => { copied = value } })
    render(<CoordinatesModule />); enter('37.060234, -2.002295')
    const row = screen.getByRole('button', { name: `Copiar ${format}` })
    fireEvent.click(row)
    await waitFor(() => expect(copied).toBe(expected))
    expect(within(row).queryByText(`Copiar ${format}`)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('la fila UTM copia solo su valor y admite Enter y Espacio', async () => {
    let copied = ''
    clipboardAccess({ writeText: async value => { copied = value } })
    render(<CoordinatesModule />); enter('30S 588700 4101800')
    const row = screen.getByRole('button', { name: 'Copiar UTM' })
    fireEvent.keyDown(row, { key: 'Enter' })
    await waitFor(() => expect(copied).toBe('30S 588700 4101800'))
    copied = ''
    fireEvent.keyDown(row, { key: ' ' })
    await waitFor(() => expect(copied).toBe('30S 588700 4101800'))
  })
  it('una fila no disponible no se copia y el bloqueo de dos dedos impide copiar filas válidas', async () => {
    let copied = ''
    clipboardAccess({ writeText: async value => { copied = value } })
    const view = render(<CoordinatesModule />); enter('89, 0')
    const unavailable = screen.getByLabelText('Resultado UTM').closest('div')!
    expect(unavailable).not.toHaveAttribute('role', 'button')
    fireEvent.click(unavailable); fireEvent.keyDown(unavailable, { key: 'Enter' })
    await Promise.resolve()
    expect(copied).toBe('')
    view.rerender(<ViewportContext.Provider value={{ blocked: false, blockedRef: { current: false } }}><CoordinatesModule /></ViewportContext.Provider>)
    enter('37, -2')
    view.rerender(<ViewportContext.Provider value={{ blocked: true, blockedRef: { current: true } }}><CoordinatesModule /></ViewportContext.Provider>)
    const row = screen.getByRole('button', { name: 'Copiar DD' })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(row); fireEvent.keyDown(row, { key: ' ' })
    await Promise.resolve()
    expect(copied).toBe('')
  })
  it('Maps es un hipervínculo separado de Copiar enlace', () => {
    render(<CoordinatesModule />); enter('37, -2')
    const link = screen.getByRole('link', { name: 'Enlace de Google Maps' })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=37%2C-2')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeEnabled()
  })
  it('el fallo de copia de fila se anuncia sin ocupar espacio visible', async () => {
    clipboardAccess({ writeText: async () => { throw new Error('permiso') } })
    render(<CoordinatesModule />); enter('37, -2')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar DD' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo copiar la coordenada.'))
    expect(screen.getByRole('status')).toHaveClass('coordinates-copy-error')
  })
  it('una copia de fila pendiente no anuncia errores de una conversión anterior', async () => {
    let reject!: (reason: Error) => void
    clipboardAccess({ writeText: () => new Promise<void>((_resolve, fail) => { reject = fail }) })
    render(<CoordinatesModule />); enter('37, -2')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar DD' }))
    enter('38, -3'); await act(async () => reject(new Error('permiso')))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
  it('comienza vacío y convierte a los cuatro formatos sin pedir red', () => {
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled()
    enter('37.060234. -2.002295')
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('37.060234, -2.002295')
    for (const format of ['DD', 'DMS', 'DMM', 'UTM']) expect(screen.getByLabelText(`Resultado ${format}`)).not.toHaveTextContent(/^$/)
    expect(screen.getByRole('link', { name: 'Enlace de Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  })

  it('editar elimina conversiones y enlace anteriores; inválida conserva todo el texto', () => {
    render(<CoordinatesModule />); enter('30S 588700 4101800')
    const input = screen.getByRole('textbox', { name: 'Coordenadas' })
    const invalid = ' 30I. 588700, 4101800 '
    fireEvent.change(input, { target: { value: invalid } })
    expect(screen.getByLabelText('Resultado DD')).toBeEmptyDOMElement()
    expect(screen.queryByRole('link', { name: 'Enlace de Google Maps' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Convertir' }))
    expect(input).toHaveValue(invalid)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(/banda/i)
    expect(input).toHaveAttribute('aria-describedby', screen.getByRole('alert').id)
    enter('0, 0'); expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('copia el enlace y muestra confirmación; un fallo permite copiar el texto manualmente', async () => {
    let clipboard = ''
    const writeText = vi.fn(async (value: string) => { clipboard = value })
    clipboardAccess({ writeText })
    render(<CoordinatesModule />); enter('37.060234, -2.002295')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado'))
    expect(clipboard).toBe('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
    writeText.mockRejectedValueOnce(new Error('permiso'))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/copia.*manualmente/i))
    expect(screen.getByRole('link', { name: 'Enlace de Google Maps' })).toHaveTextContent('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  })

  it('un resultado asíncrono de copia no confirma un enlace anterior tras editar', async () => {
    let finish!: () => void
    clipboardAccess({ writeText: () => new Promise<void>(resolve => { finish = resolve }) })
    render(<CoordinatesModule />); enter('37, -2')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    enter('38, -3'); finish()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('dos dedos bloquean controles y no cambian contenido', () => {
    render(<ViewportContext.Provider value={{ blocked: true, blockedRef: { current: true } }}><CoordinatesModule /></ViewportContext.Provider>)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Convertir' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled()
  })

  it('no recupera coordenadas después de desmontar y volver a abrir', () => {
    const view = render(<CoordinatesModule />); enter('37, -2'); view.unmount()
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('')
    expect(screen.getByLabelText('Resultado DD')).toBeEmptyDOMElement()
  })
})
