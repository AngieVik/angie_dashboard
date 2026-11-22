import type { ComponentProps } from 'react'
import { RadioGroup as Primitive } from 'radix-ui'
import styles from './radio-group.module.css'
import checkboxStyles from '../checkbox/checkbox.module.css'
import { CheckboxMark } from '../checkbox/checkbox-mark'

export function RadioGroup({ className = '', ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="radio-group" className={`${styles.base} ${className}`.trim()} {...props} />
}
export function RadioGroupItem({ className = '', ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="radio-group-item" className={`${checkboxStyles.base} ${className}`.trim()} {...props}><Primitive.Indicator data-slot="radio-group-indicator" className={checkboxStyles.indicator}><CheckboxMark /></Primitive.Indicator></Primitive.Item>
}
