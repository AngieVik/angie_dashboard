import type { ComponentProps } from 'react'
import { Checkbox as Primitive } from 'radix-ui'
import styles from './checkbox.module.css'
import { CheckboxMark } from './checkbox-mark'

// shadcn/ui Radix composition, styled with Angie's shared tokens.
export function Checkbox({ className = '', readOnly, onClick, onCheckedChange, ...props }: Omit<ComponentProps<typeof Primitive.Root>, 'children' | 'checked' | 'defaultChecked' | 'onCheckedChange'> & {
  checked?: boolean | 'indeterminate'; defaultChecked?: boolean; readOnly?: boolean; onCheckedChange?: (checked: boolean) => void
}) {
  return <Primitive.Root data-slot="checkbox" className={`${styles.base} ${className}`.trim()} {...props}
    aria-readonly={readOnly} onClick={event => {
      onClick?.(event)
      if (readOnly) event.preventDefault()
    }} onCheckedChange={next => onCheckedChange?.(next === true)}>
    <Primitive.Indicator data-slot="checkbox-indicator" className={styles.indicator}>
      <CheckboxMark indeterminate={props.checked === 'indeterminate'} />
    </Primitive.Indicator>
  </Primitive.Root>
}
