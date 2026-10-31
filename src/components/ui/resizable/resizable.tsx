import type { ComponentProps } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { GripVertical } from 'lucide-react'
import styles from './resizable.module.css'

export function ResizablePanelGroup({ className = '', orientation = 'horizontal', ...props }: ComponentProps<typeof Group>) {
  return <Group data-slot="resizable-panel-group" orientation={orientation} className={`${styles.group} ${className}`.trim()} {...props} />
}
export function ResizablePanel({ className = '', ...props }: ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" className={`${styles.panel} ${className}`.trim()} {...props} />
}
export function ResizableHandle({ className = '', withHandle = false, children, ...props }: ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return <Separator data-slot="resizable-handle" className={`${styles.handle} ${className}`.trim()} {...props}>
    {withHandle && <span className={styles.grip} aria-hidden="true"><GripVertical /></span>}{children}
  </Separator>
}
