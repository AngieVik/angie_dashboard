import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties } from 'react'
import * as Primitive from '@radix-ui/react-alert-dialog'
import { AlertDialogOverlay, AlertDialogTitle } from '@/components/ui/alert-dialog'
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
import { constrainWindowContentSize } from '../../layout/windowContentSize'
import { OverlayPortalContext } from '../../layout/OverlayPortalContext'
import styles from './fileDialog.module.css'
import viewportStyles from '@/layout/mobileViewport.module.css'

interface Area extends Size { left: number; top: number }

function visibleArea() {
  const viewport = window.visualViewport
  const area = { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight,
    left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 }
  const workspace = document.querySelector<HTMLElement>('[data-slot="app-workspace"]')?.getBoundingClientRect()
  if (!workspace) return { viewport: area, workspace: area }
  const left = Math.max(area.left, workspace.left), top = Math.max(area.top, workspace.top)
  return { viewport: area, workspace: { left, top,
    width: Math.max(1, Math.min(area.left + area.width, workspace.right) - left),
    height: Math.max(1, Math.min(area.top + area.height, workspace.bottom) - top) } }
}

interface Box extends Size { x: number; y: number }
function constrain(box: Box, bounds: Size): Box {
  const width = Math.min(bounds.width, Math.max(27, box.width)), height = Math.min(bounds.height, Math.max(27, box.height))
  return { width, height, x: Math.max(0, Math.min(box.x, bounds.width - width)), y: Math.max(0, Math.min(box.y, bounds.height - height)) }
}

export function FileDialogContent({ title, icon, onClose, width = 460, height = 180, children, onOpenAutoFocus, className = '', ...props }:
  Omit<ComponentProps<typeof Primitive.Content>, 'title'> & { title: string; icon?: LucideIcon; onClose: () => void; width?: number; height?: number }) {
  const [area, setArea] = useState(visibleArea)
  const content = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const attachContent = useCallback((node: HTMLDivElement | null) => { content.current = node; setPortalContainer(node) }, [])
  const outsidePointer = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const update = () => setArea(visibleArea())
    update()
    const workspace = document.querySelector<HTMLElement>('[data-slot="app-workspace"]')
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (workspace) observer?.observe(workspace)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])
  return <Primitive.Portal>
    <AlertDialogOverlay appearance="transparent" />
    <Primitive.Content {...props} ref={attachContent} data-slot="file-dialog-content" className={`${styles.surface} ${className}`.trim()} aria-describedby={undefined}
      style={area.viewport}
      onPointerDownCapture={event => {
        props.onPointerDownCapture?.(event)
        const target = event.target, workspace = content.current?.querySelector('[data-slot="file-dialog-workspace"]')
        const background = target instanceof Element && (target === content.current || (workspace?.contains(target) && !target.closest('[data-module]')))
        outsidePointer.current = !event.defaultPrevented && event.isPrimary && event.button === 0 && background ? { x: event.clientX, y: event.clientY } : null
      }} onPointerMoveCapture={event => {
        props.onPointerMoveCapture?.(event)
        const start = outsidePointer.current
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) outsidePointer.current = null
      }} onPointerCancelCapture={event => { props.onPointerCancelCapture?.(event); outsidePointer.current = null }}
      onClick={event => {
        props.onClick?.(event)
        const outside = outsidePointer.current !== null
        outsidePointer.current = null
        if (outside && !event.defaultPrevented) onClose()
      }}
      onEscapeKeyDown={event => { event.preventDefault(); onClose() }}
      onOpenAutoFocus={event => {
        onOpenAutoFocus?.(event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          content.current?.focus()
        }
      }}>
      <AlertDialogTitle className="visually-hidden">{title}</AlertDialogTitle>
      <OverlayPortalContext value={portalContainer}>
        <FileDialogFrame title={title} icon={icon} onClose={onClose} bounds={area.workspace} initial={{ width, height }}>{children}</FileDialogFrame>
      </OverlayPortalContext>
    </Primitive.Content>
  </Primitive.Portal>
}

function FileDialogFrame({ title, icon, onClose, bounds, initial, children }: { title: string; icon?: LucideIcon; onClose: () => void; bounds: Area; initial: Size; children: ComponentProps<typeof ModuleFrame>['children'] }) {
  const [box, setBox] = useState(() => constrain({ ...initial, x: (bounds.width - initial.width) / 2, y: (bounds.height - initial.height) / 2 }, bounds))
  const shown = constrain(box, bounds)
  const [active, setActive] = useState(false)
  const element = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const iconTap = useRef<{ pointerId: number; icon: HTMLButtonElement } | null>(null)
  const state = { scale: 1, offsetX: 0, offsetY: 0 }
  const { blocked, blockedRef, moduleNavigationRef, handlers } = useViewportGestures(state, bounds, bounds, () => {}, element)
  const contentMinimum: LayoutConstraint = { name: 'window-content-minimum', constrainSize: (_item, w, h) => {
    if (blockedRef.current || shown.height <= 29) return { w, h }
    const size = constrainWindowContentSize(element.current?.querySelector<HTMLElement>('.module-frame'), { width: w, height: h })
    return { w: size.width, h: size.height }
  } }
  const fit = (size: Size) => { if (!blockedRef.current) setBox(current => constrain({ ...current, ...size }, bounds)) }
  const move: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!item || !node || blockedRef.current) return
    node.style.setProperty('--module-drag-x', Math.max(0, item.x) + 'px'); node.style.setProperty('--module-drag-y', Math.max(0, item.y) + 'px')
  }
  const resize: EventCallback = (_layout, _old, item, _placeholder, _event, node) => {
    if (!item || !node || blockedRef.current) return
    const container = node.closest<HTMLElement>('[data-module]')
    container?.style.setProperty('--module-resize-width', item.w + 'px'); container?.style.setProperty('--module-resize-height', item.h + 'px')
  }
  const commit: EventCallback = (layout, _old, item, _placeholder, _event, node) => {
    node?.style.removeProperty('--module-drag-x'); node?.style.removeProperty('--module-drag-y')
    const container = node?.closest<HTMLElement>('[data-module]')
    container?.style.removeProperty('--module-resize-width'); container?.style.removeProperty('--module-resize-height')
    if (!item || blockedRef.current) return
    const finalItem = layout.find(candidate => candidate.i === item.i)
    if (finalItem) setBox(constrain({ x: finalItem.x, y: finalItem.y, width: finalItem.w, height: finalItem.h }, bounds))
  }
  return <div ref={element} data-slot="file-dialog-workspace" data-grid-surface="file-dialog" className={`${styles.workspace} ${viewportStyles.workspace} logical-workspace`}
    style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }} {...handlers}>
    <ViewportContext value={{ blocked, blockedRef, moduleNavigationRef }}>
      <GridLayout width={bounds.width} style={{ height: bounds.height }} autoSize={false}
        layout={[{ i: 'file', x: shown.x, y: shown.y, w: shown.width, h: shown.height, minW: 27, minH: 27, maxW: bounds.width - shown.x, maxH: bounds.height - shown.y }]}
        gridConfig={{ cols: bounds.width, rowHeight: 1, maxRows: bounds.height, margin: [0, 0], containerPadding: [0, 0] }}
        compactor={noCompactor} constraints={[contentMinimum, minMaxSize]}
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
            <div data-slot="file-dialog-body" className={styles.body}>{children}</div>
          </ModuleFrame>
        </div>
      </GridLayout>
    </ViewportContext>
  </div>
}
