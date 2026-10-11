import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Proportions, X } from 'lucide-react'
import { HelpTooltip } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'
import { MODULE_ICONS, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'
import { ModuleSizeContext } from './ModuleSizeContext'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'
import type { Position } from '../domain/document/types'

interface ScrollAxis { element: HTMLElement; offset: number; ratio: number; maximum: number }


export function ModuleFrame({ id, active, onClose, onFit, children, generation = 0, height }: { id: ModuleId; active: boolean; onClose: () => void; onFit?: (size: Size) => void; children?: ReactNode; generation?: number; height?: number }) {
  const name = MODULE_REGISTRY[id].name
  const Icon = MODULE_ICONS[id]
  const [scale, setScale] = useState(1)
  const [collapse, setCollapse] = useState<{ height: number; generation: number } | null>(null)
  const collapsed = height === undefined ? collapse?.generation === generation : height <= 29
  const collapseLabel = (collapsed ? 'Expandir ' : 'Colapsar ') + name
  const content = useRef<HTMLDivElement>(null)
  const { blocked, blockedRef, moduleNavigationRef } = useViewportInteraction()
  const currentScale = useRef(scale)
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; horizontal?: ScrollAxis; vertical?: ScrollAxis } | null>(null)
  const dragged = useRef(false)
  const frame = useRef<HTMLElement>(null)
  function toggleCollapse() {
    const section = frame.current
    if (blockedRef.current || !section || !onFit) return
    const minimum = section.querySelector<HTMLElement>('.module-header')!.offsetHeight + 2
    if (collapsed) {
      const restored = collapse?.generation === generation ? collapse.height : MODULE_REGISTRY[id].initial[1]
      setCollapse(null)
      onFit({ width: section.offsetWidth, height: Math.max(minimum + 1, restored) })
    } else {
      setCollapse({ height: section.offsetHeight, generation })
      onFit({ width: section.offsetWidth, height: minimum })
    }
  }
  const changeScale = useCallback((requested: number, point: Position) => {
    if (!Number.isFinite(requested)) return
    const next = Math.min(2, Math.max(.25, requested)), node = content.current
    const previous = currentScale.current
    if (next === previous) return
    if (node) {
      const rect = node.getBoundingClientRect()
      if (rect.width && rect.height) {
        const inside = point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
        const x = inside ? (point.x - rect.left) * node.clientWidth / rect.width : node.clientWidth / 2
        const y = inside ? (point.y - rect.top) * node.clientHeight / rect.height : node.clientHeight / 2
        pendingScroll.current = { left: (node.scrollLeft + x) * next / previous - x, top: (node.scrollTop + y) * next / previous - y }
      }
    }
    currentScale.current = next
    setScale(next)
  }, [])
  useLayoutEffect(() => {
    currentScale.current = scale
    const node = content.current, pending = pendingScroll.current
    if (node && pending) { node.scrollLeft = pending.left; node.scrollTop = pending.top }
    pendingScroll.current = null
  }, [scale])
  useLayoutEffect(() => {
    const element = content.current
    if (!active || !element || !moduleNavigationRef) return
    const navigation = { element, get scale() { return currentScale.current }, zoom: changeScale }
    moduleNavigationRef.current = navigation
    return () => { if (moduleNavigationRef.current === navigation) moduleNavigationRef.current = null }
  }, [active, moduleNavigationRef, changeScale])
  useEffect(() => {
    const node = frame.current
    if (!active || !node || moduleNavigationRef) return
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node!.clientHeight : 1
      changeScale(currentScale.current * Math.exp(-event.deltaY * unit * .002), { x: event.clientX, y: event.clientY })
    }
    node.addEventListener('wheel', wheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', wheel, true)
  }, [active, moduleNavigationRef, blockedRef, changeScale])
  useEffect(() => { if (blocked) drag.current = null }, [blocked])
  function startPan(event: PointerEvent<HTMLDivElement>) {
    dragged.current = false
    if (blockedRef.current || event.button !== 0 || !event.isPrimary) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('button,input,textarea,select,a,[role="button"],[role="slider"],[role="radio"],[contenteditable="true"],.board-area,.notebook-handle')) return
    let horizontal: ScrollAxis | undefined, vertical: ScrollAxis | undefined
    for (let element: Element | null = target; element && event.currentTarget.contains(element); element = element.parentElement) {
      if (!(element instanceof HTMLElement)) continue
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      const ratio = element.offsetWidth ? rect.width / element.offsetWidth || 1 : 1
      if (!horizontal && /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth) horizontal = { element, offset: element.scrollLeft, ratio, maximum: element.scrollWidth - element.clientWidth }
      if (!vertical && /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight) vertical = { element, offset: element.scrollTop, ratio, maximum: element.scrollHeight - element.clientHeight }
    }
    if (horizontal || vertical) drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal, vertical }
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId || blockedRef.current) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (!dragged.current && Math.hypot(dx, dy) <= 4) return
    dragged.current = true
    event.preventDefault(); event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (start.horizontal) { const axis = start.horizontal; axis.element.scrollLeft = Math.max(0, Math.min(axis.maximum, axis.offset - dx / axis.ratio)) }
    if (start.vertical) { const axis = start.vertical; axis.element.scrollTop = Math.max(0, Math.min(axis.maximum, axis.offset - dy / axis.ratio)) }
  }
  function requestSpace(minimum: Size, { fitHeight = false } = {}) {
    const section = frame.current
    if (blockedRef.current || collapsed || !section || !onFit) return
    const chrome = section.querySelector<HTMLElement>('.module-header')!.offsetHeight + section.querySelector<HTMLElement>('.module-controls')!.offsetHeight + 2
    if (fitHeight) {
      const height = Math.max(chrome + 1, Math.ceil(minimum.height * scale + chrome))
      if (height !== section.offsetHeight) onFit({ width: section.offsetWidth, height })
      return
    }
    const width = Math.ceil(Math.max(section.offsetWidth, minimum.width * scale + 2))
    const originalWidth = section.style.width
    let height: number
    try {
      section.style.width = width + 'px'
      const measuredHeight = (content.current?.firstElementChild as HTMLElement | null)?.scrollHeight ?? 0
      height = Math.ceil(Math.max(section.offsetHeight, Math.max(minimum.height, measuredHeight) * scale + chrome))
    } finally { section.style.width = originalWidth }
    if (width > section.offsetWidth || height > section.offsetHeight) onFit({ width, height })
  }
  return (
    <section ref={frame} className="module-frame" data-active={active} data-collapsed={collapsed} role="region" aria-label={name}>
      <header className="module-header">
        <Icon className="module-icon" aria-hidden="true" />
        <h2>{name}</h2>
        <HelpTooltip text={collapseLabel}><Button className="module-fit" aria-label={collapseLabel} aria-expanded={!collapsed} disabled={blocked || !onFit} onClick={toggleCollapse}><Proportions aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip key={generation} text={`Cerrar ${name}`}><Button className="module-close" aria-label={`Cerrar ${name}`} disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button></HelpTooltip>
      </header>
      <div ref={content} className="module-content" hidden={collapsed}
        onPointerDownCapture={startPan} onPointerMoveCapture={movePan}
        onPointerUpCapture={() => { drag.current = null }} onPointerCancelCapture={() => { drag.current = null }}
        onLostPointerCapture={event => { if (event.target === event.currentTarget) drag.current = null }}
        onClickCapture={event => { if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() } }}>
        <div className="module-scaled-content" data-scale={scale} style={{ zoom: scale, width: '100%', height: '100%' }}><ModuleSizeContext value={requestSpace}>{children}</ModuleSizeContext></div>
      </div>
      <div className="module-controls" hidden={collapsed}>
        <ZoomControl key={generation} scale={scale} onChange={value => { if (!blockedRef.current) setScale(value) }} label={`Zoom de ${name}`} disabled={blocked} side="right" />
      </div>
    </section>
  )
}
