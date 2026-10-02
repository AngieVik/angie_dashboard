import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ViewportContext } from '../../layout/ViewportContext'
import { CalculatorModule } from './CalculatorModule'

function input() { return screen.getByRole('textbox', { name: 'Operación' }) }
function press(name: string) { fireEvent.click(screen.getByRole('button', { name })) }
function calculate(expression: string) {
  fireEvent.change(input(), { target: { value: expression } })
  press('Calcular')
}

describe('Calculadora', () => {
  it('conserva el campo accesible sin etiqueta visible redundante', () => {
    render(<CalculatorModule />)
    expect(input()).toBeInTheDocument()
    expect(screen.queryByText('Operación')).not.toBeInTheDocument()
    calculate('200 + 10 %')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^220$/)
  })
  it('comienza vacía y permite operaciones con el teclado de botones', () => {
    render(<CalculatorModule />)
    expect(input()).toHaveValue('')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
    for (const key of ['2', '0', '0', 'Sumar', '1', '0', 'Porcentaje', 'Calcular']) press(key)
    expect(input()).toHaveValue('200+10%')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^220$/)
  })

  it.each([
    ['10 %', '0,1'], ['200 - 10 %', '180'], ['200 × 10 %', '20'],
    ['200 ÷ 10 %', '2000'], ['80 + 12,5 %', '90'], ['(2 + 3) × 4', '20'],
    ['0,1 + 0,2', '0,3'],
  ])('calcula %s y muestra %s', (expression, expected) => {
    render(<CalculatorModule />); calculate(expression)
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(new RegExp(`^${expected}$`))
  })

  it('retroceso borra un carácter y limpia elimina operación, resultado y error', () => {
    render(<CalculatorModule />); calculate('12+3')
    press('Borrar último carácter')
    expect(input()).toHaveValue('12+')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
    press('Calcular'); expect(screen.getByRole('alert')).toBeInTheDocument()
    press('Limpiar')
    expect(input()).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
    press('Borrar último carácter'); expect(input()).toHaveValue('')
    calculate('2+3'); press('Limpiar')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
  })

  it('mantiene la entrada errónea y no conserva un resultado anterior al dividir entre 0 %', () => {
    render(<CalculatorModule />); calculate('2+3'); calculate('200 ÷ 0 %')
    expect(input()).toHaveValue('200 ÷ 0 %')
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('División por cero')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
    fireEvent.change(input(), { target: { value: '10 %' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input()).toHaveAttribute('aria-invalid', 'false')
    fireEvent.submit(input().closest('form')!)
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^0,1$/)
  })

  it('decimales y paréntesis están disponibles por botones', () => {
    render(<CalculatorModule />)
    for (const key of ['Abrir paréntesis', '1', 'Separador decimal', '5', 'Sumar', '2', 'Cerrar paréntesis', 'Multiplicar', '2', 'Calcular']) press(key)
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^7$/)
  })

  it('no recupera la operación al desmontar y volver a abrir', () => {
    const view = render(<CalculatorModule />); calculate('40+2'); view.unmount()
    render(<CalculatorModule />)
    expect(input()).toHaveValue('')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
  })

  it('dos dedos bloquean la edición y los controles', () => {
    render(<ViewportContext.Provider value={{ blocked: true, blockedRef: { current: true } }}><CalculatorModule /></ViewportContext.Provider>)
    expect(input()).toBeDisabled()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    fireEvent.change(input(), { target: { value: '2+3' } })
    fireEvent.submit(input().closest('form')!)
    expect(input()).toHaveValue('')
    expect(screen.getByLabelText('Resultado')).toHaveTextContent(/^$/)
  })
})
