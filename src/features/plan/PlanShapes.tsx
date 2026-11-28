import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import * as L from 'leaflet'
import { createPortal } from 'react-dom'
import { MAX_MAP_LATITUDE } from '../map/mapNavigation'
import { unwrapLongitude } from '../map/longitudeGeometry'
import { useMapSurface } from '../map/MapSurfaceContext'
import { ShapeSurface, type ShapeSurfaceProps } from '../drawing/ShapeSurface'
import { ellipseRing, ghostOpacity, groupVisible, placePoints, screenPoints, shapeScale, type Placed, type Projection } from '../drawing/shapeGeometry'
import { fromPlanInk, planInk } from './planInk'
import { InkSurface } from '../drawing/InkSurface'
import { inkAt, inkReferences, replaceInk } from '../drawing/inkGeometry'
import { useModuleZoom } from '@/layout/ModuleZoomContext'
import { DrawingImages, type ImageMode, type ImageActions } from '../drawing/DrawingImages'
import styles from '../drawing/drawing.module.css'
import type { AngieDocument, DrawingImage, PlanStroke, Position } from '@/domain/document/types'

function projectMap(map: L.Map): Projection {
  return {
    screen: p => map.latLngToContainerPoint([p.y, unwrapLongitude(p.x, map.getCenter().lng)]),
    world: p => { const ll = map.containerPointToLatLng([p.x, p.y]).wrap(); return { x: ll.lng, y: Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, ll.lat)) } },
    pixelsPerUnit: p => {
      const at = map.project([p.y, p.x]), other = map.unproject(at.add([1, 0]))
      return 1 / Math.max(Number.EPSILON, map.distance([p.y, p.x], other))
    },
  }
}
export interface PlanSurfaceActions {
  projection: () => Projection | undefined
  drop: (p: Position) => Position | null
  center: (p: Position) => void
  fit: (ids: string[]) => void
}
export function PlanShapes(props: Omit<ShapeSurfaceProps, 'projection' | 'native' | 'objects'> & {
  objects: NonNullable<AngieDocument['plan']>; actions: Ref<PlanSurfaceActions>; imageActions: Ref<ImageActions>; imageMode: ImageMode
  previewInk: (strokes: PlanStroke[] | null) => void; saveInk: (patch: Partial<NonNullable<AngieDocument['plan']>>) => boolean
  saveImages: (images: DrawingImage[]) => boolean; selectImage: (id: string) => void
  /** Figures being moved, turned or edited, drawn faded under their new version. */
  faded: string[]
}) {
  const { scale: zoom } = useModuleZoom()
  const { mapRef } = useMapSurface()
  const [located, setLocated] = useState<{ p: Position; time: number } | null>(null)
  const [imageHost, setImageHost] = useState<HTMLDivElement | null>(null)
  const [ready, setReady] = useState<L.Map | null>(null)
  useImperativeHandle(props.actions, () => ({
    projection: () => ready ? projectMap(ready) : undefined,
    drop(p) {
      if (!ready) return null
      const node = ready.getContainer(), rect = node.getBoundingClientRect()
      if (!rect.width || !rect.height || p.x < rect.left || p.x > rect.right || p.y < rect.top || p.y > rect.bottom) return null
      return projectMap(ready).world({ x: (p.x - rect.left) * node.clientWidth / rect.width, y: (p.y - rect.top) * node.clientHeight / rect.height })
    },
    center(p) { if (ready) { ready.panTo([p.y, p.x], { animate: false }); setLocated({ p, time: performance.now() }) } },
    fit(ids) {
      if (!ready) return
      const group = L.featureGroup()
      for (const pin of props.objects.pins) if (ids.includes(pin.elementId)) group.addLayer(L.marker([pin.latitude, pin.longitude]))
      const projection = projectMap(ready)
      const line = (item: Placed) => L.polyline(screenPoints(item, projection).map(p => ready.containerPointToLatLng([p.x, p.y])))
      for (const stroke of props.objects.strokes) if (ids.includes(stroke.id)) group.addLayer(line(planInk(stroke)))
      for (const shape of props.objects.shapes ?? []) if (ids.includes(shape.id)) {
        if (shape.radii) {
          const c = projection.screen(shape.points[0]!), k = shapeScale(shape, projection)
          const dx = shape.radii.x * k, dy = shape.radii.y * k
          group.addLayer(L.rectangle(L.latLngBounds(ready.containerPointToLatLng([c.x - dx, c.y - dy]), ready.containerPointToLatLng([c.x + dx, c.y + dy]))))
        } else group.addLayer(line(shape))
      }
      const bounds = group.getBounds()
      if (bounds.isValid()) ready.fitBounds(bounds, { padding: [24, 24], maxZoom: ready.getMaxZoom() })
    },
  }))
  const [projection, setProjection] = useState<Projection | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    setReady(map)
    const pane = map.getPane('operational-images') ?? map.createPane('operational-images')
    pane.style.zIndex = '375'
    const host = L.DomUtil.create('div', '', pane)
    host.style.position = 'absolute'
    host.style.pointerEvents = 'none'
    L.DomEvent.disableClickPropagation(host)
    function sync() {
      const size = map!.getSize()
      host.style.width = size.x + 'px'; host.style.height = size.y + 'px'
      L.DomUtil.setPosition(host, map!.containerPointToLayerPoint([0, 0]))
      setProjection(projectMap(map!))
    }
    setImageHost(host); sync(); map.on('move zoom resize', sync)
    return () => { map.off('move zoom resize', sync); host.remove() }
  }, [mapRef])
  const { shapes, groups, labels, pins, strokes } = props.objects, { faded } = props
  const { select, mode, suspended, selected } = props
  const selectLabel = useRef(select)
  const selectedLabel = useRef(selected)
  useEffect(() => {
    selectedLabel.current = selected
    const container = mapRef.current?.getContainer()
    for (const node of container?.querySelectorAll<HTMLElement>('[data-drawing-label]') ?? []) {
      node.dataset.selected = String(node.dataset.drawingLabel === selected)
    }
  }, [mapRef, selected])
  useEffect(() => { selectLabel.current = select }, [select])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pane = map.getPane('operational-figures') ?? map.createPane('operational-figures')
    pane.style.zIndex = '460'
    pane.style.pointerEvents = 'none'
    const group = L.featureGroup().addTo(map), projection = projectMap(map)
    function latlng(p: Position) { return L.latLng(p.y, p.x + 360 * Math.round((map!.getCenter().lng - p.x) / 360)) }
    function paint() {
      group.clearLayers()
      for (const s of shapes ?? []) {
        if (!groupVisible({ groups }, s.id)) continue
        const points = s.anchor ? screenPoints(s, projection).map(p => map!.containerPointToLatLng([p.x, p.y])) : s.points.map(latlng)
        const at = points[0]!
        const options = { pane: 'operational-figures', color: s.color, weight: s.width, opacity: faded.includes(s.id) ? ghostOpacity : 1, fill: false, interactive: false }
        if (s.kind === 'ellipse' && s.radii) {
          if (s.radii.x === s.radii.y) {
            if (s.unit === 'world') L.circle(at, { ...options, radius: s.radii.x }).addTo(group)
            else L.circleMarker(at, { ...options, radius: s.radii.x }).addTo(group)
          } else {
            const ring = ellipseRing(s, projection, 96).map(q => map!.containerPointToLatLng([q.x, q.y]))
            L.polygon(ring, options).addTo(group)
          }
        } else if (s.kind === 'rectangle') L.rectangle(L.latLngBounds(points), options).addTo(group)
        else if (s.kind === 'polygon') L.polygon(points, options).addTo(group)
        else L.polyline(points, options).addTo(group)
      }
      for (const label of labels ?? []) {
        if (label.owner && (!groupVisible({ groups }, label.owner) || pins.some(p => p.elementId === label.owner && !p.visible))) continue
        const content = document.createElement('span')
        content.textContent = label.text
        const interactive = mode === 'select' && !suspended
        const tip = L.tooltip({ permanent: true, interactive, className: 'drawing-label' }).setContent(content).setLatLng(latlng(label.point)).addTo(group)
        const node = tip.getElement()
        if (node) {
          node.dataset.drawingLabel = label.id
          if (label.size) node.style.setProperty('--label-size', label.size + 'px')
          if (label.color) node.style.setProperty('--label-color', label.color)
          if (label.background) { node.style.setProperty('--label-background', label.background); node.dataset.background = '' }
          node.dataset.selected = String(label.id === selectedLabel.current)
          if (interactive) {
            L.DomEvent.disableClickPropagation(node)
            node.onclick = () => selectLabel.current(label.id)
          }
        }
      }
    }
    paint()
    let frame: number | undefined
    function schedulePaint() {
      if (frame !== undefined) return
      frame = requestAnimationFrame(() => { frame = undefined; paint() })
    }
    map.on('zoomend moveend', schedulePaint)
    return () => {
      map.off('zoomend moveend', schedulePaint)
      if (frame !== undefined) cancelAnimationFrame(frame)
      group.remove()
    }
  }, [mapRef, shapes, labels, groups, pins, mode, suspended, faded])
  useEffect(() => {
    if (!ready || suspended || mode !== 'select') return
    const clear = () => select(null)
    ready.on('click', clear)
    return () => { ready.off('click', clear) }
  }, [ready, mode, select, suspended])
  const ink = useMemo(() => strokes.filter(s => groupVisible({ groups }, s.id)).map(s => ({ id: s.id, width: s.width * zoom, color: s.color, ...planInk(s) })), [strokes, groups, zoom])
  if (!ready || !projection) return null
  const placeInk = (stroke: PlanStroke, points: Position[]) => fromPlanInk(stroke, placePoints(planInk(stroke), points, projection))
  return <>
    {imageHost && createPortal(<DrawingImages images={props.objects.images ?? []} actions={props.imageActions} projection={projection} mode={props.imageMode} enabled={!suspended && props.mode === 'select'}
      selected={props.selected} select={props.selectImage} save={props.saveImages} warn={props.warn} />, imageHost)}
    {!suspended && (props.mode === 'select' || props.mode === 'eraser') && <InkSurface key={'ink-' + props.mode} mode={props.mode} eraserWidth={props.width} paths={ink}
      objects={props.objects} projection={projection} selected={props.selected} select={props.select} selection={props.selection} selectMany={props.selectMany} rotate={props.rotateSelection} flip={props.flipSelection} onGhost={props.onGhost}
      preview={changes => props.previewInk(replaceInk(props.objects.strokes, changes, placeInk))} clear={() => props.previewInk(null)}
      commit={(changes, delta) => props.saveInk({ strokes: replaceInk(props.objects.strokes, changes, placeInk), ...inkReferences(props.objects, changes, projection, delta) })} />}
    <ShapeSurface key={'shape-' + props.mode} {...props} projection={projection} native ink={ink} anchorAt={point => {
      const p = projection.screen(point)
      return props.objects.pins.findLast(pin => { const q = projection.screen({ x: pin.longitude, y: pin.latitude })
        return pin.visible && groupVisible(props.objects, pin.elementId) && Math.hypot(p.x - q.x, p.y - q.y) < 12 })?.elementId ?? inkAt(ink, projection, point)
    }} />
    {located && <span key={located.time} className={styles.locate} onAnimationEnd={() => setLocated(null)}
      style={{ left: projection.screen(located.p).x, top: projection.screen(located.p).y }} />}
  </>
}
