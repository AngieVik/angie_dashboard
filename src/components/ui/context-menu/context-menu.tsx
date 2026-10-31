import { useContext } from 'react'
import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-context-menu'
import { ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { OverlayPortalContext } from '@/layout/OverlayPortalContext'
import menuStyles from '../dropdown-menu/dropdown-menu.module.css'
import styles from './context-menu.module.css'

export const ContextMenu = Primitive.Root
export const ContextMenuTrigger = Primitive.Trigger
export const ContextMenuPortal = Primitive.Portal
export const ContextMenuGroup = Primitive.Group
export const ContextMenuRadioGroup = Primitive.RadioGroup
export const ContextMenuSub = Primitive.Sub

export function ContextMenuContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(OverlayPortalContext)
  return <Primitive.Portal container={container ?? undefined}>
    <Primitive.Content data-slot="context-menu-content" collisionPadding={8} className={`${menuStyles.content} ${styles.content} ${className}`.trim()} {...props} />
  </Primitive.Portal>
}

export function ContextMenuSubContent({ className = '', ...props }: ComponentProps<typeof Primitive.SubContent>) {
  const container = useContext(OverlayPortalContext)
  return <Primitive.Portal container={container ?? undefined}>
    <Primitive.SubContent data-slot="context-menu-sub-content" sideOffset={4} alignOffset={-4} collisionPadding={8} className={`${menuStyles.content} ${styles.content} ${className}`.trim()} {...props} />
  </Primitive.Portal>
}

export function ContextMenuItem({ className = '', inset = false, variant = 'default', ...props }: ComponentProps<typeof Primitive.Item> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return <Primitive.Item data-slot="context-menu-item" data-inset={inset || undefined} data-variant={variant}
    className={`${menuStyles.item} ${styles.item} ${className}`.trim()} {...props} />
}

export function ContextMenuSubTrigger({ children, className = '', inset = false, ...props }: ComponentProps<typeof Primitive.SubTrigger> & { inset?: boolean }) {
  return <Primitive.SubTrigger data-slot="context-menu-sub-trigger" data-inset={inset || undefined} className={`${menuStyles.item} ${styles.item} ${className}`.trim()} {...props}>
    {children}<ChevronRight className={styles.subArrow} aria-hidden="true" />
  </Primitive.SubTrigger>
}

export function ContextMenuCheckboxItem({ children, className = '', checked = false, onCheckedChange, ...props }: Omit<ComponentProps<typeof Primitive.CheckboxItem>, 'checked' | 'onCheckedChange'> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  return <Primitive.CheckboxItem data-slot="context-menu-checkbox-item" checked={checked} onCheckedChange={next => onCheckedChange?.(next === true)} className={`${menuStyles.item} ${className}`.trim()} {...props}>
    <span aria-hidden="true" className={menuStyles.checkboxMark}><Checkbox checked={checked} readOnly tabIndex={-1} /></span>{children}
  </Primitive.CheckboxItem>
}

export function ContextMenuRadioItem({ children, className = '', ...props }: ComponentProps<typeof Primitive.RadioItem>) {
  return <Primitive.RadioItem data-slot="context-menu-radio-item" className={`${menuStyles.item} ${className}`.trim()} {...props}>
    <span aria-hidden="true" className={menuStyles.radioMark}><Primitive.ItemIndicator>✓</Primitive.ItemIndicator></span>{children}
  </Primitive.RadioItem>
}

export function ContextMenuLabel({ className = '', inset = false, ...props }: ComponentProps<typeof Primitive.Label> & { inset?: boolean }) {
  return <Primitive.Label data-slot="context-menu-label" data-inset={inset || undefined} className={`${styles.label} ${styles.item} ${className}`.trim()} {...props} />
}

export function ContextMenuSeparator({ className = '', ...props }: ComponentProps<typeof Primitive.Separator>) {
  return <Separator asChild decorative={false}><Primitive.Separator data-slot="context-menu-separator" className={className} {...props} /></Separator>
}

export function ContextMenuShortcut({ className = '', ...props }: ComponentProps<'span'>) {
  return <span data-slot="context-menu-shortcut" className={`${styles.shortcut} ${className}`.trim()} {...props} />
}
