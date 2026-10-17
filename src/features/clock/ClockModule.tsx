import { useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Watch, RotateCcwClock, AlarmClock, Play, Pause } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { spanishClock } from './timerEngine'
import { TimerRow } from './TimerRow'
import { ModuleSizeContext } from '../../layout/ModuleSizeContext'
import type { TimerKind } from './timerTypes'
import type { TimerStore } from './timerStore'
import './clock.css'

// Implementation parameter; the V1 exposes no frequency setting.
export const ALARM_FLASH_HZ = 2
export function ClockModule({ store }: { store: TimerStore }) {
  const { timers, now, ready, storageUnavailable, storageConflict, recoveryGeneration } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const alarm = useSyncExternalStore(store.alarm.subscribe, store.alarm.getSnapshot)
  const clock = spanishClock(now)
  const root = useRef<HTMLDivElement>(null), expandPending = useRef(false)
  const previousCount = useRef(timers.length)
  const requestSpace = useContext(ModuleSizeContext)
  function addTimer(kind: TimerKind) { expandPending.current = true; store.add(kind) }
  useLayoutEffect(() => {
    const collect = timers.length < previousCount.current, expand = expandPending.current
    previousCount.current = timers.length
    expandPending.current = false
    const node = root.current
    if ((!expand && !collect) || !node) return
    node.dataset.sizing = 'true'
    try {
      const height = node.scrollHeight
      if (collect) requestSpace({ width: 0, height }, { fitHeight: true })
      else requestSpace({ width: 300, height })
    } finally { delete node.dataset.sizing }
  }, [timers.length, requestSpace])
  useEffect(() => () => store.alarm.stopPreview(), [store])
  return <div ref={root} className="clock-module" style={{ '--alarm-cycle': `${1 / ALARM_FLASH_HZ}s`, '--clock-timer-count': timers.length } as CSSProperties}>
    <div className="clock-display">
      <div className="clock-reference"><span className="clock-season-active" aria-label="UTC+2 [ST]" title="UTC+2 [ST]"><span className="clock-label-full" aria-hidden="true">UTC+2 [ST]</span><span className="clock-label-short" aria-hidden="true">2ST</span></span><span>ESP</span></div>
      <div className="clock-top">
        <div className="clock-face technical-data">
          <output className="clock-esp" aria-label="Hora española">
            <span>{clock.esp.slice(0, 2)}</span><span className="clock-separator">:</span><span>{clock.esp.slice(3, 5)}</span><span className="clock-separator">:</span><span>{clock.esp.slice(6, 8)}</span>
          </output>
        </div>
      </div>
      <div className="clock-add-controls">
        <Button aria-label="T-Zero" title="T-Zero" disabled={!ready || storageConflict} onClick={() => addTimer('tzero')}><Watch aria-hidden="true" /></Button>
        <Button aria-label="T-Minus" title="T-Minus" disabled={!ready || storageConflict} onClick={() => addTimer('tminus')}><RotateCcwClock aria-hidden="true" /></Button>
        <div className="clock-zulu technical-data"><span className="clock-zulu-label" aria-label="Zulu Time" title="Zulu Time"><span className="clock-label-full" aria-hidden="true">Zulu Time</span><span className="clock-label-short" aria-hidden="true">ZT</span></span>{' '}
          <output aria-label="Hora Zulu">{clock.zulu}</output>
        </div>
        <Button aria-label="Advisories" title="Advisories" disabled={!ready || storageConflict} onClick={() => addTimer('advisory')}><AlarmClock aria-hidden="true" /></Button>
        <Button aria-label={alarm.preview ? 'Detener prueba de sonido' : 'Reproducir prueba de sonido'} className="clock-preview document-button" disabled={alarm.activeCount > 0} aria-pressed={alarm.preview}
          onClick={() => { if (alarm.preview) store.alarm.stopPreview(); else void store.alarm.startPreview() }}>
          {alarm.preview ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      </div>
    </div>
    {alarm.error && <Alert>{alarm.error}{alarm.error === 'Sonido bloqueado' && <Button onClick={() => { void store.alarm.activateSound() }}>Activar sonido</Button>}</Alert>}
    {storageUnavailable && <Alert>{storageConflict ? 'Otra pestaña ha cambiado los temporizadores. Recargar sustituirá los cambios locales pendientes.' : 'Autoguardado no disponible'} <Button onClick={() => { void store.retryPersistence() }}>{storageConflict ? 'Recargar temporizadores' : 'Reintentar'}</Button></Alert>}
    <div className="timer-list">{timers.map((timer, position) => <TimerRow key={`${recoveryGeneration}:${timer.id}`} timer={timer}
      index={timers.slice(0, position + 1).filter(previous => previous.kind === timer.kind).length} now={now} store={store} disabled={storageConflict} />)}</div>
  </div>
}
