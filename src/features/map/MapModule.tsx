import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent, ReactNode } from 'react'
import { Check, Copy, Crosshair, Eye, EyeOff, Flag, Focus, FolderOpen, Layers, Minus, Palette, Plus, Route, Search, X } from 'lucide-react'
import * as L from 'leaflet'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { HelpTooltip } from '../../components/ui/tooltip'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Slider } from '../../components/ui/slider'
import { copyText } from '../../platform/clipboard'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { convertCoordinate, toGeographic } from '../coordinates/convertCoordinate'
import type { CoordinateFormat, GeographicCoordinate } from '../coordinates/coordinateTypes'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { PK_INTERVALS } from './gpx'
import type { LoadedGpx } from './gpx'
import { pickGpxFiles, readGpxFile } from './gpxFileAccess'
import { readGpxAccess, rememberGpxAccess, rememberGpxFile } from '../../storage/gpxAccessRepository'
import type { GpxReadHandle } from '../../storage/gpxAccessRepository'
import { closestGpxLocation, getGpxMetrics, getKilometerMarks } from './gpxMetrics'
import type { GpxLocation } from './gpxMetrics'
import { MAX_MAP_LATITUDE, readMapView, writeMapView, writeMapFrame } from './mapNavigation'
import { MAP_BACKGROUNDS, PNOA_INFORMATION } from './mapBackgrounds'
import type { MapBackground } from './mapBackgrounds'
import type { MapDocument, MapGpxReference, MapMarker } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { MapMarkers } from './MapMarkers'
import { MapSurfaceContext } from './MapSurfaceContext'
import { MapLegend } from './MapLegend'
import { classifyMapQuery } from './mapSearch'
import type { MapPlace } from './mapSearch'
import { useMapSearch } from './useMapSearch'
import { MapElevation } from './MapElevation'
import { GpxElevationProfile } from './GpxElevationProfile'
import type { GpxProfileSample } from './gpxProfile'
import './map.css'

interface MapSelection extends GeographicCoordinate { gpx?: { fileId: string; location: GpxLocation } }
const GPX_COLORS = ['#D63A3A', '#3697DC', '#54B777', '#E69B37', '#A377D8']
const EMPTY_REFERENCES: MapGpxReference[] = []
const EMPTY_MARKERS: MapMarker[] = []
const kilometers = (meters: number) => (meters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km'

export function MapModule({ navigationKey, files: loadedFiles, onFilesChange, store, overlay }: {
  navigationKey: string
  files: LoadedGpx[]
  onFilesChange: (files: LoadedGpx[]) => void
  store: DocumentStore
  overlay?: ReactNode
}) {
  const { document: currentDocument, documentGeneration } = useDocumentStore(store)
  const references = currentDocument.map?.gpx ?? EMPTY_REFERENCES
  const markers = currentDocument.map?.markers ?? EMPTY_MARKERS
  const files = useMemo(() => {
    const data = new Map(loadedFiles.map(file => [file.id, file]))
    return references.flatMap(reference => {
      const loaded = data.get(reference.id)
      return loaded && loaded.fingerprint === reference.fingerprint ? [{ ...reference, data: loaded.data }] : []
    })
  }, [references, loadedFiles])
  const canvas = useRef<HTMLDivElement>(null), inputFile = useRef<HTMLInputElement>(null)
  const coordinatesTrigger = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const coordinatesMenuId = useId()
  const markersTrigger = useRef<HTMLButtonElement>(null)
  const markersMenuId = useId()
  const gpxTrigger = useRef<HTMLButtonElement>(null), gpxColorInput = useRef<HTMLInputElement>(null)
  const gpxMenuId = useId()
  const mapRef = useRef<L.Map | null>(null), layers = useRef(new Map<string, L.FeatureGroup>())
  const kilometerLayers = useRef(new Map<string, { group: L.LayerGroup; zoom: number; color: string; interval: number }>())
  const currentFiles = useRef(files)
  const publishFiles = useRef(onFilesChange)
  const currentFormat = useRef<CoordinateFormat>('DD')
  const selection = useRef<L.CircleMarker | null>(null)
  const request = useRef({ revision: 0, reading: false })
  const relinkTarget = useRef<string | null>(null)
  const touches = useRef(new Set<number>()), cancelledTouch = useRef(false), suppressSelection = useRef(false)
  const { blocked, blockedRef } = useViewportInteraction()
  const { fitContentRef } = useModuleZoom()
  const [input, setInput] = useState(''), [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [tileError, setTileError] = useState(false)
  const [informationTileError, setInformationTileError] = useState(false)
  const [accessNotice, setAccessNotice] = useState<string | null>(null)
  const [useFileInput, setUseFileInput] = useState(false)
  const [selected, setSelected] = useState<MapSelection | null>(null)
  const [coordinatesOpen, setCoordinatesOpen] = useState(true)
  const [markersOpen, setMarkersOpen] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [gpxOpen, setGpxOpen] = useState(false), [selectedGpxId, setSelectedGpxId] = useState<string | null>(null)
  const [profileControls, setProfileControls] = useState<HTMLDivElement | null>(null)
  const [mapZoom, setMapZoom] = useState(() => readMapView(navigationKey).zoom)
  const [background, setBackground] = useState(() => readMapView(navigationKey).background)
  const [pnoaInformation, setPnoaInformation] = useState(() => readMapView(navigationKey).pnoaInformation)
  const showInformation = background === 'pnoa' && pnoaInformation
  const [format, setFormat] = useState<CoordinateFormat>('DD'), [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const selectionRevision = useRef(0)
  const { state: searchState, search: searchPlaces, reset: resetSearch } = useMapSearch(navigationKey)

  function mutateMap(update: (map: MapDocument) => void): boolean {
    if (blockedRef.current || store.getSnapshot().documentGeneration !== documentGeneration) return false
    try {
      store.mutateDocument(document => {
        document.map ??= { markers: [], gpx: [] }
        update(document.map)
      })
      setError(null)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudieron guardar los cambios del mapa.')
      return false
    }
  }
  function changeReferences(update: (files: MapGpxReference[]) => MapGpxReference[]) {
    mutateMap(map => { map.gpx = update(map.gpx) })
  }
  function editMarker(id: string, patch: Partial<Omit<MapMarker, 'id'>>) {
    return mutateMap(map => { map.markers = map.markers.map(marker => marker.id === id ? { ...marker, ...patch } : marker) })
  }
  function selectMarker(marker: MapMarker) {
    if (blockedRef.current) return
    resetSearch()
    const formatted = convertCoordinate({ ...marker, format: 'DD' }, format)
    setSelected({ latitude: marker.latitude, longitude: marker.longitude }); setCopied(false)
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
      if (index < 0) return
      neighbor = map.markers[index + 1] ?? map.markers[index - 1]
      map.markers = map.markers.filter(marker => marker.id !== id)
    }) && selectedMarkerId === id) {
      if (neighbor) selectMarker(neighbor)
      else { setSelectedMarkerId(null); setSelected(null); setCopied(false) }
    }
  }
  function addMarker() {
    if (blockedRef.current) return
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(parsed.error); return }
    const point = toGeographic(parsed.coordinate)
    if (Math.abs(point.latitude) > MAX_MAP_LATITUDE) { setError('Esta cartografía admite latitudes entre −85,05° y 85,05°.'); return }
    const id = crypto.randomUUID()
    if (mutateMap(map => {
      map.markers.push({ id, name: `M.${map.markers.length + 1}`, ...point, color: GPX_COLORS[0]! })
    })) { setSelected(point); setSelectedGpxId(null); setSelectedMarkerId(id); setCopied(false) }
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
    setCopied(false)
  }
  function selectProfilePoint(fileId: string, sample: GpxProfileSample) {
    if (blockedRef.current) return
    if (Math.abs(sample.point.latitude) > MAX_MAP_LATITUDE) { setError('Esta cartografía admite latitudes entre −85,05° y 85,05°.'); return }
    resetSearch(); setError(null); setCopied(false)
    setSelected({ ...sample.point, gpx: { fileId, location: { point: sample.point, distanceMeters: sample.distanceMeters, offsetMeters: 0 } } })
    setSelectedGpxId(fileId); setSelectedMarkerId(null)
    const formatted = convertCoordinate({ ...sample.point, format: 'DD' }, format)
    if (formatted.ok) setInput(formatted.text)
    else { setFormat('DD'); setInput(`${sample.point.latitude.toFixed(6)}, ${sample.point.longitude.toFixed(6)}`) }
    mapRef.current?.panTo([sample.point.latitude, sample.point.longitude], { animate: false })
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
        const file = await store.readWorkspaceGpx(reference) ?? await readGpxAccess(reference.fingerprint)
        if (!isCurrent()) return
        if (!file) continue
        try {
          const { data } = await readGpxFile(file, reference.fingerprint)
          if (!isCurrent()) return
          const liveReference = store.getSnapshot().document.map?.gpx.find(item => item.id === reference.id && item.fingerprint === reference.fingerprint)
          if (!liveReference) continue
          // Recovery never edits the document or replaces its saved adjustments.
          const next = [...currentFiles.current.filter(item => item.id !== reference.id), { ...liveReference, data }]
          currentFiles.current = next
          publishFiles.current(next)
        } catch { /* The named pending reference remains available for reselection. */ }
      }
    }
    void recover()
    return () => { cancelled = true }
  }, [references, documentGeneration, navigationKey, blocked, busy, blockedRef, store])

  useLayoutEffect(() => {
    const node = canvas.current
    if (!node) return
    const renderedLayers = layers.current
    const renderedKilometers = kilometerLayers.current
    const pendingRequest = request.current
    const view = readMapView(navigationKey)
    const map = L.map(node, { zoomControl: false, minZoom: 2, maxZoom: 19, zoomSnap: .25, zoomDelta: .25, wheelPxPerZoomLevel: 240, preferCanvas: true, zoomAnimation: false })
      .setView([view.latitude, view.longitude], view.zoom)
    mapRef.current = map
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
      setCopied(false)
      const point = snapped && nearest ? { ...nearest.location.point, gpx: nearest } : coordinate
      setSelected(point)
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
      pendingRequest.revision++; pendingRequest.reading = false
      clearTimeout(copyTimer.current)
      observer.disconnect(); cancelAnimationFrame(frame)
      map.remove(); mapRef.current = null; renderedLayers.clear(); renderedKilometers.clear(); selection.current = null
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
    const map = mapRef.current
    if (!map) return
    for (const [id, group] of layers.current) if (!files.some(file => file.id === id)) { map.removeLayer(group); layers.current.delete(id) }
    for (const [id, item] of kilometerLayers.current) if (!files.some(file => file.id === id)) { map.removeLayer(item.group); kilometerLayers.current.delete(id) }
    for (const file of files) {
      const color = file.color ?? GPX_COLORS[0]!
      let group = layers.current.get(file.id)
      if (!group) {
        group = L.featureGroup()
        for (const line of file.data.lines) {
          const points = line.map(point => L.latLng(point.latitude, point.longitude))
          if (points.length === 1) L.circleMarker(points[0]!, { radius: 4, color }).addTo(group)
          else L.polyline(points, { color, weight: 3 }).addTo(group)
        }
        for (const point of file.data.waypoints) {
          const marker = L.circleMarker([point.latitude, point.longitude], { radius: 5, color, weight: 2, fillColor: color, fillOpacity: 1 }).addTo(group)
          if (point.name) { const label = document.createElement('span'); label.textContent = point.name; marker.bindTooltip(label) }
        }
        layers.current.set(file.id, group)
      }
      group.eachLayer(layer => { if (layer instanceof L.Path) layer.setStyle({ color, fillColor: color }) })
      if (file.visible) group.addTo(map)
      else map.removeLayer(group)
      let marks = kilometerLayers.current.get(file.id)
      const interval = file.kilometerInterval ?? 1
      if (file.kilometers && (!marks || marks.zoom !== mapZoom || marks.color !== color || marks.interval !== interval)) {
        if (marks) map.removeLayer(marks.group)
        const markers = L.layerGroup()
        for (const mark of getKilometerMarks(file.data, Math.max(interval, 2 ** (13 - mapZoom)))) {
          const label = document.createElement('span')
          label.textContent = mark.kilometer.toLocaleString('es-ES')
          label.style.borderColor = color
          label.title = 'PK ' + mark.kilometer.toLocaleString('es-ES')
          L.marker([mark.point.latitude, mark.point.longitude], {
            icon: L.divIcon({ className: 'map-kilometer', html: label, iconSize: [30, 20], iconAnchor: [15, 10] }),
            interactive: false, keyboard: false, zIndexOffset: 200,
          }).addTo(markers)
        }
        marks = { group: markers, zoom: mapZoom, color, interval }
        kilometerLayers.current.set(file.id, marks)
      }
      if (marks) {
        if (file.visible && file.kilometers) marks.group.addTo(map)
        else map.removeLayer(marks.group)
      }
    }
  }, [files, mapZoom])

  useEffect(() => {
    const map = mapRef.current
    selectionRevision.current++; clearTimeout(copyTimer.current)
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
    setError(null); setInput(formatted.ok ? formatted.text : parsed.normalizedInput); setSelected(coordinate); setSelectedGpxId(null); setSelectedMarkerId(null); setCopied(false)
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
    resetSearch(); setError(null); setCopied(false)
    const point = { latitude: place.latitude, longitude: place.longitude }
    const formatted = convertCoordinate({ ...point, format: 'DD' }, format)
    if (formatted.ok) setInput(formatted.text)
    else { setFormat('DD'); setInput(`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`) }
    setSelected(point); setSelectedGpxId(null); setSelectedMarkerId(null)
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
  async function loadChosenFiles(selection: Promise<({ file: File; handle?: never } | { handle: GpxReadHandle; file?: never })[]>, targetId: string | null) {
    if (request.current.reading || blockedRef.current) return
    const current = ++request.current.revision
    request.current.reading = true; setBusy(true); setError(null)
    const added: LoadedGpx[] = [], errors: string[] = []
    const isCurrent = () => current === request.current.revision && store.getSnapshot().documentGeneration === documentGeneration
    let chosen: Awaited<typeof selection>
    try { chosen = await selection } catch (failure) {
      if (isCurrent()) {
        if (!(failure instanceof DOMException && failure.name === 'AbortError')) {
          setUseFileInput(true)
          setError('No se pudo abrir el selector GPX. Vuelve a seleccionar el archivo.')
        }
        setBusy(false); request.current.reading = false
      }
      return
    }
    let accessFailed = false
    for (const choice of chosen) {
      if (!isCurrent()) return
      let name = choice.file?.name ?? choice.handle!.name
      try {
        const file = choice.file ?? await choice.handle!.getFile()
        name = file.name
        if (!isCurrent()) return
        const saved = store.getSnapshot().document.map?.gpx ?? EMPTY_REFERENCES
        const target = targetId ? saved.find(item => item.id === targetId) : undefined
        if (targetId && !target) continue
        const { fingerprint, data } = await readGpxFile(file, target?.fingerprint)
        if (!isCurrent()) return
        rememberGpxFile(fingerprint, file)
        const reference = targetId ? saved.find(item => item.id === targetId) : saved.find(item => item.fingerprint === fingerprint)
        if (choice.handle && !await rememberGpxAccess(fingerprint, choice.handle)) accessFailed = true
        if (!isCurrent()) return
        if (currentFiles.current.some(item => item.fingerprint === fingerprint) || added.some(item => item.fingerprint === fingerprint)) continue
        added.push({ ...(reference ?? {
          id: crypto.randomUUID(), name: file.name, size: file.size, lastModified: file.lastModified, fingerprint, visible: true,
          color: GPX_COLORS[(saved.length + added.filter(item => !saved.some(reference => reference.id === item.id)).length) % GPX_COLORS.length]!,
          kilometers: false, kilometerInterval: 1,
        }), data })
      } catch (failure) { errors.push(`${name}: ${failure instanceof Error ? failure.message : 'No se pudo leer el archivo.'}`) }
    }
    if (!isCurrent()) return
    if (added.length) {
      const liveReferences = store.getSnapshot().document.map?.gpx ?? EMPTY_REFERENCES
      if (targetId && !liveReferences.some(reference => reference.id === targetId && reference.fingerprint === added[0]?.fingerprint)) {
        setBusy(false); request.current.reading = false; return
      }
      const newFiles = added.filter(file => !liveReferences.some(reference => reference.id === file.id))
      const saved = newFiles.length ? mutateMap(map => {
        for (const file of newFiles) if (!map.gpx.some(reference => reference.id === file.id)) {
          // Keep the parsed geometry in memory; only this explicit reference enters the JSON.
          const { id, name, size, lastModified, fingerprint, visible, color, kilometers, kilometerInterval } = file
          map.gpx.push({ id, name, size, lastModified, fingerprint, visible, color, kilometers, kilometerInterval })
        }
      }) : !blockedRef.current
      if (saved) {
        const next = [...currentFiles.current, ...added]
        currentFiles.current = next
        publishFiles.current(next)
        selectGpx(added[0]!.id)
        const points = added.filter(file => file.visible).flatMap(file => [...file.data.lines.flat(), ...file.data.waypoints])
        if (points.length) mapRef.current?.fitBounds(L.latLngBounds(points.map(point => L.latLng(point.latitude, point.longitude))), { padding: [24, 24], maxZoom: 16, animate: false })
      } else { setBusy(false); request.current.reading = false; return }
    }
    setAccessNotice(accessFailed ? 'GPX cargado. No se pudo recordar el acceso al original; podrás recuperarlo desde la carpeta gpx si se completa su copia.' : null)
    setError(errors.length ? errors.join(' ') : null); setBusy(false); request.current.reading = false
    if (added.length) void store.saveWorkspaceNow()
  }
  const missingFiles = references.filter(reference => !files.some(file => file.id === reference.id))
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
    if (!result) { setError('No se pudo copiar la coordenada.'); return }
    clearTimeout(copyTimer.current); setCopied(true)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
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
  return <div className="map-module" data-coordinates-open={coordinatesOpen}>
    <div className="map-toolbar" hidden={!coordinatesOpen}>
      <form id={coordinatesMenuId} aria-label="Buscar en el mapa" onSubmit={event => { event.preventDefault(); searchMap() }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resetSearch(); setCoordinatesOpen(false); coordinatesTrigger.current?.focus() }
      }}>
        <select className="map-coordinate-format" aria-label="Formato de coordenadas del mapa" value={format} disabled={blocked} onChange={event => {
          const next = event.target.value as CoordinateFormat
          selectionRevision.current++; setFormat(next); setCopied(false)
          const parsed = parseCoordinate(input)
          if (parsed.ok) {
            const formatted = convertCoordinate(parsed.coordinate, next)
            if (formatted.ok) { setInput(formatted.text); setError(null) }
            else setError(formatted.error)
          }
        }}>
          {(['DD', 'DMS', 'DMM', 'UTM'] as const).map(value => <option key={value}>{value}</option>)}
        </select>
        <div className="map-coordinate-field">
          <Input ref={searchInput} className="document-title map-coordinate-input" aria-label="Lugar, dirección o coordenadas" placeholder="Lugar, dirección o coordenadas" value={input} disabled={blocked} spellCheck={false} autoComplete="off"
            title="Lugar, dirección o coordenadas" onChange={event => { resetSearch(); selectionRevision.current++; setInput(event.target.value); setError(null); setCopied(false) }} />
          <button type="submit" className="map-coordinate-action map-search-submit" aria-label="Buscar" disabled={blocked || !input.trim() || searchState.status === 'loading'}><Search aria-hidden="true" /><span>Buscar</span></button>
          <HelpTooltip text={copied ? 'Coordenadas copiadas' : 'Copiar coordenadas'}><button type="button" className="map-coordinate-action" aria-label="Copiar coordenadas del punto" disabled={blocked || !canCopy} onClick={() => { void copyCoordinate() }}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button></HelpTooltip>
        </div>
      </form>
    </div>
    <div className="map-panel-toggles" role="group" aria-label="Paneles del mapa">
      <HelpTooltip text={coordinatesOpen ? 'Cerrar buscador' : 'Abrir buscador'}><Button ref={coordinatesTrigger} aria-label="Buscador y coordenadas" aria-expanded={coordinatesOpen}
        aria-controls={coordinatesMenuId} aria-pressed={coordinatesOpen} disabled={blocked} onClick={() => { resetSearch(); setCoordinatesOpen(open => !open) }}><Crosshair aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text={markersOpen ? 'Cerrar marcadores' : 'Abrir marcadores'}><Button ref={markersTrigger} aria-label="Marcadores" aria-expanded={markersOpen}
        aria-controls={markersMenuId} aria-pressed={markersOpen} disabled={blocked} onClick={() => setMarkersOpen(open => !open)}><Flag aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text={gpxOpen ? 'Cerrar GPX' : 'Abrir GPX'}><Button ref={gpxTrigger} aria-label="GPX" aria-expanded={gpxOpen}
        aria-controls={gpxMenuId} aria-pressed={gpxOpen} disabled={blocked} onClick={() => setGpxOpen(open => !open)}><Route aria-hidden="true" /></Button></HelpTooltip>
      <DropdownMenu>
        <HelpTooltip text="Fondo del mapa"><DropdownMenuTrigger asChild><Button aria-label="Fondo del mapa" disabled={blocked}><Layers aria-hidden="true" /></Button></DropdownMenuTrigger></HelpTooltip>
        <DropdownMenuContent className="file-menu-content map-background-menu" side="bottom" align="end" collisionPadding={8} aria-label="Fondo del mapa">
          {(Object.keys(MAP_BACKGROUNDS) as MapBackground[]).map(id => <DropdownMenuCheckboxItem key={id} checked={background === id} disabled={blocked}
            onSelect={() => changeBackground(id)}>{MAP_BACKGROUNDS[id].name}</DropdownMenuCheckboxItem>)}
          {background === 'pnoa' && <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={pnoaInformation} disabled={blocked}
              onCheckedChange={checked => changeInformation(checked === true)}>Información</DropdownMenuCheckboxItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
      <MapLegend background={background} information={pnoaInformation} zoom={mapZoom} disabled={blocked} />
    </div>
    <input ref={inputFile} type="file" accept=".gpx,application/gpx+xml" multiple hidden onChange={event => { void loadFiles(event) }} />
    {error && <p className="map-notice map-error" role="alert">{error}</p>}
    {accessNotice && <p className="map-notice" role="status">{accessNotice}</p>}
    {busy && <p className="map-notice" role="status">Leyendo GPX…</p>}
    {missingFiles.length > 0 && <p className="map-notice map-gpx-pending" role="status">
      <span>GPX pendientes: {missingFiles.map(file => file.name).join(', ')}</span>
      <Button className="document-button" disabled={blocked || busy} onClick={() => setGpxOpen(true)}>Ver GPX</Button>
    </p>}
    <div className="map-workspace">
      <div className="map-area">
        {coordinatesOpen && searchState.status !== 'idle' && <div className="map-search-results" aria-label="Búsqueda de lugares" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resetSearch(); searchInput.current?.focus() }
        }}>
          {searchState.status === 'loading' && <p className="map-notice" role="status">Buscando…</p>}
          {searchState.status === 'empty' && <p className="map-notice" role="status">No se encontraron lugares.</p>}
          {searchState.status === 'error' && <p className="map-notice map-error" role="alert">{searchState.message}</p>}
          {searchState.status === 'results' && <>
            <p className="map-notice" role="status">{searchState.places.length === 1 ? '1 coincidencia' : `${searchState.places.length} coincidencias`}</p>
            <ul aria-label="Resultados de búsqueda">
              {searchState.places.map(place => <li key={place.id}><button type="button" disabled={blocked} onClick={() => choosePlace(place)}>
                <strong>{place.name}</strong><span>{place.label}</span>
                <span className="map-search-coordinate">{place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}</span>
              </button></li>)}
            </ul>
          </>}
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
        {(tileError || informationTileError) && <p className="map-tile-notice" role="status">No se puede cargar parte del mapa. Comprueba la conexión.</p>}
      </div>
      <div className="map-sidepanels" hidden={!gpxOpen && !markersOpen}>
      {gpxOpen && <aside id={gpxMenuId} className="map-gpx-menu" aria-labelledby={`${gpxMenuId}-title`} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGpx() }
      }}>
        <div className="map-gpx-heading">
          <span id={`${gpxMenuId}-title`}>GPX</span>
          <HelpTooltip text="Agregar GPX"><Button aria-label="Agregar GPX" disabled={blocked || busy} onClick={() => chooseFiles()}><Plus aria-hidden="true" /></Button></HelpTooltip>
          <HelpTooltip text="Cerrar GPX"><Button aria-label="Cerrar GPX" disabled={blocked} onClick={closeGpx}><X aria-hidden="true" /></Button></HelpTooltip>
        </div>
        <div className="map-file-actions" role="group" aria-label={activeFile ? 'Controles de ' + activeFile.name : 'Controles GPX'}>
          <HelpTooltip text={activeFile?.visible === false ? 'Mostrar GPX' : 'Ocultar GPX'}><Button aria-label={activeFile ? (activeFile.visible ? 'Ocultar ' : 'Mostrar ') + activeFile.name : 'Ocultar GPX'}
            aria-pressed={Boolean(activeFile?.visible)} disabled={blocked || busy || !activeFile}
            onClick={() => { if (activeFile) changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, visible: !item.visible } : item)) }}>
            {activeFile?.visible === false ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button></HelpTooltip>
          <span className="map-color-control">
            <HelpTooltip text="Color GPX"><Button aria-label={activeFile ? 'Elegir color de ' + activeFile.name : 'Color GPX'} disabled={blocked || busy || !activeFile}
              onClick={() => gpxColorInput.current?.click()}><Palette aria-hidden="true" /></Button></HelpTooltip>
            {activeFile && <input key={activeFile.id} ref={gpxColorInput} type="color" aria-label={'Color de ' + activeFile.name}
              value={activeFile.color ?? GPX_COLORS[0]!} disabled={blocked || busy} tabIndex={-1}
              onChange={event => changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, color: event.target.value.toUpperCase() } : item))} />}
          </span>
          <Popover key={activeFile?.id ?? 'no-selection'}>
            <HelpTooltip text="Separación PK"><PopoverTrigger asChild><Button aria-label={activeFile ? 'PK de ' + activeFile.name : 'Separación PK'} aria-pressed={Boolean(activeFile?.kilometers)}
              disabled={blocked || busy || !activeFile || (selectedFile !== undefined && !selectedFile.data.lines.length)}>PK</Button></PopoverTrigger></HelpTooltip>
            {activeFile && <PopoverContent className="map-pk-popover" side="bottom" align="start" aria-label={'Puntos kilométricos de ' + activeFile.name}>
              <div className="map-pk-heading">
                <span>Separación PK</span><output>{(activeFile.kilometerInterval ?? 1).toLocaleString('es-ES')} km</output>
                <HelpTooltip text={activeFile.kilometers ? 'Ocultar PK' : 'Mostrar PK'}><Button className="document-button map-pk-visibility" aria-label={(activeFile.kilometers ? 'Ocultar PK de ' : 'Mostrar PK de ') + activeFile.name}
                  aria-pressed={Boolean(activeFile.kilometers)} disabled={blocked || busy} onClick={() => changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, kilometers: !item.kilometers } : item))}>
                  {activeFile.kilometers ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </Button></HelpTooltip>
              </div>
              <Slider label={'Separación PK de ' + activeFile.name} value={PK_INTERVALS.indexOf(activeFile.kilometerInterval ?? 1)} valueText={(activeFile.kilometerInterval ?? 1).toLocaleString('es-ES') + ' km'}
                min={0} max={PK_INTERVALS.length - 1} step={1} disabled={blocked || busy}
                onValueChange={index => { if (!blockedRef.current) changeReferences(files => files.map(item => item.id === activeFile.id ? { ...item, kilometerInterval: PK_INTERVALS[index]!, kilometers: true } : item)) }} />
              <div className="map-pk-steps" aria-hidden="true">{PK_INTERVALS.map(value => <span key={value}>{value.toLocaleString('es-ES')}</span>)}</div>
            </PopoverContent>}
          </Popover>
          <HelpTooltip text="Centrar GPX"><Button aria-label={activeFile ? 'Centrar ' + activeFile.name : 'Centrar GPX'} disabled={blocked || !activeFile?.visible || !selectedFile}
            onClick={() => { if (activeFile) fitFiles([activeFile.id]) }}><Focus aria-hidden="true" /></Button></HelpTooltip>
          <HelpTooltip text="Retirar GPX"><Button aria-label={activeFile ? 'Retirar ' + activeFile.name : 'Retirar GPX'} disabled={blocked || busy || !activeFile} onClick={() => {
            if (activeFile && mutateMap(map => { map.gpx = map.gpx.filter(item => item.id !== activeFile.id) })) {
              onFilesChange(files.filter(item => item.id !== activeFile.id))
              setSelectedGpxId(null)
              if (selected?.gpx?.fileId === activeFile.id) setSelected(null)
            }
          }}><X aria-hidden="true" /></Button></HelpTooltip>
        </div>
        {!references.length && <p className="map-notice">No hay archivos GPX.</p>}
        <ul className="map-files" aria-label="Archivos GPX del mapa">
          {references.map(file => {
            const loaded = files.some(item => item.id === file.id)
            return <li key={file.id}>
              <Button className="document-button map-file-name" data-visible={file.visible && loaded} title={file.name + (loaded ? '' : ' · Pendiente')}
                aria-label={file.name + (loaded ? '' : ' · Pendiente')} aria-pressed={file.id === activeFile?.id} disabled={blocked || busy} onClick={() => selectGpx(file.id)}>
                {Array.from(file.name).slice(0, 20).join('')}{Array.from(file.name).length > 20 && '…'}
                {!loaded && ' · Pendiente'}
              </Button>
              {!loaded && <HelpTooltip text="Seleccionar GPX"><Button className="document-button map-file-relink" aria-label={'Seleccionar GPX ' + file.name}
                disabled={blocked || busy} onClick={() => chooseFiles(file.id)}><FolderOpen aria-hidden="true" /></Button></HelpTooltip>}
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
          <div title="PK"><dt>PK</dt><dd>{kilometers(selectedLocation.distanceMeters)}</dd></div>
          <div><dt>Restan</dt><dd>{kilometers(Math.max(0, selectedMetrics.totalMeters - selectedLocation.distanceMeters))}</dd></div>
        </>}
        {selectedMetrics && <div><dt>Total</dt><dd>{kilometers(selectedMetrics.totalMeters)}</dd></div>}
        {selectedLocation?.point.elevation !== undefined && <div title="Altitud GPX"><dt>Altitud GPX</dt><dd>{selectedLocation.point.elevation.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' m'}</dd></div>}
        {selected && <MapElevation point={selected} />}
        {selectedLocation?.point.name && <div><dt>Punto</dt><dd>{selectedLocation.point.name}</dd></div>}
        {selectedLocation?.point.time && <div title="Hora GPX"><dt>Hora GPX</dt><dd><time dateTime={selectedLocation.point.time}>{new Date(selectedLocation.point.time).toLocaleString('es-ES')}</time></dd></div>}
      </dl>
    </div>}
    {selectedFile && selectedFile.data.lines.length > 0 && <GpxElevationProfile key={selectedFile.id} file={selectedFile} disabled={blocked} controlsHost={profileControls}
      selected={selected?.gpx?.fileId === selectedFile.id ? selected.gpx.location : undefined}
      onSelect={sample => selectProfilePoint(selectedFile.id, sample)} />}
  </div>
}
