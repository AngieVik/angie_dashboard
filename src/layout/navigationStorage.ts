import type { ViewportState } from './layoutTypes'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN } from './viewportMath'

export interface NavigationState extends ViewportState {
  autoResize?: boolean
  scrolls?: Record<string, { left: number; top: number }>
}
const navigation = new Map<string, NavigationState>()
const empty = (): NavigationState => ({ scale: 1, offsetX: 0, offsetY: 0 })
export function readNavigation(key?: string): NavigationState {
  return key ? navigation.get(key) ?? empty() : empty()
}
export function writeNavigation(key: string | undefined, value: NavigationState) {
  if (key) navigation.set(key, value)
}
export function resetNavigation() { navigation.clear() }

// Only reload recovery reads this session value; normal starts use preferences.
export function readReloadZoom(documentId: string): number | null {
  try {
    const value = sessionStorage.getItem(`angie-dashboard.reload-zoom.${documentId}`)
    if (value === null) return null
    const scale = Number(value)
    return Number.isFinite(scale) && scale >= VIEWPORT_ZOOM_MIN && scale <= VIEWPORT_ZOOM_MAX ? scale : null
  } catch { return null }
}

export function writeReloadZoom(documentId: string, scale: number) {
  if (!Number.isFinite(scale) || scale < VIEWPORT_ZOOM_MIN || scale > VIEWPORT_ZOOM_MAX) return
  try { sessionStorage.setItem(`angie-dashboard.reload-zoom.${documentId}`, String(scale)) } catch { /* Keep navigation usable when session storage is unavailable. */ }
}
