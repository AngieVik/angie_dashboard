import type { ComponentProps } from 'react'
import styles from './textarea.module.css'

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={`${styles.base} ${className}`.trim()} {...props} />
}
