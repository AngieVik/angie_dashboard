import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-popover'

export const Popover = Primitive.Root
export const PopoverTrigger = Primitive.Trigger
export function PopoverContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content className={`ui-popover ${className}`} sideOffset={5} collisionPadding={8}
    updatePositionStrategy="always" {...props} /></Primitive.Portal>
}
