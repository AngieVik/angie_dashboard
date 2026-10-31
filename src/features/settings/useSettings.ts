import { useEffect, useSyncExternalStore } from 'react'
import { getSettingsStore } from './settingsStore'

export function useSettings() {
  const store = getSettingsStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => { if (!store.getSnapshot().ready) void store.reload() }, [store])
  return snapshot
}
