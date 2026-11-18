import type { DocumentModuleId, ModuleLayout } from '../domain/document/types'

export type ModuleId = DocumentModuleId
export type { ModuleLayout }
export interface Size { width: number; height: number }
export interface ViewportState { scale: number; offsetX: number; offsetY: number }
export interface PlacementRequest { id: ModuleId; size?: Size; origin?: { x: number; y: number } }
export interface PlacementResult { layout: ModuleLayout }
