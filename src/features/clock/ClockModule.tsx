import { useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Watch, RotateCcwClock, AlarmClock, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { referenceClock } from './timerEngine'
import { DEFAULT_TIME_ZONE, timeZoneCity, utcOffsetLabel } from '@/platform/timeZones'
import { useSettings } from '../settings/useSettings'
import { TimerRow } from './TimerRow'
import { ModuleSizeContext } from '../../layout/ModuleSizeContext'
import type { TimerKind } from './timerTypes'
import type { TimerStore } from './timerStore'
import styles from './clock.module.css'

// Implementation parameter; the V1 exposes no frequency setting.
export const ALARM_FLASH_HZ = 2
export function ClockModule({ store }: { store: TimerStore }) {
  const { timers, now, ready, storageConflict, recoveryGeneration } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const alarm = useSyncExternalStore(store.alarm.subscribe, store.alarm.getSnapshot)
  const { settings } = useSettings()
  const timeZone = settings.location?.timeZone ?? DEFAULT_TIME_ZONE
  const clock = referenceClock(now, timeZone), offset = utcOffsetLabel(now, timeZone)
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
    const availableHeight = node.clientHeight
    node.dataset.sizing = 'true'
    try {
      const height = node.scrollHeight
      if (collect || height > availableHeight) requestSpace({ width: 0, height })
    } finally { delete node.dataset.sizing }
  }, [timers.length, requestSpace])
  useEffect(() => () => store.alarm.stopPreview(), [store])
  return <div ref={root} data-slot="clock-module" className={`${styles.base} clock-module`} style={{ '--alarm-cycle': `${1 / ALARM_FLASH_HZ}s` } as CSSProperties}>
    <div className="clock-display">
      <div className="clock-reference"><span className="clock-season-active" aria-label={offset}><span className="clock-label-full" aria-hidden="true">{offset}</span><span className="clock-label-short" aria-hidden="true">{offset.replace('UTC', '')}</span></span><span aria-label={timeZone}>{timeZoneCity(timeZone)}</span></div>
      <div className="clock-top">
        <div className="clock-face technical-data">
          <output className="clock-esp" aria-label="Hora de referencia">
            <span>{clock.local.slice(0, 2)}</span><span className="clock-separator">:</span><span>{clock.local.slice(3, 5)}</span><span className="clock-separator">:</span><span>{clock.local.slice(6, 8)}</span>
          </output>
        </div>
      </div>
      <div className="clock-add-controls">
        <Button appearance="integrated" aria-label="T-Zero" disabled={!ready || storageConflict} onClick={() => addTimer('tzero')}><Watch aria-hidden="true" /></Button>
        <Button appearance="integrated" aria-label="T-Minus" disabled={!ready || storageConflict} onClick={() => addTimer('tminus')}><RotateCcwClock aria-hidden="true" /></Button>
        <div className="clock-zulu technical-data"><span className="clock-zulu-label" aria-label="Zulu Time"><span className="clock-label-full" aria-hidden="true">Zulu Time</span><span className="clock-label-short" aria-hidden="true">ZT</span></span>{' '}
          <output aria-label="Hora Zulu">{clock.zulu}</output>
        </div>
        <Button appearance="integrated" aria-label="Advisories" disabled={!ready || storageConflict} onClick={() => addTimer('advisory')}><AlarmClock aria-hidden="true" /></Button>
        <Button appearance="integrated" variant="icon" aria-label={alarm.preview ? 'Detener prueba de sonido' : 'Reproducir prueba de sonido'} className="clock-preview" disabled={alarm.activeCount > 0} aria-pressed={alarm.preview}
          onClick={() => { if (alarm.preview) store.alarm.stopPreview(); else void store.alarm.startPreview() }}>
          {alarm.preview ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      </div>
    </div>
    <div className="timer-list">{timers.map((timer, position) => <TimerRow key={`${recoveryGeneration}:${timer.id}`} timer={timer}
      index={timers.slice(0, position + 1).filter(previous => previous.kind === timer.kind).length} now={now} store={store} disabled={storageConflict} />)}</div>
  </div>
}
