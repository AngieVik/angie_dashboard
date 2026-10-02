import type { Size, ViewportState } from './layoutTypes'

export function fit(size: Size, bounds: Size = size): ViewportState {
  return { scale: 1, offsetX: (size.width - bounds.width) / 2, offsetY: (size.height - bounds.height) / 2 }
}
export function clamp(state: ViewportState, size: Size, bounds: Size = size): ViewportState {
  const axis = (offset: number, visible: number, extent: number) => {
    const lower = Math.min(0, visible - extent) - visible * 0.1
    const upper = Math.max(0, visible - extent) + visible * 0.1
    return Math.max(lower, Math.min(upper, offset))
  }
  return { ...state, offsetX: axis(state.offsetX, size.width, bounds.width * state.scale), offsetY: axis(state.offsetY, size.height, bounds.height * state.scale) }
}
export function pan(state: ViewportState, dx: number, dy: number, size: Size, bounds: Size = size) {
  return clamp({ ...state, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy }, size, bounds)
}
export function zoomAt(state: ViewportState, requestedScale: number, point: { x: number; y: number }, size: Size, bounds: Size = size): ViewportState {
  const scale = Math.min(4, Math.max(1, requestedScale))
  const ratio = scale / state.scale
  return clamp({ scale, offsetX: point.x - (point.x - state.offsetX) * ratio, offsetY: point.y - (point.y - state.offsetY) * ratio }, size, bounds)
}
export function resizeViewport(state: ViewportState, previous: Size, next: Size, bounds: Size = next): ViewportState {
  const centerX = (previous.width / 2 - state.offsetX) / state.scale
  const centerY = (previous.height / 2 - state.offsetY) / state.scale
  const scale = Math.min(4, Math.max(1, state.scale))
  return clamp({ scale, offsetX: next.width / 2 - centerX * scale, offsetY: next.height / 2 - centerY * scale }, next, bounds)
}
