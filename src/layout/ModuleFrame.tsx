import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { FileText, Proportions, Scan, ScanSquare, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { moduleAutoHeightLimit, moduleCollapsedWidth, moduleCompactsInPlace, moduleExpandedMinimumSize, moduleSupportsAutoResize, MODULE_ICONS, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'
import { ModuleSizeContext } from './ModuleSizeContext'
import { ModuleZoomContext } from './ModuleZoomContext'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'
import { readNavigation, writeNavigation } from './navigationStorage'
import { measureModuleBaseSize } from './windowContentSize'
import styles from './moduleFrame.module.css'
import controlStyles from './controlButton.module.css'

function scrollKey(element: HTMLElement, root: HTMLElement) {
  if (element === root) return 'content'
  return [element.tagName, [...element.classList].join('.'), element.getAttribute('aria-label') ?? ''].join('|')
}

export type ModuleAction = 'front' | 'collapse' | 'contract' | 'expand' | 'fit' | 'reset-zoom' | 'clear-close' | 'reset' | 'close'
export type ModuleActions = (action: ModuleAction) => Size | undefined

interface ScrollAxis { element: HTMLElement; offset: number; ratio: number; maximum: number }

export function ModuleFrame({ id, title, icon, active, onClose, onFit, children, generation = 0, contentSizeRevision = 0, locateToken = 0, height, width, navigationKey, resetSizeOnMount = false, onFront, onPark, onReset, onActions }: {
  id?: ModuleId; title?: string; icon?: LucideIcon; active: boolean; onClose: () => void; onFit?: (size: Size) => void; children?: ReactNode
  generation?: number; contentSizeRevision?: number; locateToken?: number; height?: number; width?: number; navigationKey?: string; resetSizeOnMount?: boolean
  onFront?: () => void; onPark?: (size: Size) => void; onReset?: () => void
  onActions?: (id: ModuleId, actions: ModuleActions | null) => void
}) {
  const name = title ?? (id ? MODULE_REGISTRY[id].name : ''), Icon = icon ?? (id ? MODULE_ICONS[id] : FileText)
  const sizeMode = id ? MODULE_REGISTRY[id].sizeMode : 'specific'
  const supportsAutoResize = moduleSupportsAutoResize(id)
  const elementList = id === 'elements' || id === 'dotations'
  const automaticHeight = !!id && supportsAutoResize && MODULE_REGISTRY[id].baseHeight === 'content'
  const [initialNavigation] = useState(() => readNavigation(navigationKey))
  const [autoResize, setAutoResize] = useState(supportsAutoResize && initialNavigation.autoResize !== false)
  const currentAutoResize = useRef(supportsAutoResize && initialNavigation.autoResize !== false)
  const [scale, setScale] = useState(initialNavigation.scale)
  const [collapsedGeneration, setCollapsedGeneration] = useState<number | null>(null)
  const [iconCollapsed, setIconCollapsed] = useState(false)
  const lastToggle = useRef(-Infinity)
  const [, setActionError] = useValidationNotice(null, generation)
  const [zoomHidden, setZoomHidden] = useState(false)
  const fitContentRef = useRef<(() => Size) | null>(null)
  const dialogExpandedSize = useRef<Size | undefined>(undefined)
  const initialSizePending = useRef(resetSizeOnMount)
  const restoringSize = useRef(false)
  const preserveManualSize = useRef(false)
  const savedScrolls = useRef(initialNavigation.scrolls ?? {})
  const previousScale = useRef(scale)
  const collapsed = height === undefined ? iconCollapsed || collapsedGeneration === generation : height <= 29
  const collapseLabel = (collapsed ? 'Expandir ' : 'Colapsar ') + name
  const content = useRef<HTMLDivElement>(null), frame = useRef<HTMLElement>(null)
  const { blocked, blockedRef, moduleNavigationRef } = useViewportInteraction()
  const currentScale = useRef(scale)
  const drag = useRef<{ id: number; x: number; y: number; horizontal?: ScrollAxis; vertical?: ScrollAxis } | null>(null)
  const dragged = useRef(false)
  const iconPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const iconDragged = useRef(false)
  const persist = useCallback(() => {
    writeNavigation(navigationKey, { ...readNavigation(navigationKey), scale: currentScale.current, offsetX: 0, offsetY: 0, scrolls: savedScrolls.current, autoResize: currentAutoResize.current })
  }, [navigationKey])
  function toggleAutoResize() {
    if (!supportsAutoResize || blockedRef.current || !onFit) return
    const next = !currentAutoResize.current
    currentAutoResize.current = next
    if (next) {
      restoringSize.current = false
      preserveManualSize.current = false
    }
    setAutoResize(next); persist()
  }
  function expandedSize() {
    return id ? measureModuleBaseSize(frame.current, id) : dialogExpandedSize.current ?? { width: 360, height: 180 }
  }
  function rememberDialogSize() {
    const section = frame.current
    if (id || !section || collapsed || section.offsetWidth <= 29 || section.offsetHeight <= 29) return
    dialogExpandedSize.current = { width: section.offsetWidth, height: section.offsetHeight }
  }
  function restore() {
    restoringSize.current = true
    preserveManualSize.current = true
    const size = expandedSize()
    setCollapsedGeneration(null); setIconCollapsed(false)
    onFit?.(size)
    persist()
    return size
  }
  function compact(icon: boolean, park = false) {
    const section = frame.current
    if (blockedRef.current || !section || !onFit) return
    rememberDialogSize()
    setCollapsedGeneration(generation); setIconCollapsed(icon)
    const size = icon ? { width: 27, height: 27 } : { width: moduleCollapsedWidth(id), height: 27 }
    if (park && onPark && !moduleCompactsInPlace(id)) onPark(size)
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
      const minimum = moduleExpandedMinimumSize(id)
      const size = { width: Math.max(minimum.width, Math.ceil(Math.max(measured.width, header.scrollWidth) + 2)),
        height: Math.max(minimum.height, Math.ceil(measured.height + header.offsetHeight + (controls?.offsetHeight ?? 25) + 2)) }
      setCollapsedGeneration(null); setIconCollapsed(false)
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
    // Dialogs have no module definition and retain their own expanded size in memory.
    const section = frame.current
    const currentWidth = width ?? section?.offsetWidth ?? 0, currentHeight = height ?? section?.offsetHeight ?? 0
    if (id || currentWidth <= 29 || currentHeight <= 29) return
    dialogExpandedSize.current = { width: currentWidth, height: currentHeight }
  }, [id, width, height])
  useLayoutEffect(() => {
    if (!initialSizePending.current || !id || !frame.current || blockedRef.current || !onFit) return
    initialSizePending.current = false
    restoringSize.current = true
    preserveManualSize.current = true
    onFit(measureModuleBaseSize(frame.current, id))
  }, [id, blockedRef, onFit])
  const changeScale = useCallback((requested: number) => {
    if (!Number.isFinite(requested)) return
    const next = Math.min(2, Math.max(.25, requested))
    preserveManualSize.current = false
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
    const wheel = (event: WheelEvent) => { if (!event.ctrlKey && ((sizeMode !== 'feed' && sizeMode !== 'editable') || blockedRef.current)) event.preventDefault() }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [sizeMode, blockedRef])
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
  useEffect(() => {
    const container = frame.current?.parentElement
    if (!container || !supportsAutoResize) return
    const preserve = (event: globalThis.PointerEvent) => {
      if (event.button === 0 && !blockedRef.current && event.target instanceof Element && event.target.closest('.react-resizable-handle')) {
        preserveManualSize.current = true
        currentAutoResize.current = false
        setAutoResize(false)
        persist()
      }
    }
    container.addEventListener('pointerdown', preserve, true)
    return () => container.removeEventListener('pointerdown', preserve, true)
  }, [supportsAutoResize, blockedRef, persist])
  useLayoutEffect(() => {
    const controls = frame.current?.querySelector<HTMLElement>('.module-controls')
    const zoom = controls?.querySelector<HTMLElement>('[data-slot="zoom-control"]')
    if (collapsed || !controls || !zoom) return
    const measure = () => {
      const style = getComputedStyle(controls)
      const available = controls.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setZoomHidden(zoom.offsetWidth > available)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(controls); observer.observe(zoom)
    return () => observer.disconnect()
  }, [collapsed, generation, supportsAutoResize])
  // The dashboard menu uses the current frame actions without moving local controls.
  useLayoutEffect(() => {
    if (!id) return
    onActions?.(id, action => {
      if (blockedRef.current) return
      switch (action) {
        case 'front': onFront?.(); break
        case 'collapse': compact(false, true); break
        case 'contract': compact(true, true); break
        case 'expand': if (collapsed) return restore(); break
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
    if (!(target instanceof Element) || target.closest('input,textarea,select,[data-slot="select"],[role="checkbox"],[role="slider"],[role="radio"],[role="separator"][aria-valuenow],[contenteditable="true"],.board-area,.notebook-handle,[data-map-surface]')) return
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
  const requestSpace = useCallback((minimum: Size) => {
    const section = frame.current
    if (!supportsAutoResize || !currentAutoResize.current || blockedRef.current || collapsed || !section || !onFit || section.closest('.resizing')) return
    if (preserveManualSize.current) return
    // RGL synchronizes the restored box after the module props have changed.
    if (width !== undefined && Math.abs(section.offsetWidth - width) > 1) return
    const chrome = 29 + (section.querySelector<HTMLElement>('.module-controls')?.offsetHeight || 25)
    const expandedMinimum = moduleExpandedMinimumSize(id)
    const nextWidth = Math.max(expandedMinimum.width, section.offsetWidth)
    const requestedHeight = Math.max(30, Math.ceil(minimum.height + chrome))
    const height = Math.max(expandedMinimum.height, Math.min(moduleAutoHeightLimit(id), requestedHeight))
    if (nextWidth !== section.offsetWidth || height !== section.offsetHeight) onFit({ width: nextWidth, height })
  }, [id, supportsAutoResize, width, blockedRef, collapsed, onFit])
  const measuredSpace = useRef(requestSpace)
  // Keep the observer stable when the parent's resize callback changes.
  useLayoutEffect(() => { measuredSpace.current = requestSpace }, [requestSpace])
  useLayoutEffect(() => {
    const node = content.current?.firstElementChild as HTMLElement | null
    if (!supportsAutoResize || !autoResize || collapsed || blocked || !node) return
    const restoring = restoringSize.current
    restoringSize.current = false
    let preserveRestoredSize = restoring
    let previousHeight: number | undefined
    const intrinsicHeight = () => {
      const measuring = node.getAttribute('data-measuring')
      const clock = node.querySelector<HTMLElement>('.clock-module'), clockSizing = clock?.getAttribute('data-sizing')
      node.setAttribute('data-measuring', 'true')
      clock?.setAttribute('data-sizing', 'true')
      try {
        return node.scrollHeight
      }
      finally {
        if (measuring === null) node.removeAttribute('data-measuring')
        else node.setAttribute('data-measuring', measuring)
        if (clockSizing == null) clock?.removeAttribute('data-sizing')
        else clock?.setAttribute('data-sizing', clockSizing)
      }
    }
    const measure = () => {
      const section = frame.current, expectedWidth = section?.parentElement?.dataset.width
      if (!section || section.closest('.resizing') || (expectedWidth && Math.abs(section.offsetWidth - Number(expectedWidth)) > 1)) return
      const height = intrinsicHeight()
      if (preserveRestoredSize) { previousHeight = height; preserveRestoredSize = false; return }
      if (preserveManualSize.current) { previousHeight = height; return }
      if (height === previousHeight) return
      previousHeight = height
      if (height) measuredSpace.current({ width: 0, height })
    }
    // Keep the measured basic size until the content actually changes.
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    for (const child of Array.from(node.firstElementChild?.children ?? [])) observer?.observe(child)
    for (const child of node.querySelectorAll('.timeline-entries ol,.timeline-add')) observer?.observe(child)
    const mutations = new MutationObserver(records => {
      if (records.some(record => record.type !== 'attributes' || record.attributeName !== 'style')) preserveManualSize.current = false
      measure()
    })
    mutations.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'data-expanded', 'src'] })
    return () => { observer?.disconnect(); mutations.disconnect() }
  }, [supportsAutoResize, autoResize, id, collapsed, blocked, contentSizeRevision])
  return <section ref={frame} data-slot="module-frame" className={`${styles.base} module-frame`} data-active={active} data-auto-height={autoResize && automaticHeight && !elementList} data-scroll-side={sizeMode === 'feed' ? (id === 'information' || id === 'timeline' ? 'right' : 'left') : sizeMode === 'editable' ? 'right' : undefined} data-collapsed={collapsed} data-icon-only={width === undefined ? iconCollapsed : width <= 29 && collapsed} role="region" aria-label={name}>
    <header data-slot="module-header" className="module-header">
      <Button data-control="module-icon" className={`${controlStyles.base} module-icon`} aria-label={'Recoger o restaurar ' + name} aria-pressed={active} aria-expanded={!(width === undefined ? iconCollapsed : width <= 29 && collapsed)} disabled={blocked || !onFit}
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
      <h2 data-slot="module-title">{name}</h2>
      <Button data-control="module-collapse" className={`${controlStyles.base} module-fit`} aria-label={collapseLabel} aria-expanded={!collapsed} disabled={blocked || !onFit} onClick={event => { if (event.detail < 2) toggleCollapse() }}><Proportions aria-hidden="true" /></Button>
      <Button key={generation} data-control="module-close" className={`${controlStyles.base} module-close`} aria-label={'Cerrar ' + name} disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button>
    </header>
    <div ref={content} data-slot="module-content" className="module-content" hidden={collapsed}
      onInputCapture={() => { preserveManualSize.current = false }}
      onScrollCapture={event => {
        const root = content.current, node = event.target
        if (!root || id === 'timeline' || !(node instanceof HTMLElement)) return
        savedScrolls.current[scrollKey(node, root)] = { left: node.scrollLeft, top: node.scrollTop }; persist()
      }}
      onPointerDownCapture={startPan} onPointerMoveCapture={movePan}
      onPointerUpCapture={() => { drag.current = null }} onPointerCancelCapture={() => { drag.current = null }}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) drag.current = null }}
      onClickCapture={event => {
        if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); return }
      }}>
      <div data-slot="module-scaled-content" className="module-scaled-content" data-scale={scale} data-kind={id === 'board' ? 'board' : 'module'} style={{ '--module-zoom': id === 'board' ? 1 : scale } as CSSProperties}>
        <ModuleZoomContext value={{ scale, navigationKey, fitContentRef }}><ModuleSizeContext value={requestSpace}>{children}</ModuleSizeContext></ModuleZoomContext>
      </div>
    </div>
    <div data-slot="module-controls" className="module-controls" hidden={collapsed} data-zoom-hidden={zoomHidden} data-auto-resize-supported={supportsAutoResize}>
      <ZoomControl key={generation} scale={scale} onChange={value => { if (!blockedRef.current) changeScale(value) }} label={'Zoom de ' + name} disabled={blocked || zoomHidden} side="right" />
      {supportsAutoResize && <Button data-control="module-auto-resize" className={`${controlStyles.base} module-auto-resize`} aria-label="Redimensionado automático" aria-pressed={autoResize} disabled={blocked || !onFit} onClick={toggleAutoResize}>{autoResize ? <ScanSquare aria-hidden="true" /> : <Scan aria-hidden="true" />}</Button>}
    </div>
    {locateToken > 0 && <div key={locateToken} data-slot="module-locator" className="module-locator" aria-hidden="true" />}
  </section>
}
