import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties } from 'react'
import * as Primitive from '@radix-ui/react-alert-dialog'
import type { LucideIcon } from 'lucide-react'
import GridLayout from 'react-grid-layout'
import type { EventCallback } from 'react-grid-layout'
import { minMaxSize, noCompactor } from 'react-grid-layout/core'
import type { LayoutConstraint } from 'react-grid-layout/core'
import { ModuleFrame } from '../../layout/ModuleFrame'
import { HandleBottomRight } from '../../layout/WindowResize'
import { ViewportContext } from '../../layout/ViewportContext'
import { useViewportGestures } from '../../layout/useViewportGestures'
import type { Size } from '../../layout/layoutTypes'
import './fileDialog.css'

function visibleArea() {
  const viewport = window.visualViewport
  return { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight,
    left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 }
}

interface Box extends Size { x: number; y: number }
function constrain(box: Box, bounds: Size): Box {
  const width = Math.min(bounds.width, Math.max(27, box.width)), height = Math.min(bounds.height, Math.max(27, box.height))
  return { width, height, x: Math.max(0, Math.min(box.x, bounds.width - width)), y: Math.max(0, Math.min(box.y, bounds.height - height)) }
}

export function FileDialogContent({ title, icon, onClose, dismissOnOutside = false, width = 460, height = 180, children, onOpenAutoFocus, ...props }:
  Omit<ComponentProps<typeof Primitive.Content>, 'title'> & { title: string; icon?: LucideIcon; onClose: () => void; dismissOnOutside?: boolean; width?: number; height?: number }) {
  const [area, setArea] = useState(visibleArea)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => setArea(visibleArea())
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])
  return <Primitive.Portal>
    <Primitive.Overlay className="file-dialog-overlay" />
    <Primitive.Content {...props} ref={content} className="file-dialog-surface" aria-describedby={undefined}
      style={{ left: area.left, top: area.top, width: area.width, height: area.height }}
      onEscapeKeyDown={event => { event.preventDefault(); onClose() }}
      onOpenAutoFocus={event => {
        onOpenAutoFocus?.(event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          content.current?.focus()
        }
      }}>
      <Primitive.Title className="visually-hidden">{title}</Primitive.Title>
      <FileDialogFrame title={title} icon={icon} onClose={onClose} dismissOnOutside={dismissOnOutside} bounds={area} initial={{ width, height }}>{children}</FileDialogFrame>
    </Primitive.Content>
  </Primitive.Portal>
}

function FileDialogFrame({ title, icon, onClose, dismissOnOutside, bounds, initial, children }: { title: string; icon?: LucideIcon; onClose: () => void; dismissOnOutside: boolean; bounds: Size; initial: Size; children: ComponentProps<typeof ModuleFrame>['children'] }) {
  const [box, setBox] = useState(() => constrain({ ...initial, x: (bounds.width - initial.width) / 2, y: (bounds.height - initial.height) / 2 }, bounds))
  const shown = constrain(box, bounds)
  const [active, setActive] = useState(false)
  const element = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const iconTap = useRef<{ pointerId: number; icon: HTMLButtonElement } | null>(null)
  const state = { scale: 1, offsetX: 0, offsetY: 0 }
  const { blocked, blockedRef, moduleNavigationRef, handlers } = useViewportGestures(state, bounds, bounds, () => {}, element)
  const compact: LayoutConstraint = { name: 'file-window-size', constrainSize: (_item, w, h) => ({ w, h: h <= 50 ? 27 : h }) }
  const fit = (size: Size) => { if (!blockedRef.current) setBox(current => constrain({ ...current, ...size }, bounds)) }
  const move: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!item || !node || blockedRef.current) return
    node.style.setProperty('--module-drag-x', item.x + 'px'); node.style.setProperty('--module-drag-y', item.y + 'px')
  }
  const resize: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!item || !node || blockedRef.current) return
    node.style.setProperty('--module-resize-width', item.w + 'px'); node.style.setProperty('--module-resize-height', item.h + 'px')
  }
  const commit: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    node?.style.removeProperty('--module-drag-x'); node?.style.removeProperty('--module-drag-y')
    node?.style.removeProperty('--module-resize-width'); node?.style.removeProperty('--module-resize-height')
    if (item && !blockedRef.current) setBox(constrain({ x: item.x, y: item.y, width: item.w, height: item.h }, bounds))
  }
  return <div ref={element} className="file-dialog-workspace logical-workspace" {...handlers}
    onClick={event => { if (dismissOnOutside && !blockedRef.current && event.target instanceof Element && element.current?.contains(event.target) && !event.target.closest('[data-module]')) onClose() }}>
    <ViewportContext value={{ blocked, blockedRef, moduleNavigationRef }}>
      <GridLayout width={bounds.width} style={{ height: bounds.height }} autoSize={false}
        layout={[{ i: 'file', x: shown.x, y: shown.y, w: shown.width, h: shown.height, minW: 27, minH: 27, maxW: bounds.width - shown.x, maxH: bounds.height - shown.y }]}
        gridConfig={{ cols: bounds.width, rowHeight: 1, maxRows: bounds.height, margin: [0, 0], containerPadding: [0, 0] }}
        compactor={noCompactor} constraints={[compact, minMaxSize]}
        dragConfig={{ enabled: !blocked, bounded: true, handle: '.module-header', cancel: 'button:not(.module-icon),input,textarea,select' }}
        resizeConfig={{ enabled: !blocked && shown.height > 29, handles: ['se'], handleComponent: (axis, ref) => <span ref={ref} className={'react-resizable-handle react-resizable-handle-' + axis} title="Redimensionar ventana"><HandleBottomRight aria-hidden="true" /></span> }}
        onDragStart={(...args) => { dragged.current = true; move(...args) }} onDrag={move} onDragStop={commit}
        onResizeStart={resize} onResize={resize} onResizeStop={commit}>
        <div key="file" data-module="file" style={{ '--module-x': shown.x + 'px', '--module-y': shown.y + 'px' } as CSSProperties}
          onKeyDownCapture={() => setActive(true)}
          onPointerDownCapture={event => {
            if (!blockedRef.current) setActive(true)
            dragged.current = false
            const icon = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.module-header .module-icon') : null
            iconTap.current = !blockedRef.current && icon && event.pointerType === 'touch' ? { pointerId: event.pointerId, icon } : null
          }}
          onPointerUpCapture={event => {
            const tap = iconTap.current
            if (!tap || tap.pointerId !== event.pointerId) return
            iconTap.current = null
            // RGL consumes the touch click, as in DashboardGrid.
            if (!blockedRef.current && !dragged.current) tap.icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
          }} onPointerCancelCapture={() => { iconTap.current = null }}
          onClickCapture={event => { if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() } }}>
          <ModuleFrame title={title} icon={icon} active={active} width={shown.width} height={shown.height} onClose={onClose} onFit={fit}>
            <div className="file-dialog-body">{children}</div>
          </ModuleFrame>
        </div>
      </GridLayout>
    </ViewportContext>
  </div>
}
