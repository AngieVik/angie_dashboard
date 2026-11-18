import { useSyncExternalStore } from 'react'
import { Select } from '@/components/ui/select'
import { TEXT_SIZES } from './accessibilityPreferences'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function AccessibilitySettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  const preferences = snapshot.settings.accessibility
  return <div className={styles.accessibility}>
    <label>Tamaño de texto<Select sizeToOptions aria-label="Tamaño de texto" disabled={disabled} value={String(preferences.textSize)}
      options={TEXT_SIZES.map(size => ({ value: String(size), label: `${size} %` }))}
      onValueChange={value => {
        const textSize = TEXT_SIZES.find(size => String(size) === value)
        if (!disabled && textSize !== undefined) void store.updateAccessibility({ textSize })
      }} /></label>
    <label>Contraste<Select sizeToOptions aria-label="Contraste" disabled={disabled} value={preferences.highContrast ? 'high' : 'normal'}
      options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alto' }]}
      onValueChange={value => { if (!disabled && (value === 'normal' || value === 'high')) void store.updateAccessibility({ highContrast: value === 'high' }) }} /></label>
    <label>Movimiento<Select sizeToOptions aria-label="Movimiento" disabled={disabled} value={preferences.motion}
      options={[{ value: 'system', label: 'Según el sistema' }, { value: 'reduce', label: 'Reducido' }]}
      onValueChange={value => { if (!disabled && (value === 'system' || value === 'reduce')) void store.updateAccessibility({ motion: value }) }} /></label>
  </div>
}
