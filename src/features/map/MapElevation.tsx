import { useEffect, useState } from 'react'
import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import { lookupMapElevation } from './terrainElevation'

type ElevationResult = { point: GeographicCoordinate } & (
  { status: 'ready'; elevation: number } | { status: 'empty' | 'error' }
)

export function MapElevation({ point }: { point: GeographicCoordinate }) {
  const [result, setResult] = useState<ElevationResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const elevation = await lookupMapElevation(point, controller.signal)
        if (!controller.signal.aborted) setResult(elevation === null ? { point, status: 'empty' } : { point, status: 'ready', elevation })
      } catch {
        if (!controller.signal.aborted) setResult({ point, status: 'error' })
      }
    }
    // Rapid selections only query the point the user settles on.
    const timer = setTimeout(() => { void load() }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [point])

  // Hide the previous point's result immediately, before effect cleanup runs.
  const current = result?.point === point ? result : null
  const text = current === null ? 'Consultando…' : current.status === 'ready' ?
    current.elevation.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' m' :
    current.status === 'empty' ? 'Sin datos' : 'Consulta no disponible'
  return <>
    <div><dt>Altitud del terreno</dt><dd role="status" aria-label="Altitud del terreno">{text}</dd></div>
    <div><dt>Fuente</dt><dd><a href="https://pnoa.ign.es/pnoa-lidar/modelo-digital-del-terreno" target="_blank" rel="noopener noreferrer">IGN/CNIG · MDT05</a></dd></div>
  </>
}
