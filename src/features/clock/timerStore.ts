import { acknowledgeTimer, createTimer, deactivateTimer, pauseTimer, resetTimer, settleTimer, startTimer } from './timerEngine'
import { AlarmController } from './alarmController'
import { TimerConflictError, TimerRepository } from './timerRepository'
import type { InternalTimerRepository } from './timerRepository'
import type { TimerKind, TimerRecord } from './timerTypes'

export function createTimerStore(repository: InternalTimerRepository, alarm: AlarmController) {
  let state = { timers: [] as TimerRecord[], now: Date.now(), ready: false, storageUnavailable: false, storageConflict: false, recoveryGeneration: 0 }
  let initialization: Promise<void> | undefined
  let recoveryOperation: Promise<void> | undefined
  let recoveryNeeded = true
  let saving = Promise.resolve()
  const listeners = new Set<() => void>()
  function update(patch: Partial<typeof state>) {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  function syncAlarms(previous: TimerRecord[]) {
    for (const timer of previous) {
      if (timer.alertActive && !state.timers.some(current => current.id === timer.id && current.alertActive)) alarm.acknowledge(timer.id)
    }
    for (const timer of state.timers) if (timer.alertActive) void alarm.startAlarm(timer.id)
  }
  function persist() {
    if (recoveryNeeded || state.storageConflict) return saving
    const copy = structuredClone(state.timers)
    saving = saving.then(async () => {
      // Jobs already queued before a conflict must not write after it either.
      if (state.storageConflict) return
      try { await repository.saveTimers(copy); update({ storageUnavailable: false }) }
      catch (error) { update({ storageUnavailable: true, storageConflict: error instanceof TimerConflictError }) }
    })
    return saving
  }
  function replace(timers: TimerRecord[], now = Date.now(), save = true) {
    const previous = state.timers
    update({ timers, now })
    syncAlarms(previous)
    if (save) void persist()
  }
  function tick() {
    const now = Date.now(), settled = state.timers.map(timer => settleTimer(timer, now))
    if (settled.some((timer, index) => timer !== state.timers[index])) replace(settled, now)
    else update({ now })
  }
  async function recover() {
    try {
      const recovered = await repository.loadTimers()
      recoveryNeeded = false
      // On a failed initial read, preserve new timers created in memory and
      // merge recovered records rather than silently replacing current work.
      const ids = new Set(state.timers.map(timer => timer.id))
      const combined = [...recovered.filter(timer => !ids.has(timer.id)), ...state.timers], now = Date.now()
      const settled = combined.map(timer => settleTimer(timer, now))
      const changed = state.timers.length > 0 || settled.some((timer, index) => timer !== combined[index])
      replace(settled, now, changed)
      update({ ready: true, storageUnavailable: false })
      await saving
    } catch { update({ ready: true, storageUnavailable: true }) }
  }
  function recoverOnce() {
    recoveryOperation ??= recover().finally(() => { recoveryOperation = undefined })
    return recoveryOperation
  }
  async function reloadTimers() {
    // Finish rejected/queued writes before accepting a new repository revision.
    await saving
    try {
      const recovered = await repository.loadTimers(), now = Date.now()
      const settled = recovered.map(timer => settleTimer(timer, now))
      recoveryNeeded = false
      update({ storageUnavailable: false, storageConflict: false, recoveryGeneration: state.recoveryGeneration + 1 })
      // Replace exactly: merging would resurrect timers removed in another tab.
      replace(settled, now, settled.some((timer, index) => timer !== recovered[index]))
      await saving
    } catch { update({ storageUnavailable: true }) }
  }
  function change(id: string, action: (timer: TimerRecord) => TimerRecord) {
    if (!state.ready || state.storageConflict) return
    const timers = state.timers.map(timer => timer.id === id ? action(settleTimer(timer, Date.now())) : timer)
    replace(timers)
  }
  return {
    alarm,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= recoverOnce(); return initialization },
    connect() {
      syncAlarms([])
      const interval = window.setInterval(tick, 250)
      const resume = () => tick()
      window.addEventListener('pageshow', resume)
      window.addEventListener('focus', resume)
      document.addEventListener('visibilitychange', resume)
      return () => {
        window.clearInterval(interval)
        window.removeEventListener('pageshow', resume)
        window.removeEventListener('focus', resume)
        document.removeEventListener('visibilitychange', resume)
        alarm.stop()
      }
    },
    tick,
    add(kind: TimerKind) { if (state.ready && !state.storageConflict) replace([...state.timers, createTimer(kind)]) },
    start(id: string) { change(id, timer => startTimer(timer, Date.now())) },
    pause(id: string) { change(id, timer => pauseTimer(timer, Date.now())) },
    reset(id: string) { change(id, resetTimer) },
    deactivate(id: string) { change(id, deactivateTimer) },
    acknowledge(id: string) {
      // A storage conflict must not prevent silencing an alarm locally.
      if (state.storageConflict) replace(state.timers.map(timer => timer.id === id ? acknowledgeTimer(timer) : timer), Date.now(), false)
      else change(id, acknowledgeTimer)
    },
    close(id: string) { if (state.ready && !state.storageConflict) replace(state.timers.filter(timer => timer.id !== id)) },
    setNote(id: string, note: string) { change(id, timer => ({ ...timer, note })) },
    setDuration(id: string, durationSeconds: number) {
      change(id, timer => timer.kind !== 'tzero' && timer.status === 'idle' ? { ...timer, durationSeconds } : timer)
    },
    retryPersistence() {
      if (state.storageConflict) {
        recoveryOperation ??= reloadTimers().finally(() => { recoveryOperation = undefined })
        return recoveryOperation
      }
      return recoveryNeeded ? recoverOnce() : persist()
    },
    flush: () => saving,
  }
}
export type TimerStore = ReturnType<typeof createTimerStore>
let browserTimers: TimerStore | undefined
export function getTimerStore() {
  browserTimers ??= createTimerStore(new TimerRepository(), new AlarmController())
  return browserTimers
}
