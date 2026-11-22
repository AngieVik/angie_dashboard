import type { ComponentProps } from 'react'
import { Separator as Primitive } from 'radix-ui'
import styles from './separator.module.css'

export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="separator" className={`${styles.base} ${className}`.trim()} orientation={orientation} decorative={decorative} {...props} />
}
