import type { ModuleId } from './layoutTypes'

interface ModuleDefinition { name: string; initial: readonly [number, number]; minimum: readonly [number, number] }
export const MODULE_REGISTRY = {
  board: { name: 'Pizarra', initial: [720, 480], minimum: [320, 220] },
  elements: { name: 'Elementos', initial: [300, 420], minimum: [220, 240] },
  information: { name: 'Información', initial: [320, 240], minimum: [220, 140] },
  operations: { name: 'Operativo', initial: [340, 320], minimum: [240, 200] },
  coordinates: { name: 'Coordenadas', initial: [360, 280], minimum: [260, 180] },
  clock: { name: 'Reloj', initial: [440, 480], minimum: [320, 260] },
  calculator: { name: 'Calculadora', initial: [280, 360], minimum: [220, 280] },
  notebook: { name: 'Cuaderno', initial: [360, 420], minimum: [260, 220] },
  timeline: { name: 'Registro cronológico', initial: [420, 320], minimum: [280, 180] },
} as const satisfies Record<ModuleId, ModuleDefinition>
