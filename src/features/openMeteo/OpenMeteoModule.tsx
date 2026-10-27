import { useEffect, useId, useLayoutEffect, useState } from 'react'
import { ArrowDownToLine, Search, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'
import { HelpTooltip } from '@/components/ui/tooltip'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { toGeographic } from '../coordinates/convertCoordinate'
import { clearWeatherPoint, readWeatherPoint, writeWeatherPoint } from './openMeteo'
import { useCurrentWeather } from './useCurrentWeather'
import type { CurrentWeatherReportSnapshot } from '../document/weatherReport'
import './openMeteo.css'

function number(value: number | null, digits = 1) { return value === null ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: digits }) }
function date(value: string, timeZone: string) {
  try { return new Date(value).toLocaleString('es-ES', { timeZone, dateStyle: 'short', timeStyle: 'short' }) }
  catch { return new Date(value).toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }) + ' UTC' }
}

export function OpenMeteoModule({ navigationKey, getCoordinatesInput, onReportChange }: { navigationKey: string; getCoordinatesInput: () => string; onReportChange?: (snapshot: CurrentWeatherReportSnapshot | null) => void }) {
  const id = useId(), { blocked, blockedRef } = useViewportInteraction()
  const [point, setPoint] = useState(() => readWeatherPoint(navigationKey))
  const [input, setInput] = useState(() => point ? `${point.latitude}, ${point.longitude}` : '')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0), [online, setOnline] = useState(() => navigator.onLine)
  const weather = useCurrentWeather(point, revision, online), data = weather.data
  const previous = !online || Boolean(weather.error || weather.loading)
  useLayoutEffect(() => { onReportChange?.(point ? { point, data, previous } : null) }, [point, data, previous, onReportChange])
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) setRevision(value => value + 1) }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  function consult() {
    if (blockedRef.current) return
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(parsed.error); return }
    const next = toGeographic(parsed.coordinate)
    writeWeatherPoint(navigationKey, next); setPoint(next); setInput(parsed.normalizedInput); setError(null); setRevision(value => value + 1)
  }
  function bringCoordinates() {
    if (blockedRef.current) return
    const value = getCoordinatesInput()
    if (!value.trim()) { setError('No hay una entrada en el módulo Coordenadas.'); return }
    setInput(value); setError(null)
  }
  const interval = data ? data.interval % 60 === 0 ? `${data.interval / 60} min` : `${data.interval} s` : ''
  return <div className="open-meteo-module">
    <form className="open-meteo-toolbar" onSubmit={event => { event.preventDefault(); consult() }}>
      <InputGroup className="open-meteo-entry">
        <Input id={id + '-input'} aria-label="Coordenadas de Open-Meteo" className="technical-data" value={input} placeholder="Coordenadas" autoComplete="off" spellCheck={false} disabled={blocked}
          aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} onChange={event => { if (!blockedRef.current) { setInput(event.target.value); setError(null) } }} />
        <HelpTooltip text="Consultar ubicación"><Button appearance="integrated" type="submit" className="open-meteo-action" aria-label="Consultar Open-Meteo por coordenadas" disabled={blocked || weather.loading}><Search aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Traer de Coordenadas"><Button appearance="integrated" className="open-meteo-action" aria-label="Traer entrada del módulo Coordenadas" disabled={blocked} onClick={bringCoordinates}><ArrowDownToLine aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Quitar ubicación"><Button appearance="integrated" className="open-meteo-action" aria-label="Quitar ubicación de Open-Meteo" disabled={blocked || (!point && !input)}
          onClick={() => { if (!blockedRef.current) { clearWeatherPoint(navigationKey); setPoint(null); setInput(''); setError(null) } }}><Trash aria-hidden="true" /></Button></HelpTooltip>
      </InputGroup>
    </form>
    <div className="open-meteo-body">
      {error && <p className="open-meteo-message" role="alert" id={id + '-error'}>{error}</p>}
      {point && <p className="open-meteo-location" title={data ? `Rejilla del modelo: ${data.grid.latitude}, ${data.grid.longitude}` : undefined}>Ubicación consultada: {number(point.latitude, 6)}, {number(point.longitude, 6)}</p>}
      {!point && <p className="open-meteo-message">Introduce una coordenada para consultar.</p>}
      {weather.loading && <p className="open-meteo-message" role="status">Consultando Open-Meteo…</p>}
      {weather.error && <p className="open-meteo-message" role="alert">{weather.error}</p>}
      {point && (!online || (weather.error && data)) && <p className="open-meteo-message" role="status">{!online ? 'Sin conexión.' : 'No se pudo actualizar.'} {data ? 'Se muestra una consulta anterior.' : 'La consulta necesita conexión.'}</p>}
      {data && <dl className="open-meteo-values">
        <div><dt>Temperatura<span>2 m</span></dt><dd>{number(data.temperature)}<span>°C</span></dd></div>
        <div><dt>Sensación térmica</dt><dd>{number(data.apparentTemperature)}<span>°C</span></dd></div>
        <div><dt>Lluvia<span>Con chubascos · últimos {interval}</span></dt><dd>{number(data.rain, 2)}<span>mm</span></dd></div>
        <div><dt>Humedad<span>2 m</span></dt><dd>{number(data.humidity, 0)}<span>%</span></dd></div>
        <div><dt>Viento<span>10 m</span></dt><dd>{number(data.windSpeed)}<span>km/h{data.windDirection !== null ? ' · ' + number(data.windDirection, 0) + '°' : ''}</span></dd></div>
      </dl>}
    </div>
    <footer className="open-meteo-footer">
      <p>Estimaciones de modelos meteorológicos; no son mediciones en ese punto.</p>
      {data && <div className="open-meteo-dates"><span>Dato: {date(data.validAt, data.timeZone)} · {data.timeZone}</span><span>Consulta: {date(data.retrievedAt, data.timeZone)}</span></div>}
      <div className="open-meteo-attribution">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" aria-disabled={blocked} tabIndex={blocked ? -1 : 0} onClick={event => { if (blockedRef.current) event.preventDefault() }}>Open-Meteo</a>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" aria-disabled={blocked} tabIndex={blocked ? -1 : 0} onClick={event => { if (blockedRef.current) event.preventDefault() }}>CC BY 4.0</a>
        <a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer" aria-disabled={blocked} tabIndex={blocked ? -1 : 0} onClick={event => { if (blockedRef.current) event.preventDefault() }}>Uso no comercial</a>
      </div>
    </footer>
  </div>
}
