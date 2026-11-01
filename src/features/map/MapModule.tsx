import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent, ReactNode } from 'react'
import { Copy, Crosshair, Eye, EyeOff, Flag, Focus, FolderOpen, Layers, Minus, Palette, Plus, Route, Search, Trash, X } from 'lucide-react'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import * as L from 'leaflet'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/sonner'
import { copyText } from '../../platform/clipboard'
import { checkGpxPointTotal, InputBudgetError } from '../../domain/input/inputBudgets'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { convertCoordinate, toGeographic } from '../coordinates/convertCoordinate'
import type { CoordinateFormat, GeographicCoordinate } from '../coordinates/coordinateTypes'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { PK_INTERVALS } from './gpx'
import type { LoadedGpx } from './gpx'
import { pickGpxFiles, readGpxFile } from './gpxFileAccess'
import { useGpxFiles } from './useGpxFiles'
import { releaseGpxOriginals } from '../../storage/gpxResources'
import { rememberGpxAccess } from '../../storage/gpxAccessRepository'
import type { GpxReadHandle } from '../../storage/gpxAccessRepository'
import { closestGpxLocation, getGpxMetrics } from './gpxMetrics'
import type { GpxLocation } from './gpxMetrics'
import { MAX_MAP_LATITUDE, readMapView, writeMapView, writeMapFrame } from './mapNavigation'
import { MAP_BACKGROUNDS, PNOA_INFORMATION } from './mapBackgrounds'
import type { MapBackground } from './mapBackgrounds'
import type { MapDocument, MapGpxReference, MapMarker } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { replaceMap } from '../document/documentEdits'
import { MapMarkers } from './MapMarkers'
import { MapSurfaceContext } from './MapSurfaceContext'
import { MapLegend } from './MapLegend'
import { classifyMapQuery } from './mapSearch'
import type { MapPlace } from './mapSearch'
import { useMapSearch } from './useMapSearch'
import { MapElevation } from './MapElevation'
import { GpxLayers } from './gpxLayers'
import { GpxElevationProfile } from './GpxElevationProfile'
import type { GpxProfileSample } from './gpxProfile'
import styles from './map.module.css'

interface MapSelection extends GeographicCoordinate { gpx?: { fileId: string; location: GpxLocation } }
const GPX_COLORS = ['#D63A3A', '#3697DC', '#54B777', '#E69B37', '#A377D8']
const EMPTY_REFERENCES: MapGpxReference[] = []
const EMPTY_MARKERS: MapMarker[] = []
const kilometers = (meters: number) => (meters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km'

export interface MapNotice {
  cartography: string[]
  missing: { id: string; name: string }[]
  access: string[]
  errors: string[]
  busy: boolean
  onChoose: (id?: string | null) => void
  onOpenGpx: () => void
}

export function MapModule({ navigationKey, store, overlay, onCoordinateSelect, onNoticesChange, noticeSource = 'map' }: {
  navigationKey: string
  store: DocumentStore
  overlay?: ReactNode
  onCoordinateSelect?: (point: GeographicCoordinate) => void
  onNoticesChange: (source: 'map' | 'plan', notice: MapNotice | null) => void
  noticeSource?: 'map' | 'plan'
}) {
  const { document: currentDocument, documentGeneration, workspaceStatus } = useDocumentStore(store)
  const references = currentDocument.map?.gpx ?? EMPTY_REFERENCES
  const markers = currentDocument.map?.markers ?? EMPTY_MARKERS
  const { files, onFilesChange, loadGpx, admitGpx, withGpxAdmission, getGpxGeometry } = useGpxFiles(store, documentGeneration, references)
  const canvas = useRef<HTMLDivElement>(null), inputFile = useRef<HTMLInputElement>(null)
  const coordinatesTrigger = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const coordinatesMenuId = useId()
  const markersTrigger = useRef<HTMLButtonElement>(null)
  const markersMenuId = useId()
  const gpxTrigger = useRef<HTMLButtonElement>(null), gpxColorInput = useRef<HTMLInputElement>(null)
  const gpxMenuId = useId()
  const mapRef = useRef<L.Map | null>(null), gpxLayers = useRef<GpxLayers | null>(null)
  const currentFiles = useRef(files)
  const publishFiles = useRef(onFilesChange)
  const currentFormat = useRef<CoordinateFormat>('DD')
  const selection = useRef<L.CircleMarker | null>(null)
  const request = useRef<{ revision: number; reading: boolean; controller?: AbortController }>({ revision: 0, reading: false })
  const relinkTarget = useRef<string | null>(null)
  const touches = useRef(new Set<number>()), cancelledTouch = useRef(false), suppressSelection = useRef(false)
  const { blocked, blockedRef } = useViewportInteraction()
  const { fitContentRef } = useModuleZoom()
  const [input, setInput] = useState('')
  const [error, setError] = useValidationNotice(null, documentGeneration, null)
  const [busy, setBusy] = useState(false), [tileError, setTileError] = useState(false)
  const [informationTileError, setInformationTileError] = useState(false)
  const [accessWarnings, setAccessWarnings] = useState<string[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [useFileInput, setUseFileInput] = useState(false)
  const [selected, setSelected] = useState<MapSelection | null>(null)
  const publishCoordinate = useRef(onCoordinateSelect)
  useLayoutEffect(() => { publishCoordinate.current = onCoordinateSelect }, [onCoordinateSelect])
  function selectCoordinate(point: MapSelection) {
    setSelected(point)
    publishCoordinate.current?.(point)
  }
  const [coordinatesOpen, setCoordinatesOpen] = useState(true)
  const [markersOpen, setMarkersOpen] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [gpxOpen, setGpxOpen] = useState(false), [selectedGpxId, setSelectedGpxId] = useState<string | null>(null)
  const [profileControls, setProfileControls] = useState<HTMLDivElement | null>(null)
  const [mapZoom, setMapZoom] = useState(() => readMapView(navigationKey).zoom)
  const [background, setBackground] = useState(() => readMapView(navigationKey).background)
  const [pnoaInformation, setPnoaInformation] = useState(() => readMapView(navigationKey).pnoaInformation)
  const showInformation = background === 'pnoa' && pnoaInformation
  const [format, setFormat] = useState<CoordinateFormat>('DD')
  const noticeId = navigationKey + '-map-notice'
  const cancelImport = useCallback(() => {
    request.current.revision++; request.current.controller?.abort(); request.current.controller = undefined
    request.current.reading = false; setBusy(false)
  }, [])
  useLayoutEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const snapshot = store.getSnapshot()
      if (snapshot.replacing || !snapshot.active || snapshot.documentGeneration !== documentGeneration) {
        cancelImport(); gpxLayers.current?.dispose()
      }
    })
    return () => { unsubscribe(); cancelImport() }
  }, [store, documentGeneration, cancelImport])
  const selectionRevision = useRef(0)
  const { state: searchState, search: searchPlaces, reset: resetSearch } = useMapSearch(navigationKey)
  useEffect(() => {
    if (searchState.status === 'error') toast.error(searchState.message, { id: noticeId })
    else if (searchState.status === 'empty') toast('No se encontraron lugares.', { id: noticeId })
  }, [searchState, noticeId])
  useEffect(() => () => { selectionRevision.current++; toast.dismiss(noticeId) }, [noticeId])

  function mutateMap(update: (map: MapDocument) => MapDocument): boolean {
    if (blockedRef.current || store.getSnapshot().documentGeneration !== documentGeneration) return false
    try {
      const accepted = store.applyDocumentCommand(document => replaceMap(document, update(document.map ?? { markers: [], gpx: [] })))
      if (!accepted) { setError(store.getSnapshot().fileMessage); return false }
      setError(null)
      return true
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'No se pudieron guardar los cambios del mapa.', { id: noticeId })
      return false
    }
  }
  function changeReferences(update: (files: MapGpxReference[]) => MapGpxReference[]) {
    mutateMap(map => ({ ...map, gpx: update(map.gpx) }))
  }
  function editMarker(id: string, patch: Partial<Omit<MapMarker, 'id'>>) {
    return mutateMap(map => ({ ...map, markers: map.markers.map(marker => marker.id === id ? { ...marker, ...patch } : marker) }))
  }
  function selectMarker(marker: MapMarker) {
    if (blockedRef.current) return
    resetSearch()
    const formatted = convertCoordinate({ ...marker, format: 'DD' }, format)
    selectCoordinate({ latitude: marker.latitude, longitude: marker.longitude })
    setSelectedGpxId(null)
    setSelectedMarkerId(marker.id)
    if (formatted.ok) setInput(formatted.text)
    else { setFormat('DD'); setInput(`${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}`) }
  }
  function centerMarker(marker: MapMarker) {
    if (blockedRef.current) return
    selectMarker(marker)
    mapRef.current?.panTo([marker.latitude, marker.longitude], { animate: false })
  }
  function removeMarker(id: string) {
    let neighbor: MapMarker | undefined
    if (mutateMap(map => {
      const index = map.markers.findIndex(marker => marker.id === id)
      if (index < 0) return map
      neighbor = map.markers[index + 1] ?? map.markers[index - 1]
      return { ...map, markers: map.markers.filter(marker => marker.id !== id) }
    }) && selectedMarkerId === id) {
      if (neighbor) selectMarker(neighbor)
      else { setSelectedMarkerId(null); setSelected(null) }
    }
  }
  function addMarker() {
    if (blockedRef.current) return
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(parsed.error); return }
    const point = toGeographic(parsed.coordinate)
    if (Math.abs(point.latitude) > MAX_MAP_LATITUDE) { setError('Esta cartografía admite latitudes entre −85,05° y 85,05°.'); return }
    const id = crypto.randomUUID()
    if (mutateMap(map => ({ ...map, markers: [...map.markers, { id, name: `M.${map.markers.length + 1}`, ...point, color: GPX_COLORS[0]! }] }))) { selectCoordinate(point); setSelectedGpxId(null); setSelectedMarkerId(id) }
  }
  function closeMarkers() {
    setMarkersOpen(false)
    markersTrigger.current?.focus()
  }
  function closeGpx() {
    setGpxOpen(false)
    gpxTrigger.current?.focus()
  }
  function selectGpx(id: string) {
    if (blockedRef.current) return
    resetSearch()
    setSelectedGpxId(id)
    setSelectedMarkerId(null)
    setSelected(null)
  }
  function selectProfilePoint(fileId: string, sample: GpxProfileSample) {
    if (blockedRef.current) return
    if (Math.abs(sample.point.latitude) > MAX_MAP_LATITUDE) { setError('Esta cartografía admite latitudes entre −85,05° y 85,05°.'); return }
    resetSearch(); setError(null)
    selectCoordinate({ ...sample.point, gpx: { fileId, location: { point: sample.point, distanceMeters: sample.distanceMeters, offsetMeters: 0 } } })
    setSelectedGpxId(fileId); setSelectedMarkerId(null)
    const formatted = convertCoordinate({ ...sample.point, format: 'DD' }, format)
    if (formatted.ok) setInput(formatted.text)
    else { setFormat('DD'); setInput(`${sample.point.latitude.toFixed(6)}, ${sample.point.longitude.toFixed(6)}`) }
    mapRef.current?.panTo([sample.point.latitude, sample.point.longitude], { animate: false })
  }
  async function loadChosenFiles(selection: Promise<({ file: File; handle?: never } | { handle: GpxReadHandle; file?: never })[]>, targetId: string | null) {
    if (request.current.reading || blockedRef.current) return
    const current = ++request.current.revision
    const controller = new AbortController()
    request.current.controller = controller
    request.current.reading = true; setBusy(true); setError(null)
    const added: LoadedGpx[] = [], errors: string[] = []
    let originalsRead = false
    const stagedOriginals = new Set<string>()
    const isCurrent = () => !controller.signal.aborted && current === request.current.revision &&
      store.getSnapshot().active && !store.getSnapshot().replacing && store.getSnapshot().documentGeneration === documentGeneration
    let chosen: Awaited<typeof selection>
    try { chosen = await selection } catch (failure) {
      if (isCurrent()) {
        if (!(failure instanceof DOMException && failure.name === 'AbortError')) {
          setUseFileInput(true)
          toast.error('No se pudo abrir el selector GPX. Vuelve a seleccionar el archivo.', { id: noticeId })
        }
        setBusy(false); request.current.reading = false
      }
      return
    }
    const failedAccess: string[] = [], rememberedAccess: string[] = []
    try {
      for (const choice of chosen) {
        if (!isCurrent()) return
        let name = choice.file?.name ?? choice.handle!.name
        try {
          await withGpxAdmission(async allowance => {
            if (!isCurrent()) return
            const file = choice.file ?? await choice.handle!.getFile()
            name = file.name
            if (!isCurrent()) return
            const saved = store.getSnapshot().document.map?.gpx ?? EMPTY_REFERENCES
            const target = targetId ? saved.find(item => item.id === targetId) : undefined
            if (targetId && !target) return
            const { fingerprint, data } = await readGpxFile(file, target?.fingerprint, true, { documentGeneration, signal: controller.signal, allowance, getCached: getGpxGeometry })
            stagedOriginals.add(fingerprint)
            if (!isCurrent()) return
            admitGpx([...currentFiles.current, { fingerprint, data }])
            originalsRead = true
            if (choice.handle) (await rememberGpxAccess(fingerprint, choice.handle) ? rememberedAccess : failedAccess).push(fingerprint)
            if (!isCurrent()) return
            const live = store.getSnapshot().document.map?.gpx ?? EMPTY_REFERENCES
            const reference = targetId ? live.find(item => item.id === targetId && item.fingerprint === fingerprint) : live.find(item => item.fingerprint === fingerprint)
            if (targetId && !reference) return
            if (currentFiles.current.some(item => item.fingerprint === fingerprint)) return
            const loaded: LoadedGpx = { ...(reference ?? {
              id: crypto.randomUUID(), name: file.name, size: file.size, lastModified: file.lastModified, fingerprint, visible: true,
              color: GPX_COLORS[saved.length % GPX_COLORS.length]!,
              kilometers: false, kilometerInterval: 1,
            }), data }
            const accepted = reference ? !blockedRef.current : mutateMap(map => {
              const { data: _data, ...nextReference } = loaded
              void _data
              return { ...map, gpx: [...map.gpx, nextReference] }
            })
            if (!accepted || !isCurrent()) return
            // Publish before releasing admission: later files share the remaining
            // allowance and this file can already appear while the next is parsed.
            const next = [...currentFiles.current, loaded]
            currentFiles.current = next; publishFiles.current(next); added.push(loaded)
          })
        } catch (failure) { errors.push(`${name}: ${failure instanceof Error ? failure.message : 'No se pudo leer el archivo.'}`) }
      }
      if (!isCurrent()) return
      if (added.length) {
        selectGpx(added[0]!.id)
        const bounds = L.latLngBounds([])
        for (const file of added) if (file.visible && file.data.bounds) bounds.extend(file.data.bounds)
        if (bounds.isValid()) mapRef.current?.fitBounds(bounds, { padding: [24, 24], maxZoom: 16, animate: false })
      }
      if (originalsRead) void store.protectGpxResources()
      setAccessWarnings(current => [...new Set([...current.filter(fingerprint => !rememberedAccess.includes(fingerprint)), ...failedAccess])])
      setImportErrors(errors)
      if (errors.length) toast.error('No se pudieron cargar algunos archivos GPX.', { id: noticeId })
      setBusy(false); request.current.reading = false
    } finally {
      if (isCurrent()) { request.current.reading = false; request.current.controller = undefined; setBusy(false) }
      const live = new Set(store.getSnapshot().document.map?.gpx.map(reference => reference.fingerprint) ?? [])
      releaseGpxOriginals([...stagedOriginals].filter(fingerprint => !live.has(fingerprint)))
    }
  }
  function chooseFiles(id: string | null = null) {
    if (blockedRef.current || request.current.reading || !inputFile.current) return
    try {
      const picked = useFileInput ? null : pickGpxFiles(id === null)
      if (picked) {
        void loadChosenFiles(picked.then(handles => handles.map(handle => ({ handle }))), id)
        return
      }
    } catch { /* Use the standard input if persistent access is unavailable. */ }
    relinkTarget.current = id
    inputFile.current.multiple = id === null
    inputFile.current.click()
  }
  const pendingPicker = useRef(chooseFiles)
  useLayoutEffect(() => { pendingPicker.current = chooseFiles })

  useLayoutEffect(() => { currentFiles.current = files; currentFormat.current = format; publishFiles.current = onFilesChange }, [files, format, onFilesChange])

  useEffect(() => {
    if (blocked || busy) return
    let cancelled = false
    const revision = request.current.revision
    const isCurrent = () => !cancelled && request.current.revision === revision && !request.current.reading &&
      store.getSnapshot().documentGeneration === documentGeneration && !blockedRef.current
    async function recover() {
      for (const reference of references) {
        if (!isCurrent()) return
        if (currentFiles.current.some(file => file.id === reference.id && file.fingerprint === reference.fingerprint)) continue
        try {
          const data = await loadGpx(reference)
          if (!data) continue
          if (!isCurrent()) return
          checkGpxPointTotal([...currentFiles.current, { fingerprint: reference.fingerprint, data }])
          const liveReference = store.getSnapshot().document.map?.gpx.find(item => item.id === reference.id && item.fingerprint === reference.fingerprint)
          if (!liveReference) continue
          // Recovery never edits the document or replaces its saved adjustments.
          const next = [...currentFiles.current.filter(item => item.id !== reference.id), { ...liveReference, data }]
          currentFiles.current = next
          publishFiles.current(next)
        } catch (failure) {
          if (failure instanceof InputBudgetError) setImportErrors(current => [...new Set([...current, failure.message])])
          // The named pending reference remains available for reselection.
        }
      }
    }
    void recover()
    return () => { cancelled = true }
  }, [references, documentGeneration, navigationKey, blocked, busy, blockedRef, store, loadGpx])

  useLayoutEffect(() => {
    const node = canvas.current
    if (!node) return
    const pendingRequest = request.current
    const view = readMapView(navigationKey)
    const map = L.map(node, { zoomControl: false, minZoom: 2, maxZoom: 19, zoomSnap: .25, zoomDelta: .25, wheelPxPerZoomLevel: 240, preferCanvas: true, zoomAnimation: false })
      .setView([view.latitude, view.longitude], view.zoom)
    mapRef.current = map
    const renderedGpx = new GpxLayers(map)
    gpxLayers.current = renderedGpx
    function rememberFrame() {
      if (!node || !node.clientWidth || !node.clientHeight) return
      const size = map.getSize(), center = map.getPixelBounds().getCenter()
      writeMapFrame(navigationKey, { x: center.x, y: center.y, zoom: map.getZoom(), width: size.x, height: size.y })
    }
    map.on('moveend resize', rememberFrame)
    rememberFrame()
    map.attributionControl.addAttribution('Búsqueda: <a href="https://nominatim.org">Nominatim</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
    L.control.scale({ imperial: false }).addTo(map)
    map.on('click', event => {
      if (blockedRef.current || suppressSelection.current) return
      resetSearch()
      const coordinate = { latitude: event.latlng.lat, longitude: event.latlng.wrap().lng }
      let nearest: MapSelection['gpx']
      for (const file of currentFiles.current) {
        if (!file.visible) continue
        const location = closestGpxLocation(file.data, coordinate)
        if (location && (!nearest || location.offsetMeters < nearest.location.offsetMeters)) nearest = { fileId: file.id, location }
      }
      const snapped = nearest && map.latLngToContainerPoint([nearest.location.point.latitude, nearest.location.point.longitude]).distanceTo(map.latLngToContainerPoint(event.latlng)) <= 14
      const point = snapped && nearest ? { ...nearest.location.point, gpx: nearest } : coordinate
      setSelected(point)
      publishCoordinate.current?.(point)
      setSelectedGpxId(snapped && nearest ? nearest.fileId : null)
      setSelectedMarkerId(null)
      const formatted = convertCoordinate({ ...point, format: 'DD' }, currentFormat.current)
      if (formatted.ok) setInput(formatted.text)
      else { currentFormat.current = 'DD'; setFormat('DD'); setInput(`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`) }
    })
    map.on('zoomend', () => setMapZoom(map.getZoom()))
    map.on('moveend', () => {
      const center = map.getCenter().wrap()
      writeMapView(navigationKey, { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, center.lat)), longitude: center.lng, zoom: map.getZoom() })
    })
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { if (node.clientWidth && node.clientHeight) map.invalidateSize({ pan: false }) })
    })
    observer.observe(node)
    return () => {
      pendingRequest.revision++; pendingRequest.controller?.abort(); pendingRequest.reading = false
      observer.disconnect(); cancelAnimationFrame(frame)
      renderedGpx.dispose(); gpxLayers.current = null
      map.remove(); mapRef.current = null; selection.current = null
    }
  }, [navigationKey, blockedRef, resetSearch])

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = MAP_BACKGROUNDS[background]
    const tiles = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: 19, zIndex: 1 })
    const failures = new Set<HTMLImageElement>()
    setTileError(false)
    tiles.on('tileerror', event => { failures.add((event as L.TileErrorEvent).tile); setTileError(true) })
    tiles.on('tileload tileunload', event => { failures.delete((event as L.TileEvent).tile as HTMLImageElement); setTileError(failures.size > 0) })
    tiles.addTo(map)
    return () => { tiles.remove(); tiles.off() }
  }, [background, navigationKey])

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map || !showInformation) return
    const tiles = L.tileLayer(PNOA_INFORMATION.url, { attribution: PNOA_INFORMATION.attribution, maxZoom: 19, zIndex: 2 })
    const failures = new Set<HTMLImageElement>()
    tiles.on('tileerror', event => { failures.add((event as L.TileErrorEvent).tile); setInformationTileError(true) })
    tiles.on('tileload tileunload', event => { failures.delete((event as L.TileEvent).tile as HTMLImageElement); setInformationTileError(failures.size > 0) })
    tiles.addTo(map)
    return () => { tiles.remove(); tiles.off() }
  }, [showInformation, navigationKey])

  function changeInformation(next: boolean) {
    const map = mapRef.current
    if (blockedRef.current || !map || background !== 'pnoa') return
    const center = map.getCenter().wrap()
    writeMapView(navigationKey, { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, center.lat)), longitude: center.lng, zoom: map.getZoom(), pnoaInformation: next })
    if (next !== pnoaInformation) setInformationTileError(false)
    setPnoaInformation(next)
  }

  function changeBackground(next: MapBackground) {
    const map = mapRef.current
    if (blockedRef.current || !map) return
    const center = map.getCenter().wrap()
    writeMapView(navigationKey, { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, center.lat)), longitude: center.lng, zoom: map.getZoom(), background: next })
    if (next !== background) setInformationTileError(false)
    setBackground(next)
  }

  useEffect(() => {
    // A finger can be lifted outside the map after starting a drag or pinch.
    const pointers = touches.current
    function release(event: globalThis.PointerEvent) {
      if (!pointers.delete(event.pointerId)) return
      if (!pointers.size && !blockedRef.current) { mapRef.current?.dragging.enable(); mapRef.current?.touchZoom.enable() }
    }
    document.addEventListener('pointerup', release)
    document.addEventListener('pointercancel', release)
    return () => { document.removeEventListener('pointerup', release); document.removeEventListener('pointercancel', release); pointers.clear() }
  }, [blockedRef])

  useEffect(() => {
    if (!fitContentRef) return
    const fit = () => ({ width: 600, height: 400 })
    fitContentRef.current = fit
    return () => { if (fitContentRef.current === fit) fitContentRef.current = null }
  }, [fitContentRef])

  useEffect(() => {
    gpxLayers.current?.sync(files, mapZoom)
  }, [files, mapZoom, navigationKey])

  useEffect(() => {
    const map = mapRef.current
    selectionRevision.current++
    if (!map) return
    if (!selected) { selection.current?.remove(); selection.current = null; return }
    const point = L.latLng(selected.latitude, selected.longitude)
    if (selection.current) selection.current.setLatLng(point)
    else selection.current = L.circleMarker(point, { radius: 7, color: '#D63A3A', weight: 2, fillColor: '#FFFFFF', fillOpacity: .8 }).addTo(map)
  }, [selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (blocked) { map.dragging.disable(); map.touchZoom.disable(); map.scrollWheelZoom.disable() }
    else if (!touches.current.size) { map.dragging.enable(); map.touchZoom.enable(); map.scrollWheelZoom.enable() }
  }, [blocked])

  function fitFiles(ids = files.filter(file => file.visible).map(file => file.id)) {
    if (blockedRef.current) return
    const points = files.filter(file => ids.includes(file.id)).flatMap(file => [...file.data.lines.flat(), ...file.data.waypoints])
    if (points.length) mapRef.current?.fitBounds(L.latLngBounds(points.map(point => L.latLng(point.latitude, point.longitude))), { padding: [24, 24], maxZoom: 16, animate: false })
  }
  function goToCoordinate() {
    if (blockedRef.current) return
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(parsed.error); return }
    const coordinate = toGeographic(parsed.coordinate)
    if (Math.abs(coordinate.latitude) > MAX_MAP_LATITUDE) { setError('Esta cartografía admite latitudes entre −85,05° y 85,05°.'); return }
    const formatted = convertCoordinate(parsed.coordinate, format)
    setError(null); setInput(formatted.ok ? formatted.text : parsed.normalizedInput); selectCoordinate(coordinate); setSelectedGpxId(null); setSelectedMarkerId(null)
    if (!formatted.ok) setFormat(parsed.coordinate.format)
    mapRef.current?.setView([coordinate.latitude, coordinate.longitude], 15, { animate: false })
  }
  function searchMap() {
    if (blockedRef.current) return
    resetSearch(); setError(null)
    const query = classifyMapQuery(input)
    if (query.kind === 'invalid') { setError(query.error); return }
    if (query.kind === 'coordinate') { goToCoordinate(); return }
    void searchPlaces(query.query)
  }
  function choosePlace(place: MapPlace) {
    if (blockedRef.current) return
    resetSearch(); setError(null)
    const point = { latitude: place.latitude, longitude: place.longitude }
    const formatted = convertCoordinate({ ...point, format: 'DD' }, format)
    if (formatted.ok) setInput(formatted.text)
    else { setFormat('DD'); setInput(`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`) }
    selectCoordinate(point); setSelectedGpxId(null); setSelectedMarkerId(null)
    mapRef.current?.setView([point.latitude, point.longitude], 15, { animate: false })
    searchInput.current?.focus()
  }
  async function loadFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    const targetId = relinkTarget.current
    relinkTarget.current = null
    event.target.value = ''
    if (!chosen.length) return
    await loadChosenFiles(Promise.resolve(chosen.map(file => ({ file }))), targetId)
  }

  const openGpx = useCallback(() => setGpxOpen(true), [])
  useEffect(() => {
    const cartography = [tileError ? MAP_BACKGROUNDS[background].name + ': cartografía incompleta o no disponible.' : null,
      showInformation && informationTileError ? 'Callejero IGN: cartografía incompleta o no disponible.' : null].filter((message): message is string => Boolean(message))
    const missing = references.filter(reference => !files.some(file => file.id === reference.id)).map(({ id, name }) => ({ id, name }))
    const access = workspaceStatus === 'saved' ? [] : references.filter(reference => accessWarnings.includes(reference.fingerprint)).map(reference => reference.name)
    onNoticesChange(noticeSource, cartography.length || missing.length || access.length || importErrors.length ? {
      cartography, missing, access, errors: importErrors, busy: busy || blocked, onChoose: id => pendingPicker.current(id), onOpenGpx: openGpx,
    } : null)
  }, [tileError, background, showInformation, informationTileError, references, files, workspaceStatus, accessWarnings, importErrors, busy, blocked, openGpx, noticeSource, onNoticesChange])
  useEffect(() => () => onNoticesChange(noticeSource, null), [noticeSource, onNoticesChange])
  const canCopy = parseCoordinate(input).ok
  const activeFile = references.find(file => file.id === selectedGpxId)
  const selectedFile = files.find(file => file.id === activeFile?.id)
  const selectedLocation = selectedFile?.visible && selected?.gpx?.fileId === selectedFile.id ? selected.gpx.location : undefined
  const selectedMetrics = selectedFile ? getGpxMetrics(selectedFile.data) : undefined
  async function copyCoordinate() {
    if (!canCopy || blockedRef.current) return
    const current = ++selectionRevision.current
    const result = await copyText(input.trim())
    if (current !== selectionRevision.current) return
    if (store.getSnapshot().documentGeneration !== documentGeneration) return
    if (!result) { toast.error('No se pudo copiar la coordenada.', { id: noticeId }); return }

  }
  function touchStart(event: PointerEvent<HTMLDivElement>) {
    if (!touches.current.size) { cancelledTouch.current = false; suppressSelection.current = false }
    if (event.pointerType !== 'touch') return
    touches.current.add(event.pointerId)
    if (touches.current.size >= 2) { suppressSelection.current = true; mapRef.current?.dragging.disable() }
    if (touches.current.size >= 3) {
      cancelledTouch.current = true; mapRef.current?.touchZoom.disable()
    }
  }
  return <div data-slot="map-module" className={`${styles.base} map-module`} data-coordinates-open={coordinatesOpen} aria-busy={busy}>
    <div className="map-toolbar" hidden={!coordinatesOpen}>
      <form id={coordinatesMenuId} aria-label="Buscar en el mapa" onSubmit={event => { event.preventDefault(); searchMap() }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resetSearch(); setCoordinatesOpen(false); coordinatesTrigger.current?.focus() }
      }}>
        <Select aria-label="Formato de coordenadas del mapa" value={format} disabled={blocked} onValueChange={value => {
          const next = value as CoordinateFormat
          selectionRevision.current++; setFormat(next)
          const parsed = parseCoordinate(input)
          if (parsed.ok) {
            const formatted = convertCoordinate(parsed.coordinate, next)
            if (formatted.ok) { setInput(formatted.text); setError(null) }
            else setError(formatted.error)
          }
        }} options={(['DD', 'DMS', 'DMM', 'UTM'] as const).map(value => ({ value, label: value }))} />
        <InputGroup className="map-coordinate-field">
          <Input ref={searchInput} className="map-coordinate-input" aria-label="Lugar, dirección o coordenadas" aria-invalid={Boolean(error)} placeholder="Lugar, dirección o coordenadas" value={input} disabled={blocked} spellCheck={false} autoComplete="off"
            onChange={event => { resetSearch(); selectionRevision.current++; setInput(event.target.value); setError(null) }} />
          <Button appearance="integrated" type="submit" className="map-coordinate-action map-search-submit" aria-label="Buscar" aria-busy={searchState.status === 'loading'} disabled={blocked || !input.trim() || searchState.status === 'loading'}><Search aria-hidden="true" /><span>Buscar</span></Button>
          <Button appearance="integrated" type="button" className="map-coordinate-action" aria-label="Copiar coordenadas del punto" disabled={blocked || !canCopy} onClick={() => { void copyCoordinate() }}>
            <Copy aria-hidden="true" />
          </Button>
        </InputGroup>
      </form>
    </div>
    <div className="map-panel-toggles" role="group" aria-label="Paneles del mapa">
      <Button ref={coordinatesTrigger} aria-label="Buscador y coordenadas" aria-expanded={coordinatesOpen}
        aria-controls={coordinatesMenuId} aria-pressed={coordinatesOpen} disabled={blocked} onClick={() => { resetSearch(); setCoordinatesOpen(open => !open) }}><Crosshair aria-hidden="true" /></Button>
      <Button ref={markersTrigger} aria-label="Marcadores" aria-expanded={markersOpen}
        aria-controls={markersMenuId} aria-pressed={markersOpen} disabled={blocked} onClick={() => setMarkersOpen(open => !open)}><Flag aria-hidden="true" /></Button>
      <Button ref={gpxTrigger} aria-label="GPX" aria-expanded={gpxOpen}
        aria-controls={gpxMenuId} aria-pressed={gpxOpen} disabled={blocked} onClick={() => setGpxOpen(open => !open)}><Route aria-hidden="true" /></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button aria-label="Fondo del mapa" disabled={blocked}><Layers aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" collisionPadding={8} aria-label="Fondo del mapa">
          <DropdownMenuGroup>
            {(Object.keys(MAP_BACKGROUNDS) as MapBackground[]).map(id => <DropdownMenuCheckboxItem key={id} checked={background === id} disabled={blocked}
              onSelect={() => changeBackground(id)}>{MAP_BACKGROUNDS[id].name}</DropdownMenuCheckboxItem>)}
            {background === 'pnoa' && <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={pnoaInformation} disabled={blocked}
                onCheckedChange={checked => changeInformation(checked === true)}>Información</DropdownMenuCheckboxItem>
            </>}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <MapLegend background={background} information={pnoaInformation} zoom={mapZoom} disabled={blocked} />
    </div>
    <input ref={inputFile} type="file" accept=".gpx,application/gpx+xml" multiple hidden onChange={event => { void loadFiles(event) }} />
    <div className="map-workspace">
      <div className="map-area">
        {coordinatesOpen && searchState.status === 'results' && <div className="map-search-results" aria-label="Búsqueda de lugares" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resetSearch(); searchInput.current?.focus() }
        }}>
          <p className="map-notice" role="status">{searchState.places.length === 1 ? '1 coincidencia' : `${searchState.places.length} coincidencias`}</p>
          <ul aria-label="Resultados de búsqueda">
            {searchState.places.map(place => <li key={place.id}><Button type="button" disabled={blocked} onClick={() => choosePlace(place)}>
              <strong>{place.name}</strong><span>{place.label}</span>
              <span className="map-search-coordinate">{place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}</span>
            </Button></li>)}
          </ul>
        </div>}
        <div ref={canvas} className="map-canvas" data-map-surface role="region" aria-label={'Mapa: ' + MAP_BACKGROUNDS[background].name}
          onPointerDownCapture={touchStart}
          onPointerMoveCapture={event => { if (cancelledTouch.current) event.stopPropagation() }}
          onTouchMoveCapture={event => { if (cancelledTouch.current) event.stopPropagation() }} />
        {overlay && <MapSurfaceContext.Provider value={{ mapRef, suppressSelection }}>{overlay}</MapSurfaceContext.Provider>}
        <div className="map-zoom" role="group" aria-label="Zoom geográfico">
          <Button aria-label="Acercar mapa" disabled={blocked} onClick={() => mapRef.current?.zoomIn()}><Plus aria-hidden="true" /></Button>
          <Button aria-label="Alejar mapa" disabled={blocked} onClick={() => mapRef.current?.zoomOut()}><Minus aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="map-sidepanels" hidden={!gpxOpen && !markersOpen}>
      {gpxOpen && <aside id={gpxMenuId} className={`${styles.panel} ${styles.gpxPanel} map-gpx-menu`} aria-labelledby={`${gpxMenuId}-title`} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGpx() }
      }}>
        <div className={`${styles.panelHeading} map-gpx-heading`}>
          <span id={`${gpxMenuId}-title`}>GPX</span>
          {busy && <Button className={styles.panelTool} aria-label="Cancelar importación GPX" disabled={blocked} onClick={cancelImport}><X aria-hidden="true" /></Button>}
          <Button className={styles.panelTool} aria-label="Agregar GPX" disabled={blocked || busy} onClick={() => chooseFiles()}><Plus aria-hidden="true" /></Button>
          <Button className={styles.panelTool} aria-label="Cerrar GPX" disabled={blocked} onClick={closeGpx}><X aria-hidden="true" /></Button>
        </div>
        <div className={`${styles.panelActions} map-file-actions`} role="group" aria-label={activeFile ? 'Controles de ' + activeFile.name : 'Controles GPX'}>
          <Button className={styles.panelTool} aria-label={activeFile ? (activeFile.visible ? 'Ocultar ' : 'Mostrar ') + activeFile.name : 'Ocultar GPX'}
            aria-pressed={Boolean(activeFile?.visible)} disabled={blocked || busy || !activeFile}
            onClick={() => { if (activeFile) changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, visible: !item.visible } : item)) }}>
            {activeFile?.visible === false ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
          <span className={`${styles.colorControl} map-color-control`}>
            <Button className={styles.panelTool} aria-label={activeFile ? 'Elegir color de ' + activeFile.name : 'Color GPX'} disabled={blocked || busy || !activeFile}
              onClick={() => gpxColorInput.current?.click()}><Palette aria-hidden="true" /></Button>
            {activeFile && <input key={activeFile.id} ref={gpxColorInput} type="color" aria-label={'Color de ' + activeFile.name}
              value={activeFile.color ?? GPX_COLORS[0]!} disabled={blocked || busy} tabIndex={-1}
              onChange={event => changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, color: event.target.value.toUpperCase() } : item))} />}
          </span>
          <Popover key={activeFile?.id ?? 'no-selection'}>
            <PopoverTrigger asChild><Button variant="icon" className={styles.panelTool} aria-label={activeFile ? 'PK de ' + activeFile.name : 'Separación PK'} aria-pressed={Boolean(activeFile?.kilometers)}
              disabled={blocked || busy || !activeFile || (selectedFile !== undefined && !selectedFile.data.lines.length)}>PK</Button></PopoverTrigger>
            {activeFile && <PopoverContent className={`${styles.pkPopover} map-pk-popover`} side="bottom" align="start" aria-label={'Puntos kilométricos de ' + activeFile.name}>
              <div className="map-pk-heading">
                <span>Separación PK</span><output>{(activeFile.kilometerInterval ?? 1).toLocaleString('es-ES')} km</output>
                <Button className={`${styles.panelTool} map-pk-visibility`} aria-label={(activeFile.kilometers ? 'Ocultar PK de ' : 'Mostrar PK de ') + activeFile.name}
                  aria-pressed={Boolean(activeFile.kilometers)} disabled={blocked || busy} onClick={() => changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, kilometers: !item.kilometers } : item))}>
                  {activeFile.kilometers ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </Button>
              </div>
              <Slider label={'Separación PK de ' + activeFile.name} value={PK_INTERVALS.indexOf(activeFile.kilometerInterval ?? 1)} valueText={(activeFile.kilometerInterval ?? 1).toLocaleString('es-ES') + ' km'}
                min={0} max={PK_INTERVALS.length - 1} step={1} disabled={blocked || busy}
                onValueChange={index => { if (!blockedRef.current) changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, kilometerInterval: PK_INTERVALS[index]!, kilometers: true } : item)) }} />
              <div className="map-pk-steps" aria-hidden="true">{PK_INTERVALS.map(value => <span key={value}>{value.toLocaleString('es-ES')}</span>)}</div>
            </PopoverContent>}
          </Popover>
          <Button className={styles.panelTool} aria-label={activeFile ? 'Centrar ' + activeFile.name : 'Centrar GPX'} disabled={blocked || !activeFile?.visible || !selectedFile}
            onClick={() => { if (activeFile) fitFiles([activeFile.id]) }}><Focus aria-hidden="true" /></Button>
          <Button className={styles.panelTool} aria-label={activeFile ? 'Retirar ' + activeFile.name : 'Retirar GPX'} disabled={blocked || busy || !activeFile} onClick={() => {
            if (activeFile && mutateMap(map => ({ ...map, gpx: map.gpx.filter(item => item.id !== activeFile.id) }))) {
              onFilesChange(files.filter(item => item.id !== activeFile.id))
              setSelectedGpxId(null)
              if (selected?.gpx?.fileId === activeFile.id) setSelected(null)
            }
          }}><Trash aria-hidden="true" /></Button>
        </div>
        {!references.length && <p className="map-notice">No hay archivos GPX.</p>}
        <ul className="map-files" aria-label="Archivos GPX del mapa">
          {references.map(file => {
            const loaded = files.some(item => item.id === file.id)
            return <li key={file.id}>
              <Button className="map-file-name" data-visible={file.visible && loaded}
                aria-label={file.name + (loaded ? '' : ' · Pendiente')} aria-pressed={file.id === activeFile?.id} disabled={blocked || busy} onClick={() => selectGpx(file.id)}>
                {Array.from(file.name).slice(0, 20).join('')}{Array.from(file.name).length > 20 && '…'}
                {!loaded && ' · Pendiente'}
              </Button>
              {!loaded && <Button className={`${styles.panelTool} map-file-relink`} aria-label={'Seleccionar GPX ' + file.name}
                disabled={blocked || busy} onClick={() => chooseFiles(file.id)}><FolderOpen aria-hidden="true" /></Button>}
            </li>
          })}
        </ul>
      </aside>}
      <MapMarkers mapRef={mapRef} navigationKey={navigationKey} markers={markers} blocked={blocked} blockedRef={blockedRef} suppressSelection={suppressSelection}
        menuId={markersMenuId} open={markersOpen} selectedId={selectedMarkerId} canAdd={canCopy} onAdd={addMarker} onClose={closeMarkers}
        onEdit={editMarker} onRemove={removeMarker} onSelect={selectMarker} onCenter={centerMarker} />
      {gpxOpen && selectedFile && selectedFile.data.lines.length > 0 && <div ref={setProfileControls} className="map-profile-controls" />}
      </div>
    </div>
    {(selected || (selectedFile && selectedMetrics)) && <div className="map-track-info" aria-label={selectedLocation ? 'Información del punto GPX' : selected ? 'Información del punto' : 'Información del GPX'}>
      <dl>
        {selectedLocation?.distanceMeters !== undefined && selectedMetrics && <>
          <div><dt>PK</dt><dd>{kilometers(selectedLocation.distanceMeters)}</dd></div>
          <div><dt>Restan</dt><dd>{kilometers(Math.max(0, selectedMetrics.totalMeters - selectedLocation.distanceMeters))}</dd></div>
        </>}
        {selectedMetrics && <div><dt>Total</dt><dd>{kilometers(selectedMetrics.totalMeters)}</dd></div>}
        {selectedLocation?.point.elevation !== undefined && <div><dt>Altitud GPX</dt><dd>{selectedLocation.point.elevation.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' m'}</dd></div>}
        {selected && <MapElevation point={selected} />}
        {selectedLocation?.point.name && <div><dt>Punto</dt><dd>{selectedLocation.point.name}</dd></div>}
        {selectedLocation?.point.time && <div><dt>Hora GPX</dt><dd><time dateTime={selectedLocation.point.time}>{new Date(selectedLocation.point.time).toLocaleString('es-ES')}</time></dd></div>}
      </dl>
    </div>}
    {selectedFile && selectedFile.data.lines.length > 0 && <GpxElevationProfile key={selectedFile.id} file={selectedFile} disabled={blocked} controlsHost={profileControls}
      selected={selected?.gpx?.fileId === selectedFile.id ? selected.gpx.location : undefined}
      onSelect={sample => selectProfilePoint(selectedFile.id, sample)} />}
  </div>
}
