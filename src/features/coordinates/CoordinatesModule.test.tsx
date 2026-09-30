import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('comienza vacío y convierte a los cuatro formatos sin pedir red', () => {
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled()
    enter('37.060234. -2.002295')
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('37.060234, -2.002295')
    for (const format of ['DD', 'DMS', 'DMM', 'UTM']) expect(screen.getByLabelText(`Resultado ${format}`)).not.toHaveTextContent(/^$/)
    expect(screen.getByRole('textbox', { name: 'Enlace de Google Maps' })).toHaveValue('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  })

  it('editar elimina conversiones y enlace anteriores; inválida conserva todo el texto', () => {
    render(<CoordinatesModule />); enter('30S 588700 4101800')
    const input = screen.getByRole('textbox', { name: 'Coordenadas' })
    const invalid = ' 30I. 588700, 4101800 '
    fireEvent.change(input, { target: { value: invalid } })
    expect(screen.queryByLabelText('Resultado DD')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Enlace de Google Maps' })).not.toBeInTheDocument()
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
    expect(screen.getByRole('textbox', { name: 'Enlace de Google Maps' })).toHaveAttribute('readonly')
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
    expect(screen.queryByLabelText('Resultado DD')).not.toBeInTheDocument()
  })
})
