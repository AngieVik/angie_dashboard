import type { ReactNode } from 'react'
import { Button } from '../../components/ui/button'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './recovery.module.css'

export function ModuleErrorBoundary({ name, onClose, children }: { name: string; onClose: () => void; children: ReactNode }) {
  return <ErrorBoundary scope={name} fallback={retry => <section className={styles.module} role="alert" aria-label={'Error en ' + name}>
    <strong>{name}</strong>
    <p>No se pudo mostrar este módulo. El documento sigue disponible.</p>
    <div className={styles.actions}><Button onClick={retry}>Reintentar módulo</Button><Button onClick={onClose}>Cerrar módulo</Button></div>
  </section>}>{children}</ErrorBoundary>
}
