import type { MapBackground } from './mapBackgrounds'

export interface MapView { latitude: number; longitude: number; zoom: number; background: MapBackground; pnoaInformation: boolean }
export const MAX_MAP_LATITUDE = 85.05112878

const views = new Map<string, MapView>()
export function resetMapViews() { views.clear() }

export function readMapView(key: string): MapView {
  const view = views.get(key)
  if (view) return view
  return { latitude: 40, longitude: -3, zoom: 6, background: 'osm', pnoaInformation: false }
}

export function writeMapView(key: string, view: Omit<MapView, 'background' | 'pnoaInformation'> & Partial<Pick<MapView, 'background' | 'pnoaInformation'>>) {
  views.set(key, { ...readMapView(key), ...view })
}
