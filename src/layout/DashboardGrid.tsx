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
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'
import { useViewportInteraction } from './ViewportContext'

export interface OpenModule { id: ModuleId; layout: ModuleLayout }
const unpack = (item: LayoutItem, bounds: Size): ModuleLayout => ({ x: item.x, y: item.y, width: item.w, height: item.h, referenceSize: { ...bounds } })

export function DashboardGrid({ modules, bounds, layers, scale, active, onActive, onClose, onLayout, renderModule }: {
  modules: readonly OpenModule[]; bounds: Size; layers: readonly ModuleId[]; scale: number; active: ModuleId | null; onActive: (id: ModuleId) => void
  onClose: (id: ModuleId) => void; onLayout: (id: ModuleId, layout: ModuleLayout) => void
  renderModule?: (id: ModuleId) => ReactNode
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [reset, setReset] = useState(0)
  const layout = modules.map(({ id, layout }) => ({ i: id, x: layout.x, y: layout.y, w: layout.width, h: layout.height,
    minW: MODULE_REGISTRY[id].minimum[0], minH: MODULE_REGISTRY[id].minimum[1], maxW: bounds.width, maxH: bounds.height,
    isDraggable: !blocked, isResizable: !blocked }))
  const sizeBounds: LayoutConstraint = {
    name: 'module-size-bounds',
    constrainSize(item, w, h, handle) {
      const x = handle.includes('w') ? item.x + item.w - w : item.x
      const y = handle.includes('n') ? item.y + item.h - h : item.y
      const outside = x < 0 || y < 0 || x + w > bounds.width || y + h > bounds.height
      return outside ? { w: item.w, h: item.h } : { w, h }
    },
  }
  const commit: EventCallback = (layout, _old, item) => {
    if (blockedRef.current || !item) return
    const finalItem = layout.find(candidate => candidate.i === item.i)
    if (!finalItem) return
    const id = item.i as ModuleId, next = unpack(finalItem, bounds)
    if (next.x < 0 || next.y < 0 || next.x + next.width > bounds.width || next.y + next.height > bounds.height) {
      setReset(value => value + 1)
      return
    }
    onLayout(id, next)
  }
  return (
    <GridLayout key={reset} width={bounds.width} layout={layout} autoSize={false} style={{ height: bounds.height }}
      gridConfig={{ cols: bounds.width, rowHeight: 1, maxRows: bounds.height, margin: [0, 0], containerPadding: [0, 0] }}
      compactor={{ ...noCompactor, allowOverlap: true, preventCollision: false }}
      constraints={[gridBounds, minMaxSize, sizeBounds]}
      positionStrategy={{ ...transformStrategy, scale }}
      dragConfig={{ enabled: !blocked, bounded: true, handle: '.module-header', cancel: 'button,input,textarea,select' }}
      resizeConfig={{ enabled: !blocked, handles: ['se'] }}
      onDragStop={commit} onResizeStop={commit}>
      {modules.map(({ id, layout }) => (
        <div key={id} data-module={id} data-x={layout.x} data-y={layout.y} data-width={layout.width} data-height={layout.height}
          style={{ zIndex: layers.indexOf(id) + 1 }}
          onPointerDown={() => onActive(id)} onFocusCapture={() => onActive(id)}>
          <ModuleFrame id={id} active={active === id} onClose={() => onClose(id)}>{renderModule?.(id)}</ModuleFrame>
        </div>
      ))}
    </GridLayout>
  )
}
