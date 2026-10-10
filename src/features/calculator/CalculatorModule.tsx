import { useId, useState } from 'react'
import { Delete } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { evaluateExpression } from './expression'
import type { CalculationResult } from './expression'
import './calculator.css'

const keys = [
  ['7', '7'], ['8', '8'], ['9', '9'], ['÷', 'Dividir'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['×', 'Multiplicar'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['−', 'Restar'],
  ['%', 'Porcentaje'], ['0', '0'], [',', 'Separador decimal'], ['+', 'Sumar'],
] as const

export function CalculatorModule({ generation = 0 }: { generation?: number } = {}) {
  const id = useId()
  const { blocked, blockedRef } = useViewportInteraction()
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useValidationNotice(null, generation)

  function edit(value: string) {
    if (blockedRef.current) return
    setExpression(value); setResult(null); setError(null)
  }
  function calculate() {
    if (blockedRef.current) return
    const next = evaluateExpression(expression)
    setResult(next); setError(next.ok ? null : next.error)
  }

  return <form className="calculator-module" onSubmit={event => { event.preventDefault(); calculate() }}>
    <Input id={`${id}-expression`} aria-label="Operación" className="document-title technical-data" value={expression} disabled={blocked}
      autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => edit(event.target.value)} onKeyDown={event => {
        if (event.key === '=') { event.preventDefault(); calculate() }
      }} />
    <div className="calculator-readout">
      <output aria-label="Resultado" className="technical-data" aria-live="polite">
        {result?.ok ? result.value.toLocaleString('es-ES', { useGrouping: false, maximumSignificantDigits: 15 }) : ''}
      </output>
      {error && <span id={`${id}-error`} role="alert">{error}</span>}
    </div>
    <div className="calculator-keypad">
      <Button aria-label="Limpiar" disabled={blocked} onClick={() => edit('')}>C</Button>
      <Button aria-label="Borrar último carácter" disabled={blocked} onClick={() => edit(expression.slice(0, -1))}><Delete aria-hidden="true" /></Button>
      <Button aria-label="Abrir paréntesis" disabled={blocked} onClick={() => edit(expression + '(')}>(</Button>
      <Button aria-label="Cerrar paréntesis" disabled={blocked} onClick={() => edit(expression + ')')}>)</Button>
      {keys.map(([value, name]) => <Button key={name} aria-label={name} disabled={blocked} onClick={() => edit(expression + value)}>{value}</Button>)}
      <Button type="submit" className="document-button calculator-equals" aria-label="Calcular" disabled={blocked}>=</Button>
    </div>
  </form>
}
