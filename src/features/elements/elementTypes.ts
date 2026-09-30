import type { DocumentElement, ElementVisual, Position } from '../../domain/document/types'

export interface CreateElementInput {
  name: string
  visual: ElementVisual
  information: string
  isUnit: boolean
  position?: Position | null
}
export type ElementPatch = Partial<Pick<DocumentElement, 'name' | 'visual' | 'information' | 'position'>>
