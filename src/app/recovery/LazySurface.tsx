import { lazy, Suspense, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Button } from '../../components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../components/ui/alert-dialog'
import { PopoverContent } from '../../components/ui/popover'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './recovery.module.css'

type Presentation = 'dialog' | 'popover' | 'inline'

function SurfaceFailure({ name, presentation, onRetry, onClose, onCloseFocus, closeLabel }: {
  name: string; presentation: Presentation; onRetry: () => void; onClose: () => void; onCloseFocus?: () => void; closeLabel: string
}) {
  const retrying = useRef(false)
  const actions = <div className={styles.actions}><Button onClick={() => { retrying.current = true; onRetry() }}>Reintentar</Button><Button onClick={onClose}>{closeLabel}</Button></div>
  const message = 'No se pudo mostrar esta vista.'
  if (presentation === 'dialog') return <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
    <AlertDialogContent onEscapeKeyDown={event => { event.preventDefault(); onClose() }}
      onCloseAutoFocus={event => {
        if (retrying.current || onCloseFocus) event.preventDefault()
        if (!retrying.current) onCloseFocus?.()
      }}>
      <AlertDialogTitle>{name}</AlertDialogTitle>
      <AlertDialogDescription>{message}</AlertDialogDescription>
      {actions}
    </AlertDialogContent>
  </AlertDialog>
  const content = <section className={styles.module} role="alert" aria-label={'Error en ' + name}>
    <strong>{name}</strong><p>{message}</p>{actions}
  </section>
  return presentation === 'popover' ? <PopoverContent align="end" aria-label={name}
    onCloseAutoFocus={event => { if (retrying.current) event.preventDefault() }}>{content}</PopoverContent> : content
}

// The lazy identity lives above its boundary and changes only on explicit recovery.
export function LazySurface<Props extends object>({ load, componentProps, name, onClose, onCloseFocus, presentation = 'dialog', closeLabel = 'Cerrar' }: {
  load: () => Promise<{ default: ComponentType<Props> }>; componentProps: Props; name: string; onClose: () => void
  onCloseFocus?: () => void; presentation?: Presentation; closeLabel?: string
}) {
  const [View, setView] = useState(() => lazy(load))
  function renew() { setView(() => lazy(load)) }
  return <ErrorBoundary scope={name} fallback={retry => <SurfaceFailure name={name} presentation={presentation} closeLabel={closeLabel}
    onRetry={() => { renew(); retry() }} onClose={() => { renew(); onClose() }} onCloseFocus={onCloseFocus} />}>
    <Suspense fallback={null}><View {...componentProps} /></Suspense>
  </ErrorBoundary>
}
