import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import type { LoadedGpx } from './gpx'
import type { GpxLocation } from './gpxMetrics'
import { getGpxProfile, nearestProfileSample } from './gpxProfile'
import type { GpxProfileSample } from './gpxProfile'
import styles from './GpxElevationProfile.module.css'

const meters = (value: number | undefined) => value === undefined ? 'Sin datos' : value.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' m'
const kilometers = (value: number) => (value / 1000).toLocaleString('es-ES', { maximumFractionDigits: 3 }) + ' km'

export function GpxElevationProfile({ file, selected, disabled, controlsHost, onSelect }: {
  file: LoadedGpx
  selected?: GpxLocation
  disabled: boolean
  controlsHost: HTMLDivElement | null
  onSelect: (sample: GpxProfileSample) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  return <>
    {controlsHost && createPortal(<Button ref={trigger} className={`map-profile-toggle ${styles.trigger}`} aria-expanded={open} aria-controls={panelId} disabled={disabled}
      onClick={() => setOpen(value => !value)}>{open ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}Perfil GPX</Button>, controlsHost)}
    {controlsHost && open && <section id={panelId} className={`map-profile ${styles.base}`} aria-label={'Perfil GPX de ' + file.name}>
      <div className="map-profile-body" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
      }}><ProfileContent file={file} selected={selected} disabled={disabled} onSelect={onSelect} /></div>
    </section>}
  </>
}

function ProfileContent({ file, selected, disabled, onSelect }: {
  file: LoadedGpx
  selected?: GpxLocation
  disabled: boolean
  onSelect: (sample: GpxProfileSample) => void
}) {
  const { scale } = useModuleZoom()
  const profile = useMemo(() => getGpxProfile(file.data), [file.data])
  const chart = useRef<SVGSVGElement>(null)
  const tap = useRef<{ id: number; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 600, height: 150 })
  useEffect(() => {
    const node = chart.current
    if (!node) return
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect
      if (bounds && bounds.width > 0 && bounds.height > 0) setSize({ width: bounds.width, height: bounds.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const left = 55 * scale, right = size.width - 16 * scale, top = 23 * scale, bottom = size.height - 32 * scale
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top)
  const minimum = profile.minimum ?? 0, maximum = profile.maximum ?? 1
  const low = minimum === maximum ? minimum - 1 : minimum, high = minimum === maximum ? maximum + 1 : maximum
  const x = (distance: number) => left + (profile.totalMeters ? distance / profile.totalMeters : .5) * width
  const y = (elevation: number) => bottom - (elevation - low) / (high - low) * height
  const selectedIndex = useMemo(() => {
    if (selected?.distanceMeters === undefined) return -1
    const exact = profile.samples.findIndex(sample => sample.point === selected.point)
    return exact >= 0 ? exact : nearestProfileSample(profile, selected.distanceMeters, selected.point.elevation)
  }, [profile, selected])
  const sample = selectedIndex >= 0 ? profile.samples[selectedIndex] : undefined
  const paths = useMemo(() => {
    const px = (distance: number) => (left + (profile.totalMeters ? distance / profile.totalMeters : .5) * width).toFixed(1)
    const py = (elevation: number) => (bottom - (elevation - low) / (high - low) * height).toFixed(1)
    const trace: string[] = []
    for (const segment of profile.segments) {
      let drawing = false, previous = ''
      for (const item of segment) {
        if (item.point.elevation === undefined) { drawing = false; continue }
        const coordinate = px(item.distanceMeters) + ' ' + py(item.point.elevation)
        if (!drawing) trace.push('M' + coordinate + 'l0 .01')
        else if (coordinate !== previous) trace.push('L' + coordinate)
        previous = coordinate; drawing = true
      }
    }
    const gaps = profile.gaps.map(gap => {
      const start = Number(px(gap.from)), end = Number(px(gap.to))
      return `M${start} ${top}h${Math.max(1, end - start)}v${height}H${start}Z`
    }).join('')
    const cuts = profile.cuts.map(distance => `M${px(distance)} ${top}V${bottom}`).join('')
    return { trace: trace.join(''), gaps, cuts }
  }, [profile, left, top, bottom, width, height, low, high])
  const patternId = useId()
  const valueText = sample ? `PK ${kilometers(sample.distanceMeters)} · Altitud GPX ${meters(sample.point.elevation)} · Segmento ${sample.segmentIndex + 1}` : 'Sin posición seleccionada'
  const xTicks = profile.totalMeters > 0 ? [0, profile.totalMeters / 2, profile.totalMeters] : [0]
  const yTicks = profile.minimum !== undefined ? [low, (low + high) / 2, high] : []
  return <>
    <dl className="map-profile-summary">
      <div><dt>Total</dt><dd>{kilometers(profile.totalMeters)}</dd></div>
      <div><dt>Mínima</dt><dd>{meters(profile.minimum)}</dd></div>
      <div><dt>Máxima</dt><dd>{meters(profile.maximum)}</dd></div>
      <div><dt>D+</dt><dd>{meters(profile.ascent)}</dd></div>
      <div><dt>D−</dt><dd>{meters(profile.descent)}</dd></div>
    </dl>
    {(profile.missingPoints > 0 || profile.cuts.length > 0) && <p className="map-profile-legend">
      {profile.missingPoints > 0 && <span className="map-profile-missing">Tramos sin altura · {profile.ascent === undefined ? 'Sin datos de desnivel' : 'Desniveles parciales'}</span>}
      {profile.cuts.length > 0 && <span>{profile.segments.length} segmentos · cortes discontinuos</span>}
    </p>}
    <svg ref={chart} className="map-profile-chart" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" role="slider" tabIndex={disabled ? -1 : 0}
      aria-label="Posición en el perfil GPX" aria-orientation="horizontal" aria-disabled={disabled}
      aria-valuemin={0} aria-valuemax={Math.max(0, profile.samples.length - 1)} aria-valuenow={Math.max(0, selectedIndex)} aria-valuetext={valueText}
      onKeyDown={event => {
        if (disabled || !profile.samples.length) return
        const index = Math.max(0, selectedIndex), page = Math.max(1, Math.floor(profile.samples.length / 10))
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? profile.samples.length - 1 :
          ['ArrowRight', 'ArrowUp'].includes(event.key) ? index + 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? index - 1 :
            event.key === 'PageUp' ? index + page : event.key === 'PageDown' ? index - page : null
        if (next === null) return
        event.preventDefault(); event.stopPropagation()
        onSelect(profile.samples[Math.max(0, Math.min(profile.samples.length - 1, next))]!)
      }}
      onPointerDown={event => {
        tap.current = !disabled && event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null
        if (tap.current) event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (tap.current && Math.hypot(event.clientX - tap.current.x, event.clientY - tap.current.y) > 5) tap.current = null
      }}
      onPointerCancel={() => { tap.current = null }} onLostPointerCapture={() => { tap.current = null }}
      onPointerUp={event => {
        const current = tap.current
        tap.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (!current || current.id !== event.pointerId || disabled || !profile.samples.length) return
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        const positionX = (event.clientX - bounds.left) / bounds.width * size.width
        const positionY = (event.clientY - bounds.top) / bounds.height * size.height
        if (positionX < left || positionX > right || positionY < top || positionY > bottom) return
        const distance = (positionX - left) / width * profile.totalMeters
        const elevation = high - (positionY - top) / height * (high - low)
        onSelect(profile.samples[nearestProfileSample(profile, distance, elevation)]!)
      }}>
      <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" className="map-profile-hatching" /></pattern></defs>
      <path d={paths.gaps} fill={`url(#${patternId})`} />
      {yTicks.map((tick, index) => <g key={index}>
        <path d={`M${left} ${y(tick)}H${right}`} className="map-profile-gridline" />
        <text x={left - 5 * scale} y={y(tick)} textAnchor="end" dominantBaseline="middle">{tick.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</text>
      </g>)}
      <path d={`M${left} ${top}V${bottom}H${right}`} className="map-profile-axis" />
      <text x={left} y={13 * scale}>Altitud GPX (m)</text>
      {xTicks.map((tick, index) => <text key={index} x={x(tick)} y={bottom + 14 * scale} textAnchor="middle">{(tick / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })}</text>)}
      <text x={left + width / 2} y={size.height - 3 * scale} textAnchor="middle">Distancia (km)</text>
      <path d={paths.cuts} className="map-profile-cut" />
      <path d={paths.trace} className="map-profile-trace" stroke={file.color} />
      {profile.minimum === undefined && <text x={left + width / 2} y={top + height / 2} textAnchor="middle">Sin alturas GPX</text>}
      {sample && <g className="map-profile-selection">
        <path d={`M${x(sample.distanceMeters)} ${top}V${bottom}`} />
        {sample.point.elevation !== undefined && <circle cx={x(sample.distanceMeters)} cy={y(sample.point.elevation)} r={3 * scale} />}
      </g>}
    </svg>
    <p className="map-profile-position" role="status">{sample ? <>
      <span>PK <strong>{kilometers(sample.distanceMeters)}</strong></span>
      <span>Altitud GPX <strong>{meters(sample.point.elevation)}</strong></span>
      <span>Segmento {sample.segmentIndex + 1}</span>
    </> : 'Sin posición seleccionada'}</p>
  </>
}
