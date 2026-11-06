import type { ComponentProps } from 'react'
import styles from './textarea.module.css'
import { useTextInputBudget } from '../useTextInputBudget'
import type { TextInputBudget } from '../useTextInputBudget'

export function Textarea({ className = '', inputBudget, rows = 1, ...props }: ComponentProps<'textarea'> & { inputBudget?: TextInputBudget }) {
  const handlers = useTextInputBudget<HTMLTextAreaElement>({ ...props, inputBudget })
  return <textarea data-slot="textarea" rows={rows} className={`${styles.base} ${className}`.trim()} {...props} {...handlers} />
}
