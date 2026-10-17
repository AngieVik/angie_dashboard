import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { X, Play, Pause, Square } from 'lucide-react'
import { DurationInput } from './DurationInput'
import { calculateTimerValue, formatDuration, normalizeDuration } from './timerEngine'
import type { TimerRecord } from './timerTypes'
import type { TimerStore } from './timerStore'

const TIMER_LABELS = { tzero: 'T-Zero', tminus: 'T-Minus', advisory: 'Advisory' }
const STATUS_LABELS = { idle: 'Inactivo', running: 'En marcha', paused: 'Pausado', completed: 'Finalizado' }

export function TimerRow({ timer, index, now, store, disabled = false }: { timer: TimerRecord; index: number; now: number; store: TimerStore; disabled?: boolean }) {
  const row = useRef<HTMLDivElement>(null)
  const resetControl = useRef<HTMLButtonElement>(null)
  const [durationText, setDurationText] = useState(() => formatDuration(timer.kind === 'tzero' ? 0 : timer.durationSeconds))
  const snapshot = calculateTimerValue(timer, now), name = `${TIMER_LABELS[timer.kind]} ${index}`
  function enteredDuration() {
    const fields = durationText.includes(':') ? durationText.split(':') : durationText.padStart(6, '0').match(/.{2}/g)!
    return normalizeDuration(fields[0] ?? '', fields[1] ?? '', fields[2] ?? '')
  }
  function normalize() {
    if (disabled) return
    const duration = enteredDuration()
    setDurationText(formatDuration(duration))
    store.setDuration(timer.id, duration)
  }
  function start() { if (timer.kind !== 'tzero' && timer.status === 'idle') normalize(); store.start(timer.id) }
  function stop() {
    if (timer.kind !== 'tzero' && timer.status !== 'idle') setDurationText(formatDuration(timer.durationSeconds))
    if (timer.kind === 'advisory') store.deactivate(timer.id)
    else store.reset(timer.id)
  }
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
  return <div ref={row} className="timer-row" role="group" aria-label={name} aria-description={STATUS_LABELS[snapshot.status]} data-alert={snapshot.alertActive}
    onClick={event => {
      if (snapshot.alertActive && !(event.target as HTMLElement).closest('button, input, textarea')) recognize()
    }}>
    <div className="timer-heading"><span>{TIMER_LABELS[timer.kind]}</span>
      <Button className="timer-close document-button" aria-label="Cerrar temporizador" disabled={disabled} onClick={close}><X aria-hidden="true" /></Button></div>
    <div className="timer-main">
      {timer.kind !== 'tzero' && snapshot.status === 'idle'
        ? <DurationInput disabled={disabled} value={durationText} onBlur={normalize} onChange={setDurationText} />
        : snapshot.alertActive ? <Button className="timer-acknowledge" aria-label="Reconocer alerta" onClick={recognize}>{time}</Button> : time}
      <div className="timer-controls">
        <Button aria-label={snapshot.status === 'running' ? 'Pausar' : 'Iniciar'} title={snapshot.status === 'running' ? 'Pausar' : 'Iniciar'}
          disabled={disabled || snapshot.status === 'completed' || timer.kind !== 'tzero' && timer.status === 'idle' && enteredDuration() === 0} onClick={() => { if (snapshot.status === 'running') store.pause(timer.id); else start() }}>
          {snapshot.status === 'running' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button ref={resetControl} aria-label={timer.kind === 'advisory' ? 'Desactivar' : 'Reiniciar'} title={timer.kind === 'advisory' ? 'Desactivar' : 'Reiniciar'}
          disabled={disabled} onClick={stop}><Square aria-hidden="true" /></Button>
      </div>
    </div>
  </div>
}
