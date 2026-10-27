// shadcn/ui Radix composition, with shared dialog presentation and actions.
import type { ComponentProps } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { WindowResize } from '@/layout/WindowResize'
import styles from './alert-dialog.module.css'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function AlertDialogOverlay({ className = '', appearance = 'dimmed', ...props }: ComponentProps<typeof AlertDialogPrimitive.Overlay> & { appearance?: 'dimmed' | 'transparent' }) {
  return <AlertDialogPrimitive.Overlay data-slot="alert-dialog-overlay" data-appearance={appearance}
    className={`${styles.overlay} ${className}`.trim()} {...props} />
}

export function AlertDialogContent({ className = '', children, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className={`${styles.base} ${className}`.trim()} {...props}>
        {children}<WindowResize label="Redimensionar diálogo" />
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogTitle({ className = '', ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={`${styles.title} ${className}`.trim()} {...props} />
}

export function AlertDialogDescription({ className = '', ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={`${styles.description} ${className}`.trim()} {...props} />
}

export function AlertDialogFooter({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-footer" className={`${styles.footer} ${className}`.trim()} {...props} />
}

export function AlertDialogForm({ className = '', ...props }: ComponentProps<'form'>) {
  return <form data-slot="alert-dialog-form" className={`${styles.form} ${className}`.trim()} {...props} />
}
