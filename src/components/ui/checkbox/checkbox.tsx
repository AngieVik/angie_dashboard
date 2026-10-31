import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-checkbox'
import styles from './checkbox.module.css'

// shadcn/ui Radix composition, styled with Angie's shared tokens.
export function Checkbox({ className = '', readOnly, onClick, onCheckedChange, ...props }: Omit<ComponentProps<typeof Primitive.Root>, 'children' | 'checked' | 'defaultChecked' | 'onCheckedChange'> & {
  checked?: boolean; defaultChecked?: boolean; readOnly?: boolean; onCheckedChange?: (checked: boolean) => void
}) {
  return <Primitive.Root data-slot="checkbox" className={`${styles.base} ${className}`.trim()} {...props}
    aria-readonly={readOnly} onClick={event => {
      onClick?.(event)
      if (readOnly) event.preventDefault()
    }} onCheckedChange={next => onCheckedChange?.(next === true)}>
    <Primitive.Indicator data-slot="checkbox-indicator" className={styles.indicator}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
    </Primitive.Indicator>
  </Primitive.Root>
}
