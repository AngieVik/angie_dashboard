import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { MapPin, RefreshCw, Search, Settings, Trash } from 'lucide-react'
import { AlertDialog, AlertDialogForm } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DEFAULT_TIME_ZONE, timeZoneOptions } from '@/platform/timeZones'
import { toast } from '@/components/ui/sonner'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { FileDialogContent } from '../document/FileDialog'
import { StoragePermissionsPanel } from '../document/PermissionsDialog'
import type { DirectoryActions } from '../document/PermissionsDialog'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { toGeographic } from '../coordinates/convertCoordinate'
import { useMapSearch } from '../map/useMapSearch'
import { getSettingsStore } from './settingsStore'
import type { SettingsStore } from './settingsStore'
import type { AppSettings } from './appSettings'
import styles from './settings.module.css'

export type SettingsSection = 'location' | 'storage'
const placeKinds: Record<string, string> = { city: 'Ciudad', town: 'Localidad', village: 'Localidad', hamlet: 'Núcleo de población', municipality: 'Municipio', province: 'Provincia', state: 'Región', country: 'País', suburb: 'Barrio' }
export function SettingsDialog({ initialSection = 'location', onClose, onCloseFocus, onDirectoryAuthorized, onContinueLocally, onDownload, store = getSettingsStore() }: DirectoryActions & {
  initialSection?: SettingsSection; onClose: () => void; onCloseFocus: () => void; store?: SettingsStore
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [section, setSection] = useState(initialSection)
  const noticeId = useId()
  useEffect(() => { void store.reload() }, [store])
  useEffect(() => { if (snapshot.error && !store.getSnapshot().loading) toast.error(snapshot.error, { id: noticeId }) }, [snapshot.error, snapshot.loading, store, noticeId])
  useEffect(() => () => { toast.dismiss(noticeId) }, [noticeId])
  function close() { if (!store.getSnapshot().saving) onClose() }
  return <AlertDialog open onOpenChange={open => { if (!open) close() }}>
    <FileDialogContent title="Configuración" icon={Settings} onClose={close} width={520} height={390} className={styles.dialog}
      onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
      <div className={styles.base}>
        <nav className={styles.sections} aria-label="Secciones de configuración">
          <Button disabled={snapshot.saving} aria-pressed={section === 'location'} onClick={() => setSection('location')}>Ubicación</Button>
          <Button disabled={snapshot.saving} aria-pressed={section === 'storage'} onClick={() => setSection('storage')}>Almacenamiento y permisos</Button>
        </nav>
        <section className={styles.panel} hidden={section !== 'location'} aria-label="Ubicación predeterminada" data-minimum-scroll-content>
          {snapshot.ready ? <LocationSettings key={snapshot.revision ?? 'empty'} settings={snapshot.settings} revision={snapshot.revision} disabled={snapshot.saving || snapshot.loading} store={store} onClose={close} /> : snapshot.loading ? <p role="status">Consultando…</p> : null}
          {snapshot.error && <Button disabled={snapshot.loading || snapshot.saving} onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" />Recargar configuración</Button>}
        </section>
        <section className={styles.panel} hidden={section !== 'storage'} aria-label="Almacenamiento y permisos">
          <StoragePermissionsPanel onDirectoryAuthorized={onDirectoryAuthorized} onDownload={onDownload}
            onContinueLocally={onContinueLocally ? () => { onContinueLocally(); close() } : undefined} />
          <div className={styles.actions}><Button disabled={snapshot.saving} onClick={close}>Cerrar</Button></div>
        </section>
      </div>
    </FileDialogContent>
  </AlertDialog>
}

function LocationSettings({ settings, revision, disabled, store, onClose }: { settings: AppSettings; revision: number | null; disabled: boolean; store: SettingsStore; onClose: () => void }) {
  const [name, setName] = useState(settings.location?.name ?? '')
  const [coordinates, setCoordinates] = useState(settings.location ? `${settings.location.latitude}, ${settings.location.longitude}` : '')
  const [zone, setZone] = useState(settings.location?.timeZone ?? DEFAULT_TIME_ZONE)
  const [zones] = useState(() => timeZoneOptions(settings.location?.timeZone))
  const [query, setQuery] = useState('')
  const search = useMapSearch('app-settings')
  const [, notice] = useValidationNotice()
  const searchNotice = useId()
  useEffect(() => { if (search.state.status === 'error') toast.error(search.state.message, { id: searchNotice }) }, [search.state, searchNotice])
  useEffect(() => () => { toast.dismiss(searchNotice) }, [searchNotice])
  async function save() {
    if (disabled) return
    try {
      let location: AppSettings['location'] = null
      if (coordinates.trim() || name.trim()) {
        if (!name.trim()) throw new Error('Escribe un nombre para la ubicación.')
        const result = parseCoordinate(coordinates)
        if (!result.ok) throw new Error(result.error)
        const point = toGeographic(result.coordinate)
        location = { name: name.trim(), latitude: point.latitude, longitude: point.longitude, timeZone: zone }
      }
      if (await store.save({ location }, revision)) { notice(null); onClose() }
    } catch (error) { notice(error instanceof Error ? error.message : 'No se pudo guardar la ubicación.') }
  }
  return <div className={styles.location}>
    <form className={styles.search} aria-label="Buscar localidad" onSubmit={event => { event.preventDefault(); if (!disabled && query.trim()) void search.search(query.trim()) }}>
      <Input autoFocus aria-label="Localidad" value={query} autoComplete="off" disabled={disabled} onChange={event => { setQuery(event.target.value); search.reset() }} />
      <Button type="submit" disabled={disabled || !query.trim() || search.state.status === 'loading'}><Search aria-hidden="true" />{search.state.status === 'loading' ? 'Buscando…' : 'Buscar'}</Button>
    </form>
    {search.state.status === 'results' && <div>
      <div className={styles.results} role="group" aria-label="Resultados de búsqueda">
        {search.state.places.map(place => <Button key={place.id} className={styles.result} disabled={disabled} onClick={() => { setName(place.name); setCoordinates(`${place.latitude}, ${place.longitude}`); search.reset() }}>
          <MapPin aria-hidden="true" /><span>{place.kind && `${placeKinds[place.kind] ?? place.kind} · `}{place.label}<small className={styles.resultCoordinates}>{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</small></span>
        </Button>)}
      </div>
      <div className={styles.attribution}><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer">Nominatim</a></div>
    </div>}
    {search.state.status === 'empty' && <p role="status">No se encontraron localidades.</p>}
    <AlertDialogForm className={styles.form} aria-label="Guardar ubicación predeterminada" onSubmit={event => { event.preventDefault(); void save() }}>
      <label>Nombre<Input aria-label="Nombre de la ubicación" maxLength={160} value={name} disabled={disabled} onChange={event => setName(event.target.value)} /></label>
      <label>Coordenadas<Input aria-label="Coordenadas de la ubicación" value={coordinates} disabled={disabled} onChange={event => setCoordinates(event.target.value)} /></label>
      <label>Zona horaria<Select aria-label="Zona horaria" value={zone} onValueChange={setZone} options={zones} disabled={disabled} /></label>
      <div className={styles.actions}>
        <Button disabled={disabled || !name && !coordinates} aria-label="Quitar ubicación predeterminada" onClick={() => { setName(''); setCoordinates(''); search.reset() }}><Trash aria-hidden="true" /></Button>
        <Button type="submit" disabled={disabled}>{store.getSnapshot().saving ? 'Guardando…' : 'Guardar'}</Button>
        <Button disabled={disabled} onClick={onClose}>Cancelar</Button>
      </div>
    </AlertDialogForm>
  </div>
}
