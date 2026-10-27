import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { Focus, Minus, Plus } from 'lucide-react'
import * as L from 'leaflet'
import { Button } from '../../components/ui/button'
import { HelpTooltip } from '../../components/ui/tooltip'
import type { AssetId, MapGpxReference, MapMarker, PlanPin, PlanStroke } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { readGpxAccess } from '../../storage/gpxAccessRepository'
import type { LoadedGpx } from '../map/gpx'
import { readGpxFile } from '../map/gpxFileAccess'
import { getGpxMetrics } from '../map/gpxMetrics'
import { MAP_BACKGROUNDS, PNOA_INFORMATION, isMapBackground } from '../map/mapBackgrounds'
import { MAX_MAP_LATITUDE, readMapView, writeMapView, readMapFrame, subscribeMapFrame } from '../map/mapNavigation'
import { useDocumentStore } from './documentStore'
import type { DocumentStore } from './documentStore'
import { captureReportMap, createMapReportLegend, drawReportMap, drawReportMapScale } from './mapReport'
import type { ReportMapHandle } from './mapReport'
import { ICON_CATALOG } from '../elements/iconCatalog'
import { getPlanReportResourceBounds } from './planReport'
import type { PlanReportDrawing } from './planReport'
import { getReportMapContentFrame, getReportMapCrop } from './reportMapFraming'
import type { ReportMapArea as Area, ReportMapFraming } from './reportMapFraming'
import { ReportMapArea } from './ReportMapArea'
import { createReportIssue } from './reportIssues'
import type { ReportGraphicSection, ReportIssue } from './reportIssues'
import { createMapDataRecovery, createMapReportRecovery } from './mapReportRecovery'
import { DEFAULT_REPORT_PAGE } from './reportPagination'

const EMPTY_MARKERS: MapMarker[] = []
const EMPTY_GPX: MapGpxReference[] = []
const EMPTY_FILES: LoadedGpx[] = []
const EMPTY_PINS: PlanPin[] = []
const EMPTY_STROKES: PlanStroke[] = []
const EMPTY_IMAGES = new Map<AssetId, HTMLImageElement>()

export function ReportMap({ store, files: loadedFiles, onFilesChange, fields, captureRef, kind = 'map' }: {
  store: DocumentStore
  files: LoadedGpx[]
  onFilesChange: (files: LoadedGpx[]) => void
  fields: string[]
  captureRef: RefObject<ReportMapHandle | null>
  kind?: 'map' | 'plan'
}) {
  const { document: currentDocument, documentGeneration } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const isPlan = kind === 'plan'
  const title = isPlan ? 'Plano operativo' : 'Mapa'
  const navigationKey = (isPlan ? 'reports.plan.' : 'reports.') + currentDocument.document.id
  const sourceNavigationKey = (isPlan ? 'plan.' : '') + currentDocument.document.id
  const markers = currentDocument.map?.markers ?? EMPTY_MARKERS
  const references = currentDocument.map?.gpx ?? EMPTY_GPX
  const [selection, setSelection] = useState<Record<'markers' | 'gpx' | 'resources', string[]>>({ markers: [], gpx: [], resources: [] })
  const [includeHidden, setIncludeHidden] = useState(false)
  const [labels, setLabels] = useState(true)
  const [showBackground, setShowBackground] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showStrokes, setShowStrokes] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const [planFont] = useState(() => getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif')
  const [assets, setAssets] = useState<{ key: string; images: Map<AssetId, HTMLImageElement>; unavailable: AssetId[] }>({ key: '', images: EMPTY_IMAGES, unavailable: [] })
  const [view, setView] = useState(() => readMapView(navigationKey))
  const [framing, setFraming] = useState<ReportMapFraming>('content')
  const [area, setArea] = useState<Area>({ x: .1, y: .1, width: .8, height: .8 })
  const [sourceFrame, setSourceFrame] = useState(() => readMapFrame(sourceNavigationKey))
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [tileStatus, setTileStatus] = useState<string | null>(null)
  const surface = useRef<HTMLDivElement>(null), overlay = useRef<HTMLCanvasElement>(null)
  const viewport = useRef<HTMLDivElement>(null), areaGesture = useRef(false)
  const mapRef = useRef<L.Map | null>(null), tiles = useRef<L.TileLayer[]>([])
  const redrawOverlay = useRef<(() => void) | null>(null)
  const applyFraming = useRef<(() => void) | null>(null)
  const moving = useRef(false), pointers = useRef(new Set<number>()), cancelledTouch = useRef(false)
  const liveFiles = useRef(loadedFiles), publishFiles = useRef(onFilesChange)
  const imageSelected = fields.includes('image')
  const markersSelected = imageSelected || fields.includes('coordinates')
  const gpxSelected = imageSelected && showRoutes || fields.includes('gpx')
  const pins = currentDocument.plan?.pins ?? EMPTY_PINS
  const strokes = currentDocument.plan?.strokes ?? EMPTY_STROKES
  const resources = useMemo(() => {
    if (!isPlan) return []
    const elements = new Map(currentDocument.elements.map(element => [element.id.toLowerCase(), element]))
    return pins.flatMap(pin => {
      const element = elements.get(pin.elementId.toLowerCase())
      return element ? [{ element, pin }] : []
    })
  }, [isPlan, currentDocument.elements, pins])
  const availableResources = useMemo(() => resources.filter(resource => resource.pin.visible || includeHidden), [resources, includeHidden])
  const availableReferences = useMemo(() => references.filter(file => file.visible || includeHidden), [references, includeHidden])
  const resourceIds = useMemo(() => {
    const excluded = new Set(selection.resources)
    return new Set(availableResources.filter(resource => !excluded.has(resource.element.id.toLowerCase())).map(resource => resource.element.id.toLowerCase()))
  }, [selection.resources, availableResources])
  const selectedResources = useMemo(() => resources.filter(resource => resourceIds.has(resource.element.id.toLowerCase())), [resources, resourceIds])
  const assetKey = imageSelected && isPlan ? [...new Set(selectedResources.flatMap(({ element }) => element.visual.type === 'asset' ? [element.visual.assetId] : []))].sort().join('|') : ''
  const assetImages = assets.key === assetKey ? assets.images : EMPTY_IMAGES
  const planDrawing = useMemo<PlanReportDrawing | undefined>(() => isPlan ? { resources: selectedResources, strokes: showStrokes ? strokes : EMPTY_STROKES, images: assetImages, fontFamily: planFont } : undefined,
    [isPlan, selectedResources, showStrokes, strokes, assetImages, planFont])
  const markerIds = useMemo(() => {
    const excluded = new Set(selection.markers)
    return new Set(markers.filter(marker => !excluded.has(marker.id)).map(marker => marker.id))
  }, [selection.markers, markers])
  const gpxIds = useMemo(() => {
    const excluded = new Set(selection.gpx)
    return new Set(availableReferences.filter(file => !excluded.has(file.id)).map(file => file.id))
  }, [selection.gpx, availableReferences])
  const selectedMarkers = useMemo(() => markersSelected ? markers.filter(marker => markerIds.has(marker.id)) : EMPTY_MARKERS, [markers, markerIds, markersSelected])
  const selectedReferences = useMemo(() => gpxSelected ? references.filter(file => gpxIds.has(file.id)) : EMPTY_GPX, [references, gpxIds, gpxSelected])
  const files = useMemo(() => {
    const loaded = new Map(loadedFiles.map(file => [file.id, file]))
    return selectedReferences.flatMap(reference => {
      const file = loaded.get(reference.id)
      return file?.fingerprint === reference.fingerprint ? [{ ...reference, data: file.data }] : []
    })
  }, [selectedReferences, loadedFiles])
  const drawnFiles = showRoutes ? files : EMPTY_FILES
  const cropArea = framing === 'area' ? area : undefined
  const drawing = useRef({ markers: selectedMarkers, files: drawnFiles, labels, plan: planDrawing, area: cropArea })
  const showInformation = showBackground && view.background === 'pnoa' && view.pnoaInformation

  useLayoutEffect(() => { liveFiles.current = loadedFiles; publishFiles.current = onFilesChange }, [loadedFiles, onFilesChange])
  useEffect(() => subscribeMapFrame(sourceNavigationKey, () => setSourceFrame(readMapFrame(sourceNavigationKey))), [sourceNavigationKey])

  useEffect(() => {
    if (!assetKey) return
    let cancelled = false
    const assetIds = assetKey.split('|') as AssetId[]
    const pending: HTMLImageElement[] = []
    async function load() {
      const results = await Promise.allSettled(assetIds.map(id => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        pending.push(image)
        image.crossOrigin = 'anonymous'
        image.onload = () => image.naturalWidth ? resolve(image) : reject(new Error('Icono no disponible.'))
        image.onerror = () => reject(new Error('Icono no disponible.'))
        image.src = ICON_CATALOG[id].path
      })))
      if (cancelled) return
      const images = new Map<AssetId, HTMLImageElement>(), unavailable: AssetId[] = []
      results.forEach((result, index) => { if (result.status === 'fulfilled') images.set(assetIds[index]!, result.value); else unavailable.push(assetIds[index]!) })
      setAssets({ key: assetKey, images, unavailable })
    }
    void load()
    return () => { cancelled = true; for (const image of pending) { image.onload = null; image.onerror = null } }
  }, [assetKey])

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    const isCurrent = () => !cancelled && !blockedRef.current && store.getSnapshot().documentGeneration === documentGeneration
    async function recover() {
      for (const reference of selectedReferences) {
        if (!isCurrent()) return
        if (liveFiles.current.some(file => file.id === reference.id && file.fingerprint === reference.fingerprint)) continue
        const file = await store.readWorkspaceGpx(reference) ?? await readGpxAccess(reference.fingerprint)
        if (!isCurrent()) return
        if (!file) continue
        try {
          const result = await readGpxFile(file, reference.fingerprint)
          if (!isCurrent()) return
          const liveReference = store.getSnapshot().document.map?.gpx.find(item => item.id === reference.id && item.fingerprint === reference.fingerprint)
          if (!liveReference) continue
          const next = [...liveFiles.current.filter(item => item.id !== reference.id), { ...liveReference, data: result.data }]
          liveFiles.current = next
          publishFiles.current(next)
        } catch { /* Keep the selected reference visible as unavailable. */ }
      }
    }
    void recover()
    return () => { cancelled = true }
  }, [selectedReferences, loadedFiles, store, documentGeneration, blocked, blockedRef])

  useLayoutEffect(() => {
    if (!imageSelected || !surface.current) return
    const node = surface.current
    const activePointers = pointers.current
    const initial = readMapView(navigationKey)
    const map = L.map(node, { zoomControl: false, minZoom: 0, maxZoom: 19, zoomSnap: .25, zoomDelta: .25,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false, wheelPxPerZoomLevel: 240 })
      .setView([initial.latitude, initial.longitude], initial.zoom)
    mapRef.current = map
    let frame = 0
    function redraw() {
      const canvas = overlay.current, size = map.getSize()
      if (!canvas || !size.x || !size.y) return
      const ratio = Math.min(2, 4096 / Math.max(size.x, size.y))
      canvas.width = Math.ceil(size.x * ratio); canvas.height = Math.ceil(size.y * ratio)
      const context = canvas.getContext('2d')
      if (!context) return
      context.scale(ratio, ratio)
      drawReportMap(context, map, drawing.current.markers, drawing.current.files, drawing.current.labels, drawing.current.plan)
      drawReportMapScale(context, map, getReportMapCrop(size, drawing.current.area))
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(redraw) }
    redrawOverlay.current = schedule
    void document.fonts.ready.then(() => { if (mapRef.current === map) { applyFraming.current?.(); schedule() } })
    map.on('move zoom resize', schedule)
    map.on('movestart zoomstart', () => { moving.current = true })
    map.on('moveend', () => {
      moving.current = false
      const center = map.getCenter().wrap()
      writeMapView(navigationKey, { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, center.lat)), longitude: center.lng, zoom: map.getZoom() })
    })
    const observer = new ResizeObserver(() => {
      if (viewport.current) {
        const width = viewport.current.clientWidth, height = viewport.current.clientHeight
        setViewportSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
      }
      map.invalidateSize({ pan: false }); applyFraming.current?.(); schedule()
    })
    observer.observe(node)
    if (viewport.current) observer.observe(viewport.current)
    schedule()
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      map.remove(); mapRef.current = null; redrawOverlay.current = null; moving.current = false; activePointers.clear(); cancelledTouch.current = false
    }
  }, [imageSelected, navigationKey])

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!imageSelected || !map) return
    const source = MAP_BACKGROUNDS[view.background]
    const layers = showBackground ? [L.tileLayer(source.url, { attribution: source.attribution, crossOrigin: 'anonymous', maxZoom: 19 })] : []
    if (showInformation) layers.push(L.tileLayer(PNOA_INFORMATION.url, { attribution: PNOA_INFORMATION.attribution, crossOrigin: 'anonymous', maxZoom: 19 }))
    const failures = new Set<HTMLElement>()
    setTileStatus(null)
    for (const layer of layers) {
      layer.on('tileerror', event => { failures.add((event as L.TileErrorEvent).tile); setTileStatus('Cartografía incompleta o no disponible.') })
      layer.on('tileload tileunload', event => {
        failures.delete((event as L.TileEvent).tile)
        if (!failures.size) setTileStatus(null)
      })
      layer.addTo(map)
    }
    tiles.current = layers
    return () => {
      for (const layer of layers) { layer.remove(); layer.off() }
      tiles.current = []
    }
  }, [imageSelected, navigationKey, view.background, showInformation, showBackground])

  useLayoutEffect(() => {
    drawing.current = { markers: selectedMarkers, files: drawnFiles, labels, plan: planDrawing, area: cropArea }
    redrawOverlay.current?.()
  }, [selectedMarkers, drawnFiles, labels, imageSelected, planDrawing, cropArea])

  useLayoutEffect(() => {
    const apply = () => {
      const map = mapRef.current, context = overlay.current?.getContext('2d')
      if (!map || !context || !map.getSize().x || !map.getSize().y) return
      map.invalidateSize({ pan: false })
      if (framing === 'current' && sourceFrame) {
        map.setView(map.unproject([sourceFrame.x, sourceFrame.y], sourceFrame.zoom), sourceFrame.zoom, { animate: false })
        const center = map.getPixelBounds().getCenter()
        const delta = L.point(sourceFrame.x - center.x, sourceFrame.y - center.y)
        if (delta.x || delta.y) map.panBy(delta, { animate: false })
      } else if (framing === 'content') {
        const frame = getReportMapContentFrame(context, map, selectedMarkers, drawnFiles, labels, planDrawing)
        if (frame) map.setView(frame.center, frame.zoom, { animate: false })
      }
    }
    applyFraming.current = apply
    apply()
    return () => { if (applyFraming.current === apply) applyFraming.current = null }
  }, [framing, sourceFrame, selectedMarkers, drawnFiles, labels, planDrawing, imageSelected, navigationKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    function update() {
      const disabled = blockedRef.current || cancelledTouch.current || framing !== 'area'
      if (disabled || pointers.current.size >= 2) map!.dragging.disable()
      else map!.dragging.enable()
      if (disabled) { map!.touchZoom.disable(); map!.scrollWheelZoom.disable(); map!.doubleClickZoom.disable(); map!.keyboard.disable(); map!.boxZoom.disable() }
      else { map!.touchZoom.enable(); map!.scrollWheelZoom.enable(); map!.doubleClickZoom.enable(); map!.keyboard.enable(); map!.boxZoom.enable() }
    }
    function end(event: globalThis.PointerEvent) {
      pointers.current.delete(event.pointerId)
      if (!pointers.current.size) cancelledTouch.current = false
      update()
    }
    update()
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => { document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end) }
  }, [blocked, blockedRef, imageSelected, navigationKey, framing])

  useLayoutEffect(() => {
    const handle: ReportMapHandle = { capture(page = DEFAULT_REPORT_PAGE) {
      const snapshot = store.getSnapshot()
      if (snapshot.documentGeneration !== documentGeneration || snapshot.document !== currentDocument || !snapshot.active || snapshot.replacing || blockedRef.current) throw new Error('El UIBoard no está disponible para generar el informe.')
      const content: ReturnType<ReportMapHandle['capture']> = {
        documentId: currentDocument.document.id,
        markers: selectedMarkers.map(({ name, latitude, longitude }) => ({ name, latitude, longitude })),
        gpx: selectedReferences.map(reference => {
          const file = files.find(file => file.id === reference.id)
          return { name: reference.name, distance: file ? (getGpxMetrics(file.data).totalMeters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km' : '—',
            points: file ? file.data.pointCount.toLocaleString('es-ES') : '—', availability: file ? 'Disponible' : 'No disponible' }
        }),
      }
      const section: ReportGraphicSection = isPlan ? 'plan' : 'map'
      const missing = selectedReferences.filter(reference => !files.some(file => file.id === reference.id))
      const issues: ReportIssue[] = missing.map(file => createReportIssue(section, 'GPX no disponible.', { kind: 'gpx', resourceId: file.id, label: file.name }))
      if (imageSelected) {
        const map = mapRef.current
        if (moving.current || pointers.current.size || areaGesture.current) throw new Error('Termina de encuadrar el ' + (isPlan ? 'plano' : 'mapa') + ' antes de generar el informe.')
        const imageIssues: ReportIssue[] = showRoutes ? [...issues] : []
        if (!map) imageIssues.push(createReportIssue(section, 'El visor no está disponible.'))
        if (framing === 'current' && !sourceFrame) imageIssues.push(createReportIssue(section, 'La vista del módulo de origen no está disponible.'))
        if (assetKey) for (const id of assetKey.split('|') as AssetId[]) {
          if (assets.key !== assetKey || !assets.images.has(id)) imageIssues.push(createReportIssue(section, 'Icono no disponible.', { kind: 'icon', resourceId: id, label: ICON_CATALOG[id].name }))
        }
        if (isPlan && document.fonts.status === 'loading') imageIssues.push(createReportIssue(section, 'Tipografía no disponible.', { kind: 'representation', resourceId: 'font', label: 'Imagen del plano' }))
        for (const issue of imageIssues) if (!issues.includes(issue)) issues.push(issue)
        if (!imageIssues.length && map) {
          try {
            const crop = getReportMapCrop(map.getSize(), framing === 'area' ? area : undefined)
            content.image = { dataUrl: captureReportMap(map, tiles.current, selectedMarkers, drawnFiles, labels, planDrawing, crop, showBackground, page), background: showBackground ? view.background : null, pnoaInformation: showInformation,
              legend: showLegend ? createMapReportLegend(map, selectedMarkers, drawnFiles, labels, planDrawing, crop, page.quality) : [] }
          } catch (error) {
            const issue = createReportIssue(section, error)
            if (issue.kind === 'background' && issue.resourceId === 'background') issue.label = MAP_BACKGROUNDS[view.background].name
            issues.push(issue)
          }
        }
      }
      if (isPlan) {
        const map = mapRef.current, context = overlay.current?.getContext('2d')
        const represented = imageSelected && map && context ? selectedResources.filter(resource => {
          const bounds = getPlanReportResourceBounds(context, map, resource, labels, planFont)
          const crop = getReportMapCrop(map.getSize(), framing === 'area' ? area : undefined)
          return bounds.right > crop.left && bounds.bottom > crop.top && bounds.left < crop.left + crop.width && bounds.top < crop.top + crop.height
        }) : selectedResources
        content.resources = represented.map(({ element, pin }) => ({ name: element.name, type: element.isUnit ? 'Dotación' : 'Elemento', information: element.information,
          latitude: pin.latitude.toFixed(6), longitude: pin.longitude.toFixed(6) }))
      }
      content.issues = issues
      const readGpx = async (reference: MapGpxReference) => await store.readWorkspaceGpx(reference) ?? await readGpxAccess(reference.fingerprint)
      const map = mapRef.current
      if (map && map.getSize().x && map.getSize().y && (framing !== 'current' || sourceFrame)) {
        try {
          content.recovery = createMapReportRecovery({ documentId: currentDocument.document.id, section, map, layers: tiles.current,
            crop: getReportMapCrop(map.getSize(), framing === 'area' ? area : undefined), fields, markers: selectedMarkers, references: selectedReferences, files,
            labels, routes: showRoutes, legend: showLegend, background: showBackground ? view.background : null, information: showInformation, plan: planDrawing,
            readGpx, image: content.image, page })
        } catch { /* Keep the captured report when its preparation cannot be retained. */ }
      }
      if (!content.recovery) content.recovery = createMapDataRecovery(content, selectedReferences, files, readGpx, [...fields])
      return content
    } }
    captureRef.current = handle
    return () => { if (captureRef.current === handle) captureRef.current = null }
  }, [store, documentGeneration, currentDocument, selectedMarkers, selectedReferences, files, drawnFiles, imageSelected, labels, view.background, showInformation, showBackground, showRoutes, showLegend, captureRef, blockedRef, isPlan, assetKey, assets, planDrawing, selectedResources, planFont, framing, area, sourceFrame, fields])

  function toggle(kind: 'markers' | 'gpx' | 'resources', id: string, checked: boolean) {
    setSelection(current => ({ ...current, [kind]: checked ? current[kind].filter(value => value !== id) : [...current[kind], id] }))
  }
  function changeBackground(background: typeof view.background, pnoaInformation = view.pnoaInformation) {
    if (blockedRef.current) return
    setView(current => ({ ...current, background, pnoaInformation }))
    const map = mapRef.current
    const center = map?.getCenter().wrap()
    writeMapView(navigationKey, { latitude: center?.lat ?? view.latitude, longitude: center?.lng ?? view.longitude, zoom: map?.getZoom() ?? view.zoom, background, pnoaInformation })
  }
  function touchStart(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') return
    pointers.current.add(event.pointerId)
    if (pointers.current.size >= 2) mapRef.current?.dragging.disable()
    if (pointers.current.size >= 3) { cancelledTouch.current = true; mapRef.current?.touchZoom.disable(); mapRef.current?.stop() }
  }
  function centerSelection() {
    const map = mapRef.current, context = overlay.current?.getContext('2d')
    if (!map || !context || blockedRef.current) return
    const frame = getReportMapContentFrame(context, map, selectedMarkers, drawnFiles, labels, planDrawing, area)
    if (frame) map.setView(frame.center, frame.zoom, { animate: false })
  }

  return <div className="reports-map">
    <h3>{title}</h3>
    {((isPlan && resources.length > 0) || (gpxSelected && references.length > 0)) && <label><input type="checkbox" checked={includeHidden} disabled={blocked} onChange={event => setIncludeHidden(event.target.checked)} />Incluir ocultos</label>}
    <div className="reports-map-selection">
      {isPlan && <fieldset disabled={blocked}><legend>Recursos</legend>
        {availableResources.length ? availableResources.map(({ element, pin }) => <label key={element.id}><input type="checkbox" checked={resourceIds.has(element.id.toLowerCase())} onChange={event => toggle('resources', element.id.toLowerCase(), event.target.checked)} />{element.name}
          {!pin.visible && <span className="reports-resource-state">Oculto</span>}
        </label>) : <span>{resources.length ? 'Sin recursos visibles.' : 'Sin recursos.'}</span>}
      </fieldset>}
      {markersSelected && <fieldset disabled={blocked}><legend>Marcadores</legend>
        {markers.length ? markers.map(marker => <label key={marker.id}><input type="checkbox" checked={markerIds.has(marker.id)} onChange={event => toggle('markers', marker.id, event.target.checked)} />{marker.name || 'Marcador'}</label>) : <span>Sin marcadores.</span>}
      </fieldset>}
      {gpxSelected && <fieldset disabled={blocked}><legend>Recorridos GPX</legend>
        {availableReferences.length ? availableReferences.map(file => <label key={file.id}><input type="checkbox" checked={gpxIds.has(file.id)} onChange={event => toggle('gpx', file.id, event.target.checked)} />{file.name}
          {!file.visible && <span className="reports-resource-state">Oculto</span>}
          {gpxIds.has(file.id) && !files.some(loaded => loaded.id === file.id) && <span className="reports-map-unavailable">No disponible</span>}
        </label>) : <span>{references.length ? 'Sin GPX visibles.' : 'Sin GPX.'}</span>}
      </fieldset>}
    </div>
    {imageSelected && <>
      <div className="reports-map-toolbar" role="group" aria-label={'Encuadre: ' + title}>
        <select aria-label={'Encuadre: ' + title} value={framing} disabled={blocked} onChange={event => {
          const next = event.target.value
          if (next === 'content' || next === 'area' || next === 'current' && sourceFrame) setFraming(next)
        }}>
          <option value="content">Contenido seleccionado</option>
          <option value="area">Área seleccionada</option>
          <option value="current" disabled={!sourceFrame}>Vista actual</option>
        </select>
        <label><input type="checkbox" checked={showBackground} disabled={blocked} onChange={event => setShowBackground(event.target.checked)} />Fondo</label>
        <select aria-label={'Fondo: ' + title} value={view.background} disabled={blocked || !showBackground} onChange={event => { if (isMapBackground(event.target.value)) changeBackground(event.target.value) }}>
          {Object.entries(MAP_BACKGROUNDS).map(([id, background]) => <option key={id} value={id}>{background.name}</option>)}
        </select>
        {view.background === 'pnoa' && <label><input type="checkbox" checked={view.pnoaInformation} disabled={blocked || !showBackground} onChange={event => changeBackground(view.background, event.target.checked)} />Callejero</label>}
        <label><input type="checkbox" checked={labels} disabled={blocked} onChange={event => setLabels(event.target.checked)} />Nombres</label>
        <label><input type="checkbox" checked={showRoutes} disabled={blocked} onChange={event => setShowRoutes(event.target.checked)} />Recorridos</label>
        <label><input type="checkbox" checked={showLegend} disabled={blocked} onChange={event => setShowLegend(event.target.checked)} />Leyenda</label>
        {isPlan && <label><input type="checkbox" checked={showStrokes} disabled={blocked} onChange={event => setShowStrokes(event.target.checked)} />Trazos</label>}
        {framing === 'area' && <>
          <HelpTooltip text="Centrar selección"><Button disabled={blocked || (!selectedMarkers.length && !drawnFiles.length && !planDrawing?.resources.length && !planDrawing?.strokes.length)} aria-label={'Centrar selección: ' + title} onClick={centerSelection}><Focus aria-hidden="true" /></Button></HelpTooltip>
          <HelpTooltip text="Acercar"><Button disabled={blocked} aria-label={'Acercar: ' + title} onClick={() => mapRef.current?.zoomIn()}><Plus aria-hidden="true" /></Button></HelpTooltip>
          <HelpTooltip text="Alejar"><Button disabled={blocked} aria-label={'Alejar: ' + title} onClick={() => mapRef.current?.zoomOut()}><Minus aria-hidden="true" /></Button></HelpTooltip>
        </>}
      </div>
      <div ref={viewport} className="reports-map-viewport" data-map-surface onPointerDownCapture={touchStart}
        onPointerMoveCapture={event => { if (cancelledTouch.current) event.stopPropagation() }}
        onTouchMoveCapture={event => { if (cancelledTouch.current) event.stopPropagation() }}>
        <div className="reports-map-render" style={framing === 'current' && sourceFrame ? { width: sourceFrame.width, height: sourceFrame.height,
          left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: `translate(-50%, -50%) scale(${viewportSize.width && viewportSize.height ? Math.min(viewportSize.width / sourceFrame.width, viewportSize.height / sourceFrame.height) : 1})` } : undefined}>
          <div ref={surface} className="reports-map-surface" style={showBackground ? undefined : { background: '#FFFFFF' }} role="region" aria-label={'Encuadre: ' + title} />
          <canvas ref={overlay} className="reports-map-overlay" aria-hidden="true" />
          {framing === 'area' && <ReportMapArea area={area} disabled={blocked} busyRef={areaGesture} onChange={setArea} />}
        </div>
      </div>
      {tileStatus && <p className="reports-map-notice" role="status">{tileStatus}</p>}
      {isPlan && assetKey && assets.key === assetKey && assets.unavailable.length > 0 && <p className="reports-map-notice" role="status">No se pudieron cargar los iconos del plano.</p>}
    </>}
  </div>
}
