import { useEffect, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { spanishClock } from './timerEngine'
import { TimerRow } from './TimerRow'
import type { TimerStore } from './timerStore'
import './clock.css'

// Implementation parameter; the V1 exposes no frequency setting.
export const ALARM_FLASH_HZ = 2
export function ClockModule({ store }: { store: TimerStore }) {
  const { timers, now, ready, storageUnavailable } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const alarm = useSyncExternalStore(store.alarm.subscribe, store.alarm.getSnapshot)
  const clock = spanishClock(now)
  useEffect(() => () => store.alarm.stopPreview(), [store])
  return <div className="clock-module" style={{ '--alarm-cycle': `${1 / ALARM_FLASH_HZ}s` } as CSSProperties}>
    <div className="tactical-clock">
      <div className="clock-reference"><span className={clock.season === 'ST' ? 'clock-season-active' : ''}>UTC+2 [ST]</span><b>ESP</b><span className={clock.season === 'WT' ? 'clock-season-active' : ''}>UTC+1 [WT]</span></div>
      <output className="technical-data clock-esp" aria-label="Hora española">{clock.esp}</output>
      <div className="clock-zulu"><span>ZULU · UTC</span><output className="technical-data" aria-label="Hora Zulu">{clock.zulu}</output></div>
    </div>
    <div className="clock-add-controls">
      <Button disabled={!ready} onClick={() => store.add('tzero')}>[+] T-Zero</Button>
      <Button disabled={!ready} onClick={() => store.add('tminus')}>[+] T-Minus</Button>
      <Button disabled={!ready} onClick={() => store.add('advisory')}>[+] Advisories</Button>
    </div>
    <Button aria-label="Probar sonido" className="clock-preview document-button" disabled={alarm.activeCount > 0} aria-pressed={alarm.preview}
      onClick={() => { if (alarm.preview) store.alarm.stopPreview(); else void store.alarm.startPreview() }}>
      <span aria-hidden="true">{alarm.preview ? '⏸' : '▶'}</span> Probar sonido
    </Button>
    {alarm.error && <Alert>{alarm.error}{alarm.error === 'Sonido bloqueado' && <Button onClick={() => { void store.alarm.activateSound() }}>Activar sonido</Button>}</Alert>}
    {storageUnavailable && <Alert>Autoguardado no disponible <Button onClick={() => { void store.retryPersistence() }}>Reintentar</Button></Alert>}
    <div className="timer-list">{timers.map((timer, position) => <TimerRow key={timer.id} timer={timer}
      index={timers.slice(0, position + 1).filter(previous => previous.kind === timer.kind).length} now={now} store={store} />)}</div>
  </div>
}
