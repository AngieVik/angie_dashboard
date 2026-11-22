import { useEffect, useState, type RefObject } from 'react'
import type * as L from 'leaflet'
import proj4 from 'proj4'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { MapOverlay } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { MAP_OVERLAYS, overlayLayer, validateOverlay } from './mapOverlays'

export function ActiveOverlay({ mapRef, source, onError }: { mapRef: RefObject<L.Map | null>; source: MapOverlay; onError: (name: string) => void }) {
  const { id, type, name, url, layer, matrix, style, format, opacity } = source
  const [tiles, setTiles] = useState<L.TileLayer | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const tile = overlayLayer(map, { id, name, type, url, layer, matrix, style, format, opacity: 100, active: true })
    const failed = () => onError(name)
    tile.once('tileerror', failed).addTo(map)
    setTiles(tile)
    return () => { tile.off('tileerror', failed); tile.remove() }
  }, [mapRef, id, type, url, layer, name, matrix, style, format, onError])
  useEffect(() => { tiles?.setOpacity(opacity / 100) }, [tiles, opacity])
  return null
}
const blank = { name: '', url: '', layer: '', matrix: 'GoogleMapsCompatible', style: '', format: 'image/png' }
export function MapOverlaysPanel({ sources, save }: { sources: readonly MapOverlay[]; save: (sources: MapOverlay[]) => boolean }) {
  const [type, setType] = useState<MapOverlay['type']>('WMS'), [draft, setDraft] = useState(blank), [error, setError] = useState('')
  const update = (id: string, patch: Partial<MapOverlay>) => save(sources.map(source => source.id === id ? { ...source, ...patch } : source))
  function field(key: keyof typeof blank, title: string, required = false) {
    return <label>{title}<input value={draft[key]} required={required} maxLength={INPUT_BUDGETS.coordinateCharacters}
      onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>
  }
  return <><strong>Superposiciones · EPSG:3857</strong>
    {sources.map(source => <div key={source.id}><label><input type="checkbox" checked={source.active} onChange={e => update(source.id, { active: e.target.checked })} />{source.name}</label>
      {source.active && <><output>{source.opacity} %</output><Slider label={'Opacidad de ' + source.name} min={0} max={100} step={1} value={source.opacity} onValueChange={opacity => update(source.id, { opacity })} /></>}
      {!MAP_OVERLAYS.some(item => item.id === source.id) && <Button aria-label={'Retirar ' + source.name} onClick={() => save(sources.filter(item => item !== source))}>Retirar</Button>}
    </div>)}
    <details><summary>Añadir servicio</summary><form onSubmit={event => {
      event.preventDefault()
      const source = { ...draft, url: draft.url.trim(), id: crypto.randomUUID(), type, opacity: 100, active: true }
      try { validateOverlay(source); if (save([...sources, source])) { setDraft(blank); setError('') } }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Servicio no válido.') }
    }}>
      <label>Servicio<select value={type} onChange={e => setType(e.target.value as MapOverlay['type'])}><option>WMS</option><option>XYZ</option><option>WMTS</option></select></label>
      {field('name', 'Nombre', true)}{field('url', 'URL o plantilla', true)}
      {type !== 'XYZ' && <>{field('layer', 'Capa', type === 'WMS')}{field('style', 'Estilo')}{field('format', 'Formato de imagen')}</>}
      {type === 'WMTS' && field('matrix', 'Matriz Web Mercator')}
      <Button type="submit">Añadir</Button>{error && <span role="alert">{error}</span>}
    </form></details></>
}

export function CoordinateTransform() {
  const [from, setFrom] = useState('4326'), [to, setTo] = useState('3857'), [x, setX] = useState(''), [y, setY] = useState('')
  const [result, setResult] = useState('')
  function definition(value: string) {
    const code = value.trim().toUpperCase().replace(/^EPSG:/, '')
    if (/^258(?:2[89]|3[0-2])$/.test(code)) return '+proj=utm +zone=' + code.slice(-2) + ' +ellps=GRS80 +units=m +no_defs'
    return 'EPSG:' + code
  }
  return <details><summary>Transformar coordenadas</summary><form onSubmit={e => {
    e.preventDefault()
    try {
      const pair = [Number(x), Number(y)]
      if (!x.trim() || !y.trim() || !pair.every(Number.isFinite)) throw new Error()
      const output = proj4(definition(from), definition(to), pair)
      if (!output.every(Number.isFinite)) throw new Error()
      setResult(output.map(n => Number(n.toFixed(7))).join(', '))
    } catch { setResult('Comprueba los códigos EPSG y las coordenadas.') }
  }}>
    {([['EPSG de origen', from, setFrom], ['EPSG de destino', to, setTo], ['X / longitud', x, setX], ['Y / latitud', y, setY]] as const)
      .map(([name, value, set]) => <label key={name}>{name}<input required maxLength={INPUT_BUDGETS.coordinateCharacters} value={value} onChange={e => { set(e.target.value); setResult('') }} /></label>)}
    <Button type="submit">Convertir</Button><output>{result}</output>
  </form></details>
}

