import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { calculateTimerValue, formatDuration, normalizeDuration } from './timerEngine'
import type { TimerRecord } from './timerTypes'
import type { TimerStore } from './timerStore'

const TIMER_LABELS = { tzero: 'T-Zero', tminus: 'T-Minus', advisory: 'Advisory' }
const STATUS_LABELS = { idle: 'Inactivo', running: 'En marcha', paused: 'Pausado', completed: 'Finalizado' }

export function TimerRow({ timer, index, now, store }: { timer: TimerRecord; index: number; now: number; store: TimerStore }) {
  const row = useRef<HTMLDivElement>(null)
  const resetControl = useRef<HTMLButtonElement>(null)
  const [fields, setFields] = useState(() => formatDuration(timer.kind === 'tzero' ? 0 : timer.durationSeconds).split(':'))
  const snapshot = calculateTimerValue(timer, now), name = `${TIMER_LABELS[timer.kind]} ${index}`
  function normalize() {
    const duration = normalizeDuration(fields[0]!, fields[1]!, fields[2]!)
    setFields(formatDuration(duration).split(':'))
    store.setDuration(timer.id, duration)
  }
  function start() { if (timer.kind !== 'tzero' && timer.status === 'idle') normalize(); store.start(timer.id) }
  function recognize() {
    store.acknowledge(timer.id)
    resetControl.current?.focus()
  }
  function close() {
    const sibling = row.current?.nextElementSibling ?? row.current?.previousElementSibling
    const next = sibling?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? row.current?.closest('.clock-module')?.querySelector<HTMLButtonElement>('.clock-add-controls button')
    store.close(timer.id)
    next?.focus()
  }
  const time = <output className="technical-data timer-value" aria-label="Tiempo">{formatDuration(snapshot.valueSeconds)}</output>
  return <div ref={row} className="timer-row" role="group" aria-label={name} data-alert={snapshot.alertActive}
    onClick={event => {
      if (snapshot.alertActive && !(event.target as HTMLElement).closest('button, input, textarea')) recognize()
    }}>
    <div className="timer-heading"><span>{name}</span><span className="timer-status">{STATUS_LABELS[snapshot.status]}</span>
      <Button aria-label="Cerrar temporizador" onClick={close}>×</Button></div>
    <div className="timer-main">
      {snapshot.alertActive ? <Button className="timer-acknowledge" aria-label="Reconocer alerta" onClick={recognize}>{time}</Button> : time}
      <div className="timer-controls">
        <Button aria-label="Iniciar" title="Iniciar" disabled={snapshot.status === 'running' || snapshot.status === 'completed'} onClick={start}>▶</Button>
        {timer.kind === 'advisory' ? <Button ref={resetControl} aria-label="Desactivar" title="Desactivar" onClick={() => store.deactivate(timer.id)}>⏹</Button> : <>
          <Button aria-label="Pausar" title="Pausar" disabled={snapshot.status !== 'running'} onClick={() => store.pause(timer.id)}>⏸</Button>
          <Button ref={resetControl} aria-label="Reiniciar" title="Reiniciar" onClick={() => store.reset(timer.id)}>⏹</Button>
        </>}
      </div>
    </div>
    {timer.kind !== 'tzero' && <div className="timer-duration" role="group" aria-label="Duración inicial">
      <span>Duración</span>
      {['Horas', 'Minutos', 'Segundos'].map((label, part) => <span className="timer-duration-part" key={label}>
        {part > 0 && <span aria-hidden="true">:</span>}
        <Input aria-label={label} className="technical-data timer-digit" inputMode="numeric" pattern="[0-9]*"
          disabled={timer.status !== 'idle'} value={fields[part]} onBlur={normalize} onChange={event => {
            if (/^[0-9]*$/.test(event.target.value)) setFields(previous => previous.map((value, position) => position === part ? event.target.value : value))
          }} />
      </span>)}
    </div>}
    <Input aria-label="Nota" placeholder="Nota libre" className="timer-note" value={timer.note} onChange={event => store.setNote(timer.id, event.target.value)} />
  </div>
}
