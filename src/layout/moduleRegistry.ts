import { Ambulance, Calculator, ClipboardList, Clock3, FileText, Info, Map, MapPinned, MapPin, NotebookPen, Package, PanelsTopLeft, Radio } from 'lucide-react'
import type { ModuleId } from './layoutTypes'

interface ModuleDefinition { name: string; initial: readonly [number, number]; minimum: readonly [number, number]; contentMinimum: readonly [number, number]; sizeMode: 'standard' | 'editable' | 'feed' | 'specific' }
export const MODULE_AUTO_HEIGHT_LIMIT = 600
export const MODULE_REGISTRY = {
  board: { name: 'Pizarra', initial: [720, 480], minimum: [25, 25], contentMinimum: [320, 220], sizeMode: 'specific' },
  elements: { name: 'Elementos', initial: [300, 420], minimum: [25, 25], contentMinimum: [220, 240], sizeMode: 'editable' },
  dotations: { name: 'Dotaciones', initial: [300, 420], minimum: [25, 25], contentMinimum: [220, 240], sizeMode: 'editable' },
  information: { name: 'Información', initial: [320, 240], minimum: [25, 25], contentMinimum: [220, 140], sizeMode: 'feed' },
  operations: { name: 'Operativo', initial: [340, 320], minimum: [25, 25], contentMinimum: [240, 200], sizeMode: 'specific' },
  coordinates: { name: 'Coordenadas', initial: [360, 280], minimum: [25, 25], contentMinimum: [260, 180], sizeMode: 'standard' },
  map: { name: 'Mapa', initial: [600, 450], minimum: [25, 25], contentMinimum: [300, 220], sizeMode: 'specific' },
  plan: { name: 'Plano operativo', initial: [720, 480], minimum: [25, 25], contentMinimum: [320, 240], sizeMode: 'specific' },
  clock: { name: 'Reloj', initial: [440, 260], minimum: [25, 25], contentMinimum: [360, 260], sizeMode: 'editable' },
  calculator: { name: 'Calculadora', initial: [280, 360], minimum: [25, 25], contentMinimum: [220, 280], sizeMode: 'standard' },
  notebook: { name: 'Cuaderno', initial: [360, 420], minimum: [25, 25], contentMinimum: [260, 220], sizeMode: 'editable' },
  timeline: { name: 'Registro', initial: [420, 320], minimum: [25, 25], contentMinimum: [280, 180], sizeMode: 'feed' },
  reports: { name: 'Informes', initial: [600, 480], minimum: [25, 25], contentMinimum: [280, 220], sizeMode: 'specific' },
} as const satisfies Record<ModuleId, ModuleDefinition>

export const MODULE_ICONS = { board: PanelsTopLeft, elements: Package, dotations: Ambulance, information: Info, operations: Radio, coordinates: MapPin, map: Map, plan: MapPinned, clock: Clock3, calculator: Calculator, notebook: NotebookPen, timeline: ClipboardList, reports: FileText }
