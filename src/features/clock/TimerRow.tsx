import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { X, Play, Pause, Square } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { calculateTimerValue, formatDuration, normalizeDuration } from './timerEngine'
import type { TimerRecord } from './timerTypes'
import type { TimerStore } from './timerStore'

const TIMER_LABELS = { tzero: 'T-Zero', tminus: 'T-Minus', advisory: 'Advisory' }
const STATUS_LABELS = { idle: 'Inactivo', running: 'En marcha', paused: 'Pausado', completed: 'Finalizado' }

export function TimerRow({ timer, index, now, store }: { timer: TimerRecord; index: number; now: number; store: TimerStore }) {
  const row = useRef<HTMLDivElement>(null)
  const resetControl = useRef<HTMLButtonElement>(null)
  const [durationText, setDurationText] = useState(() => formatDuration(timer.kind === 'tzero' ? 0 : timer.durationSeconds))
  const snapshot = calculateTimerValue(timer, now), name = `${TIMER_LABELS[timer.kind]} ${index}`
  function normalize() {
    const fields = durationText.includes(':') ? durationText.split(':') : durationText.padStart(6, '0').match(/.{2}/g)!
    const duration = normalizeDuration(fields[0] ?? '', fields[1] ?? '', fields[2] ?? '')
    setDurationText(formatDuration(duration))
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
  return <div ref={row} className="timer-row" role="group" aria-label={name} aria-description={STATUS_LABELS[snapshot.status]} data-alert={snapshot.alertActive}
    onClick={event => {
      if (snapshot.alertActive && !(event.target as HTMLElement).closest('button, input, textarea')) recognize()
    }}>
    <div className="timer-heading"><span>{name}</span>
      <Button className="timer-close document-button" aria-label="Cerrar temporizador" onClick={close}><X aria-hidden="true" /></Button></div>
    <div className="timer-main">
      {snapshot.alertActive ? <Button className="timer-acknowledge" aria-label="Reconocer alerta" onClick={recognize}>{time}</Button> : time}
      <div className="timer-controls">
        <Button aria-label="Iniciar" title="Iniciar" disabled={snapshot.status === 'running' || snapshot.status === 'completed'} onClick={start}><Play aria-hidden="true" /></Button>
        {timer.kind === 'advisory' ? <Button ref={resetControl} aria-label="Desactivar" title="Desactivar" onClick={() => store.deactivate(timer.id)}><Square aria-hidden="true" /></Button> : <>
          <Button aria-label="Pausar" title="Pausar" disabled={snapshot.status !== 'running'} onClick={() => store.pause(timer.id)}><Pause aria-hidden="true" /></Button>
          <Button ref={resetControl} aria-label="Reiniciar" title="Reiniciar" onClick={() => store.reset(timer.id)}><Square aria-hidden="true" /></Button>
        </>}
      </div>
    </div>
    {timer.kind !== 'tzero' && <Input aria-label="Duración inicial" title="Duración inicial (hh:mm:ss)"
      className="technical-data timer-duration" inputMode="numeric" maxLength={8} placeholder="00:00:00"
      disabled={timer.status !== 'idle'} value={durationText} onBlur={normalize} onChange={event => {
        if (/^(?:[0-9]{0,6}|[0-9]{0,2}(?::[0-9]{0,2}){1,2})$/.test(event.target.value)) setDurationText(event.target.value)
      }} />}
  </div>
}
