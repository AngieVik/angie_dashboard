import type { ViewportState } from './layoutTypes'

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
