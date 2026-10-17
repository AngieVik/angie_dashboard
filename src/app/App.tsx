import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Alert } from '../components/ui/alert'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu'
import type { ModuleActions } from '../layout/ModuleFrame'
import { LocateFixed, Magnet } from 'lucide-react'
import { ZoomControl } from '../layout/ZoomControl'
import { growWorkspaceExtent, reconstructWorkspaceExtent } from '../layout/workspaceExtent'
import { repositionModules } from '../layout/repositionModules'
import { HelpTooltip, TooltipProvider } from '../components/ui/tooltip'
import { FileMenu, DocumentNotices } from '../features/document/FileMenu'
import { getDocumentStore, useDocumentStore } from '../features/document/documentStore'
import { ViewMenu } from '../features/view/ViewMenu'
import type { ViewArrangement } from '../features/view/ViewMenu'
import { CleanupMenu } from '../features/view/CleanupMenu'
import type { CleanupRequest } from '../features/view/CleanupMenu'
import { BoardModule } from '../features/board/BoardModule'
import { ElementsModule } from '../features/elements/ElementsModule'
import { DotationsModule } from '../features/elements/DotationsModule'
import { InformationModule } from '../features/information/InformationModule'
import { OperationsModule } from '../features/operations/OperationsModule'
import { TimelineModule } from '../features/timeline/TimelineModule'
import { ClockModule } from '../features/clock/ClockModule'
import { CoordinatesModule } from '../features/coordinates/CoordinatesModule'
import type { LoadedGpx } from '../features/map/gpx'
import { CalculatorModule } from '../features/calculator/CalculatorModule'
import { ForecastModule } from '../features/forecast/ForecastModule'
import { clearForecastLocation } from '../features/forecast/forecast'
import { OpenMeteoModule } from '../features/openMeteo/OpenMeteoModule'
import { clearWeatherPoint } from '../features/openMeteo/openMeteo'
import { NotebookModule } from '../features/notebook/NotebookModule'
import { getTimerStore } from '../features/clock/timerStore'
import { useBoardImage } from '../features/board/useBoardImage'
import { DashboardGrid } from '../layout/DashboardGrid'
import type { OpenModule } from '../layout/DashboardGrid'
import { MobileViewport } from '../layout/MobileViewport'
import { findModulePlacement } from '../layout/findModulePlacement'
import { adaptModuleLayout, getWorkspaceBounds } from '../layout/adaptiveLayout'
import { MODULE_ICONS, MODULE_REGISTRY } from '../layout/moduleRegistry'
import type { ModuleId, ModuleLayout } from '../layout/layoutTypes'
import { fit, resizeViewport, zoomAt } from '../layout/viewportMath'
import { readNavigation, writeNavigation } from '../layout/navigationStorage'
import type { Position } from '../domain/document/types'
import { createEmptyDocument } from '../domain/document/defaultDocument'

const MapModule = lazy(() => import('../features/map/MapModule').then(module => ({ default: module.MapModule })))
const PlanModule = lazy(() => import('../features/plan/PlanModule').then(module => ({ default: module.PlanModule })))

type PresentedModule = OpenModule & { presentation?: { size: { width: number; height: number }; generation: number; source: string } }

function layoutSource(module: PresentedModule, saved: ModuleLayout | undefined, bounds: { width: number; height: number }, generation: number): ModuleLayout {
  if (saved) return saved
  if (module.presentation?.generation === generation) return module.layout
  return findModulePlacement({ id: module.id }, [], bounds).layout
}

function presentedLayout(module: PresentedModule, saved: ModuleLayout, bounds: { width: number; height: number }, generation: number): ModuleLayout {
  if (module.presentation?.generation === generation && module.presentation.size.width === bounds.width && module.presentation.size.height === bounds.height &&
    JSON.stringify(saved) === module.presentation.source) return module.layout
  const [width, height] = MODULE_REGISTRY[module.id].minimum
  return adaptModuleLayout(saved, bounds, { width, height })
}

export function App() {
  const store = getDocumentStore()
  const timers = getTimerStore()
  useEffect(() => { void timers.initialize(); return timers.connect() }, [timers])
  const { document, documentGeneration, ready, openModules: savedOpenModules, replacing } = useDocumentStore(store)
  const [mapFiles, setMapFiles] = useState<{ generation: number; files: LoadedGpx[] }>({ generation: documentGeneration, files: [] })
  if (mapFiles.generation !== documentGeneration) setMapFiles({ generation: documentGeneration, files: [] })
  const boardImage = useBoardImage(store)
  useEffect(() => { void store.initialize(); return store.connectWorkspaceAutosave() }, [store])
  const workspace = useRef<HTMLElement>(null)
  const modulesTrigger = useRef<HTMLButtonElement>(null)
  const [boardCenter, setBoardCenter] = useState<{ generation: number; center: Position } | null>(null)
  const updateBoardCenter = useCallback((center: Position) => {
    setBoardCenter(previous => previous?.generation === documentGeneration && previous.center.x === center.x && previous.center.y === center.y ? previous : { generation: documentGeneration, center })
  }, [documentGeneration])
  const [viewport, setViewport] = useState(() => {
    const size = { width: window.innerWidth, height: window.innerHeight }
    return { size, layoutSize: size, state: fit(size), measured: false }
  })
  const [navigationDocument, setNavigationDocument] = useState<string | null>(null)
  if (navigationDocument !== document.document.id) {
    const state = readNavigation(document.document.id + '.dashboard')
    setViewport(previous => ({ ...previous, state, measured: true }))
    setNavigationDocument(document.document.id)
  }
  useEffect(() => {
    if (navigationDocument === document.document.id) writeNavigation(document.document.id + '.dashboard', viewport.state)
  }, [navigationDocument, document.document.id, viewport.state])
  const [modules, setModules] = useState<PresentedModule[]>([])
  const [modulesGeneration, setModulesGeneration] = useState(-1)
  if (ready && modulesGeneration !== documentGeneration) {
    const available = getWorkspaceBounds(viewport.layoutSize, savedOpenModules)
    const restored: PresentedModule[] = []
    for (const id of savedOpenModules) restored.push({ id, layout: findModulePlacement({ id, saved: document.moduleLayouts[id] }, restored.map(module => module.layout), available).layout })
    setModules(restored)
    setModulesGeneration(documentGeneration)
  }
  useEffect(() => {
    if (ready && modulesGeneration === documentGeneration) store.setOpenModules(modules.map(module => module.id))
  }, [ready, modulesGeneration, documentGeneration, modules, store])
  const closedModules = useRef<Partial<Record<ModuleId, PresentedModule>>>({})
  const [magnet, setMagnet] = useState(false)
  const [moduleRevisions, setModuleRevisions] = useState<Partial<Record<ModuleId, number>>>({})
  const [sizePreservation, setSizePreservation] = useState<{ generation: number; revisions: Partial<Record<ModuleId, number>> }>({ generation: documentGeneration, revisions: {} })
  const [cleanupRequest, setCleanupRequest] = useState<CleanupRequest | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [selectionReset, setSelectionReset] = useState(0)
  const [editRequest, setEditRequest] = useState<{ id: string; generation: number } | null>(null)
  const blankPointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [active, setActive] = useState<ModuleId | null>(null)
  const [locationHighlight, setLocationHighlight] = useState<{ id: ModuleId; sequence: number; generation: number } | null>(null)
  const [modulesError, setModulesError] = useState<string | null>(null)
  const moduleActions = useRef<Partial<Record<ModuleId, ModuleActions>>>({})
  const pendingEditModule = useRef<ModuleId | null>(null)
  const registerModuleActions = useCallback((id: ModuleId, actions: ModuleActions | null) => {
    if (actions) {
      moduleActions.current[id] = actions
      if (pendingEditModule.current === id) { pendingEditModule.current = null; actions('expand') }
    } else delete moduleActions.current[id]
  }, [])
  const [layers, setLayers] = useState<ModuleId[]>([])
  const bounds = useMemo(() => getWorkspaceBounds(viewport.layoutSize, modules.map(module => module.id)), [viewport.layoutSize, modules])
  const visibleBounds = { width: Math.max(1, Math.ceil(viewport.size.width / viewport.state.scale)), height: Math.max(1, Math.ceil(viewport.size.height / viewport.state.scale)) }
  const requiredBounds = { width: Math.max(visibleBounds.width, Math.ceil((viewport.size.width - viewport.state.offsetX) / viewport.state.scale)), height: Math.max(visibleBounds.height, Math.ceil((viewport.size.height - viewport.state.offsetY) / viewport.state.scale)) }
  const [extent, setExtent] = useState(() => ({ generation: documentGeneration, size: reconstructWorkspaceExtent(requiredBounds, document.moduleLayouts) }))
  const [selection, setSelection] = useState<{ generation: number; id: string | null }>({ generation: documentGeneration, id: null })
  const selectedId = selection.generation === documentGeneration && document.elements.some(element => element.id === selection.id) ? selection.id : null
  const selectedCoordinate = document.elements.some(element => element.id === selectedId && element.isUnit)
    ? document.plan?.pins.find(pin => pin.elementId.toLowerCase() === selectedId?.toLowerCase()) : undefined
  const coordinateInput = useRef({ generation: documentGeneration, value: '' })
  const rememberCoordinateInput = useCallback((value: string) => { coordinateInput.current = { generation: documentGeneration, value } }, [documentGeneration])
  const getCoordinatesInput = useCallback(() => coordinateInput.current.generation === documentGeneration ? coordinateInput.current.value : '', [documentGeneration])
  const selectElement = (id: string | null) => { setEditRequest(null); setSelection({ generation: documentGeneration, id }) }
  useLayoutEffect(() => {
    const node = workspace.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const size = { width: node.clientWidth, height: node.clientHeight }
      if (size.width <= 0 || size.height <= 0) return
      const header = node.parentElement?.querySelector<HTMLElement>('.app-header')
      // Header zoom changes the visible viewport, not the layout reference.
      const layoutSize = { width: size.width, height: header ? (node.parentElement?.clientHeight || size.height + header.offsetHeight) - header.offsetHeight : size.height }
      setViewport(previous => {
        const nextBounds = getWorkspaceBounds(layoutSize, modules.map(module => module.id))
        const measuredExtent = modules.reduce((extent, module) => {
          const layout = presentedLayout(module, layoutSource(module, document.moduleLayouts[module.id], nextBounds, documentGeneration), nextBounds, documentGeneration)
          return { width: Math.max(extent.width, layout.x + layout.width), height: Math.max(extent.height, layout.y + layout.height) }
        },
          { width: Math.max(nextBounds.width, extent.generation === documentGeneration ? extent.size.width : 0, Math.ceil((size.width - previous.state.offsetX) / previous.state.scale)), height: Math.max(nextBounds.height, extent.generation === documentGeneration ? extent.size.height : 0, Math.ceil((size.height - previous.state.offsetY) / previous.state.scale)) })
        return { size, layoutSize, measured: true, state: !previous.measured ? fit(size, measuredExtent) : resizeViewport(previous.state, previous.size, size, measuredExtent) }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [modules, document.moduleLayouts, documentGeneration, extent])
  // Visibility is recovered with the local session; the portable JSON contains geometry.
  const open = useMemo(() => modules.map(module => ({ id: module.id,
    layout: presentedLayout(module, layoutSource(module, document.moduleLayouts[module.id], bounds, documentGeneration), bounds, documentGeneration),
  })), [modules, document.moduleLayouts, bounds, documentGeneration])
  const previousExtent = extent.generation === documentGeneration ? extent.size : reconstructWorkspaceExtent(requiredBounds, document.moduleLayouts)
  const sceneBounds = growWorkspaceExtent(previousExtent, requiredBounds, open.map(module => module.layout))
  if (extent.generation !== documentGeneration || extent.size.width !== sceneBounds.width || extent.size.height !== sceneBounds.height) {
    setExtent({ generation: documentGeneration, size: sceneBounds })
  }
  function grow(candidate: ModuleLayout) {
    setExtent(previous => ({ generation: documentGeneration, size: growWorkspaceExtent(previous.size, requiredBounds, [candidate]) }))
  }
  function recolocate() {
    if (!open.length) { setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } })); return }
    let scale = viewport.state.scale
    let placed = repositionModules(open, { width: viewport.size.width / scale, height: viewport.size.height / scale })
    // Prefer a wider view to shrinking manual sizes by more than 20%.
    while (scale > .25 && placed.some(item => item.layout.width < open.find(module => module.id === item.id)!.layout.width * .8 ||
      item.layout.height < open.find(module => module.id === item.id)!.layout.height * .8)) {
      scale = Math.max(.25, scale * .9)
      placed = repositionModules(open, { width: viewport.size.width / scale, height: viewport.size.height / scale })
    }
    const saved = placed
    try { store.mutateDocument(candidate => { for (const item of saved) candidate.moduleLayouts[item.id] = item.layout }) }
    catch { return }
    setModules(previous => previous.map(module => {
      const shown = placed.find(item => item.id === module.id)!, source = saved.find(item => item.id === module.id)!
      return { ...module, layout: shown.layout, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(source.layout) } }
    }))
    setExtent({ generation: documentGeneration, size: growWorkspaceExtent(reconstructWorkspaceExtent(requiredBounds, store.getSnapshot().document.moduleLayouts), requiredBounds, placed.map(item => item.layout)) })
    setViewport(previous => ({ ...previous, state: { scale, offsetX: 0, offsetY: 0 } }))
  }
  function activate(id: ModuleId) {
    setActive(id)
    setLayers(previous => previous.at(-1) === id ? previous : [...previous.filter(other => other !== id), id])
  }
  function selectOpenModule(id: ModuleId) {
    const module = open.find(module => module.id === id)
    if (!module) return
    setLocationHighlight(previous => active === id ? { id, sequence: (previous?.sequence ?? 0) + 1, generation: documentGeneration } : null)
    activate(id)
    // Reveal the window with the smallest camera movement, keeping its geometry and zoom.
    setViewport(previous => {
      const reveal = (offset: number, position: number, length: number, available: number) => {
        const start = position * previous.state.scale + offset
        const end = start + Math.min(length * previous.state.scale, available)
        return Math.min(0, start < 0 ? offset - start : end > available ? offset + available - end : offset)
      }
      const offsetX = reveal(previous.state.offsetX, module.layout.x, module.layout.width, previous.size.width)
      const offsetY = reveal(previous.state.offsetY, module.layout.y, module.layout.height, previous.size.height)
      if (offsetX === previous.state.offsetX && offsetY === previous.state.offsetY) return previous
      return { ...previous, state: { ...previous.state, offsetX, offsetY } }
    })
  }
  function fitActiveModule() {
    if (active && open.some(module => module.id === active)) moduleActions.current[active]?.('fit')
  }
  function saveLayout(id: ModuleId, layout: ModuleLayout, kind: 'move' | 'resize' = 'resize') {
    const manual = kind === 'move' ? document.moduleLayouts[id] ?? { width: MODULE_REGISTRY[id].initial[0], height: MODULE_REGISTRY[id].initial[1] } : layout
    const saved = { ...layout, width: manual.width, height: manual.height, referenceSize: {
      width: Math.ceil(Math.max(bounds.width, layout.x + manual.width + 12, layout.x + layout.width + 12)), height: Math.ceil(Math.max(bounds.height, layout.y + manual.height + 12, layout.y + layout.height + 12)),
    } }
    store.mutateDocument(document => { document.moduleLayouts[id] = saved })
    setModules(previous => previous.map(module => module.id === id ? { ...module, layout, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(saved) } } : module))
  }
  function close(id: ModuleId) {
    if (locationHighlight?.id === id) setLocationHighlight(null)
    if (id === 'elements' || id === 'dotations') { setEditRequest(null); pendingEditModule.current = null }
    const shown = open.find(module => module.id === id)
    if (shown) closedModules.current[id] = { ...shown, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(document.moduleLayouts[id] ?? shown.layout) } }
    if (id === 'board') setBoardCenter(null)
    modulesTrigger.current?.focus()
    setModules(previous => previous.filter(module => module.id !== id))
    setLayers(previous => previous.filter(other => other !== id))
    if (active === id) setActive(null)
  }
  function requestCleanup(id: ModuleId | null, close: boolean) {
    setCleanupError(null)
    setCleanupRequest({ ids: id ? [id] : Object.keys(MODULE_REGISTRY) as ModuleId[], close, generation: documentGeneration })
  }
  function confirmCleanup() {
    const request = cleanupRequest, snapshot = store.getSnapshot()
    if (!request || request.generation !== snapshot.documentGeneration || !snapshot.ready || snapshot.replacing) return
    try {
      const timerSnapshot = timers.getSnapshot()
      if (request.ids.includes('clock') && (!timerSnapshot.ready || timerSnapshot.storageUnavailable)) {
        throw new Error('Espera a que estén disponibles los temporizadores antes de limpiarlos.')
      }
      // Validate all document changes together before changing independent timers.
      store.mutateDocument(candidate => {
        for (const id of request.ids) {
          if (id === 'board') candidate.board = createEmptyDocument().board
          else if (id === 'map') delete candidate.map
          else if (id === 'plan') delete candidate.plan
          else if (id === 'elements') candidate.elements = candidate.elements.filter(element => element.isUnit)
          else if (id === 'dotations') candidate.elements = candidate.elements.filter(element => !element.isUnit)
          else if (id === 'notebook') candidate.notebook = []
          else if (id === 'timeline') {
            candidate.timeline = []
            for (const element of candidate.elements) if (element.isUnit) {
              element.operational.status = null; element.operational.currentEntryId = null
            }
          } else if (id === 'information' || id === 'operations') {
            for (const element of candidate.elements) if (element.isUnit) {
              element.operational = { status: null, currentEntryId: null, notes: '', tags: [] }
            }
          }
        }
        if (candidate.plan) {
          const remaining = new Set(candidate.elements.map(element => element.id.toLowerCase()))
          candidate.plan.pins = candidate.plan.pins.filter(pin => remaining.has(pin.elementId.toLowerCase()))
        }
      })
      if (request.ids.includes('clock')) for (const timer of timerSnapshot.timers) timers.close(timer.id)
      if (request.ids.includes('board')) { boardImage.clear(); setBoardCenter(null); setSelectionReset(value => value + 1) }
      if (request.ids.includes('map')) setMapFiles({ generation: documentGeneration, files: [] })
      if (request.ids.includes('forecast')) clearForecastLocation(document.document.id)
      if (request.ids.includes('openMeteo')) clearWeatherPoint(document.document.id)
      if (request.ids.includes('coordinates')) rememberCoordinateInput('')
      if (request.ids.some(id => id === 'elements' || id === 'dotations' || id === 'information' || id === 'operations')) selectElement(null)
      // Shared data can change other windows too; suppress automatic resizing until their next content interaction.
      setSizePreservation(previous => {
        const revisions: Partial<Record<ModuleId, number>> = previous.generation === documentGeneration ? { ...previous.revisions } : {}
        for (const id of new Set([...open.map(module => module.id), ...request.ids])) revisions[id] = (revisions[id] ?? 0) + 1
        return { generation: documentGeneration, revisions }
      })
      setModuleRevisions(previous => {
        const next = { ...previous }
        for (const id of request.ids) next[id] = (next[id] ?? 0) + 1
        return next
      })
      if (request.close) for (const id of request.ids) close(id)
      setCleanupRequest(null); setCleanupError(null); setModulesError(null)
    } catch (error) { setCleanupError(error instanceof Error ? error.message : 'No se pudieron limpiar los módulos.') }
  }
  function arrangeOpen(mode: ViewArrangement, columns: number) {
    if (!open.length) return
    try {
      setModulesError(null)
      const collapsed = mode !== 'columns'
      // Use the frame's restore action so mounted content keeps its saved size.
      if (!collapsed) for (const module of open) if (module.layout.height <= 29) moduleActions.current[module.id]?.('expand')
      const placed: OpenModule[] = []
      const origin = { x: Math.max(0, Math.ceil(-viewport.state.offsetX / viewport.state.scale)), y: Math.max(0, Math.ceil(-viewport.state.offsetY / viewport.state.scale)) }
      const standardWidth = 200, collapsedHeight = 27
      const gap = 8, count = Math.min(columns, open.length)
      const expanded = open.map(module => {
        const navigation = readNavigation(document.document.id + '.' + module.id)
        const size = module.layout.height <= 29 ? navigation.restoreSize ?? { width: MODULE_REGISTRY[module.id].initial[0], height: MODULE_REGISTRY[module.id].initial[1] } : module.layout
        return { ...module, layout: { ...module.layout, width: size.width, height: size.height } }
      })
      const widths = Array.from({ length: count }, (_, column) => Math.max(...expanded.filter((_module, index) => index % count === column).map(module => module.layout.width)))
      const tops = Array<number>(count).fill(origin.y)
      const perRow = Math.max(1, Math.floor(visibleBounds.width / standardWidth))
      const perColumn = Math.max(1, Math.floor(visibleBounds.height / collapsedHeight))
      for (const [index, module] of expanded.entries()) {
        const { id } = module
        let layout = { ...module.layout }
        const key = document.document.id + '.' + id
        const navigation = readNavigation(key)
        if (collapsed) {
          writeNavigation(key, { ...navigation, restoreSize: { width: layout.width, height: layout.height } })
          layout = { ...layout, width: standardWidth, height: collapsedHeight,
            x: origin.x + (mode === 'collapsed-rows' ? index % perRow : Math.floor(index / perColumn)) * standardWidth,
            y: origin.y + (mode === 'collapsed-rows' ? Math.floor(index / perRow) : index % perColumn) * collapsedHeight }
        } else {
          const column = index % count
          layout = { ...layout, x: origin.x + widths.slice(0, column).reduce((sum, width) => sum + width + gap, 0), y: tops[column]! }
          tops[column] = tops[column]! + layout.height + gap
        }
        layout = { ...layout, referenceSize: { width: Math.max(bounds.width, layout.x + layout.width), height: Math.max(bounds.height, layout.y + layout.height) } }
        placed.push({ id, layout })
      }
      store.mutateDocument(candidate => { for (const module of placed) candidate.moduleLayouts[module.id] = module.layout })
      setModules(placed.map(module => ({ ...module, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(module.layout) } })))
    } catch (error) { setModulesError(error instanceof Error ? error.message : 'No se pudieron distribuir los módulos.') }
  }
  function toggle(id: ModuleId) {
    if (open.some(module => module.id === id)) { activate(id); return }
    const nextBounds = getWorkspaceBounds(visibleBounds, [...modules.map(module => module.id), id])
    const placement = findModulePlacement({ id, saved: document.moduleLayouts[id] }, open.map(module => module.layout), nextBounds)
    const cached = closedModules.current[id]
    const source = JSON.stringify(document.moduleLayouts[id] ?? (cached?.presentation?.generation === documentGeneration ? cached.layout : placement.layout))
    const layout = cached?.presentation?.generation === documentGeneration && cached.presentation.source === source && cached.presentation.size.width === bounds.width && cached.presentation.size.height === bounds.height ? cached.layout : placement.layout
    setModules(previous => [...previous, { id, layout, presentation: { size: bounds, generation: documentGeneration, source } }])
    activate(id)
  }
  return (
    <TooltipProvider delayDuration={800}><div className="app-shell">
      <header className="app-header" style={{ zoom: viewport.state.scale }}>
        <h1><img className="app-logo" src="/assets/elements/icon_chincheta.png" alt="Angie Dashboard" /></h1>
        <FileMenu store={store} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button ref={modulesTrigger} className="document-button dashboard-menu-trigger">Módulos</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(MODULE_REGISTRY) as ModuleId[]).map(id => {
              const Icon = MODULE_ICONS[id], isOpen = modules.some(module => module.id === id)
              return <DropdownMenuItem key={id} className="file-menu-item module-list-item" aria-label={MODULE_REGISTRY[id].name} aria-describedby={'module-state-' + id} disabled={!ready || replacing} onSelect={() => toggle(id)}>
                <Icon className="module-list-icon" data-open={isOpen} aria-hidden="true" />
                {MODULE_REGISTRY[id].name}<span id={'module-state-' + id} className="visually-hidden">{isOpen ? 'Abierto' : 'Cerrado'}</span>
              </DropdownMenuItem>
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <ViewMenu disabled={!ready || replacing || !open.length} active={open.some(module => module.id === active)}
          onArrange={arrangeOpen} onAutoArrange={recolocate} onFitActive={fitActiveModule} />
        <CleanupMenu active={open.some(module => module.id === active) ? active : null} disabled={!ready || replacing}
          request={cleanupRequest?.generation === documentGeneration ? cleanupRequest : null} error={cleanupError}
          onRequest={requestCleanup} onCancel={() => { setCleanupRequest(null); setCleanupError(null) }} onConfirm={confirmCleanup} />
        <nav className="open-modules" aria-label="Módulos abiertos">
          {open.map(({ id }) => {
            const Icon = MODULE_ICONS[id], name = MODULE_REGISTRY[id].name
            return <HelpTooltip key={id} text={(active === id ? 'Localizar ' : 'Seleccionar ') + name}>
              <Button className="document-button module-button" aria-label={'Seleccionar módulo ' + name} aria-pressed={active === id}
                disabled={!ready || replacing} onClick={() => selectOpenModule(id)}><Icon aria-hidden="true" /></Button>
            </HelpTooltip>
          })}
        </nav>
        <HelpTooltip text="Imán de módulos"><Button className="module-button magnet-button" aria-label="Imán de módulos" aria-pressed={magnet} onClick={() => setMagnet(value => !value)}><Magnet aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Volver al origen"><Button className="module-button origin-button" aria-label="Volver al origen" onClick={() => setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))}><LocateFixed size={19} aria-hidden="true" /></Button></HelpTooltip>
        <ZoomControl key={documentGeneration} label="Zoom actual" scale={viewport.state.scale} onChange={scale => setViewport(previous => ({ ...previous,
          state: zoomAt(previous.state, scale, { x: 0, y: 0 }, previous.size, sceneBounds) }))} />
      </header>
      <main ref={workspace} className="dashboard-workspace" aria-label="Espacio de trabajo" aria-busy={replacing}
        onPointerDownCapture={event => { blankPointer.current = { x: event.clientX, y: event.clientY, moved: false } }}
        onPointerMoveCapture={event => {
          const start = blankPointer.current
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) start.moved = true
        }} onPointerCancelCapture={() => { blankPointer.current = null }}
        onClick={event => {
          if (blankPointer.current?.moved || !(event.target instanceof Element) || event.target.closest('.module-header,.board-pin,.quick-note,.element-row,button,input,textarea,select,a,[role="button"],[role="radio"],[contenteditable="true"]')) return
          if (event.target.closest('[data-module="operations"],[data-module="information"]')) return
          if (event.target.closest('[data-module]')?.querySelector('.element-editor')) return
          selectElement(null); setSelectionReset(value => value + 1)
          if (!event.target.closest('[data-module]')) setActive(null)
        }}>
        <DocumentNotices store={store} />
        {modulesError && <div className="document-notices"><Alert>{modulesError}</Alert></div>}
        <div className="document-workspace-content" inert={replacing}>
        <MobileViewport state={viewport.state} size={viewport.size} bounds={sceneBounds} headerHeight={36} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid onActions={registerModuleActions} revisions={moduleRevisions} locationHighlight={locationHighlight?.generation === documentGeneration ? locationHighlight : undefined} contentSizeRevisions={sizePreservation.generation === documentGeneration ? sizePreservation.revisions : undefined} viewOrigin={{ x: Math.max(0, -viewport.state.offsetX / viewport.state.scale), y: Math.max(0, -viewport.state.offsetY / viewport.state.scale) }} navigationKey={document.document.id} magnet={magnet} generation={documentGeneration} modules={open} bounds={sceneBounds} visible={visibleBounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout} onGrow={grow}
            renderModule={id => id === 'board' ? <BoardModule selectionReset={selectionReset} key={documentGeneration} store={store} imageSession={boardImage} selectedId={selectedId} onSelect={selectElement}
              onViewChange={updateBoardCenter} onOpenModule={id => { if (open.some(module => module.id === id)) activate(id); else toggle(id) }}
              onEditElement={elementId => {
                const element = document.elements.find(element => element.id === elementId)
                if (!element) return
                const id = element.isUnit ? 'dotations' : 'elements'
                selectElement(elementId); setEditRequest({ id: elementId, generation: documentGeneration })
                if (open.some(module => module.id === id)) { moduleActions.current[id]?.('expand'); activate(id) }
                else { pendingEditModule.current = id; toggle(id) }
              }} /> :
              id === 'elements' ? <ElementsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                editRequest={editRequest?.generation === documentGeneration && editRequest.id === selectedId ? editRequest : undefined}
                placementPosition={boardCenter?.generation === documentGeneration ? boardCenter.center : undefined} /> :
              id === 'dotations' ? <DotationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                editRequest={editRequest?.generation === documentGeneration && editRequest.id === selectedId ? editRequest : undefined}
                placementPosition={boardCenter?.generation === documentGeneration ? boardCenter.center : undefined} /> :
              id === 'information' ? <InformationModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'operations' ? <OperationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'timeline' ? <TimelineModule key={documentGeneration} store={store} /> :
              id === 'clock' ? <ClockModule store={timers} /> :
              id === 'coordinates' ? <CoordinatesModule generation={documentGeneration} selectedCoordinate={selectedCoordinate} onInputChange={rememberCoordinateInput} /> :
              id === 'plan' ? <Suspense fallback={<p role="status">Cargando plano operativo…</p>}><PlanModule key={`${documentGeneration}.${moduleRevisions.plan ?? 0}`} navigationKey={document.document.id} store={store}
                selectedId={selectedId} onSelect={selectElement}
                files={mapFiles.generation === documentGeneration ? mapFiles.files : []}
                onFilesChange={files => { if (store.getSnapshot().documentGeneration === documentGeneration) setMapFiles({ generation: documentGeneration, files }) }}
                onOpenModule={id => { if (open.some(module => module.id === id)) activate(id); else toggle(id) }}
                onEditElement={elementId => {
                  const element = document.elements.find(element => element.id === elementId)
                  if (!element) return
                  const id = element.isUnit ? 'dotations' : 'elements'
                  selectElement(elementId); setEditRequest({ id: elementId, generation: documentGeneration })
                  if (open.some(module => module.id === id)) { moduleActions.current[id]?.('expand'); activate(id) }
                  else { pendingEditModule.current = id; toggle(id) }
                }} /></Suspense> :
              id === 'map' ? <Suspense fallback={<p role="status">Cargando mapa…</p>}><MapModule key={documentGeneration} navigationKey={document.document.id} store={store}
                files={mapFiles.generation === documentGeneration ? mapFiles.files : []}
                onFilesChange={files => { if (store.getSnapshot().documentGeneration === documentGeneration) setMapFiles({ generation: documentGeneration, files }) }} /></Suspense> :
              id === 'notebook' ? <NotebookModule key={documentGeneration} store={store} /> :
              id === 'forecast' ? <ForecastModule key={`${documentGeneration}.${moduleRevisions.forecast ?? 0}`} navigationKey={document.document.id} /> :
              id === 'openMeteo' ? <OpenMeteoModule key={`${documentGeneration}.${moduleRevisions.openMeteo ?? 0}`} navigationKey={document.document.id} getCoordinatesInput={getCoordinatesInput} /> :
              id === 'calculator' ? <CalculatorModule generation={documentGeneration} /> : null} />
        </MobileViewport>
        </div>
      </main>
    </div></TooltipProvider>
  )
}
