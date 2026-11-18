import { useState, useSyncExternalStore } from 'react'
import { AlertDialogForm } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { SAVED_DESKTOP_VIEWS_LIMIT, SAVED_VIEW_NAME_LIMIT } from './savedDesktopViews'
import type { DesktopViewsController } from './savedDesktopViews'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function SavedViewsSettings({ store, desktopViews }: { store: SettingsStore; desktopViews?: DesktopViewsController }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  const views = snapshot.settings.savedDesktopViews
  const selected = views.find(view => view.id === selectedId) ?? views[0]
  async function save() {
    if (disabled || !name.trim() || views.length >= SAVED_DESKTOP_VIEWS_LIMIT) return
    const desktop = desktopViews?.capture()
    if (!desktop) return
    const id = await store.saveDesktopView(name.trim(), desktop)
    if (id) { setSelectedId(id); setName('') }
  }
  return <fieldset className={styles.settingsGroup}>
    <legend>Disposiciones guardadas</legend>
    <AlertDialogForm className={styles.savedViewForm} aria-label="Guardar disposición del escritorio" onSubmit={event => { event.preventDefault(); void save() }}>
      <label>Nombre<Input aria-label="Nombre de la vista" required maxLength={SAVED_VIEW_NAME_LIMIT} disabled={disabled} value={name} onChange={event => setName(event.target.value)} /></label>
      <div className={styles.savedViewActions}><Button type="submit" disabled={disabled || !desktopViews?.canCapture || !name.trim() || views.length >= SAVED_DESKTOP_VIEWS_LIMIT}>Guardar</Button></div>
    </AlertDialogForm>
    {views.length >= SAVED_DESKTOP_VIEWS_LIMIT && <p>Se ha alcanzado el límite de {SAVED_DESKTOP_VIEWS_LIMIT} vistas guardadas.</p>}
    {views.length === 0 ? <p>No hay vistas guardadas.</p> : <div className={styles.savedViewForm}>
      <label>Vista guardada<Select aria-label="Vista guardada" value={selected?.id ?? ''} disabled={disabled}
        onValueChange={setSelectedId} options={views.map(view => ({ value: view.id, label: view.name }))} /></label>
      <div className={styles.savedViewActions}><Button disabled={disabled || !desktopViews?.canRestore || !selected} onClick={() => {
        if (selected && desktopViews?.restore(selected.desktop)) toast.success('Vista recuperada.', { notice: 'viewRestored' })
      }}>Cargar</Button>
      <Button disabled={disabled || !selected} onClick={() => {
        if (!selected) return
        const current = store.getSnapshot()
        void store.save({ ...current.settings, savedDesktopViews: current.settings.savedDesktopViews.filter(view => view.id !== selected.id) }, current.revision)
      }}>Eliminar</Button></div>
    </div>}
  </fieldset>
}
