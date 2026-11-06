import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent, RefObject, TouchEvent as ReactTouchEvent } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { pan, zoomAt } from './viewportMath'
import type { ModuleGesture, ModuleNavigation } from './ViewportContext'

interface Point { x: number; y: number }

function isViewportBackground(target: EventTarget | null, root: HTMLElement | null) {
  return target instanceof Element && root?.contains(target) && !target.closest('[data-module],[data-slot="module-frame"],[data-map-surface],.viewport-scrollbar,button,input,textarea,select,a,[role="button"],[contenteditable="true"]')
}

function findModuleNavigation(target: EventTarget | null, root: HTMLElement | null, navigations: Map<HTMLElement, ModuleNavigation>): ModuleNavigation | null {
  if (!(target instanceof Element) || !root?.contains(target)) return null
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    const navigation = node instanceof HTMLElement ? navigations.get(node) : undefined
    if (navigation) return navigation
  }
  return null
}

export function useViewportGestures(state: ViewportState, size: Size, bounds: Size, onChange: (state: ViewportState) => void, element: RefObject<HTMLDivElement | null>, headerHeight = 0) {
  const pointers = useRef(new Map<number, Point>())
  const origin = useRef({ left: 0, top: 0 })
  const moduleNavigationsRef = useRef(new Map<HTMLElement, ModuleNavigation>())
  const initialNavigation = useRef<ModuleNavigation | null>(null)
  const gestureOwner = useRef<'main' | 'module' | 'cancel' | null>(null)
  const moduleGesture = useRef<{ navigation: ModuleNavigation; scale: number; update: ModuleGesture | null } | null>(null)
  const blockedRef = useRef(false)
  const suppressClick = useRef(false)
  const nativeTouches = useRef<Touch[]>([])
  const [blocked, setBlocked] = useState(false)
  const current = useRef(state)
  const previous = useRef<{ midpoint: Point; distance: number } | null>(null)
  const drag = useRef<{ pointerId: number; point: Point; state: ViewportState; button: number } | null>(null)
  // Both fingers use one reference, so transient clamping between their events
  // cannot change the final scale of a translation.
  const config = useRef({ state, size, bounds, onChange, headerHeight })
  const latest = useRef({ state, size, bounds, onChange, headerHeight })
  useLayoutEffect(() => { latest.current = { state, size, bounds, onChange, headerHeight } }, [state, size, bounds, onChange, headerHeight])
  useLayoutEffect(() => { if (!pointers.current.size) current.current = state }, [state])
  function pair() {
    const [a, b] = [...pointers.current.values()]
    return a && b ? { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) } : null
  }
  function point(event: PointerEvent): Point {
    return { x: event.clientX - origin.current.left, y: event.clientY - origin.current.top }
  }
  function start(event: PointerEvent) {
    // React portals bubble through this component but live outside its surface.
    if (!(event.target instanceof Node) || !element.current?.contains(event.target)) return
    // Leaflet owns gestures beginning on the map; dashboard gestures already
    // in progress still keep their cancellation rules when crossing it.
    if (!pointers.current.size && event.target instanceof Element && event.target.closest('[data-map-surface]')) {
      suppressClick.current = false
      return
    }
    const middle = event.pointerType === 'mouse' && event.button === 1
    if (event.pointerType === 'mouse' && event.button !== 0 && !middle) return
    if (middle) {
      if (!isViewportBackground(event.target, element.current)) return
      // Prevent the browser's middle-button autoscroll before it starts.
      event.preventDefault(); event.stopPropagation()
    }
    if (!pointers.current.size) {
      const rect = element.current?.getBoundingClientRect()
      origin.current = { left: rect?.left ?? 0, top: rect?.top ?? 0 }
      current.current = state
      config.current = { state, size, bounds, onChange, headerHeight }
      suppressClick.current = false
      gestureOwner.current = null
      // Resolve before capture or activation can change the target of later events.
      initialNavigation.current = findModuleNavigation(event.target, element.current, moduleNavigationsRef.current)
      if (isViewportBackground(event.target, element.current)) {
        drag.current = { pointerId: event.pointerId, point: point(event), state, button: middle ? 1 : 0 }
        element.current?.setPointerCapture?.(event.pointerId)
      }
    }
    pointers.current.set(event.pointerId, point(event))
    if (pointers.current.size >= 2) {
      const entering = !blockedRef.current
      drag.current = null
      if (entering) config.current.state = current.current
      blockedRef.current = true
      suppressClick.current = true
      setBlocked(true)
      if (entering) {
        const navigation = initialNavigation.current
        moduleGesture.current = navigation ? { navigation, scale: navigation.scale, update: navigation.beginGesture?.() ?? null } : null
        gestureOwner.current = navigation ? 'module' : 'main'
      } else {
        gestureOwner.current = 'cancel'
      }
      previous.current = pair()
      event.preventDefault(); event.stopPropagation()
      if (entering) {
        // react-draggable/react-resizable listen for mouse/touch completion
        // on document. Complete their transient interaction while the gate
        // rejects persistence, preserving mounted module content.
        const owner = element.current?.ownerDocument
        if (nativeTouches.current.length) owner?.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, touches: [], changedTouches: nativeTouches.current,
        }))
        owner?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      }
      for (const id of pointers.current.keys()) element.current?.setPointerCapture?.(id)
    }
  }
  function finishNativeInteraction(position: Point) {
    const owner = element.current?.ownerDocument
    if (nativeTouches.current.length) owner?.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, touches: [], changedTouches: nativeTouches.current,
    }))
    owner?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: position.x + origin.current.left, clientY: position.y + origin.current.top }))
    nativeTouches.current = []
  }
  function move(event: PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, point(event))
    if (!blockedRef.current) {
      const start = drag.current
      if (!start || start.pointerId !== event.pointerId) return
      const next = point(event), dx = next.x - start.point.x, dy = next.y - start.point.y
      if (!suppressClick.current && Math.hypot(dx, dy) <= 4) return
      suppressClick.current = true
      current.current = pan(start.state, dx, dy, config.current.size, config.current.bounds)
      config.current.onChange(current.current)
      event.preventDefault(); event.stopPropagation()
      return
    }
    event.preventDefault(); event.stopPropagation()
    if (gestureOwner.current === 'cancel') return
    const next = pair(), old = previous.current
    if (next && old && old.distance > 0) {
      const translation = { x: next.midpoint.x - old.midpoint.x, y: next.midpoint.y - old.midpoint.y }
      if (gestureOwner.current === 'module') {
        const owner = moduleGesture.current
        if (!owner || moduleNavigationsRef.current.get(owner.navigation.element) !== owner.navigation) { gestureOwner.current = 'cancel'; return }
        const scale = owner.scale * next.distance / old.distance
        owner.navigation.zoom(scale, { x: old.midpoint.x + origin.current.left, y: old.midpoint.y + origin.current.top })
        owner.update?.(scale, translation)
        return
      }
      const settings = config.current
      const zoomed = zoomAt(settings.state, settings.state.scale * next.distance / old.distance, { x: 0, y: 0 }, settings.size, settings.bounds)
      current.current = translation.x || translation.y ? pan(zoomed, translation.x, translation.y, settings.size, settings.bounds) : zoomed
      settings.onChange(current.current)
    }
  }
  function end(event: PointerEvent) {
    const last = pointers.current.get(event.pointerId)
    // RGL listens for mouse/touch completion, not pointercancel.
    if (event.type === 'pointercancel' && last) finishNativeInteraction(last)
    if (drag.current?.pointerId === event.pointerId) drag.current = null
    pointers.current.delete(event.pointerId)
    if (blockedRef.current) { event.preventDefault(); event.stopPropagation() }
    previous.current = pair()
    if (pointers.current.size < 2 && blockedRef.current) gestureOwner.current = 'cancel'
    if (!pointers.current.size) {
      blockedRef.current = false; setBlocked(false); gestureOwner.current = null
      initialNavigation.current = null; moduleGesture.current = null
    }
  }
  useEffect(() => {
    const node = element.current
    if (!node) return
    function cancelPointer(pointerId: number) {
      node!.dispatchEvent(new window.PointerEvent('pointercancel', { bubbles: true, pointerId }))
    }
    function wheel(event: WheelEvent) {
      if (event.target instanceof Element && event.target.closest('[data-map-surface]')) return
      if (!event.ctrlKey) {
        // Modules and the viewport scrollbars keep their native scrolling.
        if (event.target instanceof Element && event.target.closest('[data-module],[data-slot="module-frame"],.viewport-scrollbar')) return
        event.preventDefault(); event.stopPropagation()
        if (blockedRef.current || pointers.current.size) return
        const settings = latest.current
        const unit = event.deltaMode === 1 ? 16 : 1
        // Some browsers already convert Shift + wheel into deltaX.
        const horizontal = event.shiftKey && event.deltaX === 0
        const dx = (horizontal ? event.deltaY : event.deltaX) * (event.deltaMode === 2 ? settings.size.width : unit)
        const dy = horizontal ? 0 : event.deltaY * (event.deltaMode === 2 ? settings.size.height : unit)
        const next = pan(current.current, -dx, -dy, settings.size, settings.bounds)
        if (next.offsetX !== current.current.offsetX || next.offsetY !== current.current.offsetY) {
          current.current = next
          settings.onChange(next)
        }
        return
      }
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current || pointers.current.size || !event.deltaY) return
      const settings = latest.current
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? settings.size.height : 1
      const factor = Math.exp(-event.deltaY * unit * .002)
      const navigation = findModuleNavigation(event.target, node, moduleNavigationsRef.current)
      if (navigation) { navigation.zoom(navigation.scale * factor, { x: event.clientX, y: event.clientY }); return }
      current.current = zoomAt(current.current, current.current.scale * factor, { x: 0, y: 0 }, settings.size, settings.bounds)
      settings.onChange(current.current)
    }
    function blur() { for (const pointerId of pointers.current.keys()) cancelPointer(pointerId) }
    function release(event: globalThis.PointerEvent) {
      // The first movement after a release outside the browser can target any surface.
      // Releasing one mouse button can emit pointermove while another stays down.
      const active = drag.current?.pointerId === event.pointerId ? drag.current : null
      const released = active ? !(event.buttons & (active.button === 1 ? 4 : 1)) : event.buttons === 0
      if (event.pointerType === 'mouse' && released && pointers.current.has(event.pointerId)) cancelPointer(event.pointerId)
    }
    node.addEventListener('wheel', wheel, { capture: true, passive: false })
    window.addEventListener('blur', blur)
    node.ownerDocument.addEventListener('pointermove', release, true)
    return () => {
      node.removeEventListener('wheel', wheel, true)
      window.removeEventListener('blur', blur)
      node.ownerDocument.removeEventListener('pointermove', release, true)
    }
  }, [element])
  return {
    blocked, blockedRef, moduleNavigationsRef,
    handlers: {
      onAuxClickCapture: (event: ReactMouseEvent) => {
        if (event.button === 1 && isViewportBackground(event.target, element.current)) { event.preventDefault(); event.stopPropagation() }
      },
      onPointerDownCapture: start, onPointerMoveCapture: move,
      onPointerUpCapture: end, onPointerCancelCapture: end,
      onLostPointerCapture: (event: PointerEvent) => {
        // Transferring a child's capture to the viewport does not lift a finger.
        if (event.target === event.currentTarget) end(event)
      },
      onTouchStartCapture: (event: ReactTouchEvent) => {
        if (!pointers.current.size && !blockedRef.current && event.target instanceof Element && event.target.closest('[data-map-surface]')) return
        if (blockedRef.current || event.touches.length >= 2) event.stopPropagation()
        else nativeTouches.current = Array.from(event.nativeEvent.touches)
      },
      onTouchMoveCapture: (event: ReactTouchEvent) => {
        if (blockedRef.current) event.stopPropagation()
        else nativeTouches.current = Array.from(event.nativeEvent.touches)
      },
      onTouchEndCapture: (event: ReactTouchEvent) => {
        if (suppressClick.current) event.stopPropagation()
        if (!event.touches.length) nativeTouches.current = []
      },
      onClickCapture: (event: ReactMouseEvent) => {
        // After lifting both fingers, keyboard/Radix activation (detail=0)
        // remains available; residual pointer clicks are still suppressed.
        if (blockedRef.current || (suppressClick.current && event.detail !== 0)) { event.preventDefault(); event.stopPropagation() }
      },
    },
  }
}
