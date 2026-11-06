import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Calculator, Delete, History, SunMoon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { evaluateExpression } from './expression'
import { RadarButton } from '../coordinates/RadarButton'
import type { RadarControl } from '../coordinates/RadarButton'
import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import toolbarStyles from '@/layout/moduleToolbar.module.css'
import styles from './calculator.module.css'
import type { SolarZoneOverride } from './SolarCalculator'
import type { CalendarStore } from '../calendar/calendarStore'
import { LazySurface } from '../../app/recovery/LazySurface'

const loadSolarCalculator = () => import('./SolarCalculator').then(module => ({ default: module.SolarCalculator }))

interface Calculation { id: number; expression: string; result: string }
const HISTORY_LIMIT = 10

const keys = [
  ['7', '7'], ['8', '8'], ['9', '9'], ['÷', 'Dividir'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['×', 'Multiplicar'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['−', 'Restar'],
  ['%', 'Porcentaje'], ['0', '0'], [',', 'Separador decimal'], ['+', 'Sumar'],
] as const

export function CalculatorModule({ generation = 0, radar, radarPoint, calendar }: { generation?: number; radar: RadarControl; radarPoint: GeographicCoordinate | null; calendar: CalendarStore }) {
  const id = useId()
  const { blocked, blockedRef } = useViewportInteraction()
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState<Calculation[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)
  const [completed, setCompleted] = useState<Calculation | null>(null)
  const [departing, setDeparting] = useState<Calculation | null>(null)
  const nextCalculationId = useRef(0)
  const [mode, setMode] = useState<'arithmetic' | 'solar'>('arithmetic')
  const [solarToolbar, setSolarToolbar] = useState<HTMLSpanElement | null>(null)
  const selectedDay = useSyncExternalStore(calendar.subscribe, () => calendar.getSnapshot().selectedDate)
  const [solarZone, setSolarZone] = useState<{ generation: number; value: SolarZoneOverride | null } | null>(null)
  const [error, setError] = useValidationNotice(null, generation)

  useEffect(() => {
    if (!departing) return
    const timer = window.setTimeout(() => setDeparting(null), 700)
    return () => window.clearTimeout(timer)
  }, [departing])
  function edit(value: string) {
    if (blockedRef.current) return
    if (completed) { setDeparting(completed); setCompleted(null) }
    setExpression(value); setError(null)
  }
  function calculate() {
    if (blockedRef.current) return
    const next = evaluateExpression(expression)
    if (next.ok) {
      const calculation = { id: nextCalculationId.current++, expression, result: next.value.toLocaleString('es-ES', { useGrouping: false, maximumSignificantDigits: 15 }) }
      setHistory(previous => [...previous, calculation].slice(-HISTORY_LIMIT))
      setCompleted(calculation); setDeparting(null); setExpression(calculation.result)
    }
    setError(next.ok ? null : next.error)
  }
  function deleteLastCalculation() {
    if (blockedRef.current || history.length === 0) return
    const remaining = history.slice(0, -1)
    const previous = remaining.at(-1) ?? null
    setHistory(remaining); setCompleted(previous); setDeparting(null)
    setExpression(previous?.result ?? ''); setError(null)
  }
  const historyRows = completed ? history.filter(calculation => calculation.id !== completed.id) : history

  return <div data-slot="calculator-module" className={`${styles.base} calculator-module`}>
    <header className={toolbarStyles.base}>
      <Button aria-label="Aritmética" aria-pressed={mode === 'arithmetic'} disabled={blocked} onClick={() => setMode('arithmetic')}><Calculator aria-hidden="true" /></Button>
      <Button aria-label="Sol y crepúsculos" aria-pressed={mode === 'solar'} disabled={blocked} onClick={() => setMode('solar')}><SunMoon aria-hidden="true" /></Button>
      <div className={styles.radarActions}>
        <span ref={setSolarToolbar} className={styles.solarTools} />
        <RadarButton {...radar} appearance="default" disabled={blocked} />
      </div>
    </header>
    {mode === 'arithmetic' ? <form className={styles.arithmetic} onSubmit={event => { event.preventDefault(); calculate() }}>
    <div className={`${styles.screen} technical-data`}>
      {historyVisible && <ol id={`${id}-history`} className={styles.history} aria-label="Historial de operaciones">
        {historyRows.map(calculation => <li key={calculation.id} className={styles.historyRow}>
          <span tabIndex={0} className={styles.historyExpression}>{calculation.expression} =</span>
          <span tabIndex={0} className={styles.historyResult}>{calculation.result}</span>
        </li>)}
      </ol>}
      <div className={styles.entry}>
        {completed && <span tabIndex={0} className={styles.operation}>{completed.expression} =</span>}
        {!historyVisible && departing && <span key={departing.id} className={`${styles.operation} ${styles.departing}`} aria-hidden="true">{departing.expression} =</span>}
    <Input id={`${id}-expression`} aria-label={completed ? 'Resultado' : 'Operación'} className="technical-data" value={expression} disabled={blocked}
      autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)}
      onChange={event => edit(event.target.value)} onKeyDown={event => {
        if (event.key === '=') { event.preventDefault(); calculate() }
      }} />
      </div>
    </div>
    <div className="calculator-keypad">
      <Button aria-label="Limpiar" disabled={blocked} onClick={() => edit('')}>C</Button>
      <Button variant="text" aria-label="Borrar último carácter" disabled={blocked} onClick={() => edit(expression.slice(0, -1))}><Delete aria-hidden="true" /></Button>
      <Button aria-label="Abrir paréntesis" disabled={blocked} onClick={() => edit(expression + '(')}>(</Button>
      <Button aria-label="Cerrar paréntesis" disabled={blocked} onClick={() => edit(expression + ')')}>)</Button>
      {keys.map(([value, name]) => <Button key={name} aria-label={name} disabled={blocked} onClick={() => edit(expression + value)}>{value}</Button>)}
      <Button aria-label="Historial" aria-pressed={historyVisible} aria-expanded={historyVisible} aria-controls={historyVisible ? `${id}-history` : undefined} disabled={blocked}
        onClick={() => { if (!blockedRef.current) setHistoryVisible(visible => !visible) }}><History aria-hidden="true" /></Button>
      <Button aria-label="Borrar última operación" disabled={blocked || history.length === 0} onClick={deleteLastCalculation}><Undo2 aria-hidden="true" /></Button>
      <Button type="submit" className="calculator-equals" aria-label="Calcular" disabled={blocked}>=</Button>
    </div>
    </form> : <LazySurface load={loadSolarCalculator} name="Sol y crepúsculos" presentation="inline" closeLabel="Volver a aritmética" onClose={() => setMode('arithmetic')}
      componentProps={{ radarActive: radar.active, radarPoint, selectedDay, toolbarContainer: solarToolbar,
        zoneOverride: solarZone?.generation === generation ? solarZone.value : null, onZoneChange: value => setSolarZone({ generation, value }) }} />}
  </div>
}
