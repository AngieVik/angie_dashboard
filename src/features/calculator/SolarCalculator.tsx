import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Columns3Cog, RefreshCw } from 'lucide-react'
import { useViewportInteraction } from '@/layout/ViewportContext'
import { DEFAULT_TIME_ZONE, timeZoneOptions, utcOffsetLabel } from '@/platform/timeZones'
import { formatSolarTime, solarDay, zonedDateKey, zonedNoon } from '../astronomy/astronomy'
import type { SolarEvent } from '../astronomy/astronomy'
import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import { useCoordinateTimeZone } from '../coordinates/useCoordinateTimeZone'
import { useSettings } from '../settings/useSettings'
import styles from './solarCalculator.module.css'

const rows: readonly [string, SolarEvent, SolarEvent][] = [
  ['Orto / Ocaso', 'sunrise', 'sunset'],
  ['Civil', 'dawn', 'dusk'],
  ['Náutico', 'nauticalDawn', 'nauticalDusk'],
  ['Astronómico', 'nightEnd', 'night'],
]

export type SolarZoneOverride = GeographicCoordinate & { timeZone: string }
export function SolarCalculator({ radarActive, radarPoint, selectedDay: day, zoneOverride, onZoneChange, toolbarContainer }: {
  radarActive: boolean; radarPoint: GeographicCoordinate | null; selectedDay: string
  zoneOverride: SolarZoneOverride | null; onZoneChange: (value: SolarZoneOverride | null) => void
  toolbarContainer: HTMLElement | null
}) {
  const { settings, ready, error } = useSettings()
  const { blocked } = useViewportInteraction()
  const [now, setNow] = useState(() => Date.now())
  const [editingZone, setEditingZone] = useState(false)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const receiving = radarActive && radarPoint !== null
  const point = receiving ? radarPoint : ready ? settings.location : null
  const latitude = point?.latitude, longitude = point?.longitude
  const automaticZone = useCoordinateTimeZone(receiving ? radarPoint : null)
  const manualZone = receiving && zoneOverride && zoneOverride.latitude === latitude && zoneOverride.longitude === longitude ? zoneOverride.timeZone : null
  const timeZone = receiving ? manualZone ?? automaticZone.timeZone : settings.location?.timeZone ?? DEFAULT_TIME_ZONE
  const today = timeZone ? zonedDateKey(now, timeZone) : null
  const dateLabel = day.split('-').reverse().join('/')
  const zoneOptions = useMemo(() => [{ value: 'auto', label: 'Automática' }, ...timeZoneOptions(timeZone ?? undefined)], [timeZone])
  const offset = useMemo(() => day && timeZone ? utcOffsetLabel(zonedNoon(day, timeZone), timeZone) : null, [day, timeZone])
  const zoneEditorVisible = receiving && (editingZone || Boolean(automaticZone.error && !manualZone))
  const sun = useMemo(() => day && timeZone && latitude !== undefined && longitude !== undefined ? solarDay(day, { latitude, longitude }, timeZone) : null, [day, latitude, longitude, timeZone])
  const sunset = sun?.events.sunset
  const remaining = sunset ? Math.max(0, Math.ceil((Number(sunset) - now) / 60_000)) : null
  const status = sun?.alwaysUp ? 'Sin ocaso: día polar' : sun?.alwaysDown ? 'Sin orto: noche polar' : remaining === null ? 'Sin ocaso este día' : remaining === 0 ? 'Ocaso finalizado' : `Ocaso en ${Math.floor(remaining / 60)} h ${remaining % 60} min`

  return <>
    {receiving && toolbarContainer && createPortal(<>
      {automaticZone.error && !manualZone && <Button aria-label="Reintentar zona automática" disabled={blocked} onClick={automaticZone.retry}><RefreshCw aria-hidden="true" /></Button>}
      <Button aria-label="Corregir zona horaria" aria-expanded={zoneEditorVisible} aria-pressed={zoneEditorVisible} disabled={blocked} onClick={() => setEditingZone(value => !value)}><Columns3Cog aria-hidden="true" /></Button>
    </>, toolbarContainer)}
    <section className={styles.base} data-slot="solar-calculator" data-time-zone={timeZone ?? undefined} aria-label="Sol y crepúsculos" data-minimum-scroll-content>
    <div className={styles.location}>
      <div className={styles.source} data-slot="solar-location">
        <strong>{receiving ? 'Coordenadas' : point ? settings.location?.name : ready ? 'Sin ubicación' : error ? 'Configuración no disponible' : 'Cargando ubicación…'}</strong>
        <em>{receiving ? 'Radar On' : radarActive ? 'Radar sin datos.' : 'Radar Off'}</em>
      </div>
      {point && <span className="technical-data">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</span>}
      {point && <div className={styles.zone}>
        <span aria-label={timeZone ? `${dateLabel}, ${offset}, ${manualZone ? 'zona manual' : 'zona'} ${timeZone}` : undefined}>
          <time dateTime={day}>{dateLabel}</time>{' · '}<span className={styles.offset}>{timeZone ? offset : automaticZone.loading ? 'Resolviendo zona…' : 'Zona sin resolver'}</span>
        </span>
      </div>}
      {zoneEditorVisible && <Select aria-label="Zona horaria del punto" value={manualZone ?? 'auto'} options={zoneOptions} disabled={blocked} onValueChange={value => {
        onZoneChange(value === 'auto' || !radarPoint ? null : { ...radarPoint, timeZone: value })
        if (value === 'auto' && automaticZone.error) automaticZone.retry()
      }} />}
    </div>
    {sun && timeZone && day && <>
      <table className={styles.times} aria-label="Horarios solares"><thead><tr><th scope="col">Sol / Crepúsculo</th><th scope="col">Mañana</th><th scope="col">Tarde</th></tr></thead><tbody>{rows.map(([name, morning, evening]) => <tr key={name}><th scope="row">{name}</th><td>{formatSolarTime(sun.events[morning], timeZone, day)}</td><td>{formatSolarTime(sun.events[evening], timeZone, day)}</td></tr>)}</tbody></table>
      {day === today && <p className={styles.status} role="status">{status}</p>}
    </>}
    </section>
  </>
}
