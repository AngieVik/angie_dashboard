import { Fragment, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { SquareDimensions } from 'lucide-react'
import GridLayout from 'react-grid-layout'
import type { EventCallback, LayoutItem } from 'react-grid-layout'
import { transformStrategy, minMaxSize, noCompactor } from 'react-grid-layout/core'
import type { LayoutConstraint, Layout } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { snapModulePosition, snapModuleSize } from './snapModulePosition'
import { ModuleFrame } from './ModuleFrame'
import type { ModuleActions } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'
import { readNavigation, writeNavigation } from './navigationStorage'
import { useViewportInteraction } from './ViewportContext'

export interface OpenModule { id: ModuleId; layout: ModuleLayout }
const unpack = (item: LayoutItem, bounds: Size): ModuleLayout => ({ x: item.x, y: item.y, width: item.w, height: item.h, referenceSize: { ...bounds } })

export function DashboardGrid({ modules, bounds, visible = bounds, layers, scale, active, onActive, onClose, onLayout, onGrow, renderModule, generation = 0, magnet = false, navigationKey, viewOrigin = { x: 0, y: 0 }, revisions = {}, contentSizeRevisions = {}, locationHighlight, onReset, onActions }: {
  modules: readonly OpenModule[]; bounds: Size; visible?: Size; layers: readonly ModuleId[]; scale: number; active: ModuleId | null; onActive: (id: ModuleId) => void
  onClose: (id: ModuleId) => void; onLayout: (id: ModuleId, layout: ModuleLayout, kind?: 'move' | 'resize') => void
  onActions?: (id: ModuleId, actions: ModuleActions | null) => void
  locationHighlight?: { id: ModuleId; sequence: number }
  viewOrigin?: { x: number; y: number }; revisions?: Partial<Record<ModuleId, number>>; contentSizeRevisions?: Partial<Record<ModuleId, number>>; onReset?: (id: ModuleId) => void
  onGrow?: (candidate: ModuleLayout) => void; renderModule?: (id: ModuleId) => ReactNode; generation?: number; magnet?: boolean; navigationKey?: string
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const activeLayout = useRef<Layout>([])
  const grid = useRef<HTMLDivElement>(null)
  const draggedModule = useRef<ModuleId | null>(null)
  const iconTap = useRef<{ pointerId: number; icon: HTMLButtonElement } | null>(null)
  useEffect(() => { if (blocked) iconTap.current = null }, [blocked])
  const keepLayout = { ...noCompactor, allowOverlap: true, preventCollision: false, compact: (items: Layout, cols: number) => {
    const result = noCompactor.compact(items, cols)
    activeLayout.current = result
    return result
  } }
  const gesture = useRef<{ pointerId: number; x: number; y: number; layout: ModuleLayout; resize: boolean } | null>(null)
  // Capture raw pointer movement before react-resizable applies its finite
  // maxConstraints. Growing cols and width together keeps one column = one pixel.
  useEffect(() => {
    function prepare(event: PointerEvent) {
      const start = gesture.current
      if (!start || start.pointerId !== event.pointerId || blockedRef.current || !onGrow) return
      const dx = (event.clientX - start.x) / scale, dy = (event.clientY - start.y) / scale
      const next = start.resize ? { ...start.layout, width: Math.max(1, Math.round(start.layout.width + dx)), height: Math.max(1, Math.round(start.layout.height + dy)) }
        : { ...start.layout, x: Math.max(0, Math.round(start.layout.x + dx)), y: Math.max(0, Math.round(start.layout.y + dy)) }
      if (next.x + next.width + 12 > bounds.width || next.y + next.height + 12 > bounds.height) {
        const reserve = { ...next, width: next.width + (next.x + next.width + 12 > bounds.width ? visible.width : 0),
          height: next.height + (next.y + next.height + 12 > bounds.height ? visible.height : 0) }
        // RGL defers prop-layout synchronization while a gesture is active.
        // Its compactor exposes the current items, including finite resize limits.
        for (const item of activeLayout.current) {
          item.maxW = Math.max(bounds.width, reserve.x + reserve.width + 12)
          item.maxH = Math.max(bounds.height, reserve.y + reserve.height + 12)
        }
        flushSync(() => onGrow(reserve))
      }
    }
    function end() { gesture.current = null }
    document.addEventListener('pointermove', prepare, true)
    document.addEventListener('pointerup', end, true)
    document.addEventListener('pointercancel', end, true)
    return () => {
      document.removeEventListener('pointermove', prepare, true)
      document.removeEventListener('pointerup', end, true)
      document.removeEventListener('pointercancel', end, true)
    }
  }, [bounds, visible, scale, onGrow, blockedRef])
  const layout = modules.map(({ id, layout }) => ({ i: id, x: layout.x, y: layout.y, w: layout.width, h: layout.height,
    minW: MODULE_REGISTRY[id].minimum[0], minH: MODULE_REGISTRY[id].minimum[1], maxW: bounds.width, maxH: bounds.height,
    isDraggable: !blocked, isResizable: !blocked }))
  const origin: LayoutConstraint = { name: 'workspace-origin', constrainPosition: (_item, x, y) => ({ x: Math.max(viewOrigin.x, x), y: Math.max(viewOrigin.y, y) }) }
  const magneticEdges: LayoutConstraint = { name: 'magnetic-edges', constrainPosition: (item, x, y) => {
    if (!magnet || blockedRef.current) return { x, y }
    const next = snapModulePosition({ ...unpack(item, bounds), x, y }, modules.filter(module => module.id !== item.i).map(module => module.layout), scale)
    return { x: next.x, y: next.y }
  }, constrainSize: (item, w, h) => {
    if (blockedRef.current) return { w, h }
    const module = modules.find(module => module.id === item.i)
    const iconOnly = module && module.layout.height <= 29 && module.layout.width <= 29
    const collapsed = module && module.layout.height <= 29 && !iconOnly
    const threshold = 8 / scale
    const next = magnet ? snapModuleSize({ ...unpack(item, bounds), width: w, height: h }, modules.filter(module => module.id !== item.i).map(module => module.layout), scale)
      : { width: w, height: h }
    // Use the requested size so nearby module edges cannot pull a compact bar off its detents.
    return { w: collapsed && Math.abs(w - 200) <= threshold ? 200 : next.width,
      h: module && !iconOnly && h <= 50 ? 27 : next.height }
  } }
  const coordinatesHeight: LayoutConstraint = { name: 'coordinates-content-height', constrainSize: (item, w, h) => {
    if (item.i !== 'coordinates' || blockedRef.current) return { w, h }
    const module = modules.find(module => module.id === 'coordinates')
    if (!module || module.layout.height <= 29) return { w, h }
    const frame = grid.current?.querySelector<HTMLElement>('[data-module="coordinates"] .module-frame')
    const content = frame?.querySelector<HTMLElement>('.module-scaled-content')
    if (!frame || !content) return { w, h }
    const measuring = content.getAttribute('data-measuring'), width = content.style.width
    content.setAttribute('data-measuring', 'true'); content.style.width = Math.max(0, w - 2) + 'px'
    try {
      const chrome = (frame.querySelector<HTMLElement>('.module-header')?.offsetHeight ?? 27)
        + (frame.querySelector<HTMLElement>('.module-controls')?.offsetHeight ?? 20) + 2
      return { w, h: Math.max(h, Math.ceil(content.scrollHeight + chrome)) }
    } finally {
      if (measuring === null) content.removeAttribute('data-measuring')
      else content.setAttribute('data-measuring', measuring)
      content.style.width = width
    }
  } }
  function park(id: ModuleId, size: Size) {
    if (blockedRef.current) return
    const module = modules.find(module => module.id === id)
    if (!module) return
    const left = Math.ceil(viewOrigin.x), top = Math.ceil(viewOrigin.y)
    const parked = modules.filter(other => other.id !== id && other.layout.height <= 29).map(other => other.layout)
    let x = left, y = top
    while (true) {
      const occupied = parked.filter(other => y < other.y + other.height && y + size.height > other.y && x < other.x + other.width && x + size.width > other.x)
      if (!occupied.length) break
      x = Math.ceil(Math.max(...occupied.map(other => other.x + other.width)))
      if (x + size.width > left + visible.width) { x = left; y += size.height }
    }
    const next = { ...module.layout, ...size, x, y }
    onGrow?.(next); onLayout(id, next, 'resize'); onActive(id)
  }
  const showDrag: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!node || !item || blockedRef.current) return
    node.style.setProperty('--module-drag-x', Math.max(viewOrigin.x, item.x) + 'px')
    node.style.setProperty('--module-drag-y', Math.max(viewOrigin.y, item.y) + 'px')
  }
  const showResize: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!node || !item || blockedRef.current) return
    const container = node.closest<HTMLElement>('[data-module]')
    if (!container) return
    // RGL renders the raw pointer size during resize; draw the constrained size instead.
    container.style.setProperty('--module-resize-width', item.w + 'px')
    container.style.setProperty('--module-resize-height', item.h + 'px')
  }
  function commit(kind: 'move' | 'resize'): EventCallback {
    return (layout, _old, item, _placeholder, _event, node) => {
      node?.style.removeProperty('--module-drag-x'); node?.style.removeProperty('--module-drag-y')
      const container = node?.closest<HTMLElement>('[data-module]')
      container?.style.removeProperty('--module-resize-width'); container?.style.removeProperty('--module-resize-height')
      if (blockedRef.current || !item) return
      const finalItem = layout.find(candidate => candidate.i === item.i)
      if (finalItem) onLayout(item.i as ModuleId, unpack(finalItem, bounds), kind)
    }
  }
  return (
    <div ref={grid} onPointerDownCapture={event => {
      if (blockedRef.current) return
      draggedModule.current = null
      iconTap.current = null
      const target = event.target as Element, container = target.closest<HTMLElement>('[data-module]')
      if (!container || target.closest('button:not(.module-icon),input,textarea,select')) return
      const icon = target.closest<HTMLButtonElement>('.module-header .module-icon')
      if (icon && event.pointerType === 'touch') iconTap.current = { pointerId: event.pointerId, icon }
      const resize = Boolean(target.closest('.react-resizable-handle'))
      if (!resize && !target.closest('.module-header')) return
      const module = modules.find(module => module.id === container.dataset.module)
      if (resize && module && navigationKey && (module.layout.width > 27 && module.layout.height > 29)) {
        const key = navigationKey + '.' + module.id
        writeNavigation(key, { ...readNavigation(key), restoreSize: { width: module.layout.width, height: module.layout.height } })
      }
      if (module) gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, layout: module.layout, resize }
    }} onPointerUpCapture={event => {
      const tap = iconTap.current
      if (!tap || tap.pointerId !== event.pointerId) return
      iconTap.current = null
      if (blockedRef.current || draggedModule.current) return
      // react-draggable prevents the native touch click, even below its drag threshold.
      // Keep a pointer click so the viewport can still cancel a multi-finger sequence.
      tap.icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    }} onPointerCancelCapture={() => { iconTap.current = null }}>
    <GridLayout width={bounds.width} layout={layout} autoSize={false} style={{ height: bounds.height }}
      gridConfig={{ cols: bounds.width, rowHeight: 1, maxRows: bounds.height, margin: [0, 0], containerPadding: [0, 0] }}
      compactor={keepLayout}
      constraints={[magneticEdges, coordinatesHeight, origin, minMaxSize]}
      positionStrategy={{ ...transformStrategy, scale }}
      dragConfig={{ enabled: !blocked, bounded: false, handle: '.module-header', cancel: 'button:not(.module-icon),input,textarea,select' }}
      resizeConfig={{ enabled: !blocked, handles: ['se'], handleComponent: (axis, ref) => <span ref={ref} className={'react-resizable-handle react-resizable-handle-' + axis} title="Redimensionar módulo"><SquareDimensions aria-hidden="true" /></span> }}
      onDragStart={(...args) => {
        if (!blockedRef.current && args[2]) {
          draggedModule.current = args[2].i as ModuleId
          onActive(draggedModule.current)
        }
        showDrag(...args)
      }} onDrag={showDrag} onDragStop={commit('move')} onResizeStart={showResize} onResize={showResize} onResizeStop={commit('resize')}>
      {modules.map(({ id, layout }) => (
        // RGL enters its pending drag state on press, before onDragStart runs.
        // Keep the current position available until constrained drag coordinates exist.
        <div key={id} data-module={id} data-x={layout.x} data-y={layout.y} data-width={layout.width} data-height={layout.height}
          style={{ zIndex: layers.indexOf(id) + 1, '--module-x': layout.x + 'px', '--module-y': layout.y + 'px' } as CSSProperties}
          onPointerDown={() => {
            if (blockedRef.current) return
            onActive(id)
          }} onFocusCapture={() => { if (!blockedRef.current) onActive(id) }}
          onClickCapture={event => {
            // A completed icon drag must not also contract or restore the window.
            if (draggedModule.current === id && event.detail !== 0) { event.preventDefault(); event.stopPropagation() }
          }}>
          <ModuleFrame onActions={onActions} key={navigationKey} id={id} width={layout.width} navigationKey={navigationKey ? navigationKey + '.' + id : undefined} height={layout.height} generation={generation} contentSizeRevision={contentSizeRevisions[id]} locateToken={locationHighlight?.id === id ? locationHighlight.sequence : 0} active={active === id} onFront={() => onActive(id)} onPark={size => park(id, size)} onReset={onReset ? () => onReset(id) : undefined} onClose={() => onClose(id)} onFit={size => {
            if (!blockedRef.current) { const next = { ...layout, ...size }; onGrow?.(next); onLayout(id, next, 'resize') }
          }}><Fragment key={revisions[id] ?? 0}>{renderModule?.(id)}</Fragment></ModuleFrame>
        </div>
      ))}
    </GridLayout>
    </div>
  )
}
