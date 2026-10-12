import type { Size, ViewportState } from './layoutTypes'

export interface NavigationState extends ViewportState {
  restoreSize?: Size
  scrolls?: Record<string, { left: number; top: number }>
}
const empty = (): NavigationState => ({ scale: 1, offsetX: 0, offsetY: 0 })
export function readNavigation(key?: string): NavigationState {
  if (!key) return empty()
  try {
    const saved = JSON.parse(localStorage.getItem('angie.navigation.' + key) ?? 'null')
    if (!saved || ![saved.scale, saved.offsetX, saved.offsetY].every(Number.isFinite)) return empty()
    return { scale: Math.min(2, Math.max(.25, saved.scale)), offsetX: Math.min(0, saved.offsetX), offsetY: Math.min(0, saved.offsetY),
      restoreSize: saved.restoreSize && [saved.restoreSize.width, saved.restoreSize.height].every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0) ? saved.restoreSize : undefined,
      scrolls: saved.scrolls && typeof saved.scrolls === 'object' ? Object.fromEntries(Object.entries(saved.scrolls).filter((entry): entry is [string, {left: number; top: number}] => {
        const value = entry[1] as {left?: unknown; top?: unknown} | null
        return !!value && typeof value.left === 'number' && typeof value.top === 'number' && Number.isFinite(value.left) && Number.isFinite(value.top) && value.left >= 0 && value.top >= 0
      })) : undefined }
  } catch { return empty() }
}
export function writeNavigation(key: string | undefined, value: NavigationState) {
  if (!key) return
  try { localStorage.setItem('angie.navigation.' + key, JSON.stringify(value)) } catch { /* Navigation remains usable without local storage. */ }
}
