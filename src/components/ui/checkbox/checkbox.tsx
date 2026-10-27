import { Checkbox as Primitive } from '@base-ui/react/checkbox'
import styles from './checkbox.module.css'

// shadcn/ui Base UI composition, styled with Angie's shared tokens.
export function Checkbox({ className = '', ...props }: Omit<Primitive.Root.Props, 'className' | 'children' | 'indeterminate'> & { className?: string }) {
  return <Primitive.Root data-slot="checkbox" className={`${styles.base} ${className}`.trim()} {...props}>
    <Primitive.Indicator data-slot="checkbox-indicator" className={styles.indicator}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
    </Primitive.Indicator>
  </Primitive.Root>
}
