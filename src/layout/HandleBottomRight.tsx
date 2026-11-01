import { createLucideIcon } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// Lucide handle-bottom-right (ISC), not exported by the installed version.
// https://github.com/lucide-icons/lucide/blob/main/icons/handle-bottom-right.svg
const ResizeHandleIcon = createLucideIcon('HandleBottomRight', [
  ['path', { d: 'M21 8 8 21', key: 'diagonal' }],
  ['path', { d: 'm21 15-6 6', key: 'corner' }],
])

export function HandleBottomRight(props: LucideProps) {
  return <ResizeHandleIcon {...props} />
}
