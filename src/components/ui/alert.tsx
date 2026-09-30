import type { ComponentProps } from 'react'

export function Alert(props: ComponentProps<'div'>) {
  return <div data-slot="alert" className="document-alert" role="alert" {...props} />
}
