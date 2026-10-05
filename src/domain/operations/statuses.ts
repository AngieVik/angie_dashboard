import type { OperationalStatus } from '../document/types'
export const OPERATIONAL_STATUSES = [
  { status: 'Disponible', phase: 'Alerta', abbreviation: 'DISP', icon: '🟢', description: 'En su punto de cobertura, preparada para activación.' },
  { status: 'Activada', phase: 'Alarma', abbreviation: 'ACT', icon: '🟡', description: 'Recurso activado ante un aviso prioritario.' },
  { status: 'Aproximandose', phase: 'Aproximación', abbreviation: 'RUTA', icon: '🔵', description: 'En ruta al lugar del incidente.' },
  { status: 'Interviniendo', phase: 'Asistencia', abbreviation: 'ASIS', icon: '🔴', description: 'Aislamiento y control, triaje, soporte vital y estabilización.' },
  { status: 'Trasladando', phase: 'Transporte', abbreviation: 'TRAS', icon: '💠', description: 'Paciente en traslado al centro sanitario de destino.' },
  { status: 'Transfiriendo', phase: 'Transferencia', abbreviation: 'ENTR', icon: '🟠', description: 'Transferencia del paciente al equipo receptor.' },
  { status: 'Operativa', phase: 'Reactivación', abbreviation: 'REAC', icon: '🟢', description: 'Reactivación del recurso y retorno a su punto de cobertura.' },
  { status: 'Inoperativa', phase: 'Bloqueo', abbreviation: 'BLK', icon: '⚫', description: 'Recurso temporalmente fuera de servicio.' },
] as const satisfies readonly { status: OperationalStatus; phase: string; abbreviation: string; icon: string; description: string }[]
