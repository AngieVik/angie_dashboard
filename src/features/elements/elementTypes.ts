import type { DocumentElement, ElementVisual, Position } from '../../domain/document/types'

export interface CreateElementInput {
  name: string
  nameFontSize?: number
  nameHidden?: boolean
  visual: ElementVisual
  information: string
  isUnit: boolean
  position?: Position | null
}
export type ElementPatch = Partial<Pick<DocumentElement, 'name' | 'visual' | 'information' | 'position' | 'nameFontSize' | 'nameHidden'>>
