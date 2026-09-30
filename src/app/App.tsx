import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Alert } from '../components/ui/alert'
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
import { getTimerStore } from '../features/clock/timerStore'
import { useBoardImage } from '../features/board/useBoardImage'
import { DashboardGrid } from '../layout/DashboardGrid'
import type { OpenModule } from '../layout/DashboardGrid'
import { MobileViewport } from '../layout/MobileViewport'
import { findModulePlacement, overlaps } from '../layout/findModulePlacement'
import { WORKSPACE } from '../layout/layoutTypes'
import type { ModuleId, ModuleLayout } from '../layout/layoutTypes'
import { fit, resizeViewport } from '../layout/viewportMath'

function sameLayout(a: ModuleLayout | undefined, b: ModuleLayout) {
  return a?.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function App() {
  const store = getDocumentStore()
  const timers = getTimerStore()
  useEffect(() => { void timers.initialize(); return timers.connect() }, [timers])
  const { document, documentGeneration } = useDocumentStore(store)
  const boardImage = useBoardImage(store)
  useEffect(() => { void store.initialize() }, [store])
  const workspace = useRef<HTMLElement>(null)
  const [viewport, setViewport] = useState(() => ({ size: WORKSPACE, state: fit(WORKSPACE) }))
  const [modules, setModules] = useState<OpenModule[]>([])
  const [active, setActive] = useState<ModuleId | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ generation: number; id: string | null }>({ generation: documentGeneration, id: null })
  const selectedId = selection.generation === documentGeneration && document.elements.some(element => element.id === selection.id) ? selection.id : null
  const selectElement = (id: string | null) => setSelection({ generation: documentGeneration, id })
  useLayoutEffect(() => {
    const node = workspace.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let measured = false
    const observer = new ResizeObserver(() => {
      const size = { width: node.clientWidth, height: node.clientHeight }
      if (size.width <= 0 || size.height <= 0) return
      const firstMeasurement = !measured
      measured = true
      setViewport(previous => ({ size, state: firstMeasurement ? fit(size) : resizeViewport(previous.state, previous.size, size) }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  // Module visibility and viewport belong to the running app. Document changes
  // only replace the persistent geometry; neither state is exported.
  const open = useMemo(() => modules.reduce<OpenModule[]>((placed, module) => {
    const saved = document.moduleLayouts[module.id] ?? module.layout
    const keepException = module.exceptional && sameLayout(saved, module.layout)
    const placement = keepException ? { layout: saved, exceptional: true } :
      findModulePlacement({ id: module.id, saved }, placed.map(other => other.layout), WORKSPACE)
    return [...placed, { id: module.id, layout: placement.layout, exceptional: placement.exceptional }]
  }, []), [modules, document.moduleLayouts])
  useEffect(() => {
    if (!open.some(module => !sameLayout(document.moduleLayouts[module.id], module.layout))) return
    // Imported geometries may share occupied positions. Apply the same opening
    // rules and persist the actual placement atomically, retaining the viewport.
    store.mutateDocument(document => {
      for (const module of open) document.moduleLayouts[module.id] = module.layout
    })
  }, [open, document.moduleLayouts, store])
  function saveLayout(id: ModuleId, layout: ModuleLayout) {
    store.mutateDocument(document => { document.moduleLayouts[id] = layout })
    setModules(previous => previous.map(module => module.id === id ? {
      ...module, layout, exceptional: Boolean(open.find(other => other.id === id)?.exceptional) && open.some(other => other.id !== id && overlaps(layout, other.layout)),
    } : module))
  }
  function close(id: ModuleId) {
    setModules(previous => previous.filter(module => module.id !== id))
    if (active === id) setActive(null)
  }
  function toggle(id: ModuleId) {
    if (open.some(module => module.id === id)) { close(id); return }
    const placement = findModulePlacement({ id, saved: document.moduleLayouts[id] }, open.map(module => module.layout), WORKSPACE)
    store.mutateDocument(document => { document.moduleLayouts[id] = placement.layout })
    setModules(previous => [...previous, { id, layout: placement.layout, exceptional: placement.exceptional }])
    setActive(id)
    if (placement.notice) {
      setNotice(placement.notice)
    }
  }
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timeout)
  }, [notice])
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Angie Dashboard</h1>
        <FileMenu store={store} />
        <ViewMenu visible={modules.map(module => module.id)} onToggle={toggle} />
        <Input aria-label="Título del documento" placeholder="Título del documento"
          value={document.document.title} onChange={event => store.setTitle(event.target.value)} />
        <Button onClick={() => setViewport(previous => ({ ...previous, state: fit(previous.size) }))}>Encajar</Button>
        <output className="technical-data zoom-percentage" aria-label="Zoom actual">{Math.round(viewport.state.scale * 100)} %</output>
      </header>
      {notice && <div className="layout-notice"><Alert>{notice}</Alert></div>}
      <main ref={workspace} className="dashboard-workspace" aria-label="Espacio de trabajo">
        <DocumentNotices store={store} />
        <MobileViewport state={viewport.state} size={viewport.size} onChange={state => setViewport(previous => ({ ...previous, state }))}>
          <DashboardGrid modules={open} scale={viewport.state.scale} active={active} onActive={setActive} onClose={close} onLayout={saveLayout}
            renderModule={id => id === 'board' ? <BoardModule key={documentGeneration} store={store} imageSession={boardImage} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'elements' ? <ElementsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'information' ? <InformationModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'operations' ? <OperationsModule key={documentGeneration} store={store} selectedId={selectedId} onSelect={selectElement} /> :
              id === 'timeline' ? <TimelineModule key={documentGeneration} store={store} /> :
              id === 'clock' ? <ClockModule store={timers} /> : null} />
        </MobileViewport>
      </main>
    </div>
  )
}
