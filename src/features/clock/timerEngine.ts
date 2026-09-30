import type { TimerKind, TimerRecord, TimerSnapshot } from './timerTypes'
export const MAX_TIMER_SECONDS = 86399
export function normalizeDuration(hours: string, minutes: string, seconds: string): number {
  const total = Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0)
  return Math.max(1, Math.min(MAX_TIMER_SECONDS, Math.floor(total)))
}
export function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.min(MAX_TIMER_SECONDS, Math.floor(seconds)))
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, '0')).join(':')
}
export function createTimer(kind: TimerKind, durationSeconds = 1): TimerRecord {
  const base = { id: crypto.randomUUID(), note: '', status: 'idle' as const, elapsedMs: 0, startedAt: null, alertActive: false }
  return kind === 'tzero' ? { ...base, kind } : { ...base, kind, durationSeconds }
}
function elapsed(timer: TimerRecord, now: number) {
  return timer.elapsedMs + (timer.status === 'running' && timer.startedAt !== null ? Math.max(0, now - timer.startedAt) : 0)
}
export function settleTimer(timer: TimerRecord, now: number): TimerRecord {
  if (timer.status !== 'running') return timer
  const limit = timer.kind === 'tzero' ? MAX_TIMER_SECONDS : timer.durationSeconds
  if (elapsed(timer, now) < limit * 1000) return timer
  if (timer.kind === 'tzero') return resetTimer(timer)
  return { ...timer, elapsedMs: limit * 1000, startedAt: null, status: 'completed', alertActive: true }
}
export function calculateTimerValue(timer: TimerRecord, now: number): TimerSnapshot {
  const settled = settleTimer(timer, now), ms = elapsed(settled, now)
  return {
    valueSeconds: settled.kind === 'tminus' ? Math.max(0, Math.ceil(settled.durationSeconds - ms / 1000)) : Math.floor(ms / 1000),
    status: settled.status, alertActive: settled.alertActive,
  }
}
export function startTimer(timer: TimerRecord, now: number): TimerRecord {
  if (timer.status !== 'idle' && timer.status !== 'paused') return settleTimer(timer, now)
  return { ...timer, status: 'running', startedAt: now }
}
export function pauseTimer(timer: TimerRecord, now: number): TimerRecord {
  const settled = settleTimer(timer, now)
  if (settled.status !== 'running' || settled.kind === 'advisory') return settled
  return { ...settled, status: 'paused', elapsedMs: elapsed(settled, now), startedAt: null }
}
export function resetTimer(timer: TimerRecord): TimerRecord {
  return { ...timer, status: 'idle', elapsedMs: 0, startedAt: null, alertActive: false }
}
export function deactivateTimer(timer: TimerRecord): TimerRecord { return timer.kind === 'advisory' ? resetTimer(timer) : timer }
export function acknowledgeTimer(timer: TimerRecord): TimerRecord { return timer.alertActive ? { ...timer, alertActive: false } : timer }
const clockOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } as const
const espFormatter = new Intl.DateTimeFormat('en-GB', { ...clockOptions, timeZone: 'Europe/Madrid' })
const utcFormatter = new Intl.DateTimeFormat('en-GB', { ...clockOptions, timeZone: 'UTC' })
export function spanishClock(now: number) {
  const esp = espFormatter.format(now), zulu = utcFormatter.format(now)
  const offset = (Number(esp.slice(0, 2)) - Number(zulu.slice(0, 2)) + 24) % 24
  return { esp, zulu, season: offset === 2 ? 'ST' : 'WT' }
}
