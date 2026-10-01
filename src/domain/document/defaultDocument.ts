import type { AngieDocument } from './types'

export function createEmptyDocument(title = ''): AngieDocument {
  const now = new Date().toISOString()
  return {
    format: 'angie-dashboard',
    formatVersion: 2,
    document: { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now },
    board: { backgroundColor: '#25282B', strokes: [], quickNotes: [] },
    elements: [],
    notebook: [],
    timeline: [],
    moduleLayouts: {},
  }
}
