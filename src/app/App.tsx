import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { LocateFixed, Magnet, Puzzle } from 'lucide-react'
import { ZoomControl } from '../layout/ZoomControl'
import { growWorkspaceExtent, reconstructWorkspaceExtent } from '../layout/workspaceExtent'
import { repositionModules } from '../layout/repositionModules'
import { HelpTooltip, TooltipProvider } from '../components/ui/tooltip'
import { Input } from '../components/ui/input'
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
import { clamp, fit, resizeViewport, zoomAt } from '../layout/viewportMath'
import type { Position } from '../domain/document/types'

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
  const { document, documentGeneration } = useDocumentStore(store)
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
  const [modules, setModules] = useState<PresentedModule[]>([])
  const closedModules = useRef<Partial<Record<ModuleId, PresentedModule>>>({})
  const [magnet, setMagnet] = useState(false)
  const [selectionReset, setSelectionReset] = useState(0)
  const blankPointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [active, setActive] = useState<ModuleId | null>(null)
  const [layers, setLayers] = useState<ModuleId[]>([])
  const bounds = useMemo(() => getWorkspaceBounds(viewport.layoutSize, modules.map(module => module.id)), [viewport.layoutSize, modules])
  const visibleBounds = { width: Math.max(1, Math.ceil(viewport.size.width / viewport.state.scale)), height: Math.max(1, Math.ceil(viewport.size.height / viewport.state.scale)) }
  const [extent, setExtent] = useState(() => ({ generation: documentGeneration, size: reconstructWorkspaceExtent(visibleBounds, document.moduleLayouts) }))
  const [selection, setSelection] = useState<{ generation: number; id: string | null }>({ generation: documentGeneration, id: null })
  const selectedId = selection.generation === documentGeneration && document.elements.some(element => element.id === selection.id) ? selection.id : null
  const selectElement = (id: string | null) => setSelection({ generation: documentGeneration, id })
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
          { width: Math.max(nextBounds.width, extent.generation === documentGeneration ? extent.size.width : 0, Math.ceil(size.width / previous.state.scale)), height: Math.max(nextBounds.height, extent.generation === documentGeneration ? extent.size.height : 0, Math.ceil(size.height / previous.state.scale)) })
        return { size, layoutSize, measured: true, state: !previous.measured ? fit(size, measuredExtent) : resizeViewport(previous.state, previous.size, size, measuredExtent) }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [modules, document.moduleLayouts, documentGeneration, extent])
  // Module visibility and viewport belong to the running app. Document changes
  // only replace the persistent geometry; neither state is exported.
  const open = useMemo(() => modules.map(module => ({ id: module.id,
    layout: presentedLayout(module, layoutSource(module, document.moduleLayouts[module.id], bounds, documentGeneration), bounds, documentGeneration),
  })), [modules, document.moduleLayouts, bounds, documentGeneration])
  const previousExtent = extent.generation === documentGeneration ? extent.size : reconstructWorkspaceExtent(visibleBounds, document.moduleLayouts)
  const sceneBounds = growWorkspaceExtent(previousExtent, visibleBounds, open.map(module => module.layout))
  if (extent.generation !== documentGeneration || extent.size.width !== sceneBounds.width || extent.size.height !== sceneBounds.height) {
    setExtent({ generation: documentGeneration, size: sceneBounds })
  }
  function grow(candidate: ModuleLayout) {
    setExtent(previous => ({ generation: documentGeneration, size: growWorkspaceExtent(previous.size, visibleBounds, [candidate]) }))
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
    setExtent({ generation: documentGeneration, size: growWorkspaceExtent(reconstructWorkspaceExtent(visibleBounds, store.getSnapshot().document.moduleLayouts), visibleBounds, placed.map(item => item.layout)) })
    setViewport(previous => ({ ...previous, state: { scale, offsetX: 0, offsetY: 0 } }))
  }
  function activate(id: ModuleId) {
    setActive(id)
    setLayers(previous => previous.at(-1) === id ? previous : [...previous.filter(other => other !== id), id])
  }
  function focusModule(id: ModuleId) {
    activate(id)
    const layout = open.find(module => module.id === id)?.layout
    if (!layout) return
    setViewport(previous => {
      const { state, size } = previous
      const axis = (offset: number, start: number, length: number, visible: number) => start * state.scale + offset < 0 || (start + length) * state.scale + offset > visible ? -start * state.scale : offset
      return { ...previous, state: clamp({ ...state, offsetX: axis(state.offsetX, layout.x, layout.width, size.width), offsetY: axis(state.offsetY, layout.y, layout.height, size.height) }, size, sceneBounds) }
    })
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
    const shown = open.find(module => module.id === id)
    if (shown) closedModules.current[id] = { ...shown, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(document.moduleLayouts[id] ?? shown.layout) } }
    if (id === 'board') setBoardCenter(null)
    viewTrigger.current?.focus()
    setModules(previous => previous.filter(module => module.id !== id))
    setLayers(previous => previous.filter(other => other !== id))
    if (active === id) setActive(null)
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
    <TooltipProvider delayDuration={500}><div className="app-shell">
      <header className="app-header" style={{ zoom: viewport.state.scale }}>
        <h1><img className="app-logo" src="/assets/elements/icon_chincheta.png" alt="Angie Dashboard" /></h1>
        <FileMenu store={store} />
        <ViewMenu visible={modules.map(module => module.id)} onToggle={toggle} triggerRef={viewTrigger} />
        <Input aria-label="Título del documento" placeholder="Título"
          value={document.document.title} onChange={event => store.setTitle(event.target.value)} />
        <HelpTooltip text="Volver al origen"><Button className="origin-button" aria-label="Volver al origen" onClick={() => setViewport(previous => ({ ...previous, state: { ...previous.state, offsetX: 0, offsetY: 0 } }))}><LocateFixed size={19} aria-hidden="true" /></Button></HelpTooltip>
        <nav className="open-modules" aria-label="Módulos abiertos">
          {open.map(({ id }) => {
            const Icon = MODULE_ICONS[id], name = MODULE_REGISTRY[id].name
            return <HelpTooltip key={id} text={name}><Button aria-label={'Seleccionar módulo ' + name} aria-pressed={active === id} onClick={() => focusModule(id)}><Icon aria-hidden="true" /></Button></HelpTooltip>
          })}
        </nav>
        <HelpTooltip text="Imán de módulos"><Button className="magnet-button" aria-label="Imán de módulos" aria-pressed={magnet} onClick={() => setMagnet(value => !value)}><Magnet aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Recolocar módulos"><Button className="fit-button" aria-label="Encajar" onClick={recolocate}><Puzzle size={19} aria-hidden="true" /></Button></HelpTooltip>
        <ZoomControl key={documentGeneration} label="Zoom actual" scale={viewport.state.scale} onChange={scale => setViewport(previous => ({ ...previous,
          state: zoomAt(previous.state, scale, { x: 0, y: 0 }, previous.size, sceneBounds) }))} />
      </header>
      <main ref={workspace} className="dashboard-workspace" aria-label="Espacio de trabajo"
        onPointerDownCapture={event => { blankPointer.current = { x: event.clientX, y: event.clientY, moved: false } }}
        onPointerMoveCapture={event => {
          const start = blankPointer.current
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) start.moved = true
        }} onPointerCancelCapture={() => { blankPointer.current = null }}
        onClick={event => {
          if (blankPointer.current?.moved || !(event.target instanceof Element) || event.target.closest('.board-pin,.quick-note,.element-row,button,input,textarea,select,a,[role="button"],[role="radio"],[contenteditable="true"]')) return
          selectElement(null); setSelectionReset(value => value + 1)
          if (!event.target.closest('[data-module]')) setActive(null)
        }}>
        <DocumentNotices store={store} />
        <MobileViewport state={viewport.state} size={viewport.size} bounds={sceneBounds} headerHeight={36} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid magnet={magnet} generation={documentGeneration} modules={open} bounds={sceneBounds} visible={visibleBounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout} onGrow={grow}
            renderModule={id => id === 'board' ? <BoardModule selectionReset={selectionReset} key={documentGeneration} store={store} imageSession={boardImage} selectedId={selectedId} onSelect={selectElement}
              onViewChange={updateBoardCenter} onOpenModule={id => { if (open.some(module => module.id === id)) activate(id); else toggle(id) }} /> :
              id === 'elements' ? <ElementsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                placementPosition={boardCenter?.generation === documentGeneration ? boardCenter.center : undefined} /> :
              id === 'dotations' ? <DotationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                placementPosition={boardCenter?.generation === documentGeneration ? boardCenter.center : undefined} /> :
              id === 'information' ? <InformationModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'operations' ? <OperationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'timeline' ? <TimelineModule key={documentGeneration} store={store} /> :
              id === 'clock' ? <ClockModule store={timers} /> :
              id === 'coordinates' ? <CoordinatesModule generation={documentGeneration} /> :
              id === 'notebook' ? <NotebookModule key={documentGeneration} store={store} /> :
              id === 'calculator' ? <CalculatorModule generation={documentGeneration} /> : null} />
        </MobileViewport>
      </main>
    </div></TooltipProvider>
  )
}
