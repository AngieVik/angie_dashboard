import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogFooter } from '../../components/ui/alert-dialog'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './recovery.module.css'

function ModuleFailure({ name, onRetry, onClose }: { name: string; onRetry: () => void; onClose: () => void }) {
  const [reloadOpen, setReloadOpen] = useState(false)
  return <section className={styles.module} role="alert" aria-label={'Error en ' + name}>
    <strong>{name}</strong>
    <p>No se pudo mostrar este módulo. El documento sigue disponible.</p>
    <p>Si el módulo sigue sin cargar, puedes recargar la página.</p>
    <div className={styles.actions}>
      <Button onClick={onRetry}>Reintentar módulo</Button><Button onClick={onClose}>Cerrar módulo</Button>
      <Button onClick={() => setReloadOpen(true)}>Recargar página</Button>
    </div>
    <AlertDialog open={reloadOpen} onOpenChange={setReloadOpen}>
      <AlertDialogContent>
        <AlertDialogTitle>Recargar página</AlertDialogTitle>
        <AlertDialogDescription>
          Se perderán los datos que solo estén en memoria. Cancela y guarda el UIBoard desde Archivo antes de continuar.
          Los recursos, coordenadas, geometría y otros datos de sesión no se incluyen en ese archivo.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <Button onClick={() => window.location.reload()}>Recargar ahora</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}

export function ModuleErrorBoundary({ name, onRetry, onClose, children }: {
  name: string; onRetry: () => void; onClose: () => void; children: ReactNode
}) {
  return <ErrorBoundary scope={name} fallback={retry => <ModuleFailure name={name}
    onRetry={() => { onRetry(); retry() }}
    onClose={() => { onRetry(); onClose() }} />}>{children}</ErrorBoundary>
}
