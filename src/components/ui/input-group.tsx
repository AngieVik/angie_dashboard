import type { ComponentProps } from 'react'
import './input-group.css'

export function InputGroup({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="input-group" className={`ui-input-group ${className}`} {...props} />
}
