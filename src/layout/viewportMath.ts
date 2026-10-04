import type { Size, ViewportState } from './layoutTypes'

export function fit(size: Size, bounds: Size = size): ViewportState {
  return clamp({ scale: 1, offsetX: 0, offsetY: 0 }, size, bounds)
}
export function clamp(state: ViewportState, size: Size, bounds: Size = size): ViewportState {
  const axis = (offset: number, visible: number, extent: number) => {
    const lower = Math.min(0, visible - extent)
    return Math.max(lower, Math.min(0, offset))
  }
  return { ...state, offsetX: axis(state.offsetX, size.width, bounds.width * state.scale), offsetY: axis(state.offsetY, size.height, bounds.height * state.scale) }
}
export function pan(state: ViewportState, dx: number, dy: number, size: Size, bounds: Size = size) {
  return clamp({ ...state, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy }, size, bounds)
}
export function zoomAt(state: ViewportState, requestedScale: number, point: { x: number; y: number }, size: Size, bounds: Size = size): ViewportState {
  const scale = Number.isFinite(requestedScale) ? Math.min(4, Math.max(0.25, requestedScale)) : state.scale
  const ratio = scale / state.scale
  return clamp({ scale, offsetX: point.x - (point.x - state.offsetX) * ratio, offsetY: point.y - (point.y - state.offsetY) * ratio }, size, bounds)
}
export function resizeViewport(state: ViewportState, _previous: Size, next: Size, bounds: Size = next): ViewportState {
  return clamp(state, next, bounds)
}
