import type { TimerRecord } from './timerTypes'

export interface TimerInstant { civil: number; monotonic: number }
interface Anchor { stored: TimerRecord; runtime: TimerRecord; adjustment?: number }

// Notes and alarm acknowledgement do not start another execution. Timing changes
// from another tab do: never retain a local anchor across pause/reset/restart.
function sameTiming(a: TimerRecord, b: TimerRecord) {
  return a.kind === b.kind && a.status === b.status && a.elapsedMs === b.elapsedMs && a.startedAt === b.startedAt
    && (a.kind === 'tzero' || b.kind !== 'tzero' && a.durationSeconds === b.durationSeconds)
}

export class TimerClock {
  private readonly anchors = new Map<string, Anchor>()
  private suspended: Map<string, Anchor> | undefined
  private civilAdjustment = 0
  private frozen = false

  read(): TimerInstant { return { civil: Date.now(), monotonic: performance.now() } }

  // Only this boundary interprets stored startedAt as civil time. In the store,
  // startedAt and the engine's `now` are always in the local monotonic domain.
  restore(records: TimerRecord[], now: TimerInstant, discard = false): TimerRecord[] {
    if (discard) this.anchors.clear()
    return records.map(stored => {
      if (stored.status !== 'running' || stored.startedAt === null) {
        this.anchors.delete(stored.id)
        return stored
      }
      const anchor = this.anchors.get(stored.id)
      const startedAt = anchor && sameTiming(stored, anchor.stored)
        ? anchor.runtime.startedAt!
        : now.monotonic - Math.max(0, now.civil - stored.startedAt)
      const runtime = { ...stored, startedAt }
      this.anchors.set(stored.id, { stored, runtime })
      return runtime
    })
  }

  serialize(records: readonly TimerRecord[], now: TimerInstant): TimerRecord[] {
    return records.map(timer => timer.status === 'running' && timer.startedAt !== null
      ? { ...timer, startedAt: now.civil - Math.max(0, now.monotonic - timer.startedAt) }
      : { ...timer })
  }

  committed(runtime: TimerRecord[], stored: TimerRecord[]) {
    runtime.forEach((timer, index) => {
      if (timer.status === 'running') this.anchors.set(timer.id, { runtime: timer, stored: stored[index]! })
      else this.anchors.delete(timer.id)
    })
  }

  retain(records: TimerRecord[], now: TimerInstant) {
    const ids = new Set(records.map(timer => timer.id))
    for (const id of this.anchors.keys()) if (!ids.has(id)) this.anchors.delete(id)
    if (!this.suspended) return
    for (const id of this.suspended.keys()) if (!ids.has(id)) this.suspended.delete(id)
    const stored = this.serialize(records, now)
    records.forEach((runtime, index) => {
      const previous = this.suspended!.get(runtime.id)
      if (!previous || !sameTiming(runtime, previous.runtime)) {
        this.suspended!.set(runtime.id, { runtime, stored: stored[index]!, adjustment: this.civilAdjustment })
      }
    })
  }

  suspend(records: TimerRecord[], now: TimerInstant) {
    if (this.suspended) return
    this.civilAdjustment = 0
    this.suspended = new Map()
    this.retain(records, now)
  }

  freeze() { this.frozen = true }

  observeCivilAdjustment(delta: number) {
    // A system correction observed while JS is still executing (including a
    // background tab) must not be counted again when visibility is restored.
    if (this.suspended && !this.frozen) this.civilAdjustment += delta
  }

  resume(records: TimerRecord[], now: TimerInstant): TimerRecord[] {
    const suspended = this.suspended
    this.suspended = undefined
    this.frozen = false
    if (!suspended) return records
    return records.map(timer => {
      const reference = suspended.get(timer.id)
      if (timer.status !== 'running' || timer.startedAt === null || !reference || !sameTiming(timer, reference.runtime)) return timer
      // Some platforms stop performance.now during system sleep. Recover only
      // missing time at this explicit lifecycle boundary, never on a normal tick.
      // Civil changes while suspended are indistinguishable from elapsed time.
      const civilStart = reference.stored.startedAt! + this.civilAdjustment - (reference.adjustment ?? 0)
      const civilElapsed = Math.max(0, now.civil - civilStart)
      const monotonicElapsed = Math.max(0, now.monotonic - timer.startedAt)
      if (civilElapsed <= monotonicElapsed) return timer
      const runtime = { ...timer, startedAt: now.monotonic - civilElapsed }
      const anchor = this.anchors.get(timer.id)
      if (anchor && sameTiming(timer, anchor.runtime)) this.anchors.set(timer.id, { ...anchor, runtime })
      return runtime
    })
  }
}
