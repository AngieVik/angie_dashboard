import { Ambulance, Calculator, ClipboardList, Clock3, CloudRain, CloudSun, Info, Map, MapPinned, MapPin, NotebookPen, Package, PanelsTopLeft, Radio } from 'lucide-react'
import type { ModuleId } from './layoutTypes'

interface ModuleDefinition { name: string; initial: readonly [number, number]; minimum: readonly [number, number]; contentMinimum: readonly [number, number] }
export const MODULE_REGISTRY = {
  board: { name: 'Pizarra', initial: [720, 480], minimum: [25, 25], contentMinimum: [320, 220] },
  elements: { name: 'Elementos', initial: [300, 420], minimum: [25, 25], contentMinimum: [220, 240] },
  dotations: { name: 'Dotaciones', initial: [300, 420], minimum: [25, 25], contentMinimum: [220, 240] },
  information: { name: 'Información', initial: [320, 240], minimum: [25, 25], contentMinimum: [220, 140] },
  operations: { name: 'Operativo', initial: [340, 320], minimum: [25, 25], contentMinimum: [240, 200] },
  coordinates: { name: 'Coordenadas', initial: [360, 280], minimum: [25, 25], contentMinimum: [260, 180] },
  map: { name: 'Mapa', initial: [600, 450], minimum: [25, 25], contentMinimum: [300, 220] },
  forecast: { name: 'Pronóstico', initial: [520, 340], minimum: [25, 25], contentMinimum: [300, 220] },
  openMeteo: { name: 'Open-Meteo', initial: [390, 370], minimum: [25, 25], contentMinimum: [260, 220] },
  plan: { name: 'Plano operativo', initial: [720, 480], minimum: [25, 25], contentMinimum: [320, 240] },
  clock: { name: 'Reloj', initial: [440, 260], minimum: [25, 25], contentMinimum: [360, 260] },
  calculator: { name: 'Calculadora', initial: [280, 360], minimum: [25, 25], contentMinimum: [220, 280] },
  notebook: { name: 'Cuaderno', initial: [360, 420], minimum: [25, 25], contentMinimum: [260, 220] },
  timeline: { name: 'Registro', initial: [420, 320], minimum: [25, 25], contentMinimum: [280, 180] },
} as const satisfies Record<ModuleId, ModuleDefinition>

export const MODULE_ICONS = { board: PanelsTopLeft, elements: Package, dotations: Ambulance, information: Info, operations: Radio, coordinates: MapPin, map: Map, forecast: CloudSun, openMeteo: CloudRain, plan: MapPinned, clock: Clock3, calculator: Calculator, notebook: NotebookPen, timeline: ClipboardList }
