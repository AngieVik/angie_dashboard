import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Alert } from '../components/ui/alert'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu'
import type { ModuleAction, ModuleActions } from '../layout/ModuleFrame'
import { LocateFixed, Magnet, Puzzle } from 'lucide-react'
import { ZoomControl } from '../layout/ZoomControl'
import { growWorkspaceExtent, reconstructWorkspaceExtent } from '../layout/workspaceExtent'
import { repositionModules } from '../layout/repositionModules'
import { HelpTooltip, TooltipProvider } from '../components/ui/tooltip'
import { FileMenu, DocumentNotices } from '../features/document/FileMenu'
import { getDocumentStore, useDocumentStore } from '../features/document/documentStore'
import { ViewMenu } from '../features/view/ViewMenu'
import { BoardModule } from '../features/board/BoardModule'
import { ElementsModule } from '../features/elements/ElementsModule'
import { DotationsModule } from '../features/elements/DotationsModule'
import { InformationModule } from '../features/information/InformationModule'
import { OperationsModule } from '../features/operations/OperationsModule'
import { TimelineModule } from '../features/timeline/TimelineModule'
import { ClockModule } from '../features/clock/ClockModule'
import { CoordinatesModule } from '../features/coordinates/CoordinatesModule'
import { CalculatorModule } from '../features/calculator/CalculatorModule'
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
  const boardImage = useBoardImage(store)
  useEffect(() => { void store.initialize() }, [store])
  const workspace = useRef<HTMLElement>(null)
  const viewTrigger = useRef<HTMLButtonElement>(null)
  const [boardCenter, setBoardCenter] = useState<{ generation: number; center: Position } | null>(null)
  const updateBoardCenter = useCallback((center: Position) => {
    setBoardCenter(previous => previous?.generation === documentGeneration && previous.center.x === center.x && previous.center.y === center.y ? previous : { generation: documentGeneration, center })
  }, [documentGeneration])
  const [viewport, setViewport] = useState(() => {
    const size = { width: window.innerWidth, height: window.innerHeight }
    return { size, layoutSize: size, state: fit(size), measured: false }
  })
  const [navigationDocument, setNavigationDocument] = useState<string | null>(null)
  useLayoutEffect(() => {
    const state = readNavigation(document.document.id + '.dashboard')
    setViewport(previous => ({ ...previous, state, measured: true }))
    setNavigationDocument(document.document.id)
  }, [document.document.id])
  useEffect(() => {
    if (navigationDocument === document.document.id) writeNavigation(document.document.id + '.dashboard', viewport.state)
  }, [navigationDocument, document.document.id, viewport.state])
  const [modules, setModules] = useState<PresentedModule[]>([])
  const [modulesGeneration, setModulesGeneration] = useState(-1)
  useLayoutEffect(() => {
    if (!ready || modulesGeneration === documentGeneration) return
    const available = getWorkspaceBounds(viewport.layoutSize, savedOpenModules)
    const restored: PresentedModule[] = []
    for (const id of savedOpenModules) restored.push({ id, layout: findModulePlacement({ id, saved: document.moduleLayouts[id] }, restored.map(module => module.layout), available).layout })
    setModules(restored)
    setModulesGeneration(documentGeneration)
  }, [ready, modulesGeneration, documentGeneration, savedOpenModules, document.moduleLayouts, viewport.layoutSize])
  useEffect(() => {
    if (ready && modulesGeneration === documentGeneration) store.setOpenModules(modules.map(module => module.id))
  }, [ready, modulesGeneration, documentGeneration, modules, store])
  const closedModules = useRef<Partial<Record<ModuleId, PresentedModule>>>({})
  const [magnet, setMagnet] = useState(false)
  const [moduleRevisions, setModuleRevisions] = useState<Partial<Record<ModuleId, number>>>({})
  const [selectionReset, setSelectionReset] = useState(0)
  const [editRequest, setEditRequest] = useState<{ id: string; generation: number } | null>(null)
  const blankPointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [active, setActive] = useState<ModuleId | null>(null)
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
  function saveLayout(id: ModuleId, layout: ModuleLayout, kind: 'move' | 'resize' = 'resize') {
    const manual = kind === 'move' ? document.moduleLayouts[id] ?? { width: MODULE_REGISTRY[id].initial[0], height: MODULE_REGISTRY[id].initial[1] } : layout
    const saved = { ...layout, width: manual.width, height: manual.height, referenceSize: {
      width: Math.ceil(Math.max(bounds.width, layout.x + manual.width + 12, layout.x + layout.width + 12)), height: Math.ceil(Math.max(bounds.height, layout.y + manual.height + 12, layout.y + layout.height + 12)),
    } }
    store.mutateDocument(document => { document.moduleLayouts[id] = saved })
    setModules(previous => previous.map(module => module.id === id ? { ...module, layout, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(saved) } } : module))
  }
  function close(id: ModuleId) {
    if (id === 'elements' || id === 'dotations') { setEditRequest(null); pendingEditModule.current = null }
    const shown = open.find(module => module.id === id)
    if (shown) closedModules.current[id] = { ...shown, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(document.moduleLayouts[id] ?? shown.layout) } }
    if (id === 'board') setBoardCenter(null)
    viewTrigger.current?.focus()
    setModules(previous => previous.filter(module => module.id !== id))
    setLayers(previous => previous.filter(other => other !== id))
    if (active === id) setActive(null)
  }
  function resetModule(id: ModuleId) {
    if (id === 'clock') {
      const snapshot = timers.getSnapshot()
      if (!snapshot.ready || snapshot.storageUnavailable) throw new Error('Espera a que estén disponibles los temporizadores antes de limpiarlos.')
      for (const timer of snapshot.timers) timers.close(timer.id)
    } else if (id !== 'coordinates' && id !== 'calculator') {
      store.mutateDocument(candidate => {
        if (id === 'board') candidate.board = createEmptyDocument().board
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
      })
      if (id === 'board') { boardImage.clear(); setBoardCenter(null); setSelectionReset(value => value + 1) }
      if (id === 'elements' || id === 'dotations' || id === 'information' || id === 'operations') selectElement(null)
    }
    setModuleRevisions(previous => ({ ...previous, [id]: (previous[id] ?? 0) + 1 }))
  }
  function openAll(mode: 'expanded' | 'collapsed' | 'columns' | 'columns-collapsed') {
    try {
      setModulesError(null)
      const ids = Object.keys(MODULE_REGISTRY) as ModuleId[]
      const collapsed = mode === 'collapsed' || mode === 'columns-collapsed'
      const inColumns = mode === 'columns' || mode === 'columns-collapsed'
      // Use the frame's restore action so mounted content keeps its saved size.
      if (!collapsed) for (const module of open) {
        if (module.layout.height <= 29) moduleActions.current[module.id]?.('expand')
      }
      const savedLayouts = store.getSnapshot().document.moduleLayouts
      const placed: OpenModule[] = []
      const origin = { x: Math.max(0, Math.ceil(-viewport.state.offsetX / viewport.state.scale)), y: Math.max(0, Math.ceil(-viewport.state.offsetY / viewport.state.scale)) }
      const standardWidth = 240, collapsedHeight = 29
      const columns = Math.max(1, Math.floor(visibleBounds.width / standardWidth))
      let columnX = origin.x, columnY = origin.y, columnWidth = 0
      for (const [index, id] of ids.entries()) {
        const current = open.find(module => module.id === id)
        const cached = closedModules.current[id]
        const cachedLayout = cached?.presentation?.generation === documentGeneration && cached.presentation.source === JSON.stringify(savedLayouts[id] ?? cached.layout)
          && cached.presentation.size.width === bounds.width && cached.presentation.size.height === bounds.height ? cached.layout : savedLayouts[id]
        const saved = !collapsed && current && current.layout.height <= 29 ? savedLayouts[id] : current?.layout ?? cachedLayout
        let layout = findModulePlacement({ id, saved }, placed.map(module => module.layout), visibleBounds).layout
        const key = document.document.id + '.' + id
        const navigation = readNavigation(key)
        if (!collapsed) {
          if (layout.height <= collapsedHeight) {
            const size = navigation.restoreSize ?? { width: MODULE_REGISTRY[id].initial[0], height: MODULE_REGISTRY[id].initial[1] }
            layout = { ...layout, ...size }
          }
        } else {
          const restoreSize = layout.height > collapsedHeight ? { width: layout.width, height: layout.height } : navigation.restoreSize
          writeNavigation(key, { ...navigation, restoreSize })
          layout = { ...layout, width: standardWidth, height: collapsedHeight,
            x: origin.x + index % columns * standardWidth,
            y: origin.y + Math.floor(index / columns) * collapsedHeight }
        }
        if (inColumns) {
          if (columnY > origin.y && columnY + layout.height > origin.y + visibleBounds.height) {
            columnX += columnWidth; columnY = origin.y; columnWidth = 0
          }
          layout = { ...layout, x: columnX, y: columnY }
          columnY += layout.height; columnWidth = Math.max(columnWidth, layout.width)
        }
        layout = { ...layout, referenceSize: { width: Math.max(bounds.width, layout.x + layout.width), height: Math.max(bounds.height, layout.y + layout.height) } }
        placed.push({ id, layout })
      }
      store.mutateDocument(candidate => { for (const module of placed) candidate.moduleLayouts[module.id] = module.layout })
      setModules(placed.map(module => ({ ...module, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(module.layout) } })))
      setLayers(ids); setActive(ids.at(-1) ?? null)
    } catch (error) { setModulesError(error instanceof Error ? error.message : 'No se pudieron abrir los módulos.') }
  }
  function runAll(action: 'expand' | 'fit' | 'reset-zoom' | 'close') {
    try {
      for (const module of open) moduleActions.current[module.id]?.(action)
      setModulesError(null)
    } catch (error) { setModulesError(error instanceof Error ? error.message : 'No se pudo aplicar la acción a todos los módulos.') }
  }
  function resetAll(closeAll: boolean) {
    try {
      // Check timer availability before clearing the other modules.
      resetModule('clock')
      for (const id of Object.keys(MODULE_REGISTRY) as ModuleId[]) if (id !== 'clock') resetModule(id)
      if (closeAll) {
        for (const module of open) close(module.id)
        setActive(null)
      }
      setModulesError(null)
    } catch (error) { setModulesError(error instanceof Error ? error.message : 'No se pudieron limpiar los módulos.') }
  }
  function toggle(id: ModuleId) {
    if (open.some(module => module.id === id)) { close(id); return }
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
          <DropdownMenuTrigger asChild><Button>Módulos</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => openAll('expanded')}>Abrir todos</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAll('collapsed')}>Abrir [colapsados]</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAll('columns')}>Abrir en columnas</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAll('columns-collapsed')}>Abrir en columnas [colapsados]</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runAll('expand')}>Expandir</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runAll('fit')}>Ajustar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runAll('reset-zoom')}>Restablecer</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => resetAll(true)}>Limpiar y cerrar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => resetAll(false)}>Reiniciar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runAll('close')}>Cerrar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ViewMenu visible={modules.map(module => module.id)} onToggle={toggle} triggerRef={viewTrigger} />
        <HelpTooltip text="Volver al origen"><Button className="origin-button" aria-label="Volver al origen" onClick={() => setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))}><LocateFixed size={19} aria-hidden="true" /></Button></HelpTooltip>
        <nav className="open-modules" aria-label="Módulos abiertos">
          {open.map(({ id, layout }) => {
            const Icon = MODULE_ICONS[id], name = MODULE_REGISTRY[id].name
            const run = (action: ModuleAction) => moduleActions.current[id]?.(action)
            return <DropdownMenu key={id} modal={false}>
              <HelpTooltip text={name}><DropdownMenuTrigger asChild><Button className="document-button module-button" aria-label={'Opciones de ' + name} aria-pressed={active === id} data-module-menu={id}
                onPointerDown={event => {
                  if (event.button === 0 && !event.ctrlKey && event.currentTarget.dataset.state === 'open') activate(id)
                }}
                onKeyDown={event => {
                  if ((event.key === 'Enter' || event.key === ' ') && event.currentTarget.dataset.state === 'open') activate(id)
                }}><Icon aria-hidden="true" /></Button></DropdownMenuTrigger></HelpTooltip>
              <DropdownMenuContent align="start" className="file-menu-content module-menu-content"
                onInteractOutside={event => {
                  const target = event.target
                  if (target instanceof Element && target.closest('[data-module-menu]')?.getAttribute('data-module-menu') === id) event.preventDefault()
                }}>
                <DropdownMenuItem onSelect={() => run('front')}>Traer al frente</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('collapse')}>Colapsar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('contract')}>Contraer</DropdownMenuItem>
                <DropdownMenuItem disabled={layout.height > 29} onSelect={() => run('expand')}>Expandir</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('fit')}>Ajustar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('reset-zoom')}>Restablecer</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('clear-close')}>Limpiar y cerrar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('reset')}>Reiniciar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('close')}>Cerrar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          })}
        </nav>
        <HelpTooltip text="Imán de módulos"><Button className="module-button magnet-button" aria-label="Imán de módulos" aria-pressed={magnet} onClick={() => setMagnet(value => !value)}><Magnet aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Recolocar módulos"><Button className="module-button fit-button" aria-label="Encajar" onClick={recolocate}><Puzzle size={19} aria-hidden="true" /></Button></HelpTooltip>
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
          if (event.target.closest('[data-module]')?.querySelector('.element-editor')) return
          selectElement(null); setSelectionReset(value => value + 1)
          if (!event.target.closest('[data-module]')) setActive(null)
        }}>
        <DocumentNotices store={store} />
        {modulesError && <div className="document-notices"><Alert>{modulesError}</Alert></div>}
        <div className="document-workspace-content" inert={replacing}>
        <MobileViewport state={viewport.state} size={viewport.size} bounds={sceneBounds} headerHeight={36} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid onActions={registerModuleActions} revisions={moduleRevisions} onReset={resetModule} viewOrigin={{ x: Math.max(0, -viewport.state.offsetX / viewport.state.scale), y: Math.max(0, -viewport.state.offsetY / viewport.state.scale) }} navigationKey={document.document.id} magnet={magnet} generation={documentGeneration} modules={open} bounds={sceneBounds} visible={visibleBounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout} onGrow={grow}
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
              id === 'coordinates' ? <CoordinatesModule generation={documentGeneration} /> :
              id === 'notebook' ? <NotebookModule key={documentGeneration} store={store} /> :
              id === 'calculator' ? <CalculatorModule generation={documentGeneration} /> : null} />
        </MobileViewport>
        </div>
      </main>
    </div></TooltipProvider>
  )
}
