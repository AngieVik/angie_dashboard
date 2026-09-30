export const DOCUMENT_STATUSES = [
  'Disponible', 'Asignada', 'En camino', 'En el lugar',
  'En traslado', 'En destino', 'Operativa', 'Inoperativa',
] as const

export type OperationalStatus = typeof DOCUMENT_STATUSES[number]
export type AssetId = 'ambulance' | 'pathfinder' | 'quad' | 'checkpoint' | 'hydration' | 'start' | 'finish' | 'warning' | 'pushpin'
export type DocumentModuleId = 'board' | 'elements' | 'information' | 'operations' | 'coordinates' | 'clock' | 'calculator' | 'notebook' | 'timeline'

export interface Position { x: number; y: number }
export type ElementVisual =
  | { type: 'asset'; assetId: AssetId; scale: number }
  | { type: 'emoji'; value: string }

export type BoardStroke = {
  id: string
  width: number
  points: Position[]
} & ({ tool: 'pen'; color: string } | { tool: 'eraser'; color: null })

export interface QuickNote { id: string; text: string; position: Position }
export interface UnitOperational { status: OperationalStatus; notes: string; tags: string[] }
export type DocumentElement = {
  id: string
  name: string
  visual: ElementVisual
  information: string
  position: Position | null
  readonly isUnit: boolean
} & (
  | { readonly isUnit: true; operational: UnitOperational }
  | { readonly isUnit: false; operational: null }
)

export interface ChecklistItem { id: string; text: string; checked: boolean }
export type NotebookBlock =
  | { id: string; type: 'note'; text: string }
  | { id: string; type: 'checklist'; items: ChecklistItem[] }

export type TimelineEntry =
  | { id: string; type: 'manual'; occurredAt: string; text: string }
  | {
    id: string
    type: 'status-change'
    occurredAt: string
    unitId: string
    unitName: string
    previousStatus: OperationalStatus
    nextStatus: OperationalStatus
  }

export interface ModuleLayout { x: number; y: number; width: number; height: number }

export interface AngieDocumentV1 {
  format: 'angie-dashboard'
  formatVersion: 1
  document: { readonly id: string; title: string; readonly createdAt: string; updatedAt: string }
  board: { backgroundColor: string; strokes: BoardStroke[]; quickNotes: QuickNote[] }
  elements: DocumentElement[]
  notebook: NotebookBlock[]
  timeline: TimelineEntry[]
  moduleLayouts: Partial<Record<DocumentModuleId, ModuleLayout>>
  filters: { visibleStatuses: OperationalStatus[] }
}

export interface ValidationIssue { path: string; message: string }
export type ValidationResult<T> =
  | { success: true; document: T }
  | { success: false; errors: ValidationIssue[] }

export type MigrationFailureCode = 'invalid-format' | 'invalid-version' | 'unsupported-old-version' | 'future-version' | 'invalid-document'
export type MigrationResult<T> =
  | { success: true; document: T; migrated: boolean }
  | { success: false; code: MigrationFailureCode; errors: ValidationIssue[] }
