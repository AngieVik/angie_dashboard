import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Watch, RotateCcwClock, AlarmClock, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_TIMER_COUNT, referenceClock } from './timerEngine'
import { DEFAULT_TIME_ZONE, timeZoneCity, utcOffsetLabel } from '@/platform/timeZones'
import { useSettings } from '../settings/useSettings'
import type { FormatPreferences } from '../settings/formatPreferences'
import { TimerRow } from './TimerRow'
import { ModuleSizeContext } from '../../layout/ModuleSizeContext'
import type { TimerKind } from './timerTypes'
import type { TimerStore } from './timerStore'
import styles from './clock.module.css'

// Implementation parameter; the V1 exposes no frequency setting.
const ALARM_FLASH_HZ = 2
export function ClockModule({ store }: { store: TimerStore }) {
  const { timers, ready, storageConflict, recoveryGeneration } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { settings } = useSettings()
  const timeZone = settings.location?.timeZone ?? DEFAULT_TIME_ZONE
  const numberedTimers = useMemo(() => {
    const counts: Record<TimerKind, number> = { tzero: 0, tminus: 0, advisory: 0 }
    return timers.map(timer => ({ timer, index: ++counts[timer.kind] }))
  }, [timers])
  const list = useRef<HTMLDivElement>(null)
  const previousList = useRef<{ count: number; height: number } | null>(null)
  const requestSpace = useContext(ModuleSizeContext)
  function addTimer(kind: TimerKind) {
    if (timers.length >= MAX_TIMER_COUNT) return
    store.add(kind)
  }
  useLayoutEffect(() => {
    const node = list.current
    if (!ready || !node) return
    const previous = previousList.current
    const count = timers.length
    const height = node.scrollHeight
    previousList.current = { count, height }
    if (previous && previous.count !== count) requestSpace({ timerHeightDelta: height - previous.height })
    // Track the rendered rows at the current width, font size and zoom.
    const observer = new ResizeObserver(() => {
      previousList.current = { count, height: node.scrollHeight }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [timers.length, ready, requestSpace])
  useEffect(() => () => store.alarm.stopPreview(), [store])
  return <div data-slot="clock-module" data-time-format={settings.formats.time} className={`${styles.base} clock-module`} style={{ '--alarm-cycle': `${1 / ALARM_FLASH_HZ}s` } as CSSProperties}>
    <ClockDisplay store={store} timeZone={timeZone} timeFormat={settings.formats.time}
      disabled={!ready || storageConflict || timers.length >= MAX_TIMER_COUNT} addTimer={addTimer} />
    <div ref={list} className="timer-list">{numberedTimers.map(({ timer, index }) => <TimerRow key={`${recoveryGeneration}:${timer.id}`} timer={timer}
      index={index} store={store} disabled={storageConflict} />)}</div>
  </div>
}

function ClockDisplay({ store, timeZone, timeFormat, disabled, addTimer }: {
  store: TimerStore; timeZone: string; timeFormat: FormatPreferences['time']; disabled: boolean; addTimer: (kind: TimerKind) => void
}) {
  const now = useSyncExternalStore(store.subscribeTime, store.getReferenceSecond)
  const alarm = useSyncExternalStore(store.alarm.subscribe, store.alarm.getSnapshot)
  const clock = referenceClock(now, timeZone, timeFormat), offset = utcOffsetLabel(now, timeZone)
  return <div className="clock-display">
      <div className="clock-reference"><span className="clock-season-active" aria-label={offset}><span className="clock-label-full" aria-hidden="true">{offset}</span><span className="clock-label-short" aria-hidden="true">{offset.replace('UTC', '')}</span></span><span aria-label={timeZone}>{timeZoneCity(timeZone)}</span></div>
      <div className="clock-top">
        <div className="clock-face technical-data">
          <output className="clock-esp" aria-label="Hora de referencia">
            <span>{clock.local.slice(0, 2)}</span><span className="clock-separator">:</span><span>{clock.local.slice(3, 5)}</span><span className="clock-separator">:</span><span>{clock.local.slice(6, 8)}</span>{clock.local.length > 8 && <span className="clock-period">{clock.local.slice(9)}</span>}
          </output>
        </div>
      </div>
      <div className="clock-add-controls">
        <Button appearance="integrated" aria-label="T-Zero" disabled={disabled} onClick={() => addTimer('tzero')}><Watch aria-hidden="true" /></Button>
        <Button appearance="integrated" aria-label="T-Minus" disabled={disabled} onClick={() => addTimer('tminus')}><RotateCcwClock aria-hidden="true" /></Button>
        <div className="clock-zulu technical-data"><span className="clock-zulu-label" aria-label="Zulu Time"><span className="clock-label-full" aria-hidden="true">ZULU TIME</span><span className="clock-label-short" aria-hidden="true">ZT</span></span>
          <output aria-label="Hora Zulu">{clock.zulu}</output>
        </div>
        <Button appearance="integrated" aria-label="Advisories" disabled={disabled} onClick={() => addTimer('advisory')}><AlarmClock aria-hidden="true" /></Button>
        <Button appearance="integrated" variant="icon" aria-label={alarm.preview ? 'Detener prueba de sonido' : 'Reproducir prueba de sonido'} className="clock-preview" disabled={alarm.activeCount > 0} aria-pressed={alarm.preview}
          onClick={() => { if (alarm.preview) store.alarm.stopPreview(); else void store.alarm.startPreview() }}>
          {alarm.preview ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      </div>
    </div>
}
