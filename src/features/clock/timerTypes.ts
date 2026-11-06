export type TimerKind = 'tzero' | 'tminus' | 'advisory'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
interface TimerBase {
  id: string
  note: string
  status: TimerStatus
  elapsedMs: number
  // Civil milliseconds in repository/report records; local monotonic milliseconds
  // in the store. TimerClock owns conversion at those boundaries.
  startedAt: number | null
  alertActive: boolean
}
export type TimerRecord = TimerBase & (
  | { kind: 'tzero' }
  | { kind: 'tminus' | 'advisory'; durationSeconds: number }
)
export interface TimerSnapshot { valueSeconds: number; status: TimerStatus; alertActive: boolean }
