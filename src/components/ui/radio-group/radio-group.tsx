import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-radio-group'
import styles from './radio-group.module.css'

export function RadioGroup({ className = '', ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="radio-group" className={`${styles.base} ${className}`.trim()} {...props} />
}
export function RadioGroupItem({ className = '', ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="radio-group-item" className={`${styles.item} ${className}`.trim()} {...props}><Primitive.Indicator data-slot="radio-group-indicator" className={styles.indicator} /></Primitive.Item>
}
