import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import GridLayout from 'react-grid-layout'
import type { EventCallback, LayoutItem } from 'react-grid-layout'
import { transformStrategy, minMaxSize, noCompactor } from 'react-grid-layout/core'
import type { LayoutConstraint, Layout } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ModuleFrame } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'
import { useViewportInteraction } from './ViewportContext'

export interface OpenModule { id: ModuleId; layout: ModuleLayout }
const unpack = (item: LayoutItem, bounds: Size): ModuleLayout => ({ x: item.x, y: item.y, width: item.w, height: item.h, referenceSize: { ...bounds } })

export function DashboardGrid({ modules, bounds, visible = bounds, layers, scale, active, onActive, onClose, onLayout, onGrow, renderModule, generation = 0 }: {
  modules: readonly OpenModule[]; bounds: Size; visible?: Size; layers: readonly ModuleId[]; scale: number; active: ModuleId | null; onActive: (id: ModuleId) => void
  onClose: (id: ModuleId) => void; onLayout: (id: ModuleId, layout: ModuleLayout, kind?: 'move' | 'resize') => void
  onGrow?: (candidate: ModuleLayout) => void; renderModule?: (id: ModuleId) => ReactNode; generation?: number
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const activeLayout = useRef<Layout>([])
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
  const origin: LayoutConstraint = { name: 'workspace-origin', constrainPosition: (_item, x, y) => ({ x: Math.max(0, x), y: Math.max(0, y) }) }
  function commit(kind: 'move' | 'resize'): EventCallback {
    return (layout, _old, item) => {
      if (blockedRef.current || !item) return
      const finalItem = layout.find(candidate => candidate.i === item.i)
      if (finalItem) onLayout(item.i as ModuleId, unpack(finalItem, bounds), kind)
    }
  }
  return (
    <div onPointerDownCapture={event => {
      if (blockedRef.current) return
      const target = event.target as Element, container = target.closest<HTMLElement>('[data-module]')
      if (!container || target.closest('button,input,textarea,select')) return
      const resize = Boolean(target.closest('.react-resizable-handle'))
      if (!resize && !target.closest('.module-header')) return
      const module = modules.find(module => module.id === container.dataset.module)
      if (module) gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, layout: module.layout, resize }
    }}>
    <GridLayout width={bounds.width} layout={layout} autoSize={false} style={{ height: bounds.height }}
      gridConfig={{ cols: bounds.width, rowHeight: 1, maxRows: bounds.height, margin: [0, 0], containerPadding: [0, 0] }}
      compactor={keepLayout}
      constraints={[origin, minMaxSize]}
      positionStrategy={{ ...transformStrategy, scale }}
      dragConfig={{ enabled: !blocked, bounded: false, handle: '.module-header', cancel: 'button,input,textarea,select' }}
      resizeConfig={{ enabled: !blocked, handles: ['se'] }}
      onDragStop={commit('move')} onResizeStop={commit('resize')}>
      {modules.map(({ id, layout }) => (
        <div key={id} data-module={id} data-x={layout.x} data-y={layout.y} data-width={layout.width} data-height={layout.height}
          style={{ zIndex: layers.indexOf(id) + 1 }}
          onPointerDown={() => onActive(id)} onFocusCapture={() => onActive(id)}>
          <ModuleFrame id={id} generation={generation} active={active === id} onClose={() => onClose(id)}>{renderModule?.(id)}</ModuleFrame>
        </div>
      ))}
    </GridLayout>
    </div>
  )
}
