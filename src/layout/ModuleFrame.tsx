import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId } from './layoutTypes'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'

export function ModuleFrame({ id, active, onClose, children }: { id: ModuleId; active: boolean; onClose: () => void; children?: ReactNode }) {
  const name = MODULE_REGISTRY[id].name
  const [scale, setScale] = useState(1)
  const { blocked, blockedRef } = useViewportInteraction()
  const [width, height] = MODULE_REGISTRY[id].contentMinimum
  return (
    <section className="module-frame" data-active={active} role="region" aria-label={name}>
      <header className="module-header">
        <h2>{name}</h2>
      </header>
      <div className="module-content">
        <div className="module-scaled-content" data-scale={scale} style={{ zoom: scale, width: `${100 / scale}%`, height: `${100 / scale}%`, minWidth: width - 2, minHeight: height - 44 }}>{children}</div>
      </div>
      <div className="module-controls">
        <ZoomControl scale={scale} onChange={value => { if (!blockedRef.current) setScale(value) }} label={`Zoom de ${name}`} disabled={blocked} />
        <Button className="module-close" aria-label={`Cerrar ${name}`} disabled={blocked} onClick={onClose}>×</Button>
      </div>
    </section>
  )
}
