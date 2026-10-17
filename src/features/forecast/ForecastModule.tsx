import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { HelpTooltip } from '../../components/ui/tooltip'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { ModuleSizeContext } from '../../layout/ModuleSizeContext'
import { AEMET_MUNICIPALITIES_URL, clearForecastLocation, readForecastLocation, writeForecastLocation } from './forecast'
import { loadMunicipalities, searchMunicipalities } from './municipalities'
import type { Municipality } from './municipalities'
import { ForecastTable } from './ForecastTable'
import { useForecast } from './useForecast'
import './forecast.css'

export function ForecastModule({ navigationKey }: { navigationKey: string }) {
  const fieldId = useId()
  const root = useRef<HTMLDivElement>(null)
  const options = useRef<HTMLDivElement>(null)
  const requestSpace = useContext(ModuleSizeContext)
  const requestSpaceRef = useRef(requestSpace)
  const { blocked, blockedRef } = useViewportInteraction()
  const [location, setLocation] = useState(() => readForecastLocation(navigationKey))
  const [municipalities, setMunicipalities] = useState<Municipality[] | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const selected = useMemo(() => municipalities?.find(municipality => location?.endsWith('/' + municipality.slug)), [municipalities, location])
  const input = query ?? selected?.name ?? ''
  const suggestions = useMemo(() => searchMunicipalities(municipalities ?? [], input), [municipalities, input])
  const showSuggestions = expanded && !blocked && input.trim().length > 0 && municipalities !== null
  const activeSuggestion = suggestions[activeIndex]
  const slug = location?.slice(location.lastIndexOf('/') + 1) ?? null
  const forecast = useForecast(slug, online)
  const formatDate = (value: string) => new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })

  useLayoutEffect(() => { requestSpaceRef.current = requestSpace }, [requestSpace])
  const fitContent = useCallback(() => {
    const node = root.current
    if (!node || node.closest<HTMLElement>('.module-content')?.hidden) return
    // Measure the table itself, rather than the flexible area that anchors the footer.
    const height = [...node.children].reduce((sum, child) => {
      if (!(child instanceof HTMLElement) || child.hidden) return sum
      return sum + (child.classList.contains('forecast-view') ? child.querySelector('table')?.offsetHeight ?? 0 : child.offsetHeight)
    }, 0)
    if (height) requestSpaceRef.current({ width: 0, height }, { fitHeight: true })
  }, [])
  useLayoutEffect(() => { fitContent() }, [fitContent, forecast.data, forecast.error, forecast.loading, online, error, location])

  useLayoutEffect(() => {
    const list = options.current, option = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!showSuggestions || !list || !option) return
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
  }, [showSuggestions, activeSuggestion])

  useEffect(() => {
    let cancelled = false
    void loadMunicipalities().then(value => { if (!cancelled) setMunicipalities(value) })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el catálogo local de municipios.') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  function selectMunicipality(municipality: Municipality) {
    if (blockedRef.current) return
    const next = AEMET_MUNICIPALITIES_URL + '/' + municipality.slug
    writeForecastLocation(navigationKey, next)
    setLocation(next); setQuery(null); setExpanded(false); setActiveIndex(0); setError(null)
  }

  return <div ref={root} className="forecast-module">
    <div className="forecast-toolbar">
      <label htmlFor={fieldId}>Municipio</label>
      <div className="forecast-search">
        <Input id={fieldId} role="combobox" aria-autocomplete="list" autoComplete="off" value={input} placeholder={municipalities ? 'Buscar municipio' : 'Cargando municipios…'}
          aria-expanded={showSuggestions} aria-controls={fieldId + '-options'} aria-activedescendant={showSuggestions && activeSuggestion ? fieldId + '-' + activeSuggestion.slug : undefined}
          aria-invalid={Boolean(error)} aria-describedby={error ? fieldId + '-error' : undefined} disabled={blocked || !municipalities}
          onFocus={() => { if (!blockedRef.current) setExpanded(true) }} onBlur={() => setExpanded(false)}
          onChange={event => { if (!blockedRef.current) { setQuery(event.target.value); setExpanded(true); setActiveIndex(0) } }}
          onKeyDown={event => {
            if (blockedRef.current) return
            if (event.key === 'Escape') { event.preventDefault(); setExpanded(false) }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setExpanded(true)
              setActiveIndex(index => !showSuggestions ? 0 : Math.max(0, Math.min(suggestions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && showSuggestions && activeSuggestion) { event.preventDefault(); selectMunicipality(activeSuggestion) }
          }} />
        {showSuggestions && <div ref={options} id={fieldId + '-options'} role="listbox" aria-label="Municipios" className="forecast-suggestions">
          {suggestions.length ? suggestions.map((municipality, index) => <div key={municipality.slug} id={fieldId + '-' + municipality.slug} role="option"
            aria-selected={activeIndex === index} className="forecast-suggestion" onPointerDown={event => event.preventDefault()}
            onClick={() => selectMunicipality(municipality)}>
            <span>{municipality.name}</span><span className="forecast-province">{municipality.province}</span>
          </div>) : <p className="forecast-message" role="status">Sin coincidencias.</p>}
        </div>}
      </div>
      <HelpTooltip text="Actualizar pronóstico"><Button className="forecast-action" aria-label="Actualizar pronóstico" disabled={blocked || !location || !online || forecast.loading}
        onClick={() => { if (!blockedRef.current) forecast.refresh() }}><RefreshCw aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text="Quitar municipio"><Button className="forecast-action" aria-label="Quitar municipio" disabled={blocked || (!location && !input)} onClick={() => {
        if (blockedRef.current) return
        clearForecastLocation(navigationKey); setLocation(null); setQuery(''); setExpanded(false); setActiveIndex(0)
      }}><X aria-hidden="true" /></Button></HelpTooltip>
    </div>
    {error && <p id={fieldId + '-error'} className="forecast-message" role="alert">{error}</p>}
    {forecast.error && <p className="forecast-message" role="alert">{forecast.error}</p>}
    {location && (!online || forecast.data?.stale || (forecast.error && forecast.data)) && <p className="forecast-message" role="status">
      {!online ? 'Sin conexión.' : 'No se pudo actualizar.'} {forecast.data ? 'Se muestra una consulta anterior.' : 'El pronóstico necesita conexión.'}</p>}
    {forecast.loading && <p className="forecast-message" role="status">Consultando AEMET…</p>}
    {!location ? <p className="forecast-message">Selecciona un municipio.</p> : forecast.data &&
      <div className="forecast-view" role="region" aria-label="Tabla de pronóstico" tabIndex={0}><ForecastTable key={slug} data={forecast.data} onContentChange={fitContent} /></div>}
    {location && <div className="forecast-footer">
      <a className="forecast-source" href={forecast.data?.sourceUrl ?? location} target="_blank" rel="noopener noreferrer" aria-disabled={blocked} tabIndex={blocked ? -1 : 0}
        onClick={event => { if (blockedRef.current) event.preventDefault() }}>{selected ? selected.name + (selected.name === selected.province ? '' : ' · ' + selected.province) + ' · © AEMET' : '© AEMET'}</a>
      {forecast.data && <div className="forecast-dates">
        <span title="Fecha HTTP Last-Modified del widget oficial; no es la fecha de elaboración del modelo.">Web AEMET: {forecast.data.resourceUpdatedAt ? formatDate(forecast.data.resourceUpdatedAt) : 'actualización no indicada'}</span>
        <span>Consulta: {formatDate(forecast.data.retrievedAt)}</span>
      </div>}
    </div>}
  </div>
}
