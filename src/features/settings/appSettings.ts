import type { ModuleId } from '@/layout/layoutTypes'
import { SETTINGS_MODULE_IDS } from './settingsModuleOrder'
import { validateSavedDesktopViews } from './savedDesktopViews'
import type { SavedDesktopView } from './savedDesktopViews'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN, ZOOM_STEP_DEFAULT, ZOOM_STEP_MAX } from '@/layout/viewportMath'
import { defaultNoticePreferences, validateNoticePreferences } from '../notices/noticePreferences'
import type { NoticePreferences } from '../notices/noticePreferences'
import { defaultAccessibilityPreferences, validateAccessibilityPreferences } from './accessibilityPreferences'
import type { AccessibilityPreferences } from './accessibilityPreferences'
import { defaultFormatPreferences, validateFormatPreferences } from './formatPreferences'
import type { FormatPreferences } from './formatPreferences'
import { DEFAULT_MAGNET_OPTIONS, MAGNET_DISTANCE_MIN, MAGNET_DISTANCE_MAX } from '@/layout/magnetSettings'

interface DefaultLocation {
  name: string
  latitude: number
  longitude: number
  timeZone: string
}
type InitialArrangement = 'ordered' | 'bars'
export interface AppSettings { location: DefaultLocation | null; noticesAlwaysVisible: boolean; notices: NoticePreferences; magnetByDefault: boolean; magnetDistance: number; magnetAlignEdges: boolean; accessibility: AccessibilityPreferences; formats: FormatPreferences; initialModules: ModuleId[] | null; initialArrangement: InitialArrangement; initialZoom: number; zoomStep: number; savedDesktopViews: SavedDesktopView[] }
export function emptySettings(): AppSettings { return { location: null, noticesAlwaysVisible: false, notices: defaultNoticePreferences(), magnetByDefault: false, magnetDistance: DEFAULT_MAGNET_OPTIONS.distance, magnetAlignEdges: DEFAULT_MAGNET_OPTIONS.alignEdges, accessibility: defaultAccessibilityPreferences(), formats: defaultFormatPreferences(), initialModules: null, initialArrangement: 'ordered', initialZoom: 1, zoomStep: ZOOM_STEP_DEFAULT, savedDesktopViews: [] } }

export function validateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['location', 'noticesAlwaysVisible', 'notices', 'magnetByDefault', 'magnetDistance', 'magnetAlignEdges', 'accessibility', 'formats', 'initialModules', 'initialArrangement', 'initialZoom', 'zoomStep', 'savedDesktopViews'].includes(key)) || !('location' in value)) throw new Error('Configuración guardada inválida.')
  const notices = 'notices' in value ? validateNoticePreferences(value.notices) : defaultNoticePreferences()
  const accessibility = 'accessibility' in value ? validateAccessibilityPreferences(value.accessibility) : defaultAccessibilityPreferences()
  const formats = 'formats' in value ? validateFormatPreferences(value.formats) : defaultFormatPreferences()
  const magnetDistance = 'magnetDistance' in value ? value.magnetDistance : DEFAULT_MAGNET_OPTIONS.distance
  if (typeof magnetDistance !== 'number' || !Number.isInteger(magnetDistance) || magnetDistance < MAGNET_DISTANCE_MIN || magnetDistance > MAGNET_DISTANCE_MAX) throw new Error('La distancia de atracción no es válida.')
  const magnetAlignEdges = 'magnetAlignEdges' in value ? value.magnetAlignEdges : DEFAULT_MAGNET_OPTIONS.alignEdges
  if (typeof magnetAlignEdges !== 'boolean') throw new Error('La alineación con bordes no es válida.')
  const savedDesktopViews = 'savedDesktopViews' in value ? validateSavedDesktopViews(value.savedDesktopViews) : []
  const zoomStep = 'zoomStep' in value ? value.zoomStep : ZOOM_STEP_DEFAULT
  if (typeof zoomStep !== 'number' || !Number.isInteger(zoomStep) || zoomStep < ZOOM_STEP_DEFAULT || zoomStep > ZOOM_STEP_MAX) throw new Error('El paso de zoom no es válido.')
  const initialArrangement = 'initialArrangement' in value ? value.initialArrangement : 'ordered'
  if (initialArrangement !== 'ordered' && initialArrangement !== 'bars') throw new Error('La disposición inicial no es válida.')
  const initialZoom = 'initialZoom' in value ? value.initialZoom : 1
  if (typeof initialZoom !== 'number' || !Number.isFinite(initialZoom) || initialZoom < VIEWPORT_ZOOM_MIN || initialZoom > VIEWPORT_ZOOM_MAX) throw new Error('El zoom inicial no es válido.')
  let initialModules: ModuleId[] | null = null
  if ('initialModules' in value && value.initialModules !== null) {
    const modules = value.initialModules
    if (!Array.isArray(modules) || modules.length > SETTINGS_MODULE_IDS.length || new Set(modules).size !== modules.length
      || modules.some(id => typeof id !== 'string' || !SETTINGS_MODULE_IDS.some(module => module === id))) throw new Error('Los módulos de la vista inicial no son válidos.')
    initialModules = SETTINGS_MODULE_IDS.filter(id => modules.includes(id))
  }
  const general = { noticesAlwaysVisible: false, magnetByDefault: false }
  for (const key of ['noticesAlwaysVisible', 'magnetByDefault'] as const) {
    if (key in value) {
      const preference: unknown = Reflect.get(value, key)
      if (typeof preference !== 'boolean') throw new Error('Configuración guardada inválida.')
      general[key] = preference
    }
  }
  if (value.location === null) return { ...emptySettings(), ...general, notices, magnetDistance, magnetAlignEdges, accessibility, formats, initialModules, initialArrangement, initialZoom, zoomStep, savedDesktopViews }
  const point = value.location
  if (!point || typeof point !== 'object' || Object.keys(point).length !== 4 || !('name' in point) || !('latitude' in point) || !('longitude' in point) || !('timeZone' in point)
    || typeof point.name !== 'string' || !point.name.trim() || point.name.trim().length > 160
    || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90
    || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180
    || typeof point.timeZone !== 'string') throw new Error('La ubicación predeterminada no es válida.')
  try { new Intl.DateTimeFormat('es', { timeZone: point.timeZone }).format(new Date()) }
  catch { throw new Error('La zona horaria no es válida.') }
  return { ...general, notices, magnetDistance, magnetAlignEdges, accessibility, formats, initialModules, initialArrangement, initialZoom, zoomStep, savedDesktopViews, location: { name: point.name.trim(), latitude: point.latitude, longitude: point.longitude, timeZone: point.timeZone } }
}
