import type { ComponentProps } from 'react'
import styles from './input.module.css'
import { useTextInputBudget } from '../useTextInputBudget'
import type { TextInputBudget } from '../useTextInputBudget'

export function Input({ className = '', inputBudget, ...props }: ComponentProps<'input'> & { inputBudget?: TextInputBudget }) {
  const handlers = useTextInputBudget<HTMLInputElement>({ ...props, inputBudget })
  return <input data-slot="input" className={`${styles.base} ${className}`.trim()} {...props} {...handlers} />
}
