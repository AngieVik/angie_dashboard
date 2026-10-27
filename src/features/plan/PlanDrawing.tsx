import { useEffect, useLayoutEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { GeographicPosition, PlanStroke } from '../../domain/document/types'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'
import { useMapSurface } from '../map/MapSurfaceContext'
import type { PlanMode } from './PlanModule'
import styles from './PlanDrawing.module.css'

function strokeLayer(map: L.Map, points: GeographicPosition[], color: string, width: number) {
  const pane = map.getPane('operational-plan-strokes') ?? map.createPane('operational-plan-strokes')
  pane.style.zIndex = '450'
  pane.style.pointerEvents = 'none'
  return L.polyline(points.map(point => L.latLng(point.latitude, point.longitude)), { pane: 'operational-plan-strokes', color, weight: width, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round' })
}

export function PlanDrawing({ navigationKey, mode, color, width, strokes, placeId, onStroke, onErase, onPlace }: {
  navigationKey: string
  mode: PlanMode
  color: string
  width: number
  strokes: PlanStroke[]
  placeId: string | null
  onStroke: (stroke: PlanStroke) => boolean
  onErase: (id: string) => boolean
  onPlace: (id: string, point: GeographicPosition) => void
}) {
  const { mapRef } = useMapSurface()
  const surface = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ strokes, onStroke, onErase, onPlace })
  const { blocked, blockedRef } = useViewportInteraction()
  const { scale: zoom } = useModuleZoom()
  const active = !blocked && (mode === 'draw' || mode === 'erase' || mode === 'place' && placeId !== null)
  useLayoutEffect(() => { callbacks.current = { strokes, onStroke, onErase, onPlace } }, [strokes, onStroke, onErase, onPlace])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.layerGroup().addTo(map)
    for (const stroke of strokes) strokeLayer(map, stroke.points, stroke.color, stroke.width * zoom).addTo(group)
    return () => { group.remove() }
  }, [mapRef, navigationKey, strokes, zoom])

  useEffect(() => {
    const map = mapRef.current, node = surface.current
    if (!map || !node || !active) return
    const pointers = new Set<number>()
    let interrupted = false
    let gesture: { pointerId: number; start: L.Point; last: L.Point; points: GeographicPosition[]; draft: L.Polyline | null; moved: boolean } | null = null
    function cancel() {
      const current = gesture
      gesture = null
      current?.draft?.remove()
      if (current && node!.hasPointerCapture(current.pointerId)) node!.releasePointerCapture(current.pointerId)
    }
    function track(event: globalThis.PointerEvent) {
      if (event.pointerType === 'touch') pointers.add(event.pointerId)
      if (pointers.size > 1 || gesture && gesture.pointerId !== event.pointerId) { interrupted = true; cancel() }
    }
    function release(event: globalThis.PointerEvent) {
      pointers.delete(event.pointerId)
      if (!pointers.size) interrupted = false
      if (event.type === 'pointercancel') cancel()
    }
    function coordinate(event: globalThis.PointerEvent): GeographicPosition {
      const point = map!.mouseEventToLatLng(event).wrap()
      return { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, point.lat)), longitude: point.lng }
    }
    function down(event: globalThis.PointerEvent) {
      if (blockedRef.current || interrupted || event.button !== 0 || mode === 'place' && !placeId) return
      event.preventDefault(); event.stopPropagation(); cancel()
      const start = map!.mouseEventToContainerPoint(event), point = coordinate(event)
      const draft = mode === 'draw' ? strokeLayer(map!, [point, point], color, width * zoom).addTo(map!) : null
      gesture = { pointerId: event.pointerId, start, last: start, points: [point], draft, moved: false }
      node!.setPointerCapture(event.pointerId)
    }
    function append(event: globalThis.PointerEvent) {
      if (!gesture) return
      const next = map!.mouseEventToContainerPoint(event)
      if (next.distanceTo(gesture.start) >= 4) gesture.moved = true
      if (mode !== 'draw' || next.distanceTo(gesture.last) < 2) return
      if (gesture.points.length >= 50000) return
      const point = coordinate(event)
      gesture.points.push(point)
      gesture.last = next
      gesture.draft?.addLatLng([point.latitude, point.longitude])
    }
    function move(event: globalThis.PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (blockedRef.current || interrupted) { cancel(); return }
      event.preventDefault(); event.stopPropagation(); append(event)
    }
    function up(event: globalThis.PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (blockedRef.current || interrupted) { cancel(); return }
      event.preventDefault(); event.stopPropagation(); append(event)
      const current = gesture
      cancel()
      if (mode === 'draw') {
        if (current.points.length === 1) current.points.push({ ...current.points[0]! })
        callbacks.current.onStroke({ id: crypto.randomUUID(), color, width, points: current.points })
      } else if (!current.moved && mode === 'place' && placeId) {
        callbacks.current.onPlace(placeId, coordinate(event))
      } else if (!current.moved && mode === 'erase') {
        const point = map!.mouseEventToContainerPoint(event)
        // Remove only the topmost annotation hit; the base map, pins and GPX are independent.
        const hit = callbacks.current.strokes.findLast(stroke => {
          const points = stroke.points.map(point => map!.latLngToContainerPoint([point.latitude, point.longitude]))
          return points.some((end, index) => index > 0 && L.LineUtil.pointToSegmentDistance(point, points[index - 1]!, end) <= Math.max(8, stroke.width * zoom / 2 + 4))
        })
        if (hit) callbacks.current.onErase(hit.id)
      }
    }
    function lost(event: globalThis.PointerEvent) { if (gesture?.pointerId === event.pointerId) cancel() }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') cancel() }
    function wheel(event: WheelEvent) { event.preventDefault(); event.stopPropagation() }
    document.addEventListener('pointerdown', track, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    document.addEventListener('keydown', key, true)
    window.addEventListener('blur', cancel)
    map.on('movestart zoomstart', cancel)
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', lost)
    node.addEventListener('lostpointercapture', lost)
    node.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancel()
      document.removeEventListener('pointerdown', track, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', cancel)
      map.off('movestart zoomstart', cancel)
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', lost)
      node.removeEventListener('lostpointercapture', lost)
      node.removeEventListener('wheel', wheel)
    }
  }, [mapRef, navigationKey, active, blockedRef, mode, color, width, zoom, placeId])
  return <div ref={surface} className={`plan-drawing ${styles.base}`} data-map-surface data-active={active} data-mode={mode} aria-hidden="true" onClick={event => event.stopPropagation()} />
}
