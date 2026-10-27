import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { FileText, Proportions, Scan, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HelpTooltip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { MODULE_AUTO_HEIGHT_LIMIT, MODULE_ICONS, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'
import { ModuleSizeContext } from './ModuleSizeContext'
import { ModuleZoomContext } from './ModuleZoomContext'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'
import { readNavigation, writeNavigation } from './navigationStorage'
import styles from './moduleFrame.module.css'
import controlStyles from './controlButton.module.css'

function scrollKey(element: HTMLElement, root: HTMLElement) {
  if (element === root) return 'content'
  return [element.tagName, [...element.classList].join('.'), element.getAttribute('aria-label') ?? ''].join('|')
}

export type ModuleAction = 'front' | 'collapse' | 'contract' | 'expand' | 'fit' | 'reset-zoom' | 'clear-close' | 'reset' | 'close'
export type ModuleActions = (action: ModuleAction) => void

interface ScrollAxis { element: HTMLElement; offset: number; ratio: number; maximum: number }

export function ModuleFrame({ id, title, icon, active, onClose, onFit, children, generation = 0, contentSizeRevision = 0, locateToken = 0, height, width, navigationKey, onFront, onPark, onReset, onActions }: {
  id?: ModuleId; title?: string; icon?: LucideIcon; active: boolean; onClose: () => void; onFit?: (size: Size) => void; children?: ReactNode
  generation?: number; contentSizeRevision?: number; locateToken?: number; height?: number; width?: number; navigationKey?: string
  onFront?: () => void; onPark?: (size: Size) => void; onReset?: () => void
  onActions?: (id: ModuleId, actions: ModuleActions | null) => void
}) {
  const name = title ?? (id ? MODULE_REGISTRY[id].name : ''), Icon = icon ?? (id ? MODULE_ICONS[id] : FileText)
  const sizeMode = id ? MODULE_REGISTRY[id].sizeMode : 'specific'
  const automaticHeight = sizeMode === 'feed' || (sizeMode === 'editable' && id !== 'clock')
  const observesContentSize = automaticHeight || sizeMode === 'standard'
  const [initialNavigation] = useState(() => readNavigation(navigationKey))
  const [autoResize, setAutoResize] = useState(initialNavigation.autoResize !== false)
  const currentAutoResize = useRef(initialNavigation.autoResize !== false)
  const [scale, setScale] = useState(initialNavigation.scale)
  const [collapse, setCollapse] = useState<{ height: number; generation: number } | null>(null)
  const [iconCollapsed, setIconCollapsed] = useState(false)
  const lastToggle = useRef(-Infinity)
  const [actionError, setActionError] = useState<string | null>(null)
  const [zoomHidden, setZoomHidden] = useState(false)
  const fitContentRef = useRef<(() => Size) | null>(null)
  const restoredSize = useRef(initialNavigation.restoreSize)
  const restoringSize = useRef(false)
  const preserveManualSize = useRef(false)
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
    writeNavigation(navigationKey, { ...readNavigation(navigationKey), scale: currentScale.current, offsetX: 0, offsetY: 0, restoreSize: restoredSize.current, scrolls: savedScrolls.current, autoResize: currentAutoResize.current })
  }, [navigationKey])
  function toggleAutoResize() {
    if (blockedRef.current || !onFit) return
    const next = !currentAutoResize.current
    currentAutoResize.current = next
    if (next) {
      restoringSize.current = false
      preserveManualSize.current = false
    }
    setAutoResize(next); persist()
  }
  function expandedSize() {
    const saved = readNavigation(navigationKey).restoreSize ?? restoredSize.current
    return saved && saved.width > 29 && saved.height > 29 ? saved : { width: id ? MODULE_REGISTRY[id].initial[0] : 360, height: id ? MODULE_REGISTRY[id].initial[1] : 180 }
  }
  function rememberSize() {
    const section = frame.current
    if (!section || collapsed || section.offsetWidth <= 29 || section.offsetHeight <= 29) return
    restoredSize.current = { width: section.offsetWidth, height: section.offsetHeight }
  }
  function restore() {
    restoringSize.current = true
    preserveManualSize.current = true
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
    const size = icon ? { width: 27, height: 27 } : { width: 200, height: 27 }
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
        height: Math.max(30, Math.ceil(measured.height + header.offsetHeight + (controls?.offsetHeight ?? 25) + 2)) }
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
    if (currentWidth <= 29 || currentHeight <= 29) return
    restoredSize.current = { width: currentWidth, height: currentHeight }
    persist()
  }, [width, height, persist])
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
    if (!container || !observesContentSize) return
    const preserve = (event: globalThis.PointerEvent) => {
      if (event.button === 0 && !blockedRef.current && event.target instanceof Element && event.target.closest('.react-resizable-handle')) preserveManualSize.current = true
    }
    container.addEventListener('pointerdown', preserve, true)
    return () => container.removeEventListener('pointerdown', preserve, true)
  }, [observesContentSize, blockedRef])
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
  }, [collapsed, generation])
  // The dashboard menu uses the current frame actions without moving local controls.
  useLayoutEffect(() => {
    if (!id) return
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
    if (!(target instanceof Element) || target.closest('input,textarea,select,[data-slot="select"],[role="checkbox"],[role="slider"],[role="radio"],[contenteditable="true"],.board-area,.notebook-handle,[data-map-surface]')) return
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
  const requestSpace = useCallback((minimum: Size, { fitHeight = false } = {}) => {
    const section = frame.current
    // Operativo keeps its chosen size; the forecast requests height changes explicitly.
    if (!currentAutoResize.current || id === 'operations' || blockedRef.current || collapsed || !section || !onFit || section.closest('.resizing')) return
    if (observesContentSize && preserveManualSize.current) return
    // RGL synchronizes the restored box after the module props have changed.
    if (width !== undefined && Math.abs(section.offsetWidth - width) > 1) return
    const chrome = 29 + (section.querySelector<HTMLElement>('.module-controls')?.offsetHeight || 25)
    const nextWidth = automaticHeight ? section.offsetWidth : Math.max(27, Math.ceil(Math.max(section.offsetWidth, minimum.width + 2)))
    const requestedHeight = Math.max(30, Math.ceil(fitHeight || automaticHeight ? minimum.height + chrome : Math.max(section.offsetHeight, minimum.height + chrome)))
    const height = automaticHeight || sizeMode === 'editable' ? Math.min(MODULE_AUTO_HEIGHT_LIMIT, requestedHeight) : requestedHeight
    if (nextWidth !== section.offsetWidth || height !== section.offsetHeight) onFit({ width: nextWidth, height })
  }, [id, sizeMode, automaticHeight, observesContentSize, width, blockedRef, collapsed, onFit])
  const measuredSpace = useRef(requestSpace)
  // Keep the observer stable when the parent's resize callback changes.
  useLayoutEffect(() => { measuredSpace.current = requestSpace }, [requestSpace])
  useLayoutEffect(() => {
    const node = content.current?.firstElementChild as HTMLElement | null
    if (!autoResize || !observesContentSize || collapsed || blocked || !node) return
    const restoring = restoringSize.current
    restoringSize.current = false
    let preserveRestoredSize = restoring
    let previousHeight: number | undefined
    const intrinsicHeight = () => {
      const measuring = node.getAttribute('data-measuring')
      node.setAttribute('data-measuring', 'true')
      try { return node.scrollHeight }
      finally {
        if (measuring === null) node.removeAttribute('data-measuring')
        else node.setAttribute('data-measuring', measuring)
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
      if (height) measuredSpace.current({ width: automaticHeight ? 0 : node.scrollWidth, height }, { fitHeight: true })
    }
    // Restoring must keep the saved box until its content actually changes.
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    for (const child of node.querySelectorAll('.timeline-entries ol,.timeline-add')) observer?.observe(child)
    const mutations = new MutationObserver(records => {
      if (records.some(record => record.type !== 'attributes' || record.attributeName !== 'style')) preserveManualSize.current = false
      measure()
    })
    mutations.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'data-expanded', 'src'] })
    return () => { observer?.disconnect(); mutations.disconnect() }
  }, [autoResize, automaticHeight, observesContentSize, collapsed, blocked, contentSizeRevision])
  useLayoutEffect(() => {
    if (!autoResize || observesContentSize) return
    const restoring = restoringSize.current
    restoringSize.current = false
    const node = content.current?.firstElementChild as HTMLElement | null
    if (!node || collapsed || id === 'board' || id === 'timeline' || id === 'operations' || id === 'map' || id === 'forecast') return
    function measure() {
      node!.setAttribute('data-measuring', 'true')
      const size = { width: node!.scrollWidth, height: node!.scrollHeight }
      node!.removeAttribute('data-measuring')
      return size
    }
    const countItems = () => node!.querySelectorAll('.element-row,.notebook-block,.timer-row,.timeline-entries li,[data-item-id]').length
    let count = countItems()
    const textValues = new WeakMap<HTMLTextAreaElement, string>()
    for (const textarea of node.querySelectorAll('textarea')) textValues.set(textarea, textarea.value)
    // Expanding restores the saved box; do not fit content still laid out at its compact width.
    if (!restoring) {
      const size = measure()
      if (size.height || size.width) measuredSpace.current(size)
    }
    // Content changes resize the window; textarea reflows from zoom or width do not.
    const observer = new MutationObserver(records => {
      const next = countItems()
      let editedNote = false
      for (const record of records) {
        if (record.type !== 'attributes' || !(record.target instanceof HTMLTextAreaElement)) continue
        // A newly selected unit mounts a different field; this is not a text edit.
        if (node!.contains(record.target) && textValues.has(record.target) && textValues.get(record.target) !== record.target.value) editedNote = true
        textValues.set(record.target, record.target.value)
      }
      if (next === count && !editedNote) return
      const removed = next < count
      count = next
      if (id === 'clock') return // Reloj measures timer additions/removals itself.
      const size = measure()
      if (size.height || size.width) measuredSpace.current(size, { fitHeight: removed || editedNote })
    })
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [autoResize, collapsed, id, observesContentSize])
  return <section ref={frame} data-slot="module-frame" className={`${styles.base} module-frame`} data-active={active} data-auto-height={automaticHeight} data-scroll-side={sizeMode === 'feed' ? (id === 'information' || id === 'timeline' ? 'right' : 'left') : sizeMode === 'editable' ? 'right' : undefined} data-collapsed={collapsed} data-icon-only={width === undefined ? iconCollapsed : width <= 29 && collapsed} role="region" aria-label={name}>
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
      <HelpTooltip text={collapseLabel}><Button data-control="module-collapse" className={`${controlStyles.base} module-fit`} aria-label={collapseLabel} aria-expanded={!collapsed} disabled={blocked || !onFit} onClick={event => { if (event.detail < 2) toggleCollapse() }}><Proportions aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip key={generation} text={'Cerrar ' + name}><Button data-control="module-close" className={`${controlStyles.base} module-close`} aria-label={'Cerrar ' + name} disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button></HelpTooltip>
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
      onClickCapture={event => { if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() } }}>
      <div data-slot="module-scaled-content" className="module-scaled-content" data-scale={scale} data-kind={id === 'board' ? 'board' : 'module'} style={{ '--module-zoom': id === 'board' ? 1 : scale } as CSSProperties}>
        <ModuleZoomContext value={{ scale, navigationKey, fitContentRef }}><ModuleSizeContext value={requestSpace}>{children}{actionError && <p data-slot="module-action-error" className="module-action-error" role="alert">{actionError}</p>}</ModuleSizeContext></ModuleZoomContext>
      </div>
    </div>
    <div data-slot="module-controls" className="module-controls" hidden={collapsed} data-zoom-hidden={zoomHidden}>
      <ZoomControl key={generation} variant="module" scale={scale} onChange={value => { if (!blockedRef.current) changeScale(value) }} label={'Zoom de ' + name} disabled={blocked || zoomHidden} side="right" />
      <HelpTooltip text="Redimensionado automático"><Button data-control="module-auto-resize" className={`${controlStyles.base} module-auto-resize`} aria-label="Redimensionado automático" aria-pressed={autoResize} disabled={blocked || !onFit} onClick={toggleAutoResize}><Scan aria-hidden="true" /></Button></HelpTooltip>
    </div>
    {locateToken > 0 && <div key={locateToken} data-slot="module-locator" className="module-locator" aria-hidden="true" />}
  </section>
}
