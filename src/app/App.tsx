import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Puzzle } from 'lucide-react'
import { ZoomControl } from '../layout/ZoomControl'
import { Input } from '../components/ui/input'
import { FileMenu, DocumentNotices } from '../features/document/FileMenu'
import { getDocumentStore, useDocumentStore } from '../features/document/documentStore'
import { ViewMenu } from '../features/view/ViewMenu'
import { BoardModule } from '../features/board/BoardModule'
import { ElementsModule } from '../features/elements/ElementsModule'
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
import { MODULE_REGISTRY } from '../layout/moduleRegistry'
import type { ModuleId, ModuleLayout } from '../layout/layoutTypes'
import { fit, resizeViewport, zoomAt } from '../layout/viewportMath'
import type { Position } from '../domain/document/types'

type PresentedModule = OpenModule & { presentation?: { size: { width: number; height: number }; generation: number; source: string } }

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
  const [active, setActive] = useState<ModuleId | null>(null)
  const [layers, setLayers] = useState<ModuleId[]>([])
  const bounds = useMemo(() => getWorkspaceBounds(viewport.layoutSize, modules.map(module => module.id)), [viewport.layoutSize, modules])
  const visibleBounds = { width: Math.max(bounds.width, Math.ceil(viewport.size.width / viewport.state.scale)), height: Math.max(bounds.height, Math.ceil(viewport.size.height / viewport.state.scale)) }
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
        const extent = modules.reduce((extent, module) => {
          const layout = presentedLayout(module, document.moduleLayouts[module.id] ?? module.layout, nextBounds, documentGeneration)
          return { width: Math.max(extent.width, layout.x + layout.width), height: Math.max(extent.height, layout.y + layout.height) }
        },
          { width: Math.max(nextBounds.width, Math.ceil(size.width / previous.state.scale)), height: Math.max(nextBounds.height, Math.ceil(size.height / previous.state.scale)) })
        return { size, layoutSize, measured: true, state: !previous.measured ? fit(size, extent) : resizeViewport(previous.state, previous.size, size, extent) }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [modules, document.moduleLayouts, documentGeneration])
  // Module visibility and viewport belong to the running app. Document changes
  // only replace the persistent geometry; neither state is exported.
  const open = useMemo(() => modules.map(module => ({ id: module.id,
    layout: presentedLayout(module, document.moduleLayouts[module.id] ?? module.layout, bounds, documentGeneration),
  })), [modules, document.moduleLayouts, bounds, documentGeneration])
  const sceneBounds = open.reduce((extent, module) => ({ width: Math.max(extent.width, module.layout.x + module.layout.width), height: Math.max(extent.height, module.layout.y + module.layout.height) }), visibleBounds)
  function activate(id: ModuleId) {
    setActive(id)
    setLayers(previous => previous.at(-1) === id ? previous : [...previous.filter(other => other !== id), id])
  }
  function saveLayout(id: ModuleId, layout: ModuleLayout) {
    store.mutateDocument(document => { document.moduleLayouts[id] = layout })
    setModules(previous => previous.map(module => module.id === id ? { ...module, layout, presentation: { size: bounds, generation: documentGeneration, source: JSON.stringify(layout) } } : module))
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
    if (!document.moduleLayouts[id]) store.mutateDocument(document => { document.moduleLayouts[id] = placement.layout })
    const source = JSON.stringify(document.moduleLayouts[id] ?? placement.layout)
    const cached = closedModules.current[id]
    const layout = cached?.presentation?.generation === documentGeneration && cached.presentation.source === source && cached.presentation.size.width === bounds.width && cached.presentation.size.height === bounds.height ? cached.layout : placement.layout
    setModules(previous => [...previous, { id, layout, presentation: { size: bounds, generation: documentGeneration, source } }])
    activate(id)
  }
  return (
    <div className="app-shell">
      <header className="app-header" style={{ zoom: viewport.state.scale }}>
        <h1><img className="app-logo" src="/assets/elements/icon_chincheta.png" alt="Angie Dashboard" /></h1>
        <FileMenu store={store} />
        <ViewMenu visible={modules.map(module => module.id)} onToggle={toggle} triggerRef={viewTrigger} />
        <Input aria-label="Título del documento" placeholder="Título"
          value={document.document.title} onChange={event => store.setTitle(event.target.value)} />
        <Button className="fit-button" aria-label="Encajar" title="Encajar" onClick={() => setViewport(previous => ({ ...previous, state: fit(previous.size, bounds) }))}><Puzzle size={19} aria-hidden="true" /></Button>
        <ZoomControl label="Zoom actual" scale={viewport.state.scale} onChange={scale => setViewport(previous => ({ ...previous,
          state: zoomAt(previous.state, scale, { x: 0, y: 0 }, previous.size, sceneBounds) }))} />
      </header>
      <main ref={workspace} className="dashboard-workspace" aria-label="Espacio de trabajo">
        <DocumentNotices store={store} />
        <MobileViewport state={viewport.state} size={viewport.size} bounds={sceneBounds} headerHeight={34} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid modules={open} bounds={sceneBounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout}
            renderModule={id => id === 'board' ? <BoardModule key={documentGeneration} store={store} imageSession={boardImage} selectedId={selectedId} onSelect={selectElement}
              onViewChange={updateBoardCenter} /> :
              id === 'elements' ? <ElementsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement}
                placementPosition={boardCenter?.generation === documentGeneration ? boardCenter.center : undefined} /> :
              id === 'information' ? <InformationModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'operations' ? <OperationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'timeline' ? <TimelineModule key={documentGeneration} store={store} /> :
              id === 'clock' ? <ClockModule store={timers} /> :
              id === 'coordinates' ? <CoordinatesModule /> :
              id === 'notebook' ? <NotebookModule key={documentGeneration} store={store} /> :
              id === 'calculator' ? <CalculatorModule /> : null} />
        </MobileViewport>
      </main>
    </div>
  )
}
