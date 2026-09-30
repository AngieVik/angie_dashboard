import type { OperationalStatus } from '../document/types'
export const OPERATIONAL_STATUSES = [
  { status: 'Disponible', phase: 'Espera', icon: '🟢' },
  { status: 'Asignada', phase: 'Activación', icon: '🟡' },
  { status: 'En camino', phase: 'Aproximación', icon: '🔵' },
  { status: 'En el lugar', phase: 'Intervención', icon: '🔴' },
  { status: 'En traslado', phase: 'Evacuación', icon: '💠' },
  { status: 'En destino', phase: 'Transferencia', icon: '🟠' },
  { status: 'Operativa', phase: 'Retorno', icon: '🟢' },
  { status: 'Inoperativa', phase: 'Bloqueo', icon: '⚫' },
] as const satisfies readonly { status: OperationalStatus; phase: string; icon: string }[]
