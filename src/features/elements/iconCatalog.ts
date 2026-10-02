import type { AssetId, ElementVisual } from '../../domain/document/types'
export type VisualClass = 'Horizontal' | 'Vertical' | 'Cuadrado'
export interface IconEntry { id: AssetId; name: string; path: string; visualClass: VisualClass }
export const ICON_BOXES = {
  Horizontal: { width: 150, height: 100 },
  Vertical: { width: 100, height: 150 },
  Cuadrado: { width: 100, height: 100 },
} as const
export const ICON_CATALOG: Record<AssetId, IconEntry> = {
  ambulance: { id: 'ambulance', name: 'Ambulancia', path: '/assets/elements/icon_medical.png', visualClass: 'Horizontal' },
  pathfinder: { id: 'pathfinder', name: 'Pathfinder', path: '/assets/elements/icon_vir.png', visualClass: 'Horizontal' },
  quad: { id: 'quad', name: 'Quad', path: '/assets/elements/icon_quad.png', visualClass: 'Horizontal' },
  checkpoint: { id: 'checkpoint', name: 'CP', path: '/assets/elements/icon_cp.png', visualClass: 'Cuadrado' },
  hydration: { id: 'hydration', name: 'EH', path: '/assets/elements/icon_eh.png', visualClass: 'Vertical' },
  start: { id: 'start', name: 'START', path: '/assets/elements/icon_start.png', visualClass: 'Cuadrado' },
  finish: { id: 'finish', name: 'FINISH', path: '/assets/elements/icon_finish.png', visualClass: 'Horizontal' },
  warning: { id: 'warning', name: 'Advertencia', path: '/assets/elements/icon_peligro.png', visualClass: 'Cuadrado' },
  pushpin: { id: 'pushpin', name: 'Chincheta', path: '/assets/elements/icon_chincheta.png', visualClass: 'Cuadrado' },
}

export function getPinBox(visual: ElementVisual) {
  if (visual.type === 'emoji') return { width: 64 * visual.scale, height: 64 * visual.scale }
  const box = ICON_BOXES[ICON_CATALOG[visual.assetId].visualClass]
  return { width: box.width * visual.scale, height: box.height * visual.scale }
}
