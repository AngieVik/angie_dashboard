import { useEffect, useState } from 'react'
import type { ForecastWarningDetails } from './forecastTypes'

export function useForecastWarning(slug: string, day: string | null, expectedDay: number | null, active: boolean, forecastRevision: string) {
  const path = active && day && expectedDay ? `${slug}/warnings/${day}?day=${expectedDay}` : null
  const key = path ? path + ':' + forecastRevision : null
  const [result, setResult] = useState<{ key: string; data: ForecastWarningDetails | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!key || !path) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/forecast/' + path, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
        const body = await response.json() as ForecastWarningDetails & { error?: string }
        if (!response.ok) throw new Error(body.error || 'No se pudo obtener el detalle del aviso.')
        if (!Array.isArray(body.items) || !body.retrievedAt || !body.date) throw new Error('El detalle recibido está incompleto.')
        if (!controller.signal.aborted) setResult({ key: key!, data: body, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: key!, data: null, error: error instanceof Error && error.name === 'Error' ? error.message : 'No se pudo conectar con el detalle de AEMET.' })
      }
    }
    void load()
    return () => controller.abort()
  }, [key, path])
  return { data: key && result?.key === key ? result.data : null, error: key && result?.key === key ? result.error : null,
    loading: Boolean(key && result?.key !== key) }
}
