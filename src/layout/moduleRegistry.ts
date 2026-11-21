import { Ambulance, Calculator, CalendarDays, ClipboardList, Clock3, FileText, Info, Map, MapPinned, MapPin, NotebookPen, Package, PanelsTopLeft, Radio } from 'lucide-react'
import type { ModuleId, Size } from './layoutTypes'

export type ModuleSizeMode = 'standard' | 'editable' | 'feed' | 'specific'
interface ModuleDefinition { name: string; initial: readonly [number, number]; minimum: readonly [number, number]; baseHeight: 'minimum-content' | 'fixed'; autoResize: boolean; autoHeightLimit?: number; compactInPlace?: boolean; sizeMode: ModuleSizeMode }
const MODULE_AUTO_HEIGHT_LIMIT = 500
export const MODULE_REGISTRY = {
  board: { name: 'Pizarra', initial: [510, 420], minimum: [27, 27], baseHeight: 'fixed', autoResize: false, sizeMode: 'specific' },
  elements: { name: 'Elementos', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  dotations: { name: 'Dotaciones', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  information: { name: 'Información', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'feed' },
  operations: { name: 'Operativo', initial: [150, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: false, compactInPlace: true, sizeMode: 'specific' },
  coordinates: { name: 'Coordenadas', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: false, compactInPlace: true, sizeMode: 'standard' },
  map: { name: 'Mapa', initial: [510, 420], minimum: [27, 27], baseHeight: 'fixed', autoResize: false, sizeMode: 'specific' },
  plan: { name: 'Plano operativo', initial: [510, 420], minimum: [27, 27], baseHeight: 'fixed', autoResize: false, sizeMode: 'specific' },
  clock: { name: 'Reloj', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  calendar: { name: 'Calendario', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: false, sizeMode: 'specific' },
  calculator: { name: 'Calculadora', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: false, compactInPlace: true, sizeMode: 'standard' },
  notebook: { name: 'Cuaderno', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'editable' },
  timeline: { name: 'Registro', initial: [240, 30], minimum: [27, 27], baseHeight: 'minimum-content', autoResize: true, compactInPlace: true, autoHeightLimit: MODULE_AUTO_HEIGHT_LIMIT, sizeMode: 'feed' },
  reports: { name: 'Informes', initial: [510, 420], minimum: [27, 27], baseHeight: 'fixed', autoResize: false, sizeMode: 'specific' },
} as const satisfies Record<ModuleId, ModuleDefinition>

// docs/design.md defines opening sizes and automatic height limits.
// 30px is a placeholder for measured initial heights; fixed surfaces keep their opening size.
export function moduleBaseSize(id: ModuleId): Size {
  const definition = MODULE_REGISTRY[id]
  return { width: definition.initial[0], height: definition.initial[1] }
}

// Opening sizes are independent of the content minimum used by manual resizing.
// Keep the expanded floor above the compact-state threshold (29px).
export function moduleExpandedMinimumSize(id?: ModuleId): Size {
  return { width: id ? MODULE_REGISTRY[id].minimum[0] : 27, height: 30 }
}

export function moduleAutoHeightLimit(id?: ModuleId): number {
  const definition: ModuleDefinition | undefined = id ? MODULE_REGISTRY[id] : undefined
  return definition?.autoHeightLimit ?? Infinity
}

export function moduleSupportsAutoResize(id?: ModuleId): boolean {
  return id ? MODULE_REGISTRY[id].autoResize : false
}

// Compaction placement is independent of the automatic sizing capability.
export function moduleCompactsInPlace(id?: ModuleId): boolean {
  const definition: ModuleDefinition | undefined = id ? MODULE_REGISTRY[id] : undefined
  return definition?.compactInPlace === true
}

export function moduleCollapsedWidth(id?: ModuleId): number {
  return id ? MODULE_REGISTRY[id].initial[0] : 200
}

export const MODULE_ICONS = { board: PanelsTopLeft, elements: Package, dotations: Ambulance, information: Info, operations: Radio, coordinates: MapPin, map: Map, plan: MapPinned, clock: Clock3, calendar: CalendarDays, calculator: Calculator, notebook: NotebookPen, timeline: ClipboardList, reports: FileText }
