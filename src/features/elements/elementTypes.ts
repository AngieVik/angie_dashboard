import type { DocumentElement, ElementVisual, Position } from '../../domain/document/types'

export interface CreateElementInput {
  name: string
  nameFontSize?: number
  nameHidden?: boolean
  nameOffset?: Position
  nameColor?: DocumentElement['nameColor']
  visual: ElementVisual
  information: string
  isUnit: boolean
  position?: Position | null
}
export type ElementPatch = Partial<Pick<DocumentElement, 'name' | 'visual' | 'information' | 'position' | 'nameFontSize' | 'nameHidden' | 'nameOffset' | 'nameColor'>>
