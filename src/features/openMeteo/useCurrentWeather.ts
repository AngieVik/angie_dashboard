import { useEffect, useState } from 'react'
import { loadCurrentWeather, weatherPointKey } from './openMeteo'
import type { CurrentWeather, WeatherPoint } from './openMeteo'

export function useCurrentWeather(point: WeatherPoint | null, revision: number, online: boolean) {
  const pointKey = point ? weatherPointKey(point) : null, key = `${pointKey ?? ''}:${revision}`
  const [result, setResult] = useState<{ key: string; pointKey: string; data: CurrentWeather | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!point || !pointKey || !online) return
    const controller = new AbortController()
    void loadCurrentWeather(point, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, pointKey, data, error: null })
    }).catch(error => {
      if (controller.signal.aborted) return
      setResult(previous => ({ key, pointKey, data: previous?.pointKey === pointKey ? previous.data : null,
        error: error instanceof Error && error.name === 'Error' ? error.message : 'No se pudo conectar con Open-Meteo.' }))
    })
    return () => controller.abort()
  }, [point, pointKey, key, online])
  return { data: pointKey && result?.pointKey === pointKey ? result.data : null, error: result?.key === key ? result.error : null,
    loading: Boolean(point && online && result?.key !== key) }
}
