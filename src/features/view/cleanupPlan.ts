import type { AngieDocument, DocumentModuleId } from '../../domain/document/types'
import { clearDocumentModules, MODULE_CLEANUP } from '../document/documentEdits'

export const CLEANUP_MODULE_IDS = Object.keys(MODULE_CLEANUP) as DocumentModuleId[]
export interface CleanupRequest { ids: readonly DocumentModuleId[]; generation: number }
export const CLEANUP_CHANGED_ERROR = 'El contenido ha cambiado. Revisa la vista previa antes de confirmar.'

export function buildCleanupPlan(document: AngieDocument, selected: readonly DocumentModuleId[], timers: number) {
  const ids = CLEANUP_MODULE_IDS.filter(id => selected.includes(id))
  const selection = new Set(ids)
  const result = clearDocumentModules(document, ids)
  const shared = ids.flatMap(id => MODULE_CLEANUP[id].shared?.(document, result.document) ?? [])
    .filter(effect => !selection.has(effect.module))
  return {
    ids, source: document, timerCount: timers, result,
    modules: ids.map(id => ({ id, summary: MODULE_CLEANUP[id].summary(document, timers),
      preserves: MODULE_CLEANUP[id].preserves.filter(item => !item.unless?.some(id => selection.has(id))).map(item => item.text) })),
    shared: [...new Set(shared.map(effect => effect.text))],
    runtime: new Set(ids.flatMap(id => MODULE_CLEANUP[id].runtime ?? [])),
  }
}
export type CleanupPlan = ReturnType<typeof buildCleanupPlan>

export function applyCleanupPlan(document: AngieDocument, plan: CleanupPlan) {
  if (document !== plan.source) throw new Error(CLEANUP_CHANGED_ERROR)
  return plan.result
}
