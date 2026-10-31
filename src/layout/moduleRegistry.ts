import { Ambulance, Calculator, CalendarDays, ClipboardList, Clock3, FileText, Info, Map, MapPinned, MapPin, NotebookPen, Package, PanelsTopLeft, Radio } from 'lucide-react'
import type { ModuleId } from './layoutTypes'

export type ModuleSizeMode = 'standard' | 'editable' | 'feed' | 'specific'
interface ModuleDefinition { name: string; initial: readonly [number, number]; minimum: readonly [number, number]; autoHeightLimit?: number; contentHeight?: boolean; sizeMode: ModuleSizeMode }
export const MODULE_AUTO_HEIGHT_LIMIT = 350
export const MODULE_REGISTRY = {
  board: { name: 'Pizarra', initial: [720, 480], minimum: [25, 25], sizeMode: 'specific' },
  elements: { name: 'Elementos', initial: [180, 350], minimum: [25, 25], contentHeight: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  dotations: { name: 'Dotaciones', initial: [180, 350], minimum: [25, 25], contentHeight: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  information: { name: 'Información', initial: [210, 240], minimum: [25, 25], contentHeight: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'feed' },
  operations: { name: 'Operativo', initial: [150, 320], minimum: [25, 25], contentHeight: true, sizeMode: 'specific' },
  coordinates: { name: 'Coordenadas', initial: [250, 280], minimum: [25, 25], contentHeight: true, sizeMode: 'standard' },
  map: { name: 'Mapa', initial: [600, 450], minimum: [25, 25], sizeMode: 'specific' },
  plan: { name: 'Plano operativo', initial: [720, 480], minimum: [25, 25], sizeMode: 'specific' },
  clock: { name: 'Reloj', initial: [210, 260], minimum: [25, 25], contentHeight: true, sizeMode: 'editable' },
  calendar: { name: 'Calendario', initial: [340, 500], minimum: [25, 25], sizeMode: 'specific' },
  calculator: { name: 'Calculadora', initial: [150, 360], minimum: [25, 25], contentHeight: true, sizeMode: 'standard' },
  notebook: { name: 'Cuaderno', initial: [210, 420], minimum: [25, 25], contentHeight: true, sizeMode: 'editable' },
  timeline: { name: 'Registro', initial: [250, 320], minimum: [25, 25], contentHeight: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'feed' },
  reports: { name: 'Informes', initial: [600, 480], minimum: [25, 25], sizeMode: 'specific' },
} as const satisfies Record<ModuleId, ModuleDefinition>

export function moduleAutoHeightLimit(id?: ModuleId): number {
  const definition: ModuleDefinition | undefined = id ? MODULE_REGISTRY[id] : undefined
  return definition?.autoHeightLimit ?? Infinity
}

export function moduleUsesContentHeight(id?: ModuleId): boolean {
  const definition: ModuleDefinition | undefined = id ? MODULE_REGISTRY[id] : undefined
  return definition?.contentHeight === true
}

export function moduleCollapsedWidth(id?: ModuleId): number {
  return id && (moduleUsesContentHeight(id) || id === 'calendar') ? MODULE_REGISTRY[id].initial[0] : 200
}

export const MODULE_ICONS = { board: PanelsTopLeft, elements: Package, dotations: Ambulance, information: Info, operations: Radio, coordinates: MapPin, map: Map, plan: MapPinned, clock: Clock3, calendar: CalendarDays, calculator: Calculator, notebook: NotebookPen, timeline: ClipboardList, reports: FileText }
