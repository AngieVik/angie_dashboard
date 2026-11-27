import { Palette, type LucideIcon } from 'lucide-react'
import styles from './InkPaletteIcon.module.css'

export function InkPaletteIcon({ color, icon: Icon = Palette }: { color: string; icon?: LucideIcon }) {
  return <span className={styles.icon} aria-hidden="true">
    <Icon />
    <span className={styles.swatch} style={{ backgroundColor: color }} />
  </span>
}
