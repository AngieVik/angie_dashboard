import { Children, isValidElement } from 'react'
import type { ComponentProps, ReactNode } from 'react'

function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some(child =>
    typeof child === 'string' ? Boolean(child.trim()) : typeof child === 'number' ||
      (isValidElement<{ children?: ReactNode }>(child) && hasText(child.props.children)))
}

export function Button(props: ComponentProps<'button'>) {
  return <button data-slot="button" data-text-button={hasText(props.children) || undefined} className="document-button" type="button" {...props} />
}
