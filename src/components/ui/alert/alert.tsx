import type { ComponentProps } from 'react'
import styles from './alert.module.css'

export function Alert({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert" className={`${styles.base} ${className}`.trim()} role="alert" {...props} />
}
