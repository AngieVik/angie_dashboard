import { useContext } from 'react'
import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-popover'
import { OverlayPortalContext } from '@/layout/OverlayPortalContext'
import styles from './popover.module.css'

export const Popover = Primitive.Root
export const PopoverTrigger = Primitive.Trigger
export const PopoverAnchor = Primitive.Anchor
export function PopoverContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(OverlayPortalContext)
  return <Primitive.Portal container={container ?? undefined}><Primitive.Content data-slot="popover-content" className={`${styles.base} ${className}`.trim()} sideOffset={5} collisionPadding={8}
    updatePositionStrategy="always" {...props} /></Primitive.Portal>
}
