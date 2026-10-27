import type { ComponentProps } from 'react'
import styles from './input.module.css'

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" className={`${styles.base} ${className}`.trim()} {...props} />
}
