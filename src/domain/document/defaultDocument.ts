import { DOCUMENT_STATUSES } from './types'
import type { AngieDocumentV1 } from './types'

export function createEmptyDocument(title = ''): AngieDocumentV1 {
  const now = new Date().toISOString()
  return {
    format: 'angie-dashboard',
    formatVersion: 1,
    document: { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now },
    board: { backgroundColor: '#25282B', strokes: [], quickNotes: [] },
    elements: [],
    notebook: [],
    timeline: [],
    moduleLayouts: {},
    filters: { visibleStatuses: [...DOCUMENT_STATUSES] },
  }
}
