import { useCallback, useEffect, useState } from 'react'
import type { GeographicCoordinate } from './coordinateTypes'

export function useCoordinateTimeZone(point: GeographicCoordinate | null) {
  const latitude = point?.latitude, longitude = point?.longitude
  const key = point ? `${latitude},${longitude}` : null
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; attempt: number; timeZone: string | null; error: string | null } | null>(null)
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    if (latitude === undefined || longitude === undefined || key === null) return
    let cancelled = false
    void import('./timeZoneLookup').then(module => module.coordinateTimeZone({ latitude, longitude })).then(
      timeZone => { if (!cancelled) setResult({ key, attempt, timeZone, error: null }) },
      error => { if (!cancelled) setResult({ key, attempt, timeZone: null, error: error instanceof Error ? error.message : 'Zona horaria no disponible.' }) },
    )
    return () => { cancelled = true }
  }, [latitude, longitude, key, attempt])
  const current = key !== null && result?.key === key && result.attempt === attempt ? result : null
  return { timeZone: current?.timeZone ?? null, loading: key !== null && current === null, error: current?.error ?? null, retry }
}
