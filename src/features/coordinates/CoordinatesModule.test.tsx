import { act, fireEvent, render as testingRender, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { TooltipProvider } from '../../components/ui/tooltip'
import { CoordinatesModule } from './CoordinatesModule'
import { ViewportContext } from '../../layout/ViewportContext'

function render(ui: ReactNode) { return testingRender(ui, { wrapper: TooltipProvider }) }

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
function clipboardAccess(clipboard: Pick<Clipboard, 'writeText'>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clipboard })
}
function enter(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Coordenadas' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }))
}

describe('Módulo de coordenadas', () => {
  it('conserva el campo accesible sin etiqueta ni indicación redundante', () => {
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveAttribute('placeholder', 'Coordenadas')
    expect(screen.queryByText('Convertir')).not.toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Coordenada copiada'))
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
  it.each(['click', 'Enter', ' '])('Maps copia su URL sin navegación mediante %s', async key => {
    let copied = ''
    clipboardAccess({ writeText: async value => { copied = value } })
    render(<CoordinatesModule />); enter('37, -2')
    const rows = screen.getAllByRole('button', { name: /^Copiar / })
    expect(rows.map(row => row.querySelector('dt')?.textContent)).toEqual(['DD', 'DMS', 'DMM', 'UTM', 'Maps'])
    const row = screen.getByRole('button', { name: 'Copiar Maps' })
    if (key === 'click') fireEvent.click(row); else fireEvent.keyDown(row, { key })
    await waitFor(() => expect(copied).toBe('https://www.google.com/maps/search/?api=1&query=37%2C-2'))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar enlace' })).not.toBeInTheDocument()
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
  it('comienza vacío y muestra cinco filas sin pedir red', () => {
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /^Copiar / })).not.toBeInTheDocument()
    enter('37.060234. -2.002295')
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('37.060234, -2.002295')
    for (const format of ['DD', 'DMS', 'DMM', 'UTM']) expect(screen.getByLabelText(`Resultado ${format}`)).not.toHaveTextContent(/^$/)
    expect(screen.getByLabelText('Resultado Maps')).toHaveTextContent('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  })

  it('editar elimina conversiones y enlace anteriores; inválida conserva todo el texto', () => {
    render(<CoordinatesModule />); enter('30S 588700 4101800')
    const input = screen.getByRole('textbox', { name: 'Coordenadas' })
    const invalid = ' 30I. 588700, 4101800 '
    fireEvent.change(input, { target: { value: invalid } })
    expect(screen.getByLabelText('Resultado DD')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('Resultado Maps')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: /^Copiar / })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Maps' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado'))
    expect(clipboard).toBe('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
    writeText.mockRejectedValueOnce(new Error('permiso'))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Maps' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/copia.*manualmente/i))
    expect(screen.getByLabelText('Resultado Maps')).toHaveTextContent('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
  })

  it('un resultado asíncrono de copia no confirma un enlace anterior tras editar', async () => {
    let finish!: () => void
    clipboardAccess({ writeText: () => new Promise<void>(resolve => { finish = resolve }) })
    render(<CoordinatesModule />); enter('37, -2')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Maps' }))
    enter('38, -3'); finish()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('el aviso expira a cinco segundos, reintentar reinicia el plazo y no habilita copia', () => {
    vi.useFakeTimers()
    render(<CoordinatesModule />); enter('30I 588700 4101800')
    const input = screen.getByRole('textbox', { name: 'Coordenadas' })
    input.focus()
    act(() => vi.advanceTimersByTime(4999))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.submit(input.closest('form')!)
    act(() => vi.advanceTimersByTime(4999))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).toHaveValue('30I 588700 4101800')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Copiar / })).not.toBeInTheDocument()
    for (const format of ['DD', 'DMS', 'DMM', 'UTM', 'Maps']) expect(screen.getByLabelText(`Resultado ${format}`)).toBeEmptyDOMElement()
  })

  it('dos dedos bloquean controles y no cambian contenido', () => {
    render(<ViewportContext.Provider value={{ blocked: true, blockedRef: { current: true } }}><CoordinatesModule /></ViewportContext.Provider>)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar coordenadas y mostrar formatos' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^Copiar / })).not.toBeInTheDocument()
  })

  it('no recupera coordenadas después de desmontar y volver a abrir', () => {
    const view = render(<CoordinatesModule />); enter('37, -2'); view.unmount()
    render(<CoordinatesModule />)
    expect(screen.getByRole('textbox', { name: 'Coordenadas' })).toHaveValue('')
    expect(screen.getByLabelText('Resultado DD')).toBeEmptyDOMElement()
  })
})


it.each(['DD', 'DMS', 'DMM', 'UTM', 'Maps'])('la confirmación de %s dura tres segundos y copiar de nuevo reinicia el plazo', async format => {
  vi.useFakeTimers()
  clipboardAccess({ writeText: async () => {} })
  render(<CoordinatesModule />); enter('37, -2')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar ' + format })))
  expect(screen.getByRole('status')).toHaveTextContent(format === 'Maps' ? 'Enlace copiado' : 'Coordenada copiada')
  act(() => vi.advanceTimersByTime(2000))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar ' + format })))
  act(() => vi.advanceTimersByTime(2999))
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
