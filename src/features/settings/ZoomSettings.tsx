import { useSyncExternalStore } from 'react'
import { Input } from '@/components/ui/input'
import { ZOOM_STEP_DEFAULT, ZOOM_STEP_MAX } from '@/layout/viewportMath'
import { InitialZoomSetting } from './InitialZoomSetting'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function ZoomSettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const draft = snapshot.numberDrafts.zoomStep ?? null
  const setDraft = (value: string | null) => store.setNumberDraft('zoomStep', value)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  function saveStep() {
    if (!disabled) store.commitNumberDraft('zoomStep')
  }
  return <div className={styles.initialOptions}>
    <InitialZoomSetting store={store} />
    <label>Paso de aumento/reducción (puntos porcentuales)
      <span className={styles.initialZoom}><Input type="number" inputMode="numeric" aria-label="Paso de zoom en puntos porcentuales"
        min={ZOOM_STEP_DEFAULT} max={ZOOM_STEP_MAX} step={1} disabled={disabled} value={draft ?? snapshot.settings.zoomStep}
        onChange={event => setDraft(event.target.value)} onBlur={saveStep} onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); saveStep() }
          if (event.key === 'Escape' && draft !== null) { event.preventDefault(); event.stopPropagation(); setDraft(null) }
        }} /></span>
    </label>
  </div>
}
