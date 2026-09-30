import { useState } from 'react'
import type { ReactNode } from 'react'
import GridLayout from 'react-grid-layout'
import type { EventCallback, LayoutItem } from 'react-grid-layout'
import { transformStrategy, gridBounds, minMaxSize, noCompactor } from 'react-grid-layout/core'
import type { LayoutConstraint } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ModuleFrame } from './ModuleFrame'
import { MODULE_REGISTRY } from './moduleRegistry'
import { overlaps } from './findModulePlacement'
import { WORKSPACE } from './layoutTypes'
import type { ModuleId, ModuleLayout } from './layoutTypes'
import { useViewportInteraction } from './ViewportContext'

export interface OpenModule { id: ModuleId; layout: ModuleLayout; exceptional: boolean }
const unpack = (item: LayoutItem): ModuleLayout => ({ x: item.x, y: item.y, width: item.w, height: item.h })

export function DashboardGrid({ modules, scale, active, onActive, onClose, onLayout, renderModule }: {
  modules: readonly OpenModule[]; scale: number; active: ModuleId | null; onActive: (id: ModuleId) => void
  onClose: (id: ModuleId) => void; onLayout: (id: ModuleId, layout: ModuleLayout) => void
  renderModule?: (id: ModuleId) => ReactNode
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [reset, setReset] = useState(0)
  const layout = modules.map(({ id, layout }) => ({ i: id, x: layout.x, y: layout.y, w: layout.width, h: layout.height,
    minW: MODULE_REGISTRY[id].minimum[0], minH: MODULE_REGISTRY[id].minimum[1], maxW: WORKSPACE.width, maxH: WORKSPACE.height,
    isDraggable: !blocked, isResizable: !blocked }))
  const hasException = modules.some(item => item.exceptional)
  const collisions: LayoutConstraint = {
    name: 'normal-module-collisions',
    constrainPosition(item, x, y, context) {
      if (modules.find(module => module.id === item.i)?.exceptional) return { x, y }
      const proposed = { ...unpack(item), x, y }
      return context.layout.some(other => other.i !== item.i && overlaps(proposed, unpack(other))) ? { x: item.x, y: item.y } : { x, y }
    },
    constrainSize(item, w, h, handle, context) {
      const x = handle.includes('w') ? item.x + item.w - w : item.x
      const y = handle.includes('n') ? item.y + item.h - h : item.y
      const proposed = { x, y, width: w, height: h }
      const outside = x < 0 || y < 0 || x + w > WORKSPACE.width || y + h > WORKSPACE.height
      const collision = !modules.find(module => module.id === item.i)?.exceptional && context.layout.some(other => other.i !== item.i && overlaps(proposed, unpack(other)))
      return outside || collision ? { w: item.w, h: item.h } : { w, h }
    },
  }
  const commit: EventCallback = (layout, _old, item) => {
    if (blockedRef.current || !item) return
    const finalItem = layout.find(candidate => candidate.i === item.i)
    if (!finalItem) return
    const id = item.i as ModuleId, next = unpack(finalItem)
    const exceptional = modules.find(module => module.id === id)?.exceptional
    if (next.x < 0 || next.y < 0 || next.x + next.width > 1600 || next.y + next.height > 1000 ||
      (!exceptional && modules.some(module => module.id !== id && overlaps(next, module.layout)))) {
      setReset(value => value + 1)
      return
    }
    onLayout(id, next)
  }
  return (
    <GridLayout key={reset} width={1600} layout={layout} autoSize={false} style={{ height: 1000 }}
      gridConfig={{ cols: 1600, rowHeight: 1, maxRows: 1000, margin: [0, 0], containerPadding: [0, 0] }}
      compactor={{ ...noCompactor, allowOverlap: hasException, preventCollision: true }}
      constraints={[gridBounds, minMaxSize, collisions]}
      positionStrategy={{ ...transformStrategy, scale }}
      dragConfig={{ enabled: !blocked, bounded: true, handle: '.module-header', cancel: 'button,input,textarea,select' }}
      resizeConfig={{ enabled: !blocked, handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] }}
      onDragStop={commit} onResizeStop={commit}>
      {modules.map(({ id, layout, exceptional }) => (
        <div key={id} data-module={id} data-x={layout.x} data-y={layout.y} data-width={layout.width} data-height={layout.height}
          data-exceptional={exceptional} style={{ zIndex: exceptional ? 3 : active === id ? 2 : 1 }}
          onPointerDown={() => onActive(id)} onFocusCapture={() => onActive(id)}>
          <ModuleFrame id={id} active={active === id} onClose={() => onClose(id)}>{renderModule?.(id)}</ModuleFrame>
        </div>
      ))}
    </GridLayout>
  )
}
