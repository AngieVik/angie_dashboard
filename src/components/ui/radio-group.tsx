import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-radio-group'

export function RadioGroup({ className = '', ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={`ui-radio-group ${className}`} {...props} />
}
export function RadioGroupItem(props: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className="ui-radio-item" {...props}><Primitive.Indicator className="ui-radio-indicator" /></Primitive.Item>
}
