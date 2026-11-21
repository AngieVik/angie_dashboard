import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'

export const NOTICE_LEVELS = ['message', 'success', 'info', 'warning', 'error', 'loading'] as const
export type NoticeLevel = typeof NOTICE_LEVELS[number]
export const NOTICE_LEVEL_LABELS: Record<NoticeLevel, string> = { message: 'Aviso', success: 'Completado', info: 'Información', warning: 'Advertencia', error: 'Error', loading: 'En curso' }
export const NOTICE_DURATION_DEFAULT = 5
export const NOTICE_DURATION_MIN = 1
export const NOTICE_DURATION_MAX = 120
const NOTICE_TEXT_LIMIT = 500

// Dynamic diagnostics keep their original detail unless the user replaces the template.
export const NOTICE_CATALOG = {
  validation: { level: 'error', label: 'Validación de datos', text: '{detalle}' },
  inputBudget: { level: 'error', label: 'Límite de texto', text: '{detalle}' },
  formValidation: { level: 'error', label: 'Validación de formularios', text: '{detalle}' },
  calendar: { level: 'error', label: 'Calendario · Error', text: '{detalle}' },
  timerStorage: { level: 'error', label: 'Reloj · Almacenamiento', text: '{detalle}' },
  timerAudio: { level: 'error', label: 'Reloj · Sonido', text: '{detalle}' },
  arrangement: { level: 'error', label: 'Vista · Distribución', text: '{detalle}' },
  viewRestoreError: { level: 'error', label: 'Vista · Error al recuperar', text: '{detalle}' },
  viewRestored: { level: 'success', label: 'Vista recuperada', text: 'Vista recuperada.' },
  cleanup: { level: 'error', label: 'Limpieza · Error', text: '{detalle}' },
  clipboardRead: { level: 'error', label: 'Coordenadas · Lectura del portapapeles', text: 'No se pudo leer el portapapeles.' },
  coordinateUnavailable: { level: 'error', label: 'Coordenadas · Conversión no disponible', text: '{detalle}' },
  clipboardPaste: { level: 'error', label: 'Coordenadas · Pegado', text: 'No se pudo pegar. Pega las coordenadas manualmente.' },
  copied: { level: 'success', label: 'Coordenadas copiadas', text: 'Copiado.' },
  copyError: { level: 'error', label: 'Coordenadas · Error al copiar', text: 'No se pudo copiar.' },
  boardImage: { level: 'error', label: 'Pizarra · Imagen de fondo', text: '{detalle}' },
  boardEdit: { level: 'error', label: 'Pizarra · Edición', text: '{detalle}' },
  boardPoints: { level: 'error', label: 'Pizarra · Límite de puntos', text: '{detalle}' },
  planEdit: { level: 'error', label: 'Plano operativo · Edición', text: '{detalle}' },
  planInput: { level: 'error', label: 'Plano operativo · Validación', text: '{detalle}' },
  planCopy: { level: 'error', label: 'Plano operativo · Copiar coordenadas', text: 'No se pudieron copiar las coordenadas.' },
  settingsError: { level: 'error', label: 'Configuración · Error', text: '{detalle}' },
  settingsSaved: { level: 'success', label: 'Configuración guardada', text: 'Configuración guardada.' },
  locationSearch: { level: 'error', label: 'Ubicación · Búsqueda', text: '{detalle}' },
  documentLocal: { level: 'error', label: 'Documento · Recuperación local', text: 'Recuperación del dispositivo no disponible.' },
  documentOperation: { level: 'error', label: 'Documento · Operación fallida', text: 'No se pudo completar la operación.' },
  storagePermission: { level: 'warning', label: 'Almacenamiento · Permiso', text: 'En Chrome o Edge puedes instalar Angie o añadirla a favoritos y volver a solicitarlo. Esto puede favorecer la concesión, pero no la garantiza.' },
  storageEstimateError: { level: 'error', label: 'Almacenamiento · Error al estimar espacio', text: '{detalle}' },
  storageEstimated: { level: 'success', label: 'Almacenamiento · Espacio actualizado', text: 'Estimación de espacio actualizada.' },
  mapSearch: { level: 'error', label: 'Mapa · Error de búsqueda', text: '{detalle}' },
  mapSearchEmpty: { level: 'message', label: 'Mapa · Búsqueda sin resultados', text: 'No se encontraron lugares.' },
  mapSave: { level: 'error', label: 'Mapa · Guardado', text: '{detalle}' },
  gpxPicker: { level: 'error', label: 'Mapa · Selector GPX', text: 'No se pudo abrir el selector GPX. Vuelve a seleccionar el archivo.' },
  gpxLoad: { level: 'error', label: 'Mapa · Carga GPX', text: 'No se pudieron cargar algunos archivos GPX.' },
  gpxPoint: { level: 'error', label: 'Mapa · Selección de punto GPX', text: '{detalle}' },
  mapCopy: { level: 'error', label: 'Mapa · Copiar coordenada', text: 'No se pudo copiar la coordenada.' },
  reportPreview: { level: 'error', label: 'Informes · Vista previa', text: '{detalle}' },
  reportGenerate: { level: 'error', label: 'Informes · Generación', text: '{detalle}' },
  reportSave: { level: 'error', label: 'Informes · Guardado', text: 'No se pudo guardar el informe.' },
  reportPrint: { level: 'error', label: 'Informes · Impresión', text: 'No se pudo abrir la impresión.' },
  centerLocal: { level: 'warning', label: 'Centro de avisos · Recuperación local', text: '{detalle}' },
  centerFile: { level: 'warning', label: 'Centro de avisos · Archivo', text: '{detalle}' },
  centerClock: { level: 'warning', label: 'Centro de avisos · Reloj', text: '{detalle}' },
  centerBoard: { level: 'warning', label: 'Centro de avisos · Pizarra', text: '{detalle}' },
  centerMap: { level: 'warning', label: 'Centro de avisos · Mapa', text: '{detalle}' },
  centerPlan: { level: 'warning', label: 'Centro de avisos · Plano operativo', text: '{detalle}' },
  centerReports: { level: 'warning', label: 'Centro de avisos · Informes', text: '{detalle}' },
} as const
export type NoticeId = keyof typeof NOTICE_CATALOG
interface NoticeOverride { enabled: boolean; text: string; levels?: NoticeLevel[] }
export interface NoticePreferences { duration: number; levels: NoticeLevel[]; messages: Record<string, NoticeOverride> }
export function defaultNoticePreferences(): NoticePreferences { return { duration: NOTICE_DURATION_DEFAULT, levels: [...NOTICE_LEVELS], messages: {} } }

export function validateNoticePreferences(value: unknown): NoticePreferences {
  const invalid = () => new Error('La configuración de avisos no es válida.')
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3
    || !('duration' in value) || typeof value.duration !== 'number' || !Number.isInteger(value.duration) || value.duration < NOTICE_DURATION_MIN || value.duration > NOTICE_DURATION_MAX
    || !('levels' in value) || !Array.isArray(value.levels) || value.levels.length > NOTICE_LEVELS.length || new Set(value.levels).size !== value.levels.length
    || value.levels.some(level => !NOTICE_LEVELS.includes(level))
    || !('messages' in value) || !value.messages || typeof value.messages !== 'object' || Array.isArray(value.messages)) throw invalid()
  const entries = Object.entries(value.messages)
  if (entries.length > INPUT_BUDGETS.collectionItems) throw invalid()
  let characters = 0
  const messages: [string, NoticeOverride][] = []
  for (const [key, entry] of entries) {
    if (!key.trim() || key.length > INPUT_BUDGETS.textCharacters || !entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).some(key => !['enabled', 'text', 'levels'].includes(key))
      || typeof entry.enabled !== 'boolean' || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > Math.max(NOTICE_TEXT_LIMIT, key.length)) throw invalid()
    if ('levels' in entry && (!Array.isArray(entry.levels) || entry.levels.length === 0 || entry.levels.length > NOTICE_LEVELS.length
      || new Set(entry.levels).size !== entry.levels.length || entry.levels.some((level: unknown) => !NOTICE_LEVELS.some(known => known === level)))) throw invalid()
    characters += key.length + entry.text.length
    if (characters > INPUT_BUDGETS.totalTextCharacters) throw invalid()
    messages.push([key, { enabled: entry.enabled, text: entry.text, ...('levels' in entry ? { levels: [...entry.levels] } : {}) }])
  }
  return { duration: value.duration, levels: [...value.levels], messages: Object.fromEntries(messages) }
}

export function noticeEnabled(preferences: NoticePreferences, id: NoticeId, level: NoticeLevel, detail?: string) {
  const message = detail === undefined ? undefined : Object.hasOwn(preferences.messages, detail) ? preferences.messages[detail] : undefined
  return preferences.levels.includes(level) && (message?.enabled ?? preferences.messages[id]?.enabled ?? true)
}
export function noticeText(preferences: NoticePreferences, id: NoticeId, detail: string) {
  const saved = Object.hasOwn(preferences.messages, detail) ? preferences.messages[detail] : undefined
  if (saved) return saved.text
  const template = preferences.messages[id]?.text ?? '{detalle}'
  return template.replaceAll('{detalle}', () => detail)
}
