// shadcn/ui Radix composition; menus share DropdownMenu's presentation.
import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-menubar'
import { Separator } from '@/components/ui/separator'
import menuStyles from '../dropdown-menu/dropdown-menu.module.css'
import styles from './menubar.module.css'

export const MenubarMenu = Primitive.Menu
export const MenubarGroup = Primitive.Group

export function Menubar({ className = '', ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="menubar" className={`${styles.base} ${className}`.trim()} {...props} />
}

export function MenubarTrigger({ className = '', ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger data-slot="menubar-trigger" className={`${styles.trigger} ${className}`.trim()} {...props} />
}

export function MenubarContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal>
    <Primitive.Content data-slot="menubar-content" sideOffset={4} align="start" collisionPadding={8}
      className={`${menuStyles.content} ${className}`.trim()} {...props} />
  </Primitive.Portal>
}

export function MenubarItem({ className = '', ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="menubar-item" className={`${menuStyles.item} ${className}`.trim()} {...props} />
}

export function MenubarSeparator() {
  return <Separator asChild decorative={false}><Primitive.Separator /></Separator>
}
