import type { ComponentProps } from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root data-slot="separator" className={`ui-separator ${className}`} orientation={orientation} decorative={decorative} {...props} />
}
