import { useEffect, useLayoutEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { DocumentElement, GeographicPosition, PlanPin, Position } from '../../domain/document/types'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { getPinBox, ICON_CATALOG } from '../elements/iconCatalog'
import { getPinAnchorPoint, getPinNameLayout, getRotatedPinBox, pinNameLines, PIN_NAME_COLORS, pinTransform } from '../elements/pinPresentation'
import { clampAssetScale } from '../elements/elementCommands'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'
import { useMapSurface } from '../map/MapSurfaceContext'
import type { PlanMode } from './PlanModule'

// A shared reference keeps equal pin scales equal regardless of placement zoom.
const PIN_REFERENCE_ZOOM = 16
const PIN_BASE_SCALE = 6

export function PlanPins({ navigationKey, elements, pins, mode, selectedId, focusRequest, onSelect, onEdit, onMove, onNameMove, onScale }: {
  navigationKey: string
  elements: DocumentElement[]
  pins: PlanPin[]
  mode: PlanMode
  selectedId: string | null
  focusRequest: number
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onMove: (id: string, point: GeographicPosition) => boolean
  onNameMove: (id: string, offset: Position) => boolean
  onScale: (id: string, scale: number) => boolean
}) {
  const { mapRef, suppressSelection } = useMapSurface()
  const { blocked, blockedRef } = useViewportInteraction()
  const { scale: zoom } = useModuleZoom()
  const callbacks = useRef({ selectedId, onSelect, onEdit, onMove, onNameMove, onScale })
  const renderedPins = useRef(new Map<string, L.Marker>())
  const focusedPin = useRef<{ id: string; part: 'pin' | 'name' | 'resize' } | null>(null)
  const lastFocusRequest = useRef(0)
  useLayoutEffect(() => { callbacks.current = { selectedId, onSelect, onEdit, onMove, onNameMove, onScale } }, [selectedId, onSelect, onEdit, onMove, onNameMove, onScale])
  useEffect(() => {
    const map = mapRef.current
    if (blocked || !map || lastFocusRequest.current === focusRequest) return
    lastFocusRequest.current = focusRequest
    if (selectedId) {
      const pin = pins.find(pin => pin.visible && pin.elementId.toLowerCase() === selectedId.toLowerCase())
      if (pin) map.panTo([pin.latitude, pin.longitude], { animate: false })
      return
    }
    const bounds = L.latLngBounds([])
    const factor = PIN_BASE_SCALE * zoom
    for (const pin of pins) {
      if (!pin.visible) continue
      const element = elements.find(element => element.id.toLowerCase() === pin.elementId.toLowerCase())
      if (!element) continue
      const box = getPinBox(element.visual), rotated = getRotatedPinBox(element.visual)
      const anchor = getPinAnchorPoint(element.visual, element.pinAnchor)
      const center = { x: box.width / 2 - anchor.x, y: box.height / 2 - anchor.y }
      let left = center.x - rotated.width / 2, right = center.x + rotated.width / 2
      let top = center.y - rotated.height / 2, bottom = center.y + rotated.height / 2
      if (!element.nameHidden) {
        const label = getPinNameLayout(element)
        const node = renderedPins.current.get(element.id)?.getElement()?.querySelector<HTMLElement>('.plan-pin-name')
        const estimatedWidth = Math.max(...pinNameLines(element.name).map(line => [...line].length)) * (element.nameFontSize ?? 16) * .75 + 8 * element.visual.scale
        const width = node?.offsetWidth ? node.offsetWidth / factor : estimatedWidth
        const height = node?.offsetHeight ? node.offsetHeight / factor : label.height
        left = Math.min(left, center.x + label.offset.x - width / 2)
        right = Math.max(right, center.x + label.offset.x + width / 2)
        top = Math.min(top, center.y + label.offset.y - height / 2)
        bottom = Math.max(bottom, center.y + label.offset.y + height / 2)
      }
      const point = map.project([pin.latitude, pin.longitude], PIN_REFERENCE_ZOOM)
      bounds.extend(map.unproject(point.add([left * factor - 4, top * factor - 4]), PIN_REFERENCE_ZOOM))
      bounds.extend(map.unproject(point.add([right * factor + 4, bottom * factor + 4]), PIN_REFERENCE_ZOOM))
    }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false })
  }, [focusRequest, pins, elements, selectedId, blocked, mapRef, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.layerGroup().addTo(map)
    const rendered = renderedPins.current
    const disposers: (() => void)[] = []
    const enabled = mode === 'select' && !blocked
    const pointers = new Set<number>()
    let interrupted = false
    let drag: {
      kind: 'move' | 'name' | 'resize'; marker: L.Marker; node: HTMLElement; pointerId: number
      origin: L.LatLng; start: L.Point; moved: boolean; scale: number; nameOffset: Position
      nextScale: number | null; nextNameOffset: Position | null; reset: () => void
    } | null = null
    function cancel() {
      const current = drag
      drag = null
      if (!current) return
      current.marker.setLatLng(current.origin)
      current.reset()
      if (current.node.hasPointerCapture(current.pointerId)) current.node.releasePointerCapture(current.pointerId)
    }
    function interrupt(event: globalThis.PointerEvent) {
      if (event.pointerType === 'touch') pointers.add(event.pointerId)
      if (pointers.size > 1 || drag && event.pointerId !== drag.pointerId) { interrupted = true; cancel() }
    }
    function release(event: globalThis.PointerEvent) {
      pointers.delete(event.pointerId)
      if (!pointers.size) interrupted = false
      if (event.type === 'pointercancel') cancel()
    }
    document.addEventListener('pointerdown', interrupt, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    window.addEventListener('blur', cancel)
    map.on('movestart zoomstart', cancel)
    for (const pin of pins) {
      const resource = elements.find(element => element.id.toLowerCase() === pin.elementId.toLowerCase())
      if (!pin.visible || !resource) continue
      const element = resource
      const factor = PIN_BASE_SCALE * zoom
      const box = getPinBox(element.visual)
      const anchor = getPinAnchorPoint(element.visual, element.pinAnchor)
      let mapScale = map.getZoomScale(map.getZoom(), PIN_REFERENCE_ZOOM)
      const content = document.createElement('div')
      content.className = 'plan-pin-content'
      content.style.transform = `scale(${mapScale})`
      content.style.transformOrigin = `${anchor.x * factor}px ${anchor.y * factor}px`
      const selected = element.id === callbacks.current.selectedId
      content.dataset.selected = String(selected)
      content.dataset.enabled = String(enabled)
      content.style.pointerEvents = enabled ? 'auto' : 'none'
      const visual = document.createElement(element.visual.type === 'asset' ? 'img' : 'span')
      visual.className = 'plan-pin-visual'
      visual.style.transform = pinTransform(element.visual)
      visual.setAttribute('aria-hidden', 'true')
      if (visual instanceof HTMLImageElement && element.visual.type === 'asset') {
        visual.src = ICON_CATALOG[element.visual.assetId].path
        visual.alt = ''
        visual.draggable = false
      } else if (element.visual.type === 'emoji') {
        visual.textContent = element.visual.value
        visual.style.fontSize = `${48 * element.visual.scale * factor}px`
      }
      content.append(visual)
      function nameLayout(scale = element.visual.scale) {
        return getPinNameLayout({ ...element, visual: { ...element.visual, scale } })
      }
      let name: HTMLButtonElement | null = null
      function positionName(offset: Position) {
        if (!name) return
        name.style.left = `calc(50% + ${offset.x * factor}px)`
        name.style.top = `calc(50% + ${offset.y * factor}px)`
      }
      if (!element.nameHidden) {
        name = document.createElement('button')
        name.type = 'button'
        name.className = 'plan-pin-name'
        name.disabled = !enabled
        name.setAttribute('aria-label', 'Mover nombre de ' + element.name)
        name.setAttribute('aria-pressed', String(selected))
        name.textContent = pinNameLines(element.name).join('\n')
        const theme = PIN_NAME_COLORS[element.nameColor ?? 'dark']
        positionName(nameLayout().offset)
        name.style.fontSize = `${(element.nameFontSize ?? 16) * factor}px`
        name.style.padding = `${element.visual.scale * factor}px ${4 * element.visual.scale * factor}px`
        name.style.backgroundColor = theme.backgroundColor
        name.style.color = theme.color
        content.append(name)
      }
      const resizeHandle = document.createElement('button')
      resizeHandle.type = 'button'
      resizeHandle.className = 'plan-pin-resize'
      resizeHandle.disabled = !enabled
      resizeHandle.setAttribute('aria-label', 'Redimensionar ' + element.name)
      content.append(resizeHandle)
      const resizeCorner = { right: anchor.x <= box.width / 2, bottom: anchor.y <= box.height / 2 }
      resizeHandle.style.left = resizeCorner.right ? 'auto' : '0'
      resizeHandle.style.right = resizeCorner.right ? '0' : 'auto'
      resizeHandle.style.top = resizeCorner.bottom ? 'auto' : '0'
      resizeHandle.style.bottom = resizeCorner.bottom ? '0' : 'auto'
      resizeHandle.style.cursor = resizeCorner.right === resizeCorner.bottom ? 'nwse-resize' : 'nesw-resize'
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: L.divIcon({ className: 'plan-pin', html: content, iconSize: [box.width * factor, box.height * factor], iconAnchor: [anchor.x * factor, anchor.y * factor] }),
        interactive: enabled, keyboard: enabled, bubblingMouseEvents: false, zIndexOffset: selected ? 700 : 500,
      }).addTo(group)
      rendered.set(element.id, marker)
      const node = marker.getElement()
      if (!node) continue
      node.setAttribute('role', 'group')
      node.setAttribute('aria-label', element.name + (element.isUnit && element.operational.status ? ' · ' + element.operational.status : ''))
      // Only the scaled content should receive hits, not the unscaled marker box.
      node.style.pointerEvents = 'none'
      node.tabIndex = enabled ? 0 : -1
      L.DomEvent.disableClickPropagation(node)
      if (focusedPin.current?.id === element.id && enabled) {
        const target = focusedPin.current.part === 'name' && name ? name : focusedPin.current.part === 'resize' && selected ? resizeHandle : node
        target.focus({ preventScroll: true }); focusedPin.current = null
      }
      let skipClick = false
      function resize(scale: number) {
        const resizedVisual = { ...element.visual, scale }
        const size = getPinBox(resizedVisual), anchor = getPinAnchorPoint(resizedVisual, element.pinAnchor)
        node!.style.width = `${size.width * factor}px`
        node!.style.height = `${size.height * factor}px`
        node!.style.marginLeft = `${-anchor.x * factor}px`
        node!.style.marginTop = `${-anchor.y * factor}px`
        content.style.transformOrigin = `${anchor.x * factor}px ${anchor.y * factor}px`
        if (element.visual.type === 'emoji') visual.style.fontSize = `${48 * scale * factor}px`
        if (name) name.style.padding = `${scale * factor}px ${4 * scale * factor}px`
        positionName(nameLayout(scale).offset)
      }
      function updateMapZoom() {
        mapScale = map!.getZoomScale(map!.getZoom(), PIN_REFERENCE_ZOOM)
        content.style.transform = `scale(${mapScale})`
      }
      function animateMapZoom(event: L.ZoomAnimEvent) {
        mapScale = map!.getZoomScale(event.zoom, PIN_REFERENCE_ZOOM)
        content.style.transform = `scale(${mapScale})`
      }
      map.on('zoom zoomend', updateMapZoom)
      map.on('zoomanim', animateMapZoom)
      function click(event: MouseEvent) {
        event.stopPropagation()
        if (skipClick) { skipClick = false; return }
        if (enabled && !blockedRef.current && !suppressSelection.current) callbacks.current.onSelect(element.id)
      }
      function edit(event: MouseEvent) {
        event.preventDefault(); event.stopPropagation()
        if (event.target instanceof Element && event.target.closest('.plan-pin-resize')) return
        if (enabled && !blockedRef.current && !suppressSelection.current) callbacks.current.onEdit(element.id)
      }
      function down(event: globalThis.PointerEvent) {
        if (!enabled || interrupted || blockedRef.current || suppressSelection.current || event.button !== 0) return
        const target = event.target instanceof Element ? event.target : null
        const kind = target?.closest('.plan-pin-resize') ? 'resize' : target?.closest('.plan-pin-name') ? 'name' : 'move'
        event.preventDefault(); event.stopPropagation(); cancel()
        const nameOffset = nameLayout().offset
        drag = { kind, marker, node: node!, pointerId: event.pointerId, origin: marker.getLatLng(), start: map!.mouseEventToContainerPoint(event), moved: false,
          scale: element.visual.scale, nameOffset, nextScale: null, nextNameOffset: null, reset: () => { resize(element.visual.scale); positionName(nameOffset) } }
        node!.setPointerCapture(event.pointerId)
      }
      function move(event: globalThis.PointerEvent) {
        if (!drag || drag.pointerId !== event.pointerId) return
        if (interrupted || blockedRef.current || suppressSelection.current) { cancel(); return }
        const delta = map!.mouseEventToContainerPoint(event).subtract(drag.start)
        if (!drag.moved && delta.distanceTo(L.point(0, 0)) < 3) return
        drag.moved = true
        if (drag.kind === 'name') {
          drag.nextNameOffset = { x: drag.nameOffset.x + delta.x / (factor * mapScale), y: drag.nameOffset.y + delta.y / (factor * mapScale) }
          positionName(drag.nextNameOffset)
        } else if (drag.kind === 'resize') {
          const base = getPinBox({ ...element.visual, scale: 1 })
          const anchor = getPinAnchorPoint({ ...element.visual, scale: 1 }, element.pinAnchor)
          const x = (resizeCorner.right ? base.width : 0) - anchor.x, y = (resizeCorner.bottom ? base.height : 0) - anchor.y
          drag.nextScale = clampAssetScale(drag.scale + (delta.x * x + delta.y * y) / (factor * mapScale * (x ** 2 + y ** 2)))
          resize(drag.nextScale)
        } else {
          const point = map!.containerPointToLatLng(map!.latLngToContainerPoint(drag.origin).add(delta)).wrap()
          marker.setLatLng([Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, point.lat)), point.lng])
        }
      }
      function up(event: globalThis.PointerEvent) {
        if (!drag || drag.pointerId !== event.pointerId) return
        if (interrupted || blockedRef.current || suppressSelection.current) { cancel(); return }
        const current = drag
        drag = null
        if (node!.hasPointerCapture(event.pointerId)) node!.releasePointerCapture(event.pointerId)
        const point = marker.getLatLng().wrap()
        skipClick = true
        const saved = !current.moved || (current.kind === 'name' && current.nextNameOffset
          ? callbacks.current.onNameMove(element.id, current.nextNameOffset)
          : current.kind === 'resize' && current.nextScale !== null ? callbacks.current.onScale(element.id, current.nextScale)
            : current.kind === 'move' ? callbacks.current.onMove(element.id, { latitude: point.lat, longitude: point.lng }) : true)
        if (!saved) { marker.setLatLng(current.origin); current.reset(); return }
        callbacks.current.onSelect(element.id)
      }
      function lost(event: globalThis.PointerEvent) { if (drag?.pointerId === event.pointerId) cancel() }
      function key(event: KeyboardEvent) {
        if (!enabled || interrupted || blockedRef.current || suppressSelection.current) return
        if (event.key === 'Escape') { cancel(); return }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation(); callbacks.current.onSelect(element.id); return
        }
        const offsets: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
        const offset = offsets[event.key]
        if (!offset) return
        event.preventDefault(); event.stopPropagation()
        if (event.target instanceof Element && event.target.closest('.plan-pin-name')) {
          const previous = nameLayout().offset
          if (callbacks.current.onNameMove(element.id, { x: previous.x + offset[0] / (factor * mapScale), y: previous.y + offset[1] / (factor * mapScale) })) callbacks.current.onSelect(element.id)
          return
        }
        if (event.target instanceof Element && event.target.closest('.plan-pin-resize')) {
          const scale = clampAssetScale(element.visual.scale + (offset[0] + offset[1] > 0 ? .05 : -.05))
          if (callbacks.current.onScale(element.id, scale)) callbacks.current.onSelect(element.id)
          return
        }
        const point = map!.containerPointToLatLng(map!.latLngToContainerPoint(marker.getLatLng()).add(L.point(offset))).wrap()
        if (callbacks.current.onMove(element.id, { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, point.lat)), longitude: point.lng })) callbacks.current.onSelect(element.id)
      }
      node.addEventListener('pointerdown', down)
      node.addEventListener('pointermove', move)
      node.addEventListener('pointerup', up)
      node.addEventListener('pointercancel', lost)
      node.addEventListener('lostpointercapture', lost)
      node.addEventListener('keydown', key)
      node.addEventListener('click', click)
      node.addEventListener('dblclick', edit)
      disposers.push(() => {
        map!.off('zoom zoomend', updateMapZoom)
        map!.off('zoomanim', animateMapZoom)
        if (node.contains(document.activeElement)) {
          focusedPin.current = { id: element.id, part: document.activeElement === name ? 'name' : document.activeElement === resizeHandle ? 'resize' : 'pin' }
        }
        node.removeEventListener('pointerdown', down)
        node.removeEventListener('pointermove', move)
        node.removeEventListener('pointerup', up)
        node.removeEventListener('pointercancel', lost)
        node.removeEventListener('lostpointercapture', lost)
        node.removeEventListener('keydown', key)
        node.removeEventListener('click', click)
        node.removeEventListener('dblclick', edit)
        marker.off()
      })
    }
    return () => {
      cancel()
      document.removeEventListener('pointerdown', interrupt, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      window.removeEventListener('blur', cancel)
      map.off('movestart zoomstart', cancel)
      disposers.forEach(dispose => dispose())
      rendered.clear()
      group.remove()
    }
  }, [mapRef, suppressSelection, navigationKey, elements, pins, mode, blocked, blockedRef, zoom])
  useEffect(() => {
    for (const [id, marker] of renderedPins.current) {
      const selected = id === selectedId
      const node = marker.getElement()
      const content = node?.querySelector<HTMLElement>('.plan-pin-content')
      if (content) content.dataset.selected = String(selected)
      node?.querySelector('.plan-pin-name')?.setAttribute('aria-pressed', String(selected))
      marker.setZIndexOffset(selected ? 700 : 500)
    }
  }, [selectedId, elements, pins, mode, blocked, zoom, navigationKey])
  return null
}
