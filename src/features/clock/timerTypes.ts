export type TimerKind = 'tzero' | 'tminus' | 'advisory'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
interface TimerBase {
  id: string
  note: string
  status: TimerStatus
  elapsedMs: number
  startedAt: number | null
  alertActive: boolean
}
export type TimerRecord = TimerBase & (
  | { kind: 'tzero' }
  | { kind: 'tminus' | 'advisory'; durationSeconds: number }
)
export interface TimerSnapshot { valueSeconds: number; status: TimerStatus; alertActive: boolean }
