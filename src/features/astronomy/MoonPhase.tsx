import { useMemo } from 'react'
import { useSettings } from '../settings/useSettings'
import { moonPhase } from './astronomy'
import { DEFAULT_TIME_ZONE } from '@/platform/timeZones'
import styles from './moonPhase.module.css'

export function MoonPhase({ day }: { day: string }) {
  const { settings } = useSettings()
  const timeZone = settings.location?.timeZone ?? DEFAULT_TIME_ZONE
  const moon = useMemo(() => moonPhase(day, timeZone), [day, timeZone])
  const sweep = moon.waxing ? 1 : 0
  const terminator = Math.abs(1 - 2 * moon.fraction) * 9
  const path = `M 12 3 A 9 9 0 0 ${sweep} 12 21 A ${Math.max(0.001, terminator)} 9 0 0 ${moon.fraction < 0.5 ? 1 - sweep : sweep} 12 3 Z`
  return <div className={styles.base} data-slot="moon-phase" aria-label={`Fase lunar: ${moon.name}, ${Math.round(moon.fraction * 100)} % iluminada`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d={path} /></svg>
    <span>{moon.name}</span><span className={styles.fraction}>{Math.round(moon.fraction * 100)} %</span>
  </div>
}
