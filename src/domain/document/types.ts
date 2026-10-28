export const DOCUMENT_STATUSES = [
  'Disponible', 'Activada', 'Aproximandose', 'Interviniendo',
  'Trasladando', 'Transfiriendo', 'Operativa', 'Inoperativa',
] as const

export type OperationalStatus = typeof DOCUMENT_STATUSES[number] | 'Personalizada'
export type AssetId = 'ambulance' | 'pathfinder' | 'quad' | 'checkpoint' | 'hydration' | 'start' | 'finish' | 'warning' | 'pushpin'
export type DocumentModuleId = 'board' | 'elements' | 'dotations' | 'information' | 'operations' | 'coordinates' | 'map' | 'plan' | 'clock' | 'calculator' | 'notebook' | 'timeline' | 'reports'

export interface Position { x: number; y: number }
export type PinNameColor = 'dark' | 'light' | 'yellow' | 'blue' | 'green' | 'red'
export type PinAnchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right' | Position
export interface PinTransform { rotation?: number; flipX?: boolean; flipY?: boolean }
export type ElementVisual = PinTransform & (
  | { type: 'asset'; assetId: AssetId; scale: number }
  | { type: 'emoji'; value: string; scale: number })

export type BoardStroke = {
  id: string
  width: number
  points: Position[]
} & ({ tool: 'pen'; color: string } | { tool: 'eraser'; color: null })

export interface QuickNote { id: string; title: string; text: string; scale: number; position: Position; width: number; height: number }
export interface UnitOperational { status: OperationalStatus | null; currentEntryId: string | null; notes: string; notesColor?: string; tags: string[] }
export type DocumentElement = {
  id: string
  name: string
  visual: ElementVisual
  information: string
  position: Position | null
  nameFontSize?: number
  nameHidden?: boolean
  nameOffset?: Position
  nameColor?: PinNameColor
  pinAnchor?: PinAnchor
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
    customLabel?: string
    customColor?: string
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

export interface EmbeddedBoardImage { dataUrl: string; layout: { x: number; y: number; width: number; height: number } }
export interface MapMarker { id: string; name: string; latitude: number; longitude: number; color: string }
export interface MapGpxReference {
  id: string
  name: string
  size: number
  lastModified: number
  fingerprint: string
  visible: boolean
  color: string
  kilometers: boolean
  kilometerInterval: 0.1 | 0.5 | 1 | 5 | 10
}
export interface MapDocument { markers: MapMarker[]; gpx: MapGpxReference[] }
export interface GeographicPosition { latitude: number; longitude: number }
export interface PlanPin extends GeographicPosition { elementId: string; visible: boolean }
export interface PlanStroke { id: string; color: string; width: number; points: GeographicPosition[] }
export interface OperationalPlanDocument { pins: PlanPin[]; strokes: PlanStroke[] }
export interface AngieDocumentV4 extends Omit<AngieDocumentV3, 'formatVersion' | 'board'> {
  formatVersion: 4
  board: AngieDocumentV3['board'] & { backgroundImage?: EmbeddedBoardImage }
  map?: MapDocument
  plan?: OperationalPlanDocument
}
export type AngieDocument = AngieDocumentV4

export interface ValidationIssue { path: string; message: string }
export type ValidationResult<T> =
  | { success: true; document: T }
  | { success: false; errors: ValidationIssue[] }

export type MigrationFailureCode = 'invalid-format' | 'invalid-version' | 'unsupported-old-version' | 'future-version' | 'invalid-document'
export type MigrationResult<T> =
  | { success: true; document: T; migrated: boolean }
  | { success: false; code: MigrationFailureCode; errors: ValidationIssue[] }
