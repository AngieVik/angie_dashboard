import { useEffect, useState } from 'react'
import type { ForecastData } from './forecastTypes'

export function useForecast(slug: string | null, online: boolean) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; slug: string | null; data: ForecastData | null; error: string | null }>({ key: '', slug: null, data: null, error: null })
  const key = `${slug ?? ''}:${revision}`
  useEffect(() => {
    if (!slug || !online) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/forecast/' + encodeURIComponent(slug!), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]), cache: 'no-store' })
        const body = await response.json() as ForecastData & { error?: string }
        if (!response.ok) throw new Error(body.error || 'No se pudo obtener el pronóstico de AEMET.')
        if (!Array.isArray(body.days) || !Array.isArray(body.periods) || !Array.isArray(body.rows) || !body.retrievedAt) throw new Error('El servicio ha devuelto un pronóstico incompleto.')
        if (!controller.signal.aborted) setResult({ key, slug, data: body, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        setResult(previous => ({ key, slug, data: previous.slug === slug ? previous.data : null,
          error: error instanceof Error && error.name === 'Error' ? error.message : 'No se pudo conectar con el servicio de pronóstico.' }))
      }
    }
    void load()
    return () => controller.abort()
  }, [key, slug, online])
  return { data: result.slug === slug ? result.data : null, error: result.key === key ? result.error : null,
    loading: Boolean(slug && online && result.key !== key), refresh: () => setRevision(value => value + 1) }
}
