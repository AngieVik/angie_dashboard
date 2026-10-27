import type { ComponentProps } from 'react'
import styles from './badge.module.css'

export function Badge({ className = '', variant = 'secondary', ...props }: ComponentProps<'span'> & { variant?: 'secondary' | 'outline' }) {
  return <span data-slot="badge" data-variant={variant} className={`${styles.base} ${className}`.trim()} {...props} />
}
