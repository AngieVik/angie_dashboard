import type { ComponentProps } from 'react'

export function Badge({ className = '', variant = 'secondary', ...props }: ComponentProps<'span'> & { variant?: 'secondary' | 'outline' }) {
  return <span data-slot="badge" data-variant={variant} className={`ui-badge ${className}`} {...props} />
}
