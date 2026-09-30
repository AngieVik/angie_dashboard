import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId } from './layoutTypes'

export function ModuleFrame({ id, active, onClose, children }: { id: ModuleId; active: boolean; onClose: () => void; children?: ReactNode }) {
  const name = MODULE_REGISTRY[id].name
  return (
    <section className="module-frame" data-active={active} role="region" aria-label={name}>
      <header className="module-header">
        <h2>{name}</h2>
        <Button className="module-close" aria-label={`Cerrar ${name}`} onClick={onClose}>×</Button>
      </header>
      <div className="module-content">{children}</div>
    </section>
  )
}
