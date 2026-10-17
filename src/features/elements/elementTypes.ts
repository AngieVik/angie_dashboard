import type { AssetId, DocumentElement, ElementVisual, Position } from '../../domain/document/types'

export interface CreateElementInput {
  name: string
  nameFontSize?: number
  nameHidden?: boolean
  nameOffset?: Position
  nameColor?: DocumentElement['nameColor']
  pinAnchor?: DocumentElement['pinAnchor']
  visual: ElementVisual
  information: string
  isUnit: boolean
  position?: Position | null
}
export type ElementPatch = Partial<Pick<DocumentElement, 'name' | 'visual' | 'information' | 'position' | 'nameFontSize' | 'nameHidden' | 'nameOffset' | 'nameColor' | 'pinAnchor'>>

export type ElementBatchPatch = Partial<Pick<DocumentElement, 'nameFontSize' | 'nameHidden' | 'nameColor' | 'pinAnchor'>> & {
  visual?: Partial<Pick<ElementVisual, 'scale' | 'rotation' | 'flipX' | 'flipY'>> & {
    icon?: { type: 'asset'; assetId: AssetId } | { type: 'emoji'; value: string }
  }
}
