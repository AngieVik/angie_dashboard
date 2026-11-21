import type { ModuleId, ViewportState } from '@/layout/layoutTypes'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN } from '@/layout/viewportMath'
import { MODULE_REGISTRY } from '@/layout/moduleRegistry'
import { SETTINGS_MODULE_IDS } from './settingsModuleOrder'

export const SAVED_DESKTOP_VIEWS_LIMIT = 50
export const SAVED_VIEW_NAME_LIMIT = 80
interface DesktopViewModule { id: ModuleId; x: number; y: number; width: number; height: number }
export interface DesktopViewState { modules: DesktopViewModule[]; viewport: ViewportState; active: ModuleId | null }
export interface SavedDesktopView { id: string; name: string; desktop: DesktopViewState }
export interface DesktopViewsController {
  canCapture: boolean
  canRestore: boolean
  capture: () => DesktopViewState | null
  restore: (desktop: DesktopViewState) => boolean
}

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
}
function moduleId(value: unknown): value is ModuleId { return SETTINGS_MODULE_IDS.some(id => id === value) }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER }
const invalid = () => new Error('La disposición guardada no es válida.')

export function validateDesktopViewState(value: unknown): DesktopViewState {
  if (!record(value, ['modules', 'viewport', 'active']) || !Array.isArray(value.modules) || value.modules.length > SETTINGS_MODULE_IDS.length) throw invalid()
  const ids = new Set<ModuleId>()
  const modules = value.modules.map(item => {
    if (!record(item, ['id', 'x', 'y', 'width', 'height']) || !moduleId(item.id) || ids.has(item.id)
      || !finite(item.x) || item.x < 0 || !finite(item.y) || item.y < 0
      || !finite(item.width) || item.width < MODULE_REGISTRY[item.id].minimum[0] || !finite(item.height) || item.height < MODULE_REGISTRY[item.id].minimum[1]
      || item.x + item.width > Number.MAX_SAFE_INTEGER || item.y + item.height > Number.MAX_SAFE_INTEGER) throw invalid()
    ids.add(item.id)
    return { id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }
  })
  const viewport = value.viewport
  if (!record(viewport, ['scale', 'offsetX', 'offsetY']) || !finite(viewport.scale) || viewport.scale < VIEWPORT_ZOOM_MIN || viewport.scale > VIEWPORT_ZOOM_MAX
    || !finite(viewport.offsetX) || viewport.offsetX > 0 || !finite(viewport.offsetY) || viewport.offsetY > 0
    || (value.active !== null && (!moduleId(value.active) || !ids.has(value.active)))) throw invalid()
  return { modules, viewport: { scale: viewport.scale, offsetX: viewport.offsetX, offsetY: viewport.offsetY }, active: value.active }
}

export function validateSavedDesktopViews(value: unknown): SavedDesktopView[] {
  if (!Array.isArray(value) || value.length > SAVED_DESKTOP_VIEWS_LIMIT) throw new Error(`Se admiten hasta ${SAVED_DESKTOP_VIEWS_LIMIT} vistas guardadas.`)
  const ids = new Set<string>(), names = new Set<string>()
  return value.map(item => {
    if (!record(item, ['id', 'name', 'desktop']) || typeof item.id !== 'string' || !item.id || item.id.length > 128
      || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > SAVED_VIEW_NAME_LIMIT || ids.has(item.id)) throw invalid()
    const name = item.name.trim(), key = name.toLocaleLowerCase('es')
    if (names.has(key)) throw new Error('Ya existe una vista con ese nombre. Usa otro nombre.')
    ids.add(item.id); names.add(key)
    return { id: item.id, name, desktop: validateDesktopViewState(item.desktop) }
  })
}
