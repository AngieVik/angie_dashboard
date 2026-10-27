import { Children, isValidElement } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import styles from './button.module.css'

function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some(child =>
    typeof child === 'string' ? Boolean(child.trim()) : typeof child === 'number' ||
      (isValidElement<{ children?: ReactNode }>(child) && hasText(child.props.children)))
}

export function Button({ children, className = '', variant, appearance = 'default', ...props }: ComponentProps<'button'> & {
  variant?: 'text' | 'icon'
  appearance?: 'default' | 'integrated'
}) {
  const text = hasText(children)
  return <button data-slot="button" data-text-button={text || undefined} type="button" {...props}
    className={`${styles.base} ${styles[variant ?? (text ? 'text' : 'icon')]} ${appearance === 'integrated' ? styles.integrated : ''} ${className}`.trim()}>{children}</button>
}
