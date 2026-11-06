import { useEffect } from 'react'
import { getTimerStore } from './timerStore'

// Mount beside the global UI boundary so recovery cannot disconnect the clock.
export function TimerRuntime() {
  const store = getTimerStore()
  useEffect(() => { void store.initialize(); return store.connect() }, [store])
  return null
}
