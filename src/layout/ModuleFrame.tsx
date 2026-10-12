import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { Proportions, X } from 'lucide-react'
import { HelpTooltip } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'
import { MODULE_ICONS, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'
import { ModuleSizeContext } from './ModuleSizeContext'
import { ModuleZoomContext } from './ModuleZoomContext'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'
import { readNavigation, writeNavigation } from './navigationStorage'

function scrollKey(element: HTMLElement, root: HTMLElement) {
  if (element === root) return 'content'
  return [element.tagName, [...element.classList].join('.'), element.getAttribute('aria-label') ?? ''].join('|')
}

export type ModuleAction = 'front' | 'collapse' | 'contract' | 'expand' | 'fit' | 'reset-zoom' | 'clear-close' | 'reset' | 'close'
export type ModuleActions = (action: ModuleAction) => void

interface ScrollAxis { element: HTMLElement; offset: number; ratio: number; maximum: number }

export function ModuleFrame({ id, active, onClose, onFit, children, generation = 0, height, width, navigationKey, onFront, onPark, onReset, onActions }: {
  id: ModuleId; active: boolean; onClose: () => void; onFit?: (size: Size) => void; children?: ReactNode
  generation?: number; height?: number; width?: number; navigationKey?: string
  onFront?: () => void; onPark?: (size: Size) => void; onReset?: () => void
  onActions?: (id: ModuleId, actions: ModuleActions | null) => void
}) {
  const name = MODULE_REGISTRY[id].name, Icon = MODULE_ICONS[id]
  const [initialNavigation] = useState(() => readNavigation(navigationKey))
  const [scale, setScale] = useState(initialNavigation.scale)
  const [collapse, setCollapse] = useState<{ height: number; generation: number } | null>(null)
  const [iconCollapsed, setIconCollapsed] = useState(false)
  const lastToggle = useRef(-Infinity)
  const [actionError, setActionError] = useState<string | null>(null)
  const fitContentRef = useRef<(() => Size) | null>(null)
  const restoredSize = useRef(initialNavigation.restoreSize)
  const restoringSize = useRef(false)
  const savedScrolls = useRef(initialNavigation.scrolls ?? {})
  const previousScale = useRef(scale)
  const collapsed = height === undefined ? iconCollapsed || collapse?.generation === generation : height <= 29
  const collapseLabel = (collapsed ? 'Expandir ' : 'Colapsar ') + name
  const content = useRef<HTMLDivElement>(null), frame = useRef<HTMLElement>(null)
  const { blocked, blockedRef, moduleNavigationRef } = useViewportInteraction()
  const currentScale = useRef(scale)
  const drag = useRef<{ id: number; x: number; y: number; horizontal?: ScrollAxis; vertical?: ScrollAxis } | null>(null)
  const dragged = useRef(false)
  const iconPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const iconDragged = useRef(false)
  const persist = useCallback(() => {
    writeNavigation(navigationKey, { scale: currentScale.current, offsetX: 0, offsetY: 0, restoreSize: restoredSize.current, scrolls: savedScrolls.current })
  }, [navigationKey])
  function expandedSize() {
    return readNavigation(navigationKey).restoreSize ?? restoredSize.current ?? { width: MODULE_REGISTRY[id].initial[0], height: MODULE_REGISTRY[id].initial[1] }
  }
  function rememberSize() {
    const section = frame.current
    if (!section || collapsed || section.offsetWidth <= 27 || section.offsetHeight <= 29) return
    restoredSize.current = { width: section.offsetWidth, height: section.offsetHeight }
  }
  function restore() {
    restoringSize.current = true
    const restored = expandedSize()
    restoredSize.current = restored
    setCollapse(null); setIconCollapsed(false)
    onFit?.(restored)
    persist()
  }
  function compact(icon: boolean, park = false) {
    const section = frame.current
    if (blockedRef.current || !section || !onFit) return
    rememberSize(); persist()
    setCollapse({ height: section.offsetHeight, generation }); setIconCollapsed(icon)
    const size = icon ? { width: 29, height: 29 } : { width: Math.max(27, expandedSize().width), height: 29 }
    if (park && onPark) onPark(size)
    else onFit(size)
  }
  function allowToggle() {
    const now = performance.now()
    if (blockedRef.current || !onFit || now - lastToggle.current < 500) return false
    lastToggle.current = now
    return true
  }
  function toggleCollapse() {
    if (!allowToggle()) return
    if (collapsed) restore()
    else compact(false)
  }
  function toggleIcon() {
    if (blockedRef.current || !onFit) return
    const iconOnly = width === undefined ? iconCollapsed : width <= 29 && collapsed
    if (iconOnly) restore()
    else compact(true)
  }
  function fitContent() {
    const section = frame.current, node = content.current
    if (blockedRef.current || !section || !node || !onFit) return
    const controls = section.querySelector<HTMLElement>('.module-controls')
    const hidden = node.hidden, controlsHidden = controls?.hidden
    section.dataset.fitting = 'true'; node.hidden = false
    if (controls) controls.hidden = false
    try {
      const body = node.firstElementChild as HTMLElement | null
      const measured = fitContentRef.current?.() ?? { width: body?.scrollWidth ?? 0, height: body?.scrollHeight ?? 0 }
      const header = section.querySelector<HTMLElement>('.module-header')!
      const size = { width: Math.max(27, Math.ceil(Math.max(measured.width, header.scrollWidth) + 2)),
        height: Math.max(30, Math.ceil(measured.height + header.offsetHeight + (controls?.offsetHeight ?? 20) + 2)) }
      setCollapse(null); setIconCollapsed(false)
      restoredSize.current = size
      onFit(size); persist()
    } finally {
      delete section.dataset.fitting; node.hidden = hidden
      if (controls) controls.hidden = controlsHidden ?? false
    }
  }
  function reset(close: boolean) {
    if (blockedRef.current || !onReset) return
    try { onReset(); setActionError(null); if (close) onClose() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'No se pudo limpiar el módulo.') }
  }
  useLayoutEffect(() => {
    // Keep the last expanded size; compact dimensions must never replace it.
    const section = frame.current
    const currentWidth = width ?? section?.offsetWidth ?? 0, currentHeight = height ?? section?.offsetHeight ?? 0
    if (currentWidth <= 27 || currentHeight <= 29) return
    restoredSize.current = { width: currentWidth, height: currentHeight }
    persist()
  }, [width, height, persist])
  const changeScale = useCallback((requested: number) => {
    if (!Number.isFinite(requested)) return
    const next = Math.min(2, Math.max(.25, requested))
    currentScale.current = next
    setScale(next)
  }, [])
  useLayoutEffect(() => {
    const ratio = scale / previousScale.current
    previousScale.current = scale
    const node = content.current
    if (node && id !== 'board' && id !== 'timeline' && ratio !== 1) {
      for (const element of [node, ...node.querySelectorAll<HTMLElement>('*')]) {
        if (element.scrollLeft || element.scrollTop) { element.scrollLeft *= ratio; element.scrollTop *= ratio }
      }
    }
    currentScale.current = scale; persist()
  }, [scale, persist, id])
  useLayoutEffect(() => {
    const node = content.current
    if (!node || id === 'timeline') return
    const nodes = [node, ...node.querySelectorAll<HTMLElement>('*')]
    nodes.forEach(element => {
      const saved = savedScrolls.current[scrollKey(element, node)]
      if (saved) { element.scrollLeft = saved.left; element.scrollTop = saved.top }
    })
  }, [navigationKey, id])
  useLayoutEffect(() => {
    const element = content.current
    if (!active || !element || !moduleNavigationRef) return
    const navigation = { element, get scale() { return currentScale.current }, zoom: changeScale }
    moduleNavigationRef.current = navigation
    return () => { if (moduleNavigationRef.current === navigation) moduleNavigationRef.current = null }
  }, [active, moduleNavigationRef, changeScale])
  useEffect(() => {
    const node = content.current
    if (!node) return
    const wheel = (event: WheelEvent) => { if (!event.ctrlKey) event.preventDefault() }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [])
  useEffect(() => {
    const node = frame.current
    if (!active || !node || moduleNavigationRef) return
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node!.clientHeight : 1
      changeScale(currentScale.current * Math.exp(-event.deltaY * unit * .002))
    }
    node.addEventListener('wheel', wheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', wheel, true)
  }, [active, moduleNavigationRef, blockedRef, changeScale])
  useEffect(() => { if (blocked) drag.current = null }, [blocked])
  // The dashboard menu uses the current frame actions without moving local controls.
  useLayoutEffect(() => {
    onActions?.(id, action => {
      if (blockedRef.current) return
      switch (action) {
        case 'front': onFront?.(); break
        case 'collapse': compact(false, true); break
        case 'contract': compact(true, true); break
        case 'expand': if (collapsed) restore(); break
        case 'fit': fitContent(); break
        case 'reset-zoom': changeScale(1); break
        case 'clear-close': reset(true); break
        case 'reset': reset(false); break
        case 'close': onClose(); break
      }
    })
    return () => onActions?.(id, null)
  })
  function startPan(event: PointerEvent<HTMLDivElement>) {
    dragged.current = false
    if (blockedRef.current || event.button !== 0 || !event.isPrimary) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('input,textarea,select,[role="slider"],[role="radio"],[contenteditable="true"],.board-area,.notebook-handle')) return
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
  const sizing = useRef({ collapsed, onFit })
  sizing.current = { collapsed, onFit }
  const requestSpace = useCallback((minimum: Size, { fitHeight = false } = {}) => {
    const section = frame.current, config = sizing.current
    if (blockedRef.current || config.collapsed || !section || !config.onFit) return
    const chrome = 29 + (section.querySelector<HTMLElement>('.module-controls')?.offsetHeight || 20)
    const width = Math.max(27, Math.ceil(Math.max(section.offsetWidth, minimum.width + 2)))
    const height = Math.max(30, Math.ceil(fitHeight ? minimum.height + chrome : Math.max(section.offsetHeight, minimum.height + chrome)))
    if (width !== section.offsetWidth || height !== section.offsetHeight) config.onFit({ width, height })
  }, [blockedRef])
  useLayoutEffect(() => {
    const restoring = restoringSize.current
    restoringSize.current = false
    const node = content.current?.firstElementChild as HTMLElement | null
    if (!node || collapsed || id === 'board' || id === 'timeline' || id === 'information') return
    function measure() {
      node!.dataset.measuring = 'true'
      const size = { width: node!.scrollWidth, height: node!.scrollHeight }
      delete node!.dataset.measuring
      return size
    }
    const countItems = () => node!.querySelectorAll('.element-row,.notebook-block,.timer-row,.timeline-entries li,.operations-counters > div,.unit-tag-actions,[data-item-id]').length
    let count = countItems()
    // Expanding restores the saved box; do not fit content still laid out at its compact width.
    if (!restoring) {
      const size = measure()
      if (size.height || size.width) requestSpace(size)
    }
    // Ticks and text edits do not resize a window. Structural additions/removals do.
    const observer = new MutationObserver(records => {
      const next = countItems()
      const editedNote = records.some(record => record.type === 'attributes' && record.target instanceof HTMLTextAreaElement)
      if (next === count && !editedNote) return
      const removed = next < count
      count = next
      if (id === 'clock') return // Reloj measures timer additions/removals itself.
      const size = measure()
      if (size.height || size.width) requestSpace(size, { fitHeight: removed || editedNote })
    })
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [scale, collapsed, id, requestSpace])
  return <section ref={frame} className="module-frame" data-active={active} data-collapsed={collapsed} data-icon-only={width === undefined ? iconCollapsed : width <= 29 && collapsed} role="region" aria-label={name}>
    <header className="module-header">
      <Button className="document-button module-button module-icon" aria-label={'Recoger o restaurar ' + name} aria-pressed={active} aria-expanded={!(width === undefined ? iconCollapsed : width <= 29 && collapsed)} disabled={blocked || !onFit}
        onPointerDownCapture={event => {
          iconDragged.current = false
          iconPointer.current = event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null
        }}
        onPointerMoveCapture={event => {
          const start = iconPointer.current
          if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) iconDragged.current = true
        }}
        onPointerUp={() => { iconPointer.current = null }}
        onPointerCancel={() => { iconPointer.current = null; iconDragged.current = true }}
        onClick={event => { if (!iconDragged.current || event.detail === 0) toggleIcon() }}><Icon aria-hidden="true" /></Button>
      <h2>{name}</h2>
      <HelpTooltip text={collapseLabel}><Button className="module-button module-fit" aria-label={collapseLabel} aria-expanded={!collapsed} disabled={blocked || !onFit} onClick={event => { if (event.detail < 2) toggleCollapse() }}><Proportions aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip key={generation} text={'Cerrar ' + name}><Button className="module-button module-close" aria-label={'Cerrar ' + name} disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button></HelpTooltip>
    </header>
    <div ref={content} className="module-content" hidden={collapsed}
      onScrollCapture={event => {
        const root = content.current, node = event.target
        if (!root || id === 'timeline' || !(node instanceof HTMLElement)) return
        savedScrolls.current[scrollKey(node, root)] = { left: node.scrollLeft, top: node.scrollTop }; persist()
      }}
      onPointerDownCapture={startPan} onPointerMoveCapture={movePan}
      onPointerUpCapture={() => { drag.current = null }} onPointerCancelCapture={() => { drag.current = null }}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) drag.current = null }}
      onClickCapture={event => { if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() } }}>
      <div className="module-scaled-content" data-scale={scale} data-kind={id === 'board' ? 'board' : 'module'} style={{ '--module-zoom': id === 'board' ? 1 : scale } as CSSProperties}>
        <ModuleZoomContext value={{ scale, navigationKey, fitContentRef }}><ModuleSizeContext value={requestSpace}>{children}{actionError && <p className="module-action-error" role="alert">{actionError}</p>}</ModuleSizeContext></ModuleZoomContext>
      </div>
    </div>
    <div className="module-controls" hidden={collapsed}>
      <ZoomControl key={generation} scale={scale} onChange={value => { if (!blockedRef.current) changeScale(value) }} label={'Zoom de ' + name} disabled={blocked} side="right" />
    </div>
  </section>
}
