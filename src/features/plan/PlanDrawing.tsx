import { useEffect, useLayoutEffect, useRef } from 'react'
import * as L from 'leaflet'
import { Crosshair } from 'lucide-react'
import { DrawingCursor } from '@/components/DrawingCursor'
import type { GeographicPosition, PlanStroke } from '../../domain/document/types'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'
import { useMapSurface } from '../map/MapSurfaceContext'
import { coordinateNearLongitude, longitudeShift, pathLongitudeBounds, unwrapLongitude, unwrapPath } from '../map/longitudeGeometry'
import type { PlanMode } from './planTypes'
import styles from './PlanDrawing.module.css'
import { ghostOpacity } from '../drawing/shapeGeometry'
import { INPUT_BUDGETS, budgetIssue } from '../../domain/input/inputBudgets'

function strokeLayer(map: L.Map, points: L.LatLngTuple[], color: string, width: number, opacity: number) {
  const pane = map.getPane('operational-plan-strokes') ?? map.createPane('operational-plan-strokes')
  pane.style.zIndex = '450'
  pane.style.pointerEvents = 'none'
  return L.polyline(points, { pane: 'operational-plan-strokes', color, weight: width, opacity, interactive: false, lineCap: 'round', lineJoin: 'round' })
}

// Points of a pixel stroke around its anchor, as seen now.
function anchoredPath(map: L.Map, stroke: Extract<PlanStroke, { anchor: GeographicPosition }>): [number, number][] {
  const c = map.latLngToContainerPoint([stroke.anchor.latitude, unwrapLongitude(stroke.anchor.longitude, map.getCenter().lng)])
  return stroke.points.map(o => { const p = map.containerPointToLatLng([c.x + o.x, c.y + o.y]); return [p.lat, p.lng] })
}

export function PlanDrawing({ navigationKey, mode, color, width, fixed, strokes, faded, placeId, onStroke, onPlace, onReject }: {
  navigationKey: string
  mode: PlanMode
  color: string
  width: number
  fixed: boolean
  strokes: PlanStroke[]
  /** Strokes being moved or turned, drawn faded under their new version. */
  faded: string[]
  placeId: string | null
  onStroke: (stroke: PlanStroke) => boolean
  onPlace: (id: string, point: GeographicPosition) => void
  onReject: (message: string) => void
}) {
  const { mapRef } = useMapSurface()
  const surface = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ strokes, onStroke, onPlace, onReject })
  const { blocked, blockedRef } = useViewportInteraction()
  const { scale: zoom } = useModuleZoom()
  const active = !blocked && (mode === 'pen' || mode === 'place' && placeId !== null)
  useLayoutEffect(() => { callbacks.current = { strokes, onStroke, onPlace, onReject } }, [strokes, onStroke, onPlace, onReject])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.layerGroup().addTo(map)
    const layers = strokes.filter(stroke => stroke.points.length).map(stroke => {
      const points = stroke.anchor ? anchoredPath(map, stroke) : unwrapPath(stroke.points), [west, east] = pathLongitudeBounds(points)
      const shift = stroke.anchor ? 0 : longitudeShift(west, east, map.getCenter().lng)
      const first = points[0]!, weight = stroke.width * zoom, opacity = faded.includes(stroke.id) ? ghostOpacity : 1
      const layer = points.every(([lat, lng]) => lat === first[0] && lng === first[1])
        ? L.circleMarker([first[0], first[1] + shift], { radius: weight / 2, stroke: false, fillColor: stroke.color, fillOpacity: opacity, interactive: false })
        : strokeLayer(map, points.map(([lat, lng]) => [lat, lng + shift]), stroke.color, weight, opacity)
      layer.addTo(group)
      return { stroke, points, west, east, shift, layer }
    })
    function positionStrokes() {
      for (const item of layers) {
        if (item.stroke.anchor) {
          const points = anchoredPath(map!, item.stroke)
          if (item.layer instanceof L.CircleMarker) item.layer.setLatLng(points[0]!)
          else item.layer.setLatLngs(points)
          continue
        }
        const shift = longitudeShift(item.west, item.east, map!.getCenter().lng)
        if (shift === item.shift) continue
        item.shift = shift
        if (item.layer instanceof L.CircleMarker) item.layer.setLatLng([item.points[0]![0], item.points[0]![1] + shift])
        else item.layer.setLatLngs(item.points.map(([lat, lng]) => [lat, lng + shift]))
      }
    }
    map.on('moveend', positionStrokes)
    return () => { map.off('moveend', positionStrokes); group.remove() }
  }, [mapRef, navigationKey, strokes, zoom, faded])

  useEffect(() => {
    const map = mapRef.current, node = surface.current
    if (!map || !node || !active) return
    const pointers = new Set<number>()
    let interrupted = false
    let gesture: { pointerId: number; start: L.Point; last: L.Point; points: GeographicPosition[]; screen: L.Point[]; draft: L.Polyline | null; longitude: number; moved: boolean } | null = null
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
      const visual = coordinateNearLongitude(point, map!.mouseEventToLatLng(event).lng)
      const draft = mode === 'pen' ? strokeLayer(map!, [visual, visual], color, width * zoom, 1).addTo(map!) : null
      gesture = { pointerId: event.pointerId, start, last: start, points: [point], screen: [start], draft, longitude: visual[1], moved: false }
      node!.setPointerCapture(event.pointerId)
    }
    function append(event: globalThis.PointerEvent) {
      if (!gesture) return
      const next = map!.mouseEventToContainerPoint(event)
      if (next.distanceTo(gesture.start) >= 4) gesture.moved = true
      if (mode !== 'pen' || next.distanceTo(gesture.last) < 2) return
      if (gesture.points.length >= INPUT_BUDGETS.strokePoints) {
        callbacks.current.onReject(budgetIssue(`plan.strokes[${callbacks.current.strokes.length}].points`, INPUT_BUDGETS.strokePoints, 'puntos').message)
        cancel(); return
      }
      const point = coordinate(event)
      gesture.points.push(point)
      gesture.screen.push(next)
      gesture.last = next
      const visual = coordinateNearLongitude(point, gesture.longitude)
      gesture.longitude = visual[1]
      gesture.draft?.addLatLng(visual)
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
      if (!current) return
      if (mode === 'pen') {
        if (current.points.length === 1) { current.points.push({ ...current.points[0]! }); current.screen.push(current.screen[0]!) }
        callbacks.current.onStroke(fixed ? { id: crypto.randomUUID(), color, width, ...anchor(current.screen) }
          : { id: crypto.randomUUID(), color, width, points: current.points })
      } else if (!current.moved && mode === 'place' && placeId) {
        callbacks.current.onPlace(placeId, coordinate(event))
      }
    }
    // A pixel stroke is anchored at the centre of its box and keeps pixel offsets.
    function anchor(points: L.Point[]) {
      const xs = points.map(p => p.x), ys = points.map(p => p.y)
      const c = L.point((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2), at = map!.containerPointToLatLng(c).wrap()
      return { anchor: { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, at.lat)), longitude: at.lng },
        points: points.map(p => ({ x: p.x - c.x, y: p.y - c.y })) }
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
  }, [mapRef, navigationKey, active, blockedRef, mode, color, width, fixed, zoom, placeId])
  return <div ref={surface} className={`plan-drawing ${styles.base}`} data-map-surface data-active={active} data-mode={mode} aria-hidden="true" onClick={event => event.stopPropagation()}>
    {active && mode === 'place' && <DrawingCursor diameter={20}><Crosshair size={20} /></DrawingCursor>}
    {active && mode === 'pen' && <DrawingCursor diameter={width * zoom} color={color} />}
  </div>
}
