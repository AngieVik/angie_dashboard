import { lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast, Toaster } from '@/components/ui/sonner'
import { useSettings } from '@/features/settings/useSettings'
import { validateDesktopViewState } from '@/features/settings/savedDesktopViews'
import type { DesktopViewState } from '@/features/settings/savedDesktopViews'
import { AppHeader } from './AppHeader'
import styles from './app.module.css'
import type { ModuleActions } from '../layout/ModuleFrame'
import { measureWorkspaceExtent } from '../layout/workspaceExtent'
import { collectModuleBars, repositionModules } from '../layout/repositionModules'

import { getDocumentStore, useDocumentStore } from '../features/document/documentStore'
import { applyCleanupPlan, buildCleanupPlan, CLEANUP_CHANGED_ERROR, CLEANUP_MODULE_IDS } from '../features/view/cleanupPlan'
import type { CleanupRequest } from '../features/view/cleanupPlan'
import type { ReportsNotice } from '../features/document/ReportsModule'
import type { GeographicCoordinate } from '../features/coordinates/coordinateTypes'
import type { MapNotice } from '../features/map/MapModule'
import { getTimerStore } from '../features/clock/timerStore'
import { getCalendarStore } from '../features/calendar/calendarStore'
import { resetDrawingHistory } from '../features/drawing/drawingHistory'
import { useBoardImage } from '../features/board/useBoardImage'
import { DashboardGrid } from '../layout/DashboardGrid'
import type { OpenModule } from '../layout/DashboardGrid'
import { MobileViewport } from '../layout/MobileViewport'
import { findModulePlacement } from '../layout/findModulePlacement'
import { getWorkspaceBounds } from '../layout/adaptiveLayout'
import type { ModuleId, ModuleLayout } from '../layout/layoutTypes'
import { clamp, fit, resizeViewport, zoomAt } from '../layout/viewportMath'
import { readNavigation, readReloadZoom, writeNavigation, writeReloadZoom } from '../layout/navigationStorage'

const moduleFactories = {
  board: () => lazy(() => import('../features/board/BoardModule').then(module => ({ default: module.BoardModule }))),
  elements: () => lazy(() => import('../features/elements/ElementsModule').then(module => ({ default: module.ElementsModule }))),
  dotations: () => lazy(() => import('../features/elements/DotationsModule').then(module => ({ default: module.DotationsModule }))),
  information: () => lazy(() => import('../features/information/InformationModule').then(module => ({ default: module.InformationModule }))),
  operations: () => lazy(() => import('../features/operations/OperationsModule').then(module => ({ default: module.OperationsModule }))),
  timeline: () => lazy(() => import('../features/timeline/TimelineModule').then(module => ({ default: module.TimelineModule }))),
  clock: () => lazy(() => import('../features/clock/ClockModule').then(module => ({ default: module.ClockModule }))),
  coordinates: () => lazy(() => import('../features/coordinates/CoordinatesModule').then(module => ({ default: module.CoordinatesModule }))),
  calculator: () => lazy(() => import('../features/calculator/CalculatorModule').then(module => ({ default: module.CalculatorModule }))),
  notebook: () => lazy(() => import('../features/notebook/NotebookModule').then(module => ({ default: module.NotebookModule }))),
  reports: () => lazy(() => import('../features/document/ReportsModule').then(module => ({ default: module.ReportsModule }))),
  map: () => lazy(() => import('../features/map/MapModule').then(module => ({ default: module.MapModule }))),
  plan: () => lazy(() => import('../features/plan/PlanModule').then(module => ({ default: module.PlanModule }))),
  calendar: () => lazy(() => import('../features/calendar/CalendarModule').then(module => ({ default: module.CalendarModule }))),
}
type ModuleViews = { [Id in ModuleId]: ReturnType<(typeof moduleFactories)[Id]> }

function createModuleViews(): ModuleViews {
  return Object.fromEntries(Object.entries(moduleFactories).map(([id, create]) => [id, create()])) as ModuleViews
}

export function App() {
  // Mantén las identidades perezosas por encima de los límites de la ventana: solo una recuperación explícita sustituye a una de ellas.
  const [moduleViews, setModuleViews] = useState(createModuleViews)
  const { board: BoardModule, elements: ElementsModule, dotations: DotationsModule, information: InformationModule,
    operations: OperationsModule, timeline: TimelineModule, clock: ClockModule, coordinates: CoordinatesModule,
    calculator: CalculatorModule, notebook: NotebookModule, reports: ReportsModule, map: MapModule,
    plan: PlanModule, calendar: CalendarModule } = moduleViews
  function retryModule(id: ModuleId) {
    setModuleViews(previous => ({ ...previous, [id]: moduleFactories[id]() }))
  }
  const store = getDocumentStore()
  const timers = getTimerStore()
  const calendar = getCalendarStore()
  const calendarError = useSyncExternalStore(calendar.subscribe, () => calendar.getSnapshot().error)
  useEffect(() => {
    if (calendarError) toast.error(calendarError, { notice: 'calendar', id: 'calendar-notice' })
    else toast.dismiss('calendar-notice')
  }, [calendarError])
  useEffect(() => { void calendar.initialize(); return calendar.connect() }, [calendar])
  const timerProblem = useSyncExternalStore<'conflict' | 'corrupt' | 'unavailable' | null>(timers.subscribe, () => {
    const snapshot = timers.getSnapshot()
    return snapshot.storageConflict ? 'conflict' : snapshot.storageCorrupt ? 'corrupt' : snapshot.storageUnavailable ? 'unavailable' : null
  })
  const audioProblem = useSyncExternalStore(timers.alarm.subscribe, () => timers.alarm.getSnapshot().error)
  const clockNotified = useRef({ storage: false, audio: false })
  useEffect(() => {
    const storageAdded = timerProblem && !clockNotified.current.storage
    const audioAdded = audioProblem && !clockNotified.current.audio
    clockNotified.current = { storage: Boolean(timerProblem), audio: Boolean(audioProblem) }
    if (storageAdded) toast.error(timerProblem === 'conflict' ? 'Los temporizadores han cambiado en otra pestaña.' : 'Autoguardado de temporizadores no disponible.', { notice: 'timerStorage', id: 'clock-notice' })
    else if (audioAdded && audioProblem) toast.error(audioProblem, { notice: 'timerAudio', id: 'clock-notice' })
    if (!timerProblem && !audioProblem) toast.dismiss('clock-notice')
  }, [timerProblem, audioProblem])
  useEffect(() => () => { toast.dismiss('clock-notice') }, [])
  const { document, documentGeneration, ready, openModules: savedOpenModules, replacing, active: boardActive } = useDocumentStore(store)
  const [reportNotices, setReportNotices] = useState<{ generation: number; value: ReportsNotice | null }>({ generation: documentGeneration, value: null })
  const updateReportNotices = useCallback((value: ReportsNotice | null) => {
    if (store.getSnapshot().documentGeneration !== documentGeneration) return
    setReportNotices(current => current.generation === documentGeneration && current.value === value ? current : { generation: documentGeneration, value })
  }, [store, documentGeneration])
  const [mapNotices, setMapNotices] = useState<{ generation: number; value: Partial<Record<'map' | 'plan', MapNotice>> }>({ generation: documentGeneration, value: {} })
  const updateMapNotices = useCallback((source: 'map' | 'plan', notice: MapNotice | null) => {
    if (store.getSnapshot().documentGeneration !== documentGeneration) return
    setMapNotices(current => {
      const previous: Partial<Record<'map' | 'plan', MapNotice>> = current.generation === documentGeneration ? current.value : {}
      if ((previous[source] ?? null) === notice) return current
      const value = { ...previous }
      if (notice) value[source] = notice
      else delete value[source]
      return { generation: documentGeneration, value }
    })
  }, [store, documentGeneration])
  const boardImage = useBoardImage(store)
  const boardImageInput = useRef<HTMLInputElement>(null)
  useEffect(() => { void store.initialize(); return store.connectLocalAutosave() }, [store])
  const workspace = useRef<HTMLElement>(null)
  const modulesTrigger = useRef<HTMLButtonElement>(null)
  const [initialModulesApplied, setInitialModulesApplied] = useState(false)
  const [refreshRecovery] = useState(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return navigation?.type === 'reload'
  })
  const recoveredZoom = !initialModulesApplied && refreshRecovery && boardActive ? readReloadZoom(document.document.id) : null
  const [viewport, setViewport] = useState(() => {
    const size = { width: window.innerWidth, height: window.innerHeight }
    return { size, layoutSize: size, state: fit(size), measured: false }
  })
  const [navigationGeneration, setNavigationGeneration] = useState(-1)
  if (navigationGeneration !== documentGeneration) {
    const navigation = readNavigation(document.document.id + '.dashboard')
    const state = recoveredZoom === null ? navigation : { ...navigation, scale: recoveredZoom }
    setViewport(previous => ({ ...previous, state, measured: true }))
    setNavigationGeneration(documentGeneration)
  }
  useEffect(() => {
    if (boardActive && navigationGeneration === documentGeneration) {
      writeNavigation(document.document.id + '.dashboard', viewport.state)
      writeReloadZoom(document.document.id, viewport.state.scale)
    }
  }, [boardActive, navigationGeneration, documentGeneration, document.document.id, viewport.state])
  const [modules, setModules] = useState<OpenModule[]>([])
  const [modulesGeneration, setModulesGeneration] = useState(-1)
  const preferences = useSettings()
  const [initialArrangementGeneration, setInitialArrangementGeneration] = useState<number | null>(null)
  const [viewRestoreSequence, setViewRestoreSequence] = useState(0)
  const initialPreferencesReady = preferences.ready || Boolean(preferences.error && !preferences.loading)
  if (ready && modulesGeneration !== documentGeneration && (initialModulesApplied || initialPreferencesReady)) {
    const applyInitialView = !initialModulesApplied && !(refreshRecovery && boardActive) && preferences.ready
    const ids = applyInitialView && preferences.settings.initialModules !== null
      ? preferences.settings.initialModules : savedOpenModules
    const scale = applyInitialView ? preferences.settings.initialZoom : recoveredZoom ??
      (navigationGeneration !== documentGeneration ? readNavigation(document.document.id + '.dashboard').scale : viewport.state.scale)
    const available = getWorkspaceBounds({ width: Math.ceil(viewport.size.width / scale), height: Math.ceil(viewport.size.height / scale) }, ids)
    const restored: OpenModule[] = []
    for (const id of ids) {
      const layout = findModulePlacement({ id }, restored.map(module => module.layout), available).layout
      restored.push({ id, layout, resetSizeOnMount: true })
    }
    if (applyInitialView) {
      setViewport(previous => ({ ...previous, measured: true, state: { scale, offsetX: 0, offsetY: 0 } }))
      if (preferences.settings.initialArrangement === 'bars') setModules(collectModuleBars(restored, available))
      else {
        setModules(repositionModules(restored, available))
        setInitialArrangementGeneration(documentGeneration)
      }
    } else setModules(restored)
    setModulesGeneration(documentGeneration)
    setInitialModulesApplied(true)
  }
  // Expanded opening heights are measured after lazy module content mounts.
  if (initialArrangementGeneration !== null && (initialArrangementGeneration !== documentGeneration ||
    (modulesGeneration === documentGeneration && modules.every(module => !module.resetSizeOnMount)))) {
    if (initialArrangementGeneration === documentGeneration) {
      setModules(repositionModules(modules, { width: Math.ceil(viewport.size.width / viewport.state.scale), height: Math.ceil(viewport.size.height / viewport.state.scale) }))
    }
    setInitialArrangementGeneration(null)
  }
  useEffect(() => {
    if (ready && modulesGeneration === documentGeneration) store.setOpenModules(modules.map(module => module.id), documentGeneration)
  }, [ready, modulesGeneration, documentGeneration, modules, store])
  const [magnet, setMagnet] = useState<boolean | null>(null)
  if (preferences.ready && magnet === null) setMagnet(preferences.settings.magnetByDefault)
  const [moduleRevisions, setModuleRevisions] = useState<Partial<Record<ModuleId, number>>>({})
  const [sizePreservation, setSizePreservation] = useState<{ generation: number; revisions: Partial<Record<ModuleId, number>> }>({ generation: documentGeneration, revisions: {} })
  const [cleanupRequest, setCleanupRequest] = useState<CleanupRequest | null>(null)
  const cleanupTimerCount = useSyncExternalStore(timers.subscribe, () => timers.getSnapshot().timers.length)
  const cleanupPlan = useMemo(() => cleanupRequest?.generation === documentGeneration
    ? buildCleanupPlan(document, cleanupRequest.ids, cleanupTimerCount) : null,
  [cleanupRequest, documentGeneration, document, cleanupTimerCount])
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const cleanupInFlight = useRef(false)
  const [selectionReset, setSelectionReset] = useState(0)
  const [editRequest, setEditRequest] = useState<{ id: string; generation: number } | null>(null)
  const blankPointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [active, setActive] = useState<ModuleId | null>(null)
  const [locationHighlight, setLocationHighlight] = useState<{ id: ModuleId; sequence: number; generation: number } | null>(null)
  const setModulesError = (message: string | null) => {
    if (message) toast.error(message, { notice: 'arrangement', id: 'module-arrangement' })
    else toast.dismiss('module-arrangement')
  }
  const moduleActions = useRef<Partial<Record<ModuleId, ModuleActions>>>({})
  const pendingEditModule = useRef<ModuleId | null>(null)
  const registerModuleActions = useCallback((id: ModuleId, actions: ModuleActions | null) => {
    if (actions) {
      moduleActions.current[id] = actions
      if (pendingEditModule.current === id) { pendingEditModule.current = null; actions('expand') }
    } else delete moduleActions.current[id]
  }, [])
  const [layers, setLayers] = useState<ModuleId[]>([])
  const visibleBounds = { width: Math.max(1, Math.ceil(viewport.size.width / viewport.state.scale)), height: Math.max(1, Math.ceil(viewport.size.height / viewport.state.scale)) }
  const [growth, setGrowth] = useState<{ generation: number; size: { width: number; height: number } } | null>(null)
  const [selection, setSelection] = useState<{ generation: number; id: string | null }>({ generation: documentGeneration, id: null })
  const selectedId = selection.generation === documentGeneration && document.elements.some(element => element.id === selection.id) ? selection.id : null
  const [coordinateSelection, setCoordinateSelection] = useState<{ generation: number; point: GeographicCoordinate } | null>(null)
  const selectedCoordinate = coordinateSelection?.generation === documentGeneration ? coordinateSelection.point : undefined
  const [radar, setRadar] = useState<{ generation: number; active: boolean; point: GeographicCoordinate | null }>({ generation: documentGeneration, active: false, point: null })
  const radarActive = radar.generation === documentGeneration && radar.active
  const radarPoint = radar.generation === documentGeneration ? radar.point : null
  const toggleRadar = useCallback(() => {
    if (store.getSnapshot().documentGeneration !== documentGeneration || !store.getSnapshot().active || store.getSnapshot().replacing) return
    setRadar(previous => ({ generation: documentGeneration, active: previous.generation === documentGeneration ? !previous.active : true,
      point: selectedCoordinate ?? (previous.generation === documentGeneration ? previous.point : null) }))
  }, [store, documentGeneration, selectedCoordinate])
  const selectCoordinate = useCallback((point: GeographicCoordinate) => {
    if (store.getSnapshot().documentGeneration === documentGeneration) {
      const received = { latitude: point.latitude, longitude: point.longitude }
      setCoordinateSelection({ generation: documentGeneration, point: received })
      setRadar(previous => ({ generation: documentGeneration, active: previous.generation === documentGeneration && previous.active, point: received }))
    }
  }, [store, documentGeneration])
  const rememberCoordinateInput = useCallback((_value: string, point: GeographicCoordinate | null = null) => {
    if (store.getSnapshot().documentGeneration !== documentGeneration) return
    setRadar(previous => previous.generation !== documentGeneration || !previous.active ||
      previous.point?.latitude === point?.latitude && previous.point?.longitude === point?.longitude ? previous : { ...previous, point })
  }, [store, documentGeneration])
  const getTimerRecords = useCallback(() => {
    return timers.getReportRecords()
  }, [timers])
  const selectElement = (id: string | null) => {
    setEditRequest(null); setSelection({ generation: documentGeneration, id })
    const pin = store.getSnapshot().document.plan?.pins.find(pin => pin.elementId.toLowerCase() === id?.toLowerCase())
    if (pin) selectCoordinate(pin)
  }
  useLayoutEffect(() => {
    const node = workspace.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const size = { width: node.clientWidth, height: node.clientHeight }
      if (size.width <= 0 || size.height <= 0) return
      const header = node.parentElement?.querySelector<HTMLElement>('[data-slot="app-header"]')
      // El zoom del encabezado modifica el área de visualización, no la referencia de diseño.
      const layoutSize = { width: size.width, height: header ? (node.parentElement?.clientHeight || size.height + header.offsetHeight) - header.offsetHeight : size.height }
      setViewport(previous => {
        const measuredExtent = measureWorkspaceExtent({ width: size.width / previous.state.scale, height: size.height / previous.state.scale }, modules.map(module => module.layout))
        return { size, layoutSize, measured: true, state: !previous.measured ? fit(size, measuredExtent) : resizeViewport(previous.state, previous.size, size, measuredExtent) }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [modules])
  // Window geometry belongs to mounted windows, never to document data.
  const open = modules
  const contentBounds = measureWorkspaceExtent(visibleBounds, open.map(module => module.layout))
  const sceneBounds = growth?.generation === documentGeneration
    ? { width: Math.max(contentBounds.width, growth.size.width), height: Math.max(contentBounds.height, growth.size.height) }
    : contentBounds
  const clampedViewport = clamp(viewport.state, viewport.size, sceneBounds)
  if (clampedViewport.offsetX !== viewport.state.offsetX || clampedViewport.offsetY !== viewport.state.offsetY) {
    setViewport({ ...viewport, state: clampedViewport })
  }
  const endGrowth = useCallback(() => setGrowth(null), [setGrowth])
  function grow(candidate: ModuleLayout) {
    setGrowth({ generation: documentGeneration, size: measureWorkspaceExtent(visibleBounds, [...open.map(module => module.layout), candidate]) })
  }
  function recolocate() {
    setInitialArrangementGeneration(null)
    setModules(repositionModules(open, visibleBounds))
    setGrowth(null)
    setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))
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
    // Muestra la ventana con el menor movimiento posible de la cámara, manteniendo su geometría y el zoom.
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
  function saveLayout(id: ModuleId, layout: ModuleLayout) {
    if (!modules.find(module => module.id === id)?.resetSizeOnMount) setInitialArrangementGeneration(null)
    setModules(previous => {
      const opening = previous.find(module => module.id === id)?.resetSizeOnMount
      if (!opening) return previous.map(module => module.id === id ? { ...module, layout, resetSizeOnMount: false } : module)
      const origin = { x: Math.max(0, Math.ceil(-viewport.state.offsetX / viewport.state.scale)), y: Math.max(0, Math.ceil(-viewport.state.offsetY / viewport.state.scale)) }
      const settled = previous.filter(module => module.id !== id && !module.resetSizeOnMount)
      const placed = findModulePlacement({ id, size: layout, origin }, settled.map(module => module.layout), visibleBounds).layout
      const occupied = [...settled.map(module => module.layout), placed]
      return previous.map(module => {
        if (module.id === id) return { ...module, layout: placed, resetSizeOnMount: false }
        if (!module.resetSizeOnMount) return module
        const pending = findModulePlacement({ id: module.id, size: module.layout, origin }, occupied, visibleBounds).layout
        occupied.push(pending)
        return { ...module, layout: pending }
      })
    })
    setGrowth(null)
  }

  function close(id: ModuleId) {
    setGrowth(null)
    if (locationHighlight?.id === id) setLocationHighlight(null)
    if (id === 'elements' || id === 'dotations') { setEditRequest(null); pendingEditModule.current = null }
    modulesTrigger.current?.focus()
    setModules(previous => previous.filter(module => module.id !== id))
    setLayers(previous => previous.filter(other => other !== id))
    if (active === id) setActive(null)
  }
  function requestCleanup(id: ModuleId | null) {
    if (cleanupInFlight.current) return
    setCleanupError(null)
    setCleanupRequest({ ids: id ? [id] : [...CLEANUP_MODULE_IDS], generation: documentGeneration })
  }
  function selectCleanupModules(ids: readonly ModuleId[]) {
    if (cleanupInFlight.current) return
    setCleanupError(null)
    setCleanupRequest(request => request?.generation === documentGeneration ? { ...request, ids: [...ids] } : request)
  }
  async function confirmCleanup() {
    const request = cleanupRequest, plan = cleanupPlan, snapshot = store.getSnapshot()
    if (cleanupInFlight.current || !request || !plan || !plan.ids.length || request.generation !== snapshot.documentGeneration || !snapshot.ready || !snapshot.active || snapshot.replacing) return
    const ids = plan.ids
    cleanupInFlight.current = true
    setCleanupBusy(true)
    setCleanupError(null)
    let otherModulesCleaned = false
    try {
      const timerSnapshot = timers.getSnapshot()
      if (plan.source !== snapshot.document || (plan.runtime.has('timers') && plan.timerCount !== timerSnapshot.timers.length)) throw new Error(CLEANUP_CHANGED_ERROR)
      if (plan.runtime.has('timers') && (!timerSnapshot.ready || timerSnapshot.storageUnavailable || timerSnapshot.storageConflict)) {
        throw new Error('Espera a que estén disponibles los temporizadores antes de limpiarlos.')
      }
      // Validate all document changes together before changing independent timers.
      if (!store.applyDocumentCommand(document => applyCleanupPlan(document, plan))) {
        setCleanupError(store.getSnapshot().fileMessage ?? 'No se pudieron limpiar los módulos.'); return
      }
      for (const id of ids) if (id === 'board' || id === 'plan') resetDrawingHistory(store, id)
      if (plan.runtime.has('board-image')) { boardImage.clear(); setSelectionReset(value => value + 1) }
      if (plan.runtime.has('coordinate-input')) rememberCoordinateInput('')
      if (plan.runtime.has('element-selection')) selectElement(null)
      // Los datos compartidos también pueden modificar otras ventanas; desactiva el redimensionamiento automático hasta la siguiente interacción con el contenido.
      setSizePreservation(previous => {
        const revisions: Partial<Record<ModuleId, number>> = previous.generation === documentGeneration ? { ...previous.revisions } : {}
        for (const id of new Set([...open.map(module => module.id), ...ids])) revisions[id] = (revisions[id] ?? 0) + 1
        return { generation: documentGeneration, revisions }
      })
      setModuleRevisions(previous => {
        const next = { ...previous }
        for (const id of ids) next[id] = (next[id] ?? 0) + 1
        return next
      })
      otherModulesCleaned = ids.some(id => id !== 'clock')
      if (plan.runtime.has('timers')) {
        const result = await timers.clearAll()
        const current = store.getSnapshot()
        if (request.generation !== current.documentGeneration || current.replacing) return
        if (result !== 'saved') {
          throw new Error(result === 'conflict'
            ? 'No se guardó la limpieza del reloj: los temporizadores cambiaron en otra pestaña. Recarga la lista guardada desde el aviso del reloj.'
            : 'No se guardó la limpieza del reloj. Reintenta el guardado desde el aviso del reloj antes de confirmar de nuevo.')
        }
      }
      setCleanupRequest(null); setCleanupError(null); setModulesError(null)
    } catch (error) {
      if (request.generation !== store.getSnapshot().documentGeneration) return
      const message = error instanceof Error ? error.message : 'No se pudieron limpiar los módulos.'
      setCleanupError(`${otherModulesCleaned ? 'La limpieza de los demás módulos ya se aplicó. ' : ''}${message}`)
    } finally {
      cleanupInFlight.current = false
      setCleanupBusy(false)
    }
  }
  function collapseAll() {
    setInitialArrangementGeneration(null)
    setModules(collectModuleBars(open, visibleBounds))
    setGrowth(null)
    setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))
  }
  function toggle(id: ModuleId) {
    if (open.some(module => module.id === id)) { activate(id); return }
    const origin = { x: Math.max(0, Math.ceil(-viewport.state.offsetX / viewport.state.scale)), y: Math.max(0, Math.ceil(-viewport.state.offsetY / viewport.state.scale)) }
    const layout = findModulePlacement({ id, origin }, open.map(module => module.layout), visibleBounds).layout
    setModules(previous => [...previous, { id, layout, resetSizeOnMount: true }])
    activate(id)
  }
  const canRestoreView = ready && !replacing && growth?.generation !== documentGeneration && modulesGeneration === documentGeneration
  const canCaptureView = canRestoreView && modules.every(module => !module.resetSizeOnMount)
  function captureDesktopView(): DesktopViewState | null {
    if (!canCaptureView || store.getSnapshot().replacing) return null
    return {
      modules: [...modules].sort((a, b) => layers.indexOf(a.id) - layers.indexOf(b.id)).map(({ id, layout }) => ({
        id, x: layout.x, y: layout.y, width: layout.width, height: layout.height,
      })),
      viewport: { ...viewport.state },
      active: active && modules.some(module => module.id === active) ? active : null,
    }
  }
  function restoreDesktopView(candidate: DesktopViewState) {
    if (!canRestoreView || store.getSnapshot().replacing) return false
    try {
      const desktop = validateDesktopViewState(candidate)
      const visible = { width: Math.ceil(viewport.size.width / desktop.viewport.scale), height: Math.ceil(viewport.size.height / desktop.viewport.scale) }
      const restored: OpenModule[] = desktop.modules.map(({ id, ...geometry }) => ({
        id, layout: { ...geometry, referenceSize: { ...visible } }, resetSizeOnMount: false, restoreRevision: viewRestoreSequence + 1,
      }))
      const extent = measureWorkspaceExtent(visible, restored.map(module => module.layout))
      setInitialArrangementGeneration(null); setGrowth(null); setLocationHighlight(null)
      setViewRestoreSequence(value => value + 1)
      setModules(restored); setLayers(restored.map(module => module.id)); setActive(desktop.active)
      setViewport(previous => ({ ...previous, measured: true, state: clamp(desktop.viewport, previous.size, extent) }))
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo recuperar la vista.', { notice: 'viewRestoreError' })
      return false
    }
  }
  return (
    <><div data-slot="app-shell" className={`${styles.shell} app-shell`}>
      <AppHeader scale={viewport.state.scale} documentGeneration={documentGeneration} fileMenu={{ store, desktopViews: { canCapture: canCaptureView, canRestore: canRestoreView, capture: captureDesktopView, restore: restoreDesktopView } }} reportNotices={reportNotices.generation === documentGeneration ? reportNotices.value : null} mapNotices={mapNotices.generation === documentGeneration ? mapNotices.value : {}}
        boardNotice={boardImage.resourceError && open.some(module => module.id === 'board') ? { message: boardImage.resourceError, busy: boardImage.busy, onChoose: () => boardImageInput.current?.click() } : null}
        clockNotice={timerProblem || audioProblem ? { storage: timerProblem, audio: audioProblem, onRetry: () => { void timers.retryPersistence() },
          onActivate: () => { void timers.activateSound() }, onRescue: () => timers.exportRecoveryRecord(), onReset: () => timers.resetCorruptStorage() } : null}
        modulesMenu={{ trigger: modulesTrigger, modules, disabled: !ready || !boardActive || replacing, onToggle: toggle }}
        viewMenu={{ disabled: !ready || !boardActive || replacing || !open.length, active: open.some(module => module.id === active),
          onCollapseAll: collapseAll, onAutoArrange: recolocate, onFitActive: fitActiveModule }}
        cleanupMenu={{ active: open.some(module => module.id === active) ? active : null, disabled: !ready || !boardActive || replacing,
          request: cleanupRequest?.generation === documentGeneration ? cleanupRequest : null, plan: cleanupPlan, onSelection: selectCleanupModules, error: cleanupRequest?.generation === documentGeneration ? cleanupError : null, busy: cleanupBusy,
          onRequest: requestCleanup, onCancel: () => { if (cleanupInFlight.current) return; setCleanupRequest(null); setCleanupError(null) }, onConfirm: confirmCleanup }}
        moduleShortcuts={{ modules: open, active, disabled: !ready || replacing, onSelect: selectOpenModule }}
        magnet={{ active: magnet ?? false, onToggle: () => setMagnet(value => !(value ?? false)) }}
        radar={{ active: radarActive, onToggle: toggleRadar, disabled: !ready || !boardActive || replacing }}
        onOrigin={() => setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))}
        onZoom={scale => setViewport(previous => ({ ...previous,
          state: zoomAt(previous.state, scale, { x: 0, y: 0 }, previous.size, sceneBounds) }))} />
      <main ref={workspace} data-slot="app-workspace" className={styles.workspace} aria-label="Espacio de trabajo" aria-busy={replacing}
        onPointerDownCapture={event => { blankPointer.current = { x: event.clientX, y: event.clientY, moved: false } }}
        onPointerMoveCapture={event => {
          const start = blankPointer.current
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) start.moved = true
        }} onPointerCancelCapture={() => { blankPointer.current = null }}
        onClick={event => {
          if (blankPointer.current?.moved || !(event.target instanceof Element) || event.target.closest('.module-header,.board-pin,.quick-note,.element-row,button,input,textarea,select,a,[role="button"],[role="radio"],[role="menuitemradio"],[role="checkbox"],[contenteditable="true"]')) return
          if (event.target.closest('[data-module="operations"],[data-module="information"]')) return
          if (event.target.closest('[data-module]')?.querySelector('.element-editor')) return
          selectElement(null); setSelectionReset(value => value + 1)
          if (!event.target.closest('[data-module]')) setActive(null)
        }}>

        <div data-slot="app-workspace-content" className={styles.content} inert={replacing}>
        <MobileViewport state={viewport.state} size={viewport.size} bounds={sceneBounds} headerHeight={36} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid onActions={registerModuleActions} revisions={moduleRevisions} locationHighlight={locationHighlight?.generation === documentGeneration ? locationHighlight : undefined} contentSizeRevisions={sizePreservation.generation === documentGeneration ? sizePreservation.revisions : undefined} viewOrigin={{ x: Math.max(0, -viewport.state.offsetX / viewport.state.scale), y: Math.max(0, -viewport.state.offsetY / viewport.state.scale) }} navigationKey={document.document.id} magnet={magnet ?? false}
            magnetOptions={{ distance: preferences.settings.magnetDistance, alignEdges: preferences.settings.magnetAlignEdges }} generation={documentGeneration} modules={open} bounds={sceneBounds} visible={visibleBounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout} onGrow={grow} onGrowEnd={endGrowth}
            onRetry={retryModule} renderModule={id => id === 'board' ? <BoardModule selectionReset={selectionReset} key={documentGeneration} store={store} imageSession={boardImage} imageInputRef={boardImageInput} selectedId={selectedId} onSelect={selectElement}
              onEditElement={elementId => {
                const element = document.elements.find(element => element.id === elementId)
                if (!element) return
                const id = element.isUnit ? 'dotations' : 'elements'
                selectElement(elementId); setEditRequest({ id: elementId, generation: documentGeneration })
                if (open.some(module => module.id === id)) { moduleActions.current[id]?.('expand'); activate(id) }
                else { pendingEditModule.current = id; toggle(id) }
              }} /> :
              id === 'elements' ? <ElementsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                editRequest={editRequest?.generation === documentGeneration && editRequest.id === selectedId ? editRequest : undefined} /> :
              id === 'dotations' ? <DotationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                editRequest={editRequest?.generation === documentGeneration && editRequest.id === selectedId ? editRequest : undefined} /> :
              id === 'information' ? <InformationModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'operations' ? <OperationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'timeline' ? <TimelineModule key={documentGeneration} store={store} /> :
              id === 'reports' ? <ReportsModule key={documentGeneration} store={store} getTimerRecords={getTimerRecords} onNoticesChange={updateReportNotices} /> :
              id === 'clock' ? <ClockModule store={timers} /> :
              id === 'calendar' ? <CalendarModule key={moduleRevisions.calendar ?? 0} store={calendar} /> :
              id === 'coordinates' ? <CoordinatesModule generation={documentGeneration} selectedCoordinate={selectedCoordinate} onInputChange={rememberCoordinateInput} radar={{ active: radarActive, onToggle: toggleRadar }} /> :
              id === 'plan' ? <PlanModule key={`${documentGeneration}.${moduleRevisions.plan ?? 0}`} navigationKey={document.document.id} store={store} onNoticesChange={updateMapNotices}
                selectedId={selectedId} onSelect={selectElement} onCoordinateSelect={selectCoordinate}

                onEditElement={elementId => {
                  const element = document.elements.find(element => element.id === elementId)
                  if (!element) return
                  const id = element.isUnit ? 'dotations' : 'elements'
                  selectElement(elementId); setEditRequest({ id: elementId, generation: documentGeneration })
                  if (open.some(module => module.id === id)) { moduleActions.current[id]?.('expand'); activate(id) }
                  else { pendingEditModule.current = id; toggle(id) }
                }} /> :
              id === 'map' ? <MapModule key={documentGeneration} navigationKey={document.document.id} store={store} onCoordinateSelect={selectCoordinate} onNoticesChange={updateMapNotices} /> :
              id === 'notebook' ? <NotebookModule key={documentGeneration} store={store} /> :
              id === 'calculator' ? <CalculatorModule generation={documentGeneration} radar={{ active: radarActive, onToggle: toggleRadar }} radarPoint={radarPoint} calendar={calendar} /> : null} />
        </MobileViewport>
        </div>
      </main>
    </div><Toaster scale={viewport.state.scale} /></>
  )
}
