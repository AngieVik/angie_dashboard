import * as L from 'leaflet'
import type { MapOverlay } from '@/domain/document/types'
import { PNOA_INFORMATION } from './mapBackgrounds'

export const MAP_OVERLAYS: readonly MapOverlay[] = [
  { id: 'ign-limites', name: 'Límites administrativos IGN', type: 'WMS', url: 'https://www.ign.es/wms-inspire/unidades-administrativas',
    layer: 'AU.AdministrativeBoundary', active: false, opacity: 100 },
  { id: 'ign-base-wmts', name: 'Mapa base IGN (WMTS)', type: 'WMTS', url: 'https://www.ign.es/wmts/ign-base',
    layer: 'IGNBaseTodo', matrix: 'GoogleMapsCompatible', format: 'image/jpeg', active: false, opacity: 100 },
  { id: 'ign-toponimia', name: 'Información IGNBaseOrto', type: 'XYZ', url: PNOA_INFORMATION.url, active: false, opacity: 100 },
]

function tileTemplate(source: MapOverlay) {
  if (source.type === 'XYZ') return source.url
  if (/\{Tile(?:Matrix|Col|Row)\}/i.test(source.url)) {
    return source.url.replace(/\{TileMatrixSet\}/gi, encodeURIComponent(source.matrix ?? 'GoogleMapsCompatible'))
      .replace(/\{TileMatrix\}/gi, '{z}').replace(/\{TileCol\}/gi, '{x}').replace(/\{TileRow\}/gi, '{y}')
      .replace(/\{Style\}/gi, encodeURIComponent(source.style || 'default')).replace(/\{Layer\}/gi, encodeURIComponent(source.layer ?? ''))
  }
  const url = new URL(source.url)
  const params = { SERVICE: 'WMTS', REQUEST: 'GetTile', VERSION: '1.0.0', LAYER: source.layer ?? '', STYLE: source.style || 'default',
    FORMAT: source.format || 'image/png', TILEMATRIXSET: source.matrix || 'GoogleMapsCompatible', TILEMATRIX: '{z}', TILECOL: '{x}', TILEROW: '{y}' }
  for (const key of [...url.searchParams.keys()]) if (Object.hasOwn(params, key.toUpperCase())) url.searchParams.delete(key)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.href.replace(/%7B([xyz])%7D/gi, '{$1}')
}

export function validateOverlay(source: MapOverlay) {
  const url = new URL(source.url)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Introduce una URL HTTPS válida.')
  if (!source.name.trim()) throw new Error('Escribe un nombre para la capa.')
  if (source.type === 'WMS' && !source.layer?.trim()) throw new Error('Introduce el nombre de la capa WMS.')
  if (source.type === 'WMTS' && !source.layer?.trim() && !/\{TileMatrix\}/i.test(source.url)) throw new Error('Introduce la capa WMTS o su plantilla de teselas.')
  if (source.type !== 'WMS') {
    const template = tileTemplate(source)
    if (!template.includes('{x}') || !template.includes('{z}') || !/\{-?y\}/.test(template) ||
      /[{}]/.test(template.replace(/\{(?:x|y|-y|z|s|r)\}/g, ''))) throw new Error('Comprueba los marcadores de columna, fila y nivel de la plantilla.')
  }
}

export function overlayLayer(map: L.Map, source: MapOverlay) {
  const paneName = 'cartographic-overlays'
  const pane = map.getPane(paneName) ?? map.createPane(paneName)
  pane.style.zIndex = '350'
  pane.style.pointerEvents = 'none'
  const options = { pane: paneName, opacity: source.opacity / 100,
    attribution: MAP_OVERLAYS.some(s => s.id === source.id) ? PNOA_INFORMATION.attribution : undefined }
  if (source.type !== 'WMS') return L.tileLayer(tileTemplate(source), options)
  const endpoint = new URL(source.url)
  for (const key of [...endpoint.searchParams.keys()]) {
    if (/^(request|version|layers?|styles?|service|crs|srs|bbox|width|height|format|transparent)$/i.test(key)) endpoint.searchParams.delete(key)
  }
  return L.tileLayer.wms(endpoint.href, { ...options, crs: L.CRS.EPSG3857, layers: source.layer, styles: source.style || '',
    transparent: true, format: source.format || 'image/png', version: '1.3.0' })
}

