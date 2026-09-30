import { acknowledgeTimer, createTimer, deactivateTimer, pauseTimer, resetTimer, settleTimer, startTimer } from './timerEngine'
import { AlarmController } from './alarmController'
import { TimerRepository } from './timerRepository'
import type { InternalTimerRepository } from './timerRepository'
import type { TimerKind, TimerRecord } from './timerTypes'

export function createTimerStore(repository: InternalTimerRepository, alarm: AlarmController) {
  let state = { timers: [] as TimerRecord[], now: Date.now(), ready: false, storageUnavailable: false }
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
    if (recoveryNeeded) return saving
    const copy = structuredClone(state.timers)
    saving = saving.then(async () => {
      try { await repository.saveTimers(copy); update({ storageUnavailable: false }) }
      catch { update({ storageUnavailable: true }) }
    })
    return saving
  }
  function replace(timers: TimerRecord[], now = Date.now()) {
    const previous = state.timers
    update({ timers, now })
    syncAlarms(previous)
    void persist()
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
      replace([...recovered.filter(timer => !ids.has(timer.id)), ...state.timers].map(timer => settleTimer(timer, Date.now())))
      update({ ready: true, storageUnavailable: false })
      await saving
    } catch { update({ ready: true, storageUnavailable: true }) }
  }
  function recoverOnce() {
    recoveryOperation ??= recover().finally(() => { recoveryOperation = undefined })
    return recoveryOperation
  }
  function change(id: string, action: (timer: TimerRecord) => TimerRecord) {
    if (!state.ready) return
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
    add(kind: TimerKind) { if (state.ready) replace([...state.timers, createTimer(kind)]) },
    start(id: string) { change(id, timer => startTimer(timer, Date.now())) },
    pause(id: string) { change(id, timer => pauseTimer(timer, Date.now())) },
    reset(id: string) { change(id, resetTimer) },
    deactivate(id: string) { change(id, deactivateTimer) },
    acknowledge(id: string) { change(id, acknowledgeTimer) },
    close(id: string) { if (state.ready) replace(state.timers.filter(timer => timer.id !== id)) },
    setNote(id: string, note: string) { change(id, timer => ({ ...timer, note })) },
    setDuration(id: string, durationSeconds: number) {
      change(id, timer => timer.kind !== 'tzero' && timer.status === 'idle' ? { ...timer, durationSeconds } : timer)
    },
    retryPersistence: () => recoveryNeeded ? recoverOnce() : persist(),
    flush: () => saving,
  }
}
export type TimerStore = ReturnType<typeof createTimerStore>
let browserTimers: TimerStore | undefined
export function getTimerStore() {
  browserTimers ??= createTimerStore(new TimerRepository(), new AlarmController())
  return browserTimers
}
