import { useSyncExternalStore } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { MODULE_REGISTRY } from '@/layout/moduleRegistry'
import { SETTINGS_MODULE_IDS } from './settingsModuleOrder'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function InitialViewSettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  return <div className={styles.initialView}>
    <div className={styles.initialOptions}>
      <label>Disposición<Select sizeToOptions aria-label="Disposición inicial" disabled={disabled} value={snapshot.settings.initialArrangement}
        options={[{ value: 'ordered', label: 'Ordenados' }, { value: 'bars', label: 'Recogidos en barras' }]}
        onValueChange={value => { if (!disabled && (value === 'ordered' || value === 'bars')) void store.updateInitialView({ initialArrangement: value }) }} /></label>
    </div>
    <div className={styles.initialModules} role="group" aria-label="Módulos al iniciar">
      {SETTINGS_MODULE_IDS.map(id => <label key={id}>
        <Checkbox checked={snapshot.settings.initialModules?.includes(id) ?? false} disabled={disabled}
          onCheckedChange={checked => { if (!disabled) void store.setInitialModule(id, checked) }} />
        {MODULE_REGISTRY[id].name}
      </label>)}
    </div>
  </div>
}
