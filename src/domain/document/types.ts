export const DOCUMENT_STATUSES = [
  'Disponible', 'Activada', 'Aproximandose', 'Interviniendo',
  'Trasladando', 'Transfiriendo', 'Operativa', 'Inoperativa',
] as const

export type OperationalStatus = typeof DOCUMENT_STATUSES[number]
export type AssetId = 'ambulance' | 'pathfinder' | 'quad' | 'checkpoint' | 'hydration' | 'start' | 'finish' | 'warning' | 'pushpin'
export type DocumentModuleId = 'board' | 'elements' | 'dotations' | 'information' | 'operations' | 'coordinates' | 'clock' | 'calculator' | 'notebook' | 'timeline'

export interface Position { x: number; y: number }
export type ElementVisual =
  | { type: 'asset'; assetId: AssetId; scale: number }
  | { type: 'emoji'; value: string; scale: number }

export type BoardStroke = {
  id: string
  width: number
  points: Position[]
} & ({ tool: 'pen'; color: string } | { tool: 'eraser'; color: null })

export interface QuickNote { id: string; title: string; text: string; scale: number; position: Position; width: number; height: number }
export interface UnitOperational { status: OperationalStatus | null; currentEntryId: string | null; notes: string; tags: string[] }
export type DocumentElement = {
  id: string
  name: string
  visual: ElementVisual
  information: string
  position: Position | null
  nameFontSize?: number
  nameHidden?: boolean
  pinVisible: boolean
  readonly isUnit: boolean
} & (
  | { readonly isUnit: true; operational: UnitOperational }
  | { readonly isUnit: false; operational: null }
)

export interface ChecklistItem { id: string; text: string; checked: boolean }
export type NotebookBlock =
  | { id: string; type: 'note'; title: string; text: string }
  | { id: string; type: 'checklist'; title: string; items: ChecklistItem[] }

export type TimelineRevision =
  | { id: string; kind: 'text'; recordedAt: string; text: string }
  | { id: string; kind: 'delete' | 'correction'; recordedAt: string }
export type TimelineEntry = { revisions: TimelineRevision[] } & (
  | { id: string; type: 'manual'; occurredAt: string; text: string }
  | {
    id: string
    type: 'status-change'
    occurredAt: string
    unitId: string
    unitName: string
    previousStatus: OperationalStatus | null
    nextStatus: OperationalStatus
  }
)

export interface ModuleLayout { x: number; y: number; width: number; height: number; referenceSize: { width: number; height: number } }

export interface AngieDocumentV3 {
  format: 'angie-dashboard'
  formatVersion: 3
  document: { readonly id: string; title: string; readonly createdAt: string; updatedAt: string }
  board: { backgroundColor: string; strokes: BoardStroke[]; quickNotes: QuickNote[] }
  elements: DocumentElement[]
  notebook: NotebookBlock[]
  timeline: TimelineEntry[]
  moduleLayouts: Partial<Record<DocumentModuleId, ModuleLayout>>
}

export type AngieDocument = AngieDocumentV3

export interface ValidationIssue { path: string; message: string }
export type ValidationResult<T> =
  | { success: true; document: T }
  | { success: false; errors: ValidationIssue[] }

export type MigrationFailureCode = 'invalid-format' | 'invalid-version' | 'unsupported-old-version' | 'future-version' | 'invalid-document'
export type MigrationResult<T> =
  | { success: true; document: T; migrated: boolean }
  | { success: false; code: MigrationFailureCode; errors: ValidationIssue[] }
