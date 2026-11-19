import type { Size } from './layoutTypes'

const RESIZE_STEP = 10
const FAST_RESIZE_STEP = 50

export const RESIZE_INSTRUCTIONS = `Flechas izquierda y derecha: ancho. Flechas arriba y abajo: alto. Paso de ${RESIZE_STEP} px; con Mayús, ${FAST_RESIZE_STEP} px.`

export function keyboardResizeDelta(event: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): Size | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  const step = event.shiftKey ? FAST_RESIZE_STEP : RESIZE_STEP
  switch (event.key) {
    case 'ArrowLeft': return { width: -step, height: 0 }
    case 'ArrowRight': return { width: step, height: 0 }
    case 'ArrowUp': return { width: 0, height: -step }
    case 'ArrowDown': return { width: 0, height: step }
    default: return null
  }
}

export function resizeAnnouncement(size: Size): string {
  return `Tamaño: ${Math.round(size.width)} px de ancho y ${Math.round(size.height)} px de alto.`
}
