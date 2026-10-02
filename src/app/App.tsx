import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
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
import { fit, resizeViewport } from '../layout/viewportMath'
import type { Position } from '../domain/document/types'

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
    return { size, state: fit(size), measured: false }
  })
  const [modules, setModules] = useState<OpenModule[]>([])
  const [active, setActive] = useState<ModuleId | null>(null)
  const [layers, setLayers] = useState<ModuleId[]>([])
  const bounds = useMemo(() => getWorkspaceBounds(viewport.size, modules.map(module => module.id)), [viewport.size, modules])
  const [selection, setSelection] = useState<{ generation: number; id: string | null }>({ generation: documentGeneration, id: null })
  const selectedId = selection.generation === documentGeneration && document.elements.some(element => element.id === selection.id) ? selection.id : null
  const selectElement = (id: string | null) => setSelection({ generation: documentGeneration, id })
  useLayoutEffect(() => {
    const node = workspace.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const size = { width: node.clientWidth, height: node.clientHeight }
      if (size.width <= 0 || size.height <= 0) return
      const nextBounds = getWorkspaceBounds(size, modules.map(module => module.id))
      setViewport(previous => ({ size, measured: true, state: !previous.measured ? fit(size, nextBounds) : resizeViewport(previous.state, previous.size, size, nextBounds) }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [modules])
  // Module visibility and viewport belong to the running app. Document changes
  // only replace the persistent geometry; neither state is exported.
  const open = useMemo(() => modules.map(module => {
    const saved = document.moduleLayouts[module.id] ?? module.layout
    const [width, height] = MODULE_REGISTRY[module.id].minimum
    return { id: module.id, layout: adaptModuleLayout(saved, bounds, { width, height }) }
  }), [modules, document.moduleLayouts, bounds])
  function activate(id: ModuleId) {
    setActive(id)
    setLayers(previous => previous.at(-1) === id ? previous : [...previous.filter(other => other !== id), id])
  }
  function saveLayout(id: ModuleId, layout: ModuleLayout) {
    store.mutateDocument(document => { document.moduleLayouts[id] = layout })
    setModules(previous => previous.map(module => module.id === id ? { ...module, layout } : module))
  }
  function close(id: ModuleId) {
    if (id === 'board') setBoardCenter(null)
    viewTrigger.current?.focus()
    setModules(previous => previous.filter(module => module.id !== id))
    setLayers(previous => previous.filter(other => other !== id))
    if (active === id) setActive(null)
  }
  function toggle(id: ModuleId) {
    if (open.some(module => module.id === id)) { close(id); return }
    const nextBounds = getWorkspaceBounds(viewport.size, [...modules.map(module => module.id), id])
    const placement = findModulePlacement({ id, saved: document.moduleLayouts[id] }, open.map(module => module.layout), nextBounds)
    if (!document.moduleLayouts[id]) store.mutateDocument(document => { document.moduleLayouts[id] = placement.layout })
    setModules(previous => [...previous, { id, layout: document.moduleLayouts[id] ?? placement.layout }])
    activate(id)
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Angie Dashboard</h1>
        <FileMenu store={store} />
        <ViewMenu visible={modules.map(module => module.id)} onToggle={toggle} triggerRef={viewTrigger} />
        <Input aria-label="Título del documento" placeholder="Título del documento"
          value={document.document.title} onChange={event => store.setTitle(event.target.value)} />
        <Button onClick={() => setViewport(previous => ({ ...previous, state: fit(previous.size, bounds) }))}>Encajar</Button>
        <output className="technical-data zoom-percentage" aria-label="Zoom actual">{Math.round(viewport.state.scale * 100)} %</output>
      </header>
      <main ref={workspace} className="dashboard-workspace" aria-label="Espacio de trabajo">
        <DocumentNotices store={store} />
        <MobileViewport state={viewport.state} size={viewport.size} bounds={bounds} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid modules={open} bounds={bounds} layers={layers} scale={viewport.state.scale} active={active} onActive={activate} onClose={close} onLayout={saveLayout}
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
