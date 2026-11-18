import { useSyncExternalStore } from 'react'
import { Input } from '@/components/ui/input'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN } from '@/layout/viewportMath'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function InitialZoomSetting({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const draft = snapshot.numberDrafts.initialZoom ?? null
  const setDraft = (value: string | null) => store.setNumberDraft('initialZoom', value)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  function save() {
    if (!disabled) store.commitNumberDraft('initialZoom')
  }
  return <label>Zoom inicial<span className={styles.initialZoom}>
    <Input type="number" inputMode="decimal" aria-label="Zoom inicial del escritorio" disabled={disabled}
      min={VIEWPORT_ZOOM_MIN * 100} max={VIEWPORT_ZOOM_MAX * 100} step={1}
      value={draft ?? Math.round(snapshot.settings.initialZoom * 100)} onChange={event => setDraft(event.target.value)} onBlur={save}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); save() }
        if (event.key === 'Escape' && draft !== null) { event.preventDefault(); event.stopPropagation(); setDraft(null) }
      }} /><span aria-hidden="true">%</span>
  </span></label>
}
