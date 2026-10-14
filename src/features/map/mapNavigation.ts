import { isMapBackground } from './mapBackgrounds'
import type { MapBackground } from './mapBackgrounds'

export interface MapView { latitude: number; longitude: number; zoom: number; background: MapBackground }
export const MAX_MAP_LATITUDE = 85.05112878

export function readMapView(key: string): MapView {
  try {
    const view = JSON.parse(localStorage.getItem('angie.map.' + key) ?? 'null') as MapView | null
    if (view && [view.latitude, view.longitude, view.zoom].every(Number.isFinite) && Math.abs(view.latitude) <= MAX_MAP_LATITUDE && Math.abs(view.longitude) <= 180 && view.zoom >= 2 && view.zoom <= 19) return {
      latitude: view.latitude, longitude: view.longitude, zoom: view.zoom,
      background: isMapBackground(view.background) ? view.background : 'osm',
    }
  } catch { /* Start from the default view if local navigation is unavailable. */ }
  return { latitude: 40, longitude: -3, zoom: 6, background: 'osm' }
}

export function writeMapView(key: string, view: Omit<MapView, 'background'> & { background?: MapBackground }) {
  try { localStorage.setItem('angie.map.' + key, JSON.stringify({ ...readMapView(key), ...view })) } catch { /* Navigation does not block the map. */ }
}
