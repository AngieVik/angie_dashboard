import { isMapBackground } from './mapBackgrounds'
import type { MapBackground } from './mapBackgrounds'

export interface MapView { latitude: number; longitude: number; zoom: number; background: MapBackground; pnoaInformation: boolean }
export const MAX_MAP_LATITUDE = 85.05112878

export interface MapFrame { x: number; y: number; zoom: number; width: number; height: number }
const frames = new Map<string, MapFrame>()
const frameListeners = new Map<string, Set<() => void>>()

export function readMapFrame(key: string): MapFrame | null {
  const current = frames.get(key)
  if (current) return current
  try {
    const frame = JSON.parse(localStorage.getItem('angie.map.frame.' + key) ?? 'null') as MapFrame | null
    if (frame && [frame.x, frame.y, frame.zoom, frame.width, frame.height].every(Number.isFinite) && frame.zoom >= 2 && frame.zoom <= 19 && frame.width > 0 && frame.height > 0) {
      frames.set(key, frame)
      return frame
    }
  } catch { /* A missing view must not be mistaken for the default map. */ }
  return null
}

export function writeMapFrame(key: string, frame: MapFrame) {
  if (!frame.width || !frame.height) return
  const previous = frames.get(key)
  if (previous && previous.x === frame.x && previous.y === frame.y && previous.zoom === frame.zoom && previous.width === frame.width && previous.height === frame.height) return
  frames.set(key, frame)
  try { localStorage.setItem('angie.map.frame.' + key, JSON.stringify(frame)) } catch { /* Keep the available view in this session. */ }
  frameListeners.get(key)?.forEach(listener => listener())
}

export function subscribeMapFrame(key: string, listener: () => void) {
  const listeners = frameListeners.get(key) ?? new Set<() => void>()
  frameListeners.set(key, listeners); listeners.add(listener)
  listener()
  return () => { listeners.delete(listener); if (!listeners.size) frameListeners.delete(key) }
}

export function readMapView(key: string): MapView {
  try {
    const view = JSON.parse(localStorage.getItem('angie.map.' + key) ?? 'null') as MapView | null
    if (view && [view.latitude, view.longitude, view.zoom].every(Number.isFinite) && Math.abs(view.latitude) <= MAX_MAP_LATITUDE && Math.abs(view.longitude) <= 180 && view.zoom >= 2 && view.zoom <= 19) return {
      latitude: view.latitude, longitude: view.longitude, zoom: view.zoom,
      background: isMapBackground(view.background) ? view.background : 'osm',
      pnoaInformation: view.pnoaInformation === true,
    }
  } catch { /* Start from the default view if local navigation is unavailable. */ }
  return { latitude: 40, longitude: -3, zoom: 6, background: 'osm', pnoaInformation: false }
}

export function writeMapView(key: string, view: Omit<MapView, 'background' | 'pnoaInformation'> & Partial<Pick<MapView, 'background' | 'pnoaInformation'>>) {
  try { localStorage.setItem('angie.map.' + key, JSON.stringify({ ...readMapView(key), ...view })) } catch { /* Navigation does not block the map. */ }
}
