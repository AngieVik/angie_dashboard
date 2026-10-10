import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Ambulance, Calculator, ClipboardList, Clock3, Info, MapPin, NotebookPen, Package, PanelsTopLeft, Radio, SquareX } from 'lucide-react'
import { HelpTooltip } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'
import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId } from './layoutTypes'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'

const MODULE_ICONS = { board: PanelsTopLeft, elements: Package, dotations: Ambulance, information: Info, operations: Radio, coordinates: MapPin, clock: Clock3, calculator: Calculator, notebook: NotebookPen, timeline: ClipboardList }

export function ModuleFrame({ id, active, onClose, children, generation = 0 }: { id: ModuleId; active: boolean; onClose: () => void; children?: ReactNode; generation?: number }) {
  const name = MODULE_REGISTRY[id].name
  const Icon = MODULE_ICONS[id]
  const [scale, setScale] = useState(1)
  const content = useRef<HTMLDivElement>(null)
  const { blocked, blockedRef } = useViewportInteraction()
  const [width, height] = MODULE_REGISTRY[id].contentMinimum
  useEffect(() => {
    const node = content.current
    if (id !== 'board' || !node) return
    function wheel(event: WheelEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('.board-surface') || event.target.closest('input, textarea, [contenteditable="true"]') || event.shiftKey || !event.deltaY || event.deltaX !== 0) return
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node!.clientHeight : 1
      setScale(previous => Math.min(4, Math.max(.25, previous * Math.exp(-event.deltaY * unit * .002))))
    }
    node.addEventListener('wheel', wheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', wheel, true)
  }, [id, blockedRef])
  return (
    <section className="module-frame" data-active={active} role="region" aria-label={name}>
      <header className="module-header">
        <Icon className="module-icon" aria-hidden="true" />
        <h2>{name}</h2>
        <HelpTooltip key={generation} text={`Cerrar ${name}`}><Button className="module-close" aria-label={`Cerrar ${name}`} disabled={blocked} onClick={onClose}><SquareX aria-hidden="true" /></Button></HelpTooltip>
      </header>
      <div ref={content} className="module-content">
        <div className="module-scaled-content" data-scale={scale} style={{ zoom: scale, width: '100%', height: '100%', minWidth: width - 2, minHeight: height - 52 }}>{children}</div>
      </div>
      <div className="module-controls">
        <ZoomControl key={generation} scale={scale} onChange={value => { if (!blockedRef.current) setScale(value) }} label={`Zoom de ${name}`} disabled={blocked} side="right" />
      </div>
    </section>
  )
}
