import { lazy, Suspense, useId, useState, useSyncExternalStore } from 'react'
import { Calculator, Delete, SunMoon } from 'lucide-react'
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

const SolarCalculator = lazy(() => import('./SolarCalculator').then(module => ({ default: module.SolarCalculator })))

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
  const [mode, setMode] = useState<'arithmetic' | 'solar'>('arithmetic')
  const [solarToolbar, setSolarToolbar] = useState<HTMLSpanElement | null>(null)
  const selectedDay = useSyncExternalStore(calendar.subscribe, () => calendar.getSnapshot().selectedDate)
  const [solarZone, setSolarZone] = useState<{ generation: number; value: SolarZoneOverride | null } | null>(null)
  const [error, setError] = useValidationNotice(null, generation)

  function edit(value: string) {
    if (blockedRef.current) return
    setExpression(value); setError(null)
  }
  function calculate() {
    if (blockedRef.current) return
    const next = evaluateExpression(expression)
    if (next.ok) setExpression(next.value.toLocaleString('es-ES', { useGrouping: false, maximumSignificantDigits: 15 }))
    setError(next.ok ? null : next.error)
  }

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
    <Input id={`${id}-expression`} aria-label="Operación" className="technical-data" value={expression} disabled={blocked}
      autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)}
      onChange={event => edit(event.target.value)} onKeyDown={event => {
        if (event.key === '=') { event.preventDefault(); calculate() }
      }} />
    <div className="calculator-keypad">
      <Button aria-label="Limpiar" disabled={blocked} onClick={() => edit('')}>C</Button>
      <Button variant="text" aria-label="Borrar último carácter" disabled={blocked} onClick={() => edit(expression.slice(0, -1))}><Delete aria-hidden="true" /></Button>
      <Button aria-label="Abrir paréntesis" disabled={blocked} onClick={() => edit(expression + '(')}>(</Button>
      <Button aria-label="Cerrar paréntesis" disabled={blocked} onClick={() => edit(expression + ')')}>)</Button>
      {keys.map(([value, name]) => <Button key={name} aria-label={name} disabled={blocked} onClick={() => edit(expression + value)}>{value}</Button>)}
      <Button type="submit" className="calculator-equals" aria-label="Calcular" disabled={blocked}>=</Button>
    </div>
    </form> : <Suspense fallback={null}><SolarCalculator radarActive={radar.active} radarPoint={radarPoint} selectedDay={selectedDay} toolbarContainer={solarToolbar}
      zoneOverride={solarZone?.generation === generation ? solarZone.value : null} onZoneChange={value => setSolarZone({ generation, value })} /></Suspense>}
  </div>
}
