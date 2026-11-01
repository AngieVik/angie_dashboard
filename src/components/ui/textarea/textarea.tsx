import type { ComponentProps } from 'react'
import styles from './textarea.module.css'
import { useTextInputBudget } from '../useTextInputBudget'
import type { TextInputBudget } from '../useTextInputBudget'

export function Textarea({ className = '', inputBudget, ...props }: ComponentProps<'textarea'> & { inputBudget?: TextInputBudget }) {
  const handlers = useTextInputBudget<HTMLTextAreaElement>({ ...props, inputBudget })
  return <textarea data-slot="textarea" className={`${styles.base} ${className}`.trim()} {...props} {...handlers} />
}
