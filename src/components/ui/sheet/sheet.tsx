import { useCallback, useContext, useState } from 'react'
import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayPortalContext } from '@/layout/OverlayPortalContext'
import dialogStyles from '../alert-dialog/alert-dialog.module.css'
import styles from './sheet.module.css'

export const Sheet = Primitive.Root
export const SheetTrigger = Primitive.Trigger
export const SheetClose = Primitive.Close
export const SheetPortal = Primitive.Portal

export function SheetOverlay({ className = '', ...props }: ComponentProps<typeof Primitive.Overlay>) {
  return <Primitive.Overlay data-slot="sheet-overlay" className={`${dialogStyles.overlay} ${styles.overlay} ${className}`.trim()} {...props} />
}

export function SheetContent({ className = '', children, side = 'right', showCloseButton = true, container, ref, ...props }: ComponentProps<typeof Primitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'; showCloseButton?: boolean; container?: ComponentProps<typeof Primitive.Portal>['container']
}) {
  const inheritedContainer = useContext(OverlayPortalContext)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const attach = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node)
    if (typeof ref === 'function') return ref(node)
    if (ref) ref.current = node
  }, [ref])
  return <Primitive.Portal container={container === undefined ? inheritedContainer ?? undefined : container}>
    <SheetOverlay />
    <Primitive.Content data-slot="sheet-content" data-side={side} ref={attach} className={`${styles.content} ${className}`.trim()} {...props}>
      <OverlayPortalContext value={portalContainer}>{children}</OverlayPortalContext>
      {showCloseButton && <Primitive.Close asChild><Button className={styles.close} aria-label="Cerrar panel"><X aria-hidden="true" /></Button></Primitive.Close>}
    </Primitive.Content>
  </Primitive.Portal>
}

export function SheetHeader({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={`${styles.header} ${className}`.trim()} {...props} />
}
export function SheetBody({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-body" className={`${styles.body} ${className}`.trim()} {...props} />
}
export function SheetFooter({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={`${styles.footer} ${className}`.trim()} {...props} />
}
export function SheetTitle({ className = '', ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title data-slot="sheet-title" className={`${styles.title} ${className}`.trim()} {...props} />
}
export function SheetDescription({ className = '', ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description data-slot="sheet-description" className={`${styles.description} ${className}`.trim()} {...props} />
}
