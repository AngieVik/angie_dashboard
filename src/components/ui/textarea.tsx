import type { ComponentProps } from 'react'

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={`ui-textarea ${className}`} {...props} />
}
