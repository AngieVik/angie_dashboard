import type { DocumentModuleId, ModuleLayout } from '../domain/document/types'

export type ModuleId = DocumentModuleId
export type { ModuleLayout }
export interface Size { width: number; height: number }
export interface ViewportState { scale: number; offsetX: number; offsetY: number }
export interface PlacementRequest { id: ModuleId; saved?: ModuleLayout }
export interface PlacementResult { layout: ModuleLayout; exceptional: boolean; notice: string | null }
export const WORKSPACE: Size = { width: 1600, height: 1000 }
