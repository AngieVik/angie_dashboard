import { useSyncExternalStore } from 'react'
import { Select } from '@/components/ui/select'
import { DATE_FORMATS, TIME_FORMATS, UNIT_SYSTEMS } from './formatPreferences'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function FormatSettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  const formats = snapshot.settings.formats
  return <div className={styles.formatOptions}>
    <label>Fecha<Select sizeToOptions aria-label="Formato de fecha" disabled={disabled} value={formats.date}
      options={[{ value: 'dmy', label: 'DD/MM/AAAA' }, { value: 'mdy', label: 'MM/DD/AAAA' }, { value: 'ymd', label: 'AAAA-MM-DD' }]}
      onValueChange={value => { const date = DATE_FORMATS.find(format => format === value); if (!disabled && date) void store.updateFormats({ date }) }} /></label>
    <label>Hora<Select sizeToOptions aria-label="Formato de hora" disabled={disabled} value={formats.time}
      options={[{ value: '24h', label: '24 horas' }, { value: '12h', label: '12 horas (AM/PM)' }]}
      onValueChange={value => { const time = TIME_FORMATS.find(format => format === value); if (!disabled && time) void store.updateFormats({ time }) }} /></label>
    <label>Unidades predeterminadas<Select sizeToOptions aria-label="Unidades predeterminadas" disabled={disabled} value={formats.units}
      options={[{ value: 'metric', label: 'Métricas (m, km)' }, { value: 'imperial', label: 'Imperiales (ft, mi)' }]}
      onValueChange={value => { const units = UNIT_SYSTEMS.find(system => system === value); if (!disabled && units) void store.updateFormats({ units }) }} /></label>
  </div>
}
