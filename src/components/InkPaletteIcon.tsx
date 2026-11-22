import { Palette } from 'lucide-react'
import styles from './InkPaletteIcon.module.css'

export function InkPaletteIcon({ color }: { color: string }) {
  return <span className={styles.icon} aria-hidden="true">
    <Palette />
    <span className={styles.swatch} style={{ backgroundColor: color }} />
  </span>
}
