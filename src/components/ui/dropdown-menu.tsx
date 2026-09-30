// shadcn/ui Radix composition, adapted to the existing Titan CSS tokens.
import type { ComponentProps } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export function DropdownMenuContent(props: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" className="file-menu-content" sideOffset={4} {...props} />
    </DropdownMenuPrimitive.Portal>
  )
}
export function DropdownMenuItem(props: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item" className="file-menu-item" {...props} />
}
