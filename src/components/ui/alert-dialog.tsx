// shadcn/ui Radix composition; only the parts used by document recovery.
import type { ComponentProps } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { WindowResize } from '../../layout/WindowResize'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTitle = AlertDialogPrimitive.Title
export const AlertDialogDescription = AlertDialogPrimitive.Description
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export function AlertDialogContent(props: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="document-dialog-overlay" />
      <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className="document-dialog" {...props}>
        {props.children}<WindowResize label="Redimensionar diálogo" />
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}
