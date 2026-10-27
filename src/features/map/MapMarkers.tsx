import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { Focus, Palette, Pencil, Plus, Trash, X } from 'lucide-react'
import * as L from 'leaflet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HelpTooltip } from '@/components/ui/tooltip'
import type { MapMarker } from '../../domain/document/types'
import { MAX_MAP_LATITUDE } from './mapNavigation'
import mapStyles from './map.module.css'
import styles from './MapMarkers.module.css'

export function MapMarkers({ mapRef, navigationKey, markers, blocked, blockedRef, suppressSelection, menuId, open, selectedId, canAdd, onAdd, onClose, onEdit, onRemove, onSelect, onCenter }: {
  mapRef: RefObject<L.Map | null>
  navigationKey: string
  markers: MapMarker[]
  blocked: boolean
  blockedRef: RefObject<boolean>
  suppressSelection: RefObject<boolean>
  menuId: string
  open: boolean
  selectedId: string | null
  canAdd: boolean
  onAdd: () => void
  onClose: () => void
  onEdit: (id: string, patch: Partial<Omit<MapMarker, 'id'>>) => boolean
  onRemove: (id: string) => void
  onSelect: (marker: MapMarker) => void
  onCenter: (marker: MapMarker) => void
}) {
  const callbacks = useRef({ onEdit, onSelect })
  const focusedMarker = useRef<string | null>(null)
  const colorInput = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const listDrag = useRef<{ node: HTMLUListElement; pointerId: number; startY: number; scrollTop: number; scale: number; moved: boolean } | null>(null)
  const suppressListClick = useRef(false)
  if (editingId !== null && (selectedId !== editingId || !open)) setEditingId(null)
  useLayoutEffect(() => { callbacks.current = { onEdit, onSelect } }, [onEdit, onSelect])

  useEffect(() => {
    function release() {
      const current = listDrag.current
      listDrag.current = null
      if (!current) return
      delete current.node.dataset.dragging
      if (current.node.hasPointerCapture(current.pointerId)) current.node.releasePointerCapture(current.pointerId)
    }
    function interrupt(event: globalThis.PointerEvent) {
      const current = listDrag.current
      if (!current || current.pointerId === event.pointerId) return
      suppressListClick.current = true
      release()
    }
    function end(event: globalThis.PointerEvent) {
      if (listDrag.current?.pointerId === event.pointerId) {
        if (event.type === 'pointercancel') suppressListClick.current = true
        release()
      }
    }
    document.addEventListener('pointerdown', interrupt, true)
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => {
      document.removeEventListener('pointerdown', interrupt, true)
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
      release()
    }
  }, [open])

  function startListScroll(event: PointerEvent<HTMLUListElement>) {
    if (blockedRef.current || !event.isPrimary || event.button !== 0) return
    suppressListClick.current = false
    const node = event.currentTarget
    // Leave name editing and the native scrollbar to the browser.
    if (event.target === node || event.target instanceof Element && event.target.closest('input')) return
    if (node.scrollHeight <= node.clientHeight) return
    event.stopPropagation()
    listDrag.current = { node, pointerId: event.pointerId, startY: event.clientY, scrollTop: node.scrollTop,
      scale: node.offsetHeight ? node.getBoundingClientRect().height / node.offsetHeight || 1 : 1, moved: false }
  }
  function finishListScroll(event: PointerEvent<HTMLUListElement>) {
    const current = listDrag.current
    if (!current || current.pointerId !== event.pointerId) return
    listDrag.current = null
    delete current.node.dataset.dragging
    if (current.node.hasPointerCapture(event.pointerId)) current.node.releasePointerCapture(event.pointerId)
  }
  function moveListScroll(event: PointerEvent<HTMLUListElement>) {
    const current = listDrag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (blockedRef.current) { suppressListClick.current = true; finishListScroll(event); return }
    const delta = event.clientY - current.startY
    if (!current.moved && Math.abs(delta) < 4) return
    event.preventDefault(); event.stopPropagation()
    if (!current.moved) {
      current.moved = true
      suppressListClick.current = true
      current.node.dataset.dragging = 'true'
      current.node.setPointerCapture(event.pointerId)
    }
    current.node.scrollTop = current.scrollTop - delta / current.scale
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.layerGroup().addTo(map)
    const disposers: (() => void)[] = []
    let drag: { marker: L.Marker; element: HTMLElement; pointerId: number; origin: L.LatLng; start: L.Point; moved: boolean } | null = null
    function cancel() {
      const current = drag
      drag = null
      if (!current) return
      current.marker.setLatLng(current.origin)
      if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
    }
    // A second pointer anywhere cancels the pending marker move without saving it.
    function interrupt(event: globalThis.PointerEvent) {
      if (drag && event.pointerId !== drag.pointerId) cancel()
    }
    document.addEventListener('pointerdown', interrupt, true)
    for (const item of markers) {
      let skipClick = false
      const flag = document.createElement('span')
      flag.className = 'map-marker-flag'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 28 34')
      svg.setAttribute('aria-hidden', 'true')
      const pole = document.createElementNS(svg.namespaceURI, 'path')
      pole.setAttribute('d', 'M5 31V3')
      pole.setAttribute('stroke', '#F2F2F2')
      pole.setAttribute('stroke-width', '3')
      pole.setAttribute('stroke-linecap', 'round')
      const cloth = document.createElementNS(svg.namespaceURI, 'path')
      cloth.setAttribute('d', 'M6 4H24L19 11L24 18H6Z')
      cloth.setAttribute('fill', item.color)
      cloth.setAttribute('stroke', '#181818')
      cloth.setAttribute('stroke-width', '1.5')
      svg.append(pole, cloth)
      flag.append(svg)
      const marker = L.marker([item.latitude, item.longitude], {
        icon: L.divIcon({ className: 'map-marker', html: flag, iconSize: [28, 34], iconAnchor: [5, 31], tooltipAnchor: [9, -25] }),
        alt: item.name || 'Marcador', keyboard: true, bubblingMouseEvents: false,
        zIndexOffset: 400,
      }).addTo(group)
      const label = document.createElement('span')
      label.textContent = item.name || 'Marcador'
      marker.bindTooltip(label, { direction: 'top', className: 'map-marker-label' })
      marker.on('click', () => {
        if (skipClick) { skipClick = false; return }
        if (!blockedRef.current && !suppressSelection.current) callbacks.current.onSelect(item)
      })
      const element = marker.getElement()
      if (!element) continue
      element.setAttribute('aria-label', item.name || 'Marcador')
      if (focusedMarker.current === item.id) { element.focus({ preventScroll: true }); focusedMarker.current = null }
      function down(event: globalThis.PointerEvent) {
        if (blockedRef.current || suppressSelection.current || event.button !== 0) return
        event.preventDefault(); event.stopPropagation()
        cancel()
        drag = { marker, element: element!, pointerId: event.pointerId, origin: marker.getLatLng(), start: map!.mouseEventToContainerPoint(event), moved: false }
        element!.setPointerCapture(event.pointerId)
      }
      function move(event: globalThis.PointerEvent) {
        if (!drag || drag.pointerId !== event.pointerId) return
        if (blockedRef.current || suppressSelection.current) { cancel(); return }
        const delta = map!.mouseEventToContainerPoint(event).subtract(drag.start)
        if (!drag.moved && delta.distanceTo(L.point(0, 0)) < 3) return
        drag.moved = true
        const point = map!.containerPointToLatLng(map!.latLngToContainerPoint(drag.origin).add(delta)).wrap()
        marker.setLatLng([Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, point.lat)), point.lng])
      }
      function up(event: globalThis.PointerEvent) {
        if (!drag || drag.pointerId !== event.pointerId) return
        if (blockedRef.current || suppressSelection.current) { cancel(); return }
        const current = drag
        drag = null
        if (element!.hasPointerCapture(event.pointerId)) element!.releasePointerCapture(event.pointerId)
        const point = marker.getLatLng().wrap()
        skipClick = current.moved
        if (current.moved && !callbacks.current.onEdit(item.id, { latitude: point.lat, longitude: point.lng })) {
          marker.setLatLng(current.origin)
          return
        }
        callbacks.current.onSelect({ ...item, latitude: point.lat, longitude: point.lng })
      }
      function lost(event: globalThis.PointerEvent) { if (drag?.pointerId === event.pointerId) cancel() }
      function key(event: KeyboardEvent) {
        if (event.key === 'Escape') { cancel(); return }
        const offsets: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
        const offset = offsets[event.key]
        if (!offset || blockedRef.current || suppressSelection.current) return
        event.preventDefault(); event.stopPropagation()
        const point = map!.containerPointToLatLng(map!.latLngToContainerPoint(marker.getLatLng()).add(L.point(offset))).wrap()
        const patch = { latitude: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, point.lat)), longitude: point.lng }
        if (callbacks.current.onEdit(item.id, patch)) callbacks.current.onSelect({ ...item, ...patch })
      }
      element.addEventListener('pointerdown', down)
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerup', up)
      element.addEventListener('pointercancel', lost)
      element.addEventListener('lostpointercapture', lost)
      element.addEventListener('keydown', key)
      disposers.push(() => {
        if (element === document.activeElement) focusedMarker.current = item.id
        element.removeEventListener('pointerdown', down)
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerup', up)
        element.removeEventListener('pointercancel', lost)
        element.removeEventListener('lostpointercapture', lost)
        element.removeEventListener('keydown', key)
        marker.off()
      })
    }
    return () => {
      cancel()
      document.removeEventListener('pointerdown', interrupt, true)
      disposers.forEach(dispose => dispose())
      group.remove()
    }
  }, [mapRef, navigationKey, markers, blocked, blockedRef, suppressSelection])

  const selectedMarker = markers.find(marker => marker.id === selectedId)
  if (!open) return null
  return <aside id={menuId} className={`${mapStyles.panel} ${styles.base} map-markers-menu`} aria-labelledby={`${menuId}-title`} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }}>
    <div className={`${mapStyles.panelHeading} map-markers-heading`}>
      <span id={`${menuId}-title`}>Marcadores</span>
      <HelpTooltip text="Agregar marcador"><Button className={mapStyles.panelTool} aria-label="Agregar marcador" disabled={blocked || !canAdd}
        onClick={onAdd}><Plus aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text="Cerrar marcadores"><Button className={mapStyles.panelTool} aria-label="Cerrar marcadores" disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button></HelpTooltip>
    </div>
    <div className={`${mapStyles.panelActions} map-marker-actions`} role="group" aria-label={selectedMarker ? 'Controles de ' + (selectedMarker.name || 'marcador') : 'Controles del marcador seleccionado'}>
      <span className={`${mapStyles.colorControl} map-color-control`}>
        <HelpTooltip text="Color del marcador"><Button className={mapStyles.panelTool} aria-label="Elegir color del marcador seleccionado" disabled={blocked || !selectedMarker}
          onClick={() => colorInput.current?.click()}><Palette aria-hidden="true" /></Button></HelpTooltip>
        {selectedMarker && <input key={selectedMarker.id} ref={colorInput} type="color" aria-label={'Color de ' + (selectedMarker.name || 'marcador')}
          value={selectedMarker.color} disabled={blocked} tabIndex={-1}
          onChange={event => onEdit(selectedMarker.id, { color: event.target.value.toUpperCase() })} />}
      </span>
      <HelpTooltip text="Centrar marcador"><Button className={mapStyles.panelTool} aria-label="Centrar marcador seleccionado" disabled={blocked || !selectedMarker}
        onClick={() => { if (selectedMarker) onCenter(selectedMarker) }}><Focus aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text="Borrar marcador"><Button className={mapStyles.panelTool} aria-label="Borrar marcador seleccionado" disabled={blocked || !selectedMarker}
        onClick={() => { if (selectedMarker) onRemove(selectedMarker.id) }}><Trash aria-hidden="true" /></Button></HelpTooltip>
    </div>
    {!markers.length && <p className="map-notice">No hay marcadores.</p>}
    <ul className="map-markers" aria-label="Lista de marcadores" onPointerDown={startListScroll} onPointerMove={moveListScroll} onPointerUp={finishListScroll}
      onPointerCancel={event => { if (listDrag.current?.pointerId === event.pointerId) suppressListClick.current = true; finishListScroll(event) }}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) finishListScroll(event) }} onClickCapture={event => {
        if (suppressListClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressListClick.current = false }
      }}>
      {markers.map((marker, index) => <li key={marker.id} className="map-marker-row" data-selected={marker.id === selectedMarker?.id}>
        {editingId === marker.id ? <Input className="map-marker-name" aria-label={`Nombre del marcador ${index + 1}`} value={marker.name}
          placeholder="Marcador" maxLength={200} disabled={blocked} autoFocus onChange={event => onEdit(marker.id, { name: event.target.value })}
          onBlur={() => setEditingId(null)} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur() }
          }} /> : <Button appearance="integrated" className="map-marker-select" aria-label={marker.name || 'Marcador'} aria-pressed={marker.id === selectedMarker?.id}
          title={marker.name} disabled={blocked} onClick={() => { setEditingId(null); onSelect(marker) }}><span>{marker.name || 'Marcador'}</span></Button>}
        <HelpTooltip text="Editar marcador"><Button type="button" appearance="integrated" className={`${mapStyles.panelTool} map-marker-edit`} aria-label={'Editar ' + (marker.name || 'marcador')} disabled={blocked}
          onClick={() => { onSelect(marker); setEditingId(marker.id) }}><Pencil aria-hidden="true" /></Button></HelpTooltip>
      </li>)}
    </ul>
  </aside>
}
