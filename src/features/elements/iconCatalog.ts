import type { AssetId, ElementVisual } from '../../domain/document/types'
export type VisualClass = 'Horizontal' | 'Vertical' | 'Cuadrado'
export interface IconEntry { id: AssetId; name: string; path: string; visualClass: VisualClass; isUnit: boolean }
export const ICON_BOXES = {
  Horizontal: { width: 150, height: 100 },
  Vertical: { width: 100, height: 150 },
  Cuadrado: { width: 100, height: 100 },
} as const
export const ICON_CATALOG: Record<AssetId, IconEntry> = {
  // Keep the original IDs and boxes so existing UIBoards retain their icons and geometry.
  ambulance: { id: 'ambulance', name: 'Ambulancia', path: '/assets/pins/dotaciones/icon_ambulancia.svg', visualClass: 'Horizontal', isUnit: true },
  pathfinder: { id: 'pathfinder', name: 'VIR', path: '/assets/pins/dotaciones/icon_vir.svg', visualClass: 'Horizontal', isUnit: true },
  quad: { id: 'quad', name: 'Quad', path: '/assets/pins/dotaciones/icon_quad.svg', visualClass: 'Horizontal', isUnit: true },
  doctor: { id: 'doctor', name: 'Médico', path: '/assets/pins/dotaciones/icon_medico.svg', visualClass: 'Cuadrado', isUnit: true },
  nurse: { id: 'nurse', name: 'Enfermera', path: '/assets/pins/dotaciones/icon_enfermera.svg', visualClass: 'Vertical', isUnit: true },
  checkpoint: { id: 'checkpoint', name: 'CP', path: '/assets/pins/elementos/icon_cp.svg', visualClass: 'Cuadrado', isUnit: false },
  hydration: { id: 'hydration', name: 'Agua', path: '/assets/pins/elementos/icon_agua.svg', visualClass: 'Vertical', isUnit: false },
  start: { id: 'start', name: 'START', path: '/assets/pins/elementos/icon_start.svg', visualClass: 'Cuadrado', isUnit: false },
  finish: { id: 'finish', name: 'FINISH', path: '/assets/pins/elementos/icon_finish.svg', visualClass: 'Horizontal', isUnit: false },
  warning: { id: 'warning', name: 'Advertencia', path: '/assets/pins/elementos/icon_peligro.svg', visualClass: 'Cuadrado', isUnit: false },
  pushpin: { id: 'pushpin', name: 'Chincheta', path: '/assets/pins/elementos/icon_chincheta.svg', visualClass: 'Cuadrado', isUnit: false },
  refreshment: { id: 'refreshment', name: 'Avituallamiento', path: '/assets/pins/elementos/icon_avituallamiento.svg', visualClass: 'Cuadrado', isUnit: false },
  firstAid: { id: 'firstAid', name: 'Botiquín', path: '/assets/pins/elementos/icon_botiquin.svg', visualClass: 'Cuadrado', isUnit: false },
  tent: { id: 'tent', name: 'Carpa', path: '/assets/pins/elementos/icon_carpa.svg', visualClass: 'Horizontal', isUnit: false },
  communications: { id: 'communications', name: 'Comunicaciones', path: '/assets/pins/elementos/icon_comunicaciones.svg', visualClass: 'Vertical', isUnit: false },
  roadClosure: { id: 'roadClosure', name: 'Corte de vía', path: '/assets/pins/elementos/icon_corte_via.svg', visualClass: 'Horizontal', isUnit: false },
  timing: { id: 'timing', name: 'Crono', path: '/assets/pins/elementos/icon_crono.svg', visualClass: 'Cuadrado', isUnit: false },
  aed: { id: 'aed', name: 'DAE', path: '/assets/pins/elementos/icon_dae.svg', visualClass: 'Cuadrado', isUnit: false },
  backpack: { id: 'backpack', name: 'Mochila', path: '/assets/pins/elementos/icon_mochila.svg', visualClass: 'Cuadrado', isUnit: false },
  noEntry: { id: 'noEntry', name: 'Prohibido el paso', path: '/assets/pins/elementos/icon_prohibido_paso.svg', visualClass: 'Cuadrado', isUnit: false },
  commandPost: { id: 'commandPost', name: 'Puesto de mando', path: '/assets/pins/elementos/icon_puesto_mando.svg', visualClass: 'Horizontal', isUnit: false },
  meetingPoint: { id: 'meetingPoint', name: 'Punto de encuentro', path: '/assets/pins/elementos/icon_punto_encuentro.svg', visualClass: 'Cuadrado', isUnit: false },
}

export function getIconIds(isUnit: boolean): AssetId[] {
  return Object.values(ICON_CATALOG).filter(icon => icon.isUnit === isUnit).map(icon => icon.id)
}

export function getPinBox(visual: ElementVisual) {
  if (visual.type === 'emoji') return { width: 64 * visual.scale, height: 64 * visual.scale }
  const box = ICON_BOXES[ICON_CATALOG[visual.assetId].visualClass]
  return { width: box.width * visual.scale, height: box.height * visual.scale }
}
