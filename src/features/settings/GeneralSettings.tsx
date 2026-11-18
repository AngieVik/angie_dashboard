import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { FormatSettings } from './FormatSettings'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function GeneralSettings({ store, onReset }: { store: SettingsStore; onReset: () => void }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  return <div className={styles.general}>
    <fieldset disabled={disabled}>
      <legend>Formatos</legend>
      <FormatSettings store={store} />
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Limpieza</legend>
    </fieldset>
    <Button disabled={disabled} onClick={onReset}>Restablecer los valores predeterminados</Button>
  </div>
}
