import type { ComponentProps } from 'react'
import styles from './input-group.module.css'

export function InputGroup({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="input-group" className={`${styles.base} ${className}`.trim()} {...props} />
}
