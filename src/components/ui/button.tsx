import type { ComponentProps } from 'react'

export function Button(props: ComponentProps<'button'>) {
  return <button data-slot="button" className="document-button" type="button" {...props} />
}
