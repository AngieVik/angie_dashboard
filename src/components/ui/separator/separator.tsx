import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-separator'
import styles from './separator.module.css'

export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="separator" className={`${styles.base} ${className}`.trim()} orientation={orientation} decorative={decorative} {...props} />
}
