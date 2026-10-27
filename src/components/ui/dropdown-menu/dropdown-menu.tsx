// shadcn/ui Radix composition, adapted to Angie's shared controls and tokens.
import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import styles from './dropdown-menu.module.css'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger
export const DropdownMenuGroup = Primitive.Group
export const DropdownMenuRadioGroup = Primitive.RadioGroup

export function DropdownMenuContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal>
    <Primitive.Content data-slot="dropdown-menu-content" sideOffset={4} align="start" collisionPadding={8}
      className={`${styles.content} ${className}`.trim()} {...props} />
  </Primitive.Portal>
}

export function DropdownMenuItem({ className = '', ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="dropdown-menu-item" className={`${styles.item} ${className}`.trim()} {...props} />
}

export function DropdownMenuCheckboxItem({ children, className = '', checked = false, onCheckedChange, ...props }: Omit<ComponentProps<typeof Primitive.CheckboxItem>, 'checked' | 'onCheckedChange'> & {
  checked?: boolean; onCheckedChange?: (checked: boolean) => void
}) {
  return <Primitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" className={`${styles.item} ${className}`.trim()}
    checked={checked} onCheckedChange={next => onCheckedChange?.(next === true)} {...props}>
    <span aria-hidden="true" className={styles.checkboxMark}><Checkbox checked={checked} readOnly tabIndex={-1} /></span>
    {children}
  </Primitive.CheckboxItem>
}

export function DropdownMenuRadioItem({ children, className = '', ...props }: ComponentProps<typeof Primitive.RadioItem>) {
  return <Primitive.RadioItem data-slot="dropdown-menu-radio-item" className={`${styles.item} ${className}`.trim()} {...props}>
    <span aria-hidden="true" className={styles.radioMark}><Primitive.ItemIndicator>✓</Primitive.ItemIndicator></span>
    {children}
  </Primitive.RadioItem>
}

export function DropdownMenuSeparator() {
  return <Separator asChild decorative={false}><Primitive.Separator /></Separator>
}
