import { WORKSPACE } from './layoutTypes'
import type { Size, ViewportState } from './layoutTypes'

function fitScale(size: Size) { return Math.min(size.width / WORKSPACE.width, size.height / WORKSPACE.height) }
export function fit(size: Size): ViewportState {
  const scale = fitScale(size)
  return { scale, offsetX: (size.width - WORKSPACE.width * scale) / 2, offsetY: (size.height - WORKSPACE.height * scale) / 2 }
}
export function clamp(state: ViewportState, size: Size): ViewportState {
  const axis = (offset: number, visible: number, extent: number) => {
    const lower = Math.min(0, visible - extent) - visible * 0.1
    const upper = Math.max(0, visible - extent) + visible * 0.1
    return Math.max(lower, Math.min(upper, offset))
  }
  return { ...state, offsetX: axis(state.offsetX, size.width, WORKSPACE.width * state.scale), offsetY: axis(state.offsetY, size.height, WORKSPACE.height * state.scale) }
}
export function pan(state: ViewportState, dx: number, dy: number, size: Size) {
  return clamp({ ...state, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy }, size)
}
export function zoomAt(state: ViewportState, requestedScale: number, point: { x: number; y: number }, size: Size): ViewportState {
  const minimum = fitScale(size)
  const scale = Math.min(Math.max(4, minimum), Math.max(minimum, requestedScale))
  const ratio = scale / state.scale
  return clamp({ scale, offsetX: point.x - (point.x - state.offsetX) * ratio, offsetY: point.y - (point.y - state.offsetY) * ratio }, size)
}
export function resizeViewport(state: ViewportState, previous: Size, next: Size): ViewportState {
  const centerX = (previous.width / 2 - state.offsetX) / state.scale
  const centerY = (previous.height / 2 - state.offsetY) / state.scale
  const minimum = fitScale(next)
  const scale = Math.min(Math.max(4, minimum), Math.max(minimum, state.scale))
  return clamp({ scale, offsetX: next.width / 2 - centerX * scale, offsetY: next.height / 2 - centerY * scale }, next)
}
