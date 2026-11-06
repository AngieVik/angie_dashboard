import { acknowledgeTimer, createTimer, deactivateTimer, pauseTimer, resetTimer, settleTimer, startTimer } from './timerEngine'
import { AlarmController } from './alarmController'
import { TimerConflictError, TimerRepository } from './timerRepository'
import type { InternalTimerRepository } from './timerRepository'
import type { TimerKind, TimerRecord } from './timerTypes'
import { TimerClock } from './timerClock'
import type { TimerInstant } from './timerClock'

type TimerAction = (timers: TimerRecord[], now: number) => TimerRecord[]
type TimerMutationResult = 'saved' | 'conflict' | 'unavailable' | 'not-ready'

export function createTimerStore(repository: InternalTimerRepository, alarm: AlarmController) {
  const clock = new TimerClock(), initial = clock.read()
  let state = { timers: [] as TimerRecord[], now: initial.civil, timerNow: initial.monotonic, ready: false, storageUnavailable: false, storageConflict: false, recoveryGeneration: 0 }
  let civilOffset = initial.civil - initial.monotonic
  let observedOffset = civilOffset
  let clockNeedsSave = false, resumePending = false
  let initialization: Promise<void> | undefined
  let recoveryNeeded = true
  let dirty = false
  let invalidated = true
  let operations = Promise.resolve()
  let refreshing: Promise<void> | undefined
  let refreshAgain = false
  let connected = false
  let connectionGeneration = 0
  let channel: BroadcastChannel | undefined
  const sounding = new Set<string>()
  const silenced = new Set<string>()
  const listeners = new Set<() => void>()

  function update(patch: Partial<typeof state>) {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  function silence(id: string) {
    sounding.delete(id)
    alarm.acknowledge(id)
  }
  function invalidate() {
    invalidated = true
    for (const id of sounding) silence(id)
  }
  function readTime() {
    const now = clock.read(), offset = now.civil - now.monotonic
    if (!resumePending) clock.observeCivilAdjustment(offset - observedOffset)
    observedOffset = offset
    // Repair civil recovery anchors under the existing lock after an observed
    // adjustment. This never changes the duration of an active execution.
    if (Math.abs(offset - civilOffset) >= 1000) { clockNeedsSave = true; civilOffset = offset }
    return now
  }
  function replace(timers: TimerRecord[], now: TimerInstant = readTime()) {
    clock.retain(timers, now)
    update({ timers, now: now.civil, timerNow: now.monotonic })
    // Stopping is always safe; starting requires a confirmed repository state.
    for (const id of sounding) if (!timers.some(timer => timer.id === id && timer.alertActive)) silence(id)
  }
  function resumeIfNeeded(now: TimerInstant) {
    if (!resumePending) return
    resumePending = false
    const timers = clock.resume(state.timers, now)
    if (timers.some((timer, index) => timer !== state.timers[index])) clockNeedsSave = true
    replace(timers, now)
  }
  function syncAlarms(generation: number, retrySound = false) {
    if (!connected || generation !== connectionGeneration || invalidated || dirty || recoveryNeeded || state.storageConflict || state.storageUnavailable) return
    for (const id of silenced) if (!state.timers.some(timer => timer.id === id && timer.alertActive)) silenced.delete(id)
    for (const timer of state.timers) if (timer.alertActive && !silenced.has(timer.id)) {
      sounding.add(timer.id)
      void alarm.startAlarm(timer.id)
    }
    if (retrySound && sounding.size) void alarm.activateSound()
  }
  function failed(error: unknown) {
    invalidate()
    update({ storageUnavailable: true, storageConflict: state.storageConflict || error instanceof TimerConflictError })
  }
  function enqueue(operation: () => Promise<void>) {
    operations = operations.then(operation).catch(failed)
    return operations
  }
  function announceChange() {
    // A closed/unavailable notification channel must not turn a commit into a failure.
    try { channel?.postMessage('changed') } catch { /* Focus and pre-alarm reads also reconcile changes. */ }
  }
  async function save(generation: number, retrySound = false) {
    const now = readTime()
    resumeIfNeeded(now)
    const runtime = state.timers, stored = clock.serialize(runtime, now)
    clockNeedsSave = false
    await repository.saveTimers(stored)
    clock.committed(runtime, stored)
    dirty = false
    invalidated = false
    update({ storageUnavailable: false, storageConflict: false })
    announceChange()
    syncAlarms(generation, retrySound)
  }
  async function recover(generation: number, discard = false, retrySound = false) {
    const recovered = await repository.loadTimers()
    const now = readTime()
    resumeIfNeeded(now)
    const restored = clock.restore(recovered, now, discard)
    // Only an initial failed read may merge newly created memory-only timers.
    // Normal refreshes replace exactly, so remote removals cannot be resurrected.
    const merge = recoveryNeeded && dirty && !discard
    const ids = new Set(state.timers.map(timer => timer.id))
    const combined = merge ? [...restored.filter(timer => !ids.has(timer.id)), ...state.timers] : restored
    const settled = combined.map(timer => settleTimer(timer, now.monotonic))
    recoveryNeeded = false
    if (discard) silenced.clear()
    replace(settled, now)
    update({ ready: true, storageConflict: false, recoveryGeneration: state.recoveryGeneration + (discard ? 1 : 0) })
    dirty = merge || clockNeedsSave || settled.some((timer, index) => timer !== combined[index])
    if (dirty) await save(generation, retrySound)
    else {
      invalidated = false
      update({ storageUnavailable: false })
      syncAlarms(generation, retrySound)
    }
  }
  function refresh() {
    if (refreshing) { refreshAgain = true; return refreshing }
    refreshing = enqueue(async () => {
      resumeIfNeeded(readTime())
      if (state.storageConflict || dirty) return
      const generation = connectionGeneration
      try { await repository.withLock(() => recover(generation)) }
      finally { update({ ready: true }) }
    }).finally(() => {
      refreshing = undefined
      const again = refreshAgain
      refreshAgain = false
      if (again && connected && !state.storageConflict && !dirty && !state.storageUnavailable) void refresh()
    })
    return refreshing
  }
  async function mutate(action: TimerAction): Promise<TimerMutationResult> {
    if (!state.ready) return 'not-ready'
    if (state.storageConflict) return 'conflict'
    const requestedAt = readTime().monotonic
    let result: TimerMutationResult = 'unavailable'
    await enqueue(async () => {
      const generation = connectionGeneration
      let applied = false
      const apply = () => {
        const now = readTime()
        resumeIfNeeded(now)
        replace(action(state.timers, requestedAt).map(timer => settleTimer(timer, now.monotonic)), now)
        dirty = true
        applied = true
      }
      // Commands accepted before a preceding write failed still belong to the
      // user. Preserve them locally instead of dropping them from the queue.
      if (state.storageConflict) { apply(); result = 'conflict'; return }
      try {
        await repository.withLock(async () => {
          // Commands, not obsolete list snapshots, are queued. A clean store can
          // read the latest list before applying each command without losing input.
          if (!dirty && !recoveryNeeded) {
            const recovered = await repository.loadTimers()
            const now = readTime()
            resumeIfNeeded(now)
            replace(clock.restore(recovered, now), now)
          }
          apply()
          if (!recoveryNeeded) {
            await save(generation)
            result = 'saved'
          }
        })
      } catch (error) {
        // Keep the user's command in memory even if locking or reading failed.
        // A later retry uses the existing expected revision, never a blind reload.
        if (!applied) apply()
        failed(error)
        result = error instanceof TimerConflictError ? 'conflict' : 'unavailable'
      }
    })
    return result
  }
  function change(id: string, action: (timer: TimerRecord, now: number) => TimerRecord) {
    return mutate((timers, now) => timers.map(timer => timer.id === id ? action(settleTimer(timer, now), now) : timer))
  }
  function tick() {
    const now = readTime()
    update({ now: now.civil, timerNow: now.monotonic })
    if (!state.ready || state.storageConflict || state.storageUnavailable || recoveryNeeded || dirty || invalidated) return
    // Validate even without a channel message: another tab may have committed
    // before its notification arrived, or while this tab was suspended.
    if (clockNeedsSave || resumePending || state.timers.some(timer => timer.alertActive || settleTimer(timer, now.monotonic) !== timer)) void refresh()
  }
  function refreshAfterInvalidation() {
    invalidate()
    if (state.ready) void refresh()
  }
  function silenceLocally(id: string) {
    silenced.add(id)
    silence(id)
  }
  return {
    alarm,
    getSnapshot: () => state,
    getReportRecords: () => state.ready ? clock.serialize(state.timers, readTime()) : null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= refresh(); return initialization },
    connect() {
      connected = true
      connectionGeneration++
      invalidate()
      let connection: BroadcastChannel | undefined
      try { if (typeof BroadcastChannel !== 'undefined') connection = new BroadcastChannel('angie-dashboard-timers') }
      catch { /* Repository validation remains mandatory without notifications. */ }
      channel = connection
      if (connection) connection.onmessage = event => { if (event.data === 'changed') refreshAfterInvalidation() }
      const suspend = () => { clock.suspend(state.timers, readTime()) }
      const freeze = () => { suspend(); clock.freeze() }
      const resume = () => { resumePending = true; refreshAfterInvalidation() }
      const visibility = () => {
        if (document.hidden) { suspend(); refreshAfterInvalidation() }
        else resume()
      }
      if (document.hidden) suspend()
      else resume()
      const interval = window.setInterval(tick, 250)
      window.addEventListener('pagehide', suspend)
      window.addEventListener('pageshow', resume)
      window.addEventListener('focus', refreshAfterInvalidation)
      document.addEventListener('visibilitychange', visibility)
      document.addEventListener('freeze', freeze)
      document.addEventListener('resume', resume)
      if (state.ready) void refresh()
      return () => {
        connected = false
        connectionGeneration++
        invalidate()
        window.clearInterval(interval)
        suspend()
        window.removeEventListener('pagehide', suspend)
        window.removeEventListener('pageshow', resume)
        window.removeEventListener('focus', refreshAfterInvalidation)
        document.removeEventListener('visibilitychange', visibility)
        document.removeEventListener('freeze', freeze)
        document.removeEventListener('resume', resume)
        connection?.close()
        if (channel === connection) channel = undefined
        alarm.stop()
      }
    },
    tick,
    add(kind: TimerKind) { void mutate(timers => [...timers, createTimer(kind)]) },
    start(id: string) { void change(id, startTimer) },
    pause(id: string) { void change(id, pauseTimer) },
    reset(id: string) { silenceLocally(id); void change(id, resetTimer) },
    deactivate(id: string) { silenceLocally(id); void change(id, deactivateTimer) },
    acknowledge(id: string) {
      // Silencing remains immediate, including while a write/refresh is queued.
      silenceLocally(id)
      if (state.storageConflict) replace(state.timers.map(timer => timer.id === id ? acknowledgeTimer(timer) : timer))
      else void change(id, acknowledgeTimer)
    },
    close(id: string) { silenceLocally(id); void mutate(timers => timers.filter(timer => timer.id !== id)) },
    clearAll() {
      // Silence immediately; the queued command also includes pending additions.
      for (const timer of state.timers) silenceLocally(timer.id)
      return mutate(() => [])
    },
    setNote(id: string, note: string) { void change(id, timer => ({ ...timer, note })) },
    setDuration(id: string, durationSeconds: number) {
      void change(id, timer => timer.kind !== 'tzero' && timer.status === 'idle' ? { ...timer, durationSeconds } : timer)
    },
    activateSound() {
      // Preview is an explicit user action and has no persisted timer to validate.
      if (alarm.getSnapshot().preview) return alarm.activateSound()
      return enqueue(async () => {
        if (state.storageConflict || dirty || recoveryNeeded) return
        const generation = connectionGeneration
        await repository.withLock(() => recover(generation, false, true))
      })
    },
    retryPersistence() {
      return enqueue(async () => {
        const generation = connectionGeneration
        await repository.withLock(async () => {
          if (state.storageConflict || recoveryNeeded || !dirty) await recover(generation, state.storageConflict)
          else await save(generation)
        })
      })
    },
    flush: () => operations,
  }
}
export type TimerStore = ReturnType<typeof createTimerStore>
let browserTimers: TimerStore | undefined
export function getTimerStore() {
  browserTimers ??= createTimerStore(new TimerRepository(), new AlarmController())
  return browserTimers
}
