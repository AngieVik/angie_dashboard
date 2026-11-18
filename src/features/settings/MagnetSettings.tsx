import { useSyncExternalStore } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { MAGNET_DISTANCE_MIN, MAGNET_DISTANCE_MAX } from '@/layout/magnetSettings'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function MagnetSettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const draft = snapshot.numberDrafts.magnetDistance ?? null
  const setDraft = (value: string | null) => store.setNumberDraft('magnetDistance', value)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  function saveDistance() {
    if (!disabled) store.commitNumberDraft('magnetDistance')
  }
  return <div className={styles.magnet}>
    <label className={styles.magnetEdges}><Checkbox checked={snapshot.settings.magnetByDefault} disabled={disabled}
      onCheckedChange={checked => { if (!disabled) void store.updateMagnet({ magnetByDefault: checked }) }} />Activado por defecto al iniciar</label>
    <label className={styles.magnetDistance}>Distancia de atracción (px)
      <Input type="number" inputMode="numeric" aria-label="Distancia de atracción en píxeles"
        min={MAGNET_DISTANCE_MIN} max={MAGNET_DISTANCE_MAX} step={1} disabled={disabled}
        value={draft ?? snapshot.settings.magnetDistance} onChange={event => setDraft(event.target.value)}
        onBlur={saveDistance} onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); saveDistance() }
          if (event.key === 'Escape' && draft !== null) { event.preventDefault(); event.stopPropagation(); setDraft(null) }
        }} />
    </label>
    <label className={styles.magnetEdges}><Checkbox checked={snapshot.settings.magnetAlignEdges} disabled={disabled}
      onCheckedChange={checked => { if (!disabled) void store.updateMagnet({ magnetAlignEdges: checked }) }} />Alineación con bordes</label>
  </div>
}
