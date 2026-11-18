import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function SettingsExitActions({ store, onSave, onClose }: { store: SettingsStore; onSave: () => void; onClose: () => void }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const disabled = snapshot.loading || snapshot.saving
  return <div className={styles.exitActions}>
    <Button disabled={disabled || !snapshot.ready} onClick={onSave}>Guardar</Button>
    <Button disabled={disabled} onClick={onClose}>Cerrar</Button>
  </div>
}
