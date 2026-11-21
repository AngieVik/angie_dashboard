import type { ElementVisual } from '../../domain/document/types'
import { ICON_CATALOG } from './iconCatalog'
import { pinTextLength } from './pinText'
import styles from './pinSummary.module.css'

export function PinThumbnail({ visual }: { visual: ElementVisual }) {
  return <span className={styles.thumbnail} aria-hidden="true">
    {visual.type === 'asset'
      ? <img className={styles.image} src={ICON_CATALOG[visual.assetId].path} alt="" draggable={false} />
      : <span className={styles.emoji} style={{ fontSize: `min(1em, calc(var(--pin-thumbnail-width-base) * var(--module-zoom, 1) / ${Math.max(1, pinTextLength(visual.value))}))` }}>{visual.value}</span>}
  </span>
}
