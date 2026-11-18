import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { MapPin, RefreshCw, Search, Settings } from 'lucide-react'
import { AlertDialogForm } from '@/components/ui/alert-dialog'
import { Root as Dialog } from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'
import { Select } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MODULE_REGISTRY } from '@/layout/moduleRegistry'
import { GeneralSettings } from './GeneralSettings'
import { MagnetSettings } from './MagnetSettings'
import { AccessibilitySettings } from './AccessibilitySettings'
import { NoticeSettings } from './NoticeSettings'
import { InitialViewSettings } from './InitialViewSettings'
import { ZoomSettings } from './ZoomSettings'
import { SavedViewsSettings } from './SavedViewsSettings'
import type { DesktopViewsController } from './savedDesktopViews'
import { SETTINGS_MODULE_IDS } from './settingsModuleOrder'
import { timeZoneOptions } from '@/platform/timeZones'
import { toast } from '@/components/ui/sonner'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { FileDialogContent } from '../document/FileDialog'
import { StoragePermissionsPanel } from '../document/PermissionsDialog'
import { useMapSearch } from '../map/useMapSearch'
import { createSettingsDraft, getSettingsStore } from './settingsStore'
import type { SettingsStore } from './settingsStore'
import { createLocationDraft, parseLocationDraft } from './locationDraft'
import type { LocationDraft } from './locationDraft'
import { applySettingsNumberDrafts } from './settingsNumberDrafts'
import { settingsEqual } from './settingsEquality'
import { SettingsExitActions } from './SettingsExitActions'
import styles from './settings.module.css'

const settingsSections = [
  { id: 'general', label: 'General' },
  { id: 'notices', label: 'Avisos' },
  ...SETTINGS_MODULE_IDS
    .map(id => ({ id, label: MODULE_REGISTRY[id].name })),
  { id: 'zoom', label: 'Zoom' },
  { id: 'views', label: 'Vistas' },
  { id: 'magnet', label: 'Iman' },
  { id: 'accessibility', label: 'Accesibilidad' },
  { id: 'location', label: 'Ubicación' },
  { id: 'storage', label: 'Almacenamiento y permisos' },
] as const
export type SettingsSection = typeof settingsSections[number]['id']
const placeKinds: Record<string, string> = { city: 'Ciudad', town: 'Localidad', village: 'Localidad', hamlet: 'Núcleo de población', municipality: 'Municipio', province: 'Provincia', state: 'Región', country: 'País', suburb: 'Barrio' }
export function SettingsDialog({ initialSection = 'general', onClose, onCloseFocus, store: source = getSettingsStore(), desktopViews }: {
  initialSection?: SettingsSection; onClose: () => void; onCloseFocus: () => void; store?: SettingsStore; desktopViews?: DesktopViewsController
}) {
  const draft = useMemo(() => createSettingsDraft(source), [source])
  const store = draft.store
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [section, setSection] = useState(initialSection)
  const [sheetContainer, setSheetContainer] = useState<HTMLDivElement | null>(null)
  const panelId = useId()
  const exitNoticeId = useId()
  const savedSettings = draft.getSavedSettings()
  const [locationEdit, setLocationEdit] = useState(() => ({ baseline: savedSettings, value: createLocationDraft(savedSettings.location) }))
  if (locationEdit.baseline !== savedSettings) setLocationEdit({ baseline: savedSettings, value: createLocationDraft(savedSettings.location) })
  const location = locationEdit.baseline === savedSettings ? locationEdit.value : createLocationDraft(savedSettings.location)
  const [, locationNotice] = useValidationNotice()
  function hasChanges() {
    const current = store.getSnapshot(), saved = draft.getSavedSettings()
    return current.ready && (!settingsEqual(applySettingsNumberDrafts(current.settings, current.numberDrafts), saved)
      || Object.values(current.numberDrafts).some(text => !text.trim() || !Number.isFinite(Number(text)))
      || !settingsEqual(location, createLocationDraft(saved.location)))
  }
  const dirty = hasChanges()
  const exitActions = useRef({ save: () => {}, close: () => {} })
  const noticeId = useId()
  useEffect(() => { void store.reload() }, [store])
  useEffect(() => { if (snapshot.error && !snapshot.loading && !snapshot.saving) toast.error(snapshot.error, { notice: 'settingsError', id: noticeId }) }, [snapshot.error, snapshot.loading, snapshot.saving, noticeId])
  useEffect(() => () => { toast.dismiss(noticeId); toast.dismiss(exitNoticeId) }, [noticeId, exitNoticeId])
  useEffect(() => { if (snapshot.ready && !dirty) toast.dismiss(exitNoticeId) }, [snapshot.ready, dirty, exitNoticeId])
  useLayoutEffect(() => { exitActions.current = { save: () => { void save(true) }, close: discardAndClose } })
  function changeLocation(patch: Partial<LocationDraft>) {
    setLocationEdit(current => ({ ...current, value: { ...current.value, ...patch } }))
  }
  function resetDefaults() {
    if (store.resetToDefaults()) {
      setLocationEdit({ baseline: draft.getSavedSettings(), value: createLocationDraft(null) })
      locationNotice(null)
      toast.dismiss(exitNoticeId)
    }
  }
  function discardAndClose() {
    if (store.getSnapshot().saving) return
    toast.dismiss(exitNoticeId)
    onClose()
  }
  function close() {
    if (store.getSnapshot().saving) return
    if (!hasChanges()) { discardAndClose(); return }
    toast.message('Actualmente hay cambios sin guardar.', { id: exitNoticeId, requiredAction: true, className: styles.unsavedNotice,
      action: <SettingsExitActions store={store} onSave={() => exitActions.current.save()} onClose={() => exitActions.current.close()} /> })
  }
  async function save(closeAfter = false) {
    const current = store.getSnapshot()
    if (!current.ready || current.loading || current.saving) return
    try {
      const settings = applySettingsNumberDrafts({ ...current.settings, location: parseLocationDraft(location) }, current.numberDrafts)
      locationNotice(null)
      if (!await draft.commit(settings)) return
      toast.dismiss(exitNoticeId)
      toast.success('Configuración guardada.', { notice: 'settingsSaved' })
      if (closeAfter) onClose()
    } catch (error) { locationNotice(error instanceof Error ? error.message : 'No se pudo guardar la ubicación.') }
  }
  return <Dialog open modal={false} onOpenChange={open => { if (!open) close() }}>
    <FileDialogContent title="Configuración" icon={Settings} onClose={close} modal={false} dismissOnOutside={false} width={720} height={520} className={styles.dialog}
      onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
      <div className={styles.base}>
        <div ref={setSheetContainer} className={styles.sidebarSlot} />
        {sheetContainer && <Sheet open modal={false}>
          <SheetContent container={sheetContainer} side="left" showCloseButton={false} className={styles.sidebar}
            aria-describedby={undefined} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
            onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { event.preventDefault(); close() }}>
            <SheetTitle className="visually-hidden">Secciones de configuración</SheetTitle>
            <SheetBody>
              <nav className={styles.sections} aria-label="Secciones de configuración">
                {settingsSections.map(item => <Button key={item.id} appearance="integrated" disabled={snapshot.saving}
                  aria-current={section === item.id ? 'page' : undefined} aria-controls={panelId} onClick={() => setSection(item.id)}>{item.label}</Button>)}
              </nav>
            </SheetBody>
          </SheetContent>
        </Sheet>}
        <div id={panelId} className={styles.content}>
          <h2 className={styles.title}>{settingsSections.find(item => item.id === section)?.label}</h2>
          <section className={styles.panel} hidden={section !== 'zoom'} aria-label="Zoom">
            <ZoomSettings store={store} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'views'} aria-label="Vistas">
            <fieldset className={styles.settingsGroup}>
              <legend>Vista inicial</legend>
              <InitialViewSettings store={store} />
            </fieldset>
            <SavedViewsSettings store={store} desktopViews={desktopViews} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'general'} aria-label="General">
            <GeneralSettings store={store} onReset={resetDefaults} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'magnet'} aria-label="Iman">
            <MagnetSettings store={store} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'notices'} aria-label="Avisos">
            <NoticeSettings store={store} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'accessibility'} aria-label="Accesibilidad">
            <AccessibilitySettings store={store} />
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'location'} aria-label="Ubicación predeterminada" data-minimum-scroll-content>
            {snapshot.ready ? <LocationSettings value={location} onChange={changeLocation} disabled={snapshot.saving || snapshot.loading} onSave={() => { void save() }} /> : snapshot.loading ? <p role="status">Consultando…</p> : null}
            {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
          </section>
          <section className={styles.panel} hidden={section !== 'storage'} aria-label="Almacenamiento y permisos">
            <StoragePermissionsPanel />
          </section>
        </div>
        <footer className={styles.footer}>
          <Button disabled={!snapshot.ready || snapshot.loading || snapshot.saving || !dirty} onClick={() => { void save() }}>{snapshot.saving ? 'Guardando…' : 'Guardar'}</Button>
        </footer>
      </div>
    </FileDialogContent>
  </Dialog>
}

function LocationSettings({ value, onChange, disabled, onSave }: { value: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void; disabled: boolean; onSave: () => void }) {
  const { coordinates, query, zone } = value
  const zones = useMemo(() => timeZoneOptions(zone), [zone])
  const search = useMapSearch('app-settings')
  const searchNotice = useId()
  useEffect(() => { if (search.state.status === 'error') toast.error(search.state.message, { notice: 'locationSearch', id: searchNotice }) }, [search.state, searchNotice])
  useEffect(() => () => { toast.dismiss(searchNotice) }, [searchNotice])
  return <div className={styles.location}>
    <form className={styles.search} aria-label="Buscar localidad" onSubmit={event => { event.preventDefault(); if (!disabled && query.trim()) void search.search(query.trim()) }}>
      <InputGroup>
        <Input autoFocus aria-label="Localidad" maxLength={160} value={query} autoComplete="off" disabled={disabled} onChange={event => { onChange({ query: event.target.value }); search.reset() }} />
        <Button type="submit" appearance="integrated" aria-label={search.state.status === 'loading' ? 'Buscando localidad' : 'Buscar localidad'} disabled={disabled || !query.trim() || search.state.status === 'loading'}><Search aria-hidden="true" /></Button>
      </InputGroup>
    </form>
    {search.state.status === 'results' && <div>
      <div className={styles.results} role="group" aria-label="Resultados de búsqueda">
        {search.state.places.map(place => <Button key={place.id} className={styles.result} disabled={disabled} onClick={() => { onChange({ query: place.name, coordinates: `${place.latitude}, ${place.longitude}` }); search.reset() }}>
          <MapPin aria-hidden="true" /><span>{place.kind && `${placeKinds[place.kind] ?? place.kind} · `}{place.label}<small className={styles.resultCoordinates}>{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</small></span>
        </Button>)}
      </div>
      <div className={styles.attribution}><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer">Nominatim</a></div>
    </div>}
    {search.state.status === 'empty' && <p role="status">No se encontraron localidades.</p>}
    <AlertDialogForm className={styles.form} aria-label="Guardar ubicación predeterminada" onSubmit={event => { event.preventDefault(); if (!disabled) onSave() }}>
      <label>Coordenadas<Input aria-label="Coordenadas de la ubicación" value={coordinates} disabled={disabled} onChange={event => onChange({ coordinates: event.target.value })} /></label>
      <label>Zona horaria<Select sizeToOptions aria-label="Zona horaria" value={zone} onValueChange={zone => onChange({ zone })} options={zones} disabled={disabled} /></label>
    </AlertDialogForm>
  </div>
}
