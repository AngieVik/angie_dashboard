import { emptySettings, validateSettings } from './appSettings'
import type { AppSettings } from './appSettings'
import { SettingsRepository } from './settingsRepository'
import type { SettingsStorage } from './settingsRepository'
import type { ModuleId } from '@/layout/layoutTypes'
import { SETTINGS_MODULE_IDS } from './settingsModuleOrder'
import type { DesktopViewState } from './savedDesktopViews'
import { applySettingsNumberDrafts } from './settingsNumberDrafts'
import type { SettingsNumberDrafts, SettingsNumberKey } from './settingsNumberDrafts'

export function createSettingsStore(repository: SettingsStorage) {
  let state = { settings: emptySettings(), numberDrafts: {} as SettingsNumberDrafts, revision: null as number | null, ready: false, loading: false, saving: false, error: null as string | null }
  const listeners = new Set<() => void>()
  function update(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo acceder a la configuración.'
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async reload() {
      if (state.loading || state.saving) return
      update({ loading: true })
      try { update({ ...await repository.load(), numberDrafts: {}, ready: true, error: null }) }
      catch (error) { update({ ready: false, error: message(error) }) }
      finally { update({ loading: false }) }
    },
    // Transient editors used by the configuration draft; save remains the persistence boundary.
    setNumberDraft(key: SettingsNumberKey, value: string | null) {
      if (!state.ready || state.loading || state.saving) return
      const numberDrafts = { ...state.numberDrafts }
      if (value === null) delete numberDrafts[key]
      else numberDrafts[key] = value
      update({ numberDrafts })
    },
    commitNumberDraft(key: SettingsNumberKey) {
      if (!state.ready || state.loading || state.saving || state.numberDrafts[key] === undefined) return
      const settings = applySettingsNumberDrafts(state.settings, { [key]: state.numberDrafts[key] })
      const numberDrafts = { ...state.numberDrafts }
      delete numberDrafts[key]
      update({ settings, numberDrafts })
    },
    resetToDefaults() {
      if (!state.ready || state.loading || state.saving) return false
      update({ settings: { ...emptySettings(), savedDesktopViews: state.settings.savedDesktopViews }, numberDrafts: {}, error: null })
      return true
    },
    async save(settings: AppSettings, expectedRevision: number | null) {
      if (!state.ready || state.loading || state.saving) return false
      update({ saving: true })
      try {
        const copy = validateSettings(settings), revision = await repository.save(copy, expectedRevision)
        update({ settings: copy, revision, error: null })
        return true
      } catch (error) { update({ error: message(error) }); return false }
      finally { update({ saving: false }) }
    },
    async updateGeneral(patch: Partial<Pick<AppSettings, 'noticesAlwaysVisible'>>) {
      return this.save({ ...state.settings, ...patch }, state.revision)
    },
    async updateNotices(patch: Partial<AppSettings['notices']>) {
      return this.save({ ...state.settings, notices: { ...state.settings.notices, ...patch } }, state.revision)
    },
    async setInitialModule(id: ModuleId, checked: boolean) {
      const selected = state.settings.initialModules ?? []
      const initialModules = SETTINGS_MODULE_IDS.filter(module => module === id ? checked : selected.includes(module))
      return this.save({ ...state.settings, initialModules }, state.revision)
    },
    async updateInitialView(patch: Partial<Pick<AppSettings, 'initialArrangement'>>) {
      return this.save({ ...state.settings, ...patch }, state.revision)
    },
    async updateZoom(patch: Partial<Pick<AppSettings, 'initialZoom' | 'zoomStep'>>) {
      return this.save({ ...state.settings, ...patch }, state.revision)
    },
    async updateMagnet(patch: Partial<Pick<AppSettings, 'magnetByDefault' | 'magnetDistance' | 'magnetAlignEdges'>>) {
      return this.save({ ...state.settings, ...patch }, state.revision)
    },
    async updateAccessibility(patch: Partial<AppSettings['accessibility']>) {
      return this.save({ ...state.settings, accessibility: { ...state.settings.accessibility, ...patch } }, state.revision)
    },
    async updateFormats(patch: Partial<AppSettings['formats']>) {
      return this.save({ ...state.settings, formats: { ...state.settings.formats, ...patch } }, state.revision)
    },
    async saveDesktopView(name: string, desktop: DesktopViewState) {
      if (!state.ready || state.loading || state.saving) return null
      const id = crypto.randomUUID()
      const saved = await this.save({ ...state.settings, savedDesktopViews: [...state.settings.savedDesktopViews, { id, name, desktop }] }, state.revision)
      return saved ? id : null
    },
  }
}
export type SettingsStore = ReturnType<typeof createSettingsStore>

// Reuse validation and editing operations without writing preferences until Save.
export function createSettingsDraft(source: SettingsStore) {
  let baseRevision: number | null = null
  let savedSettings = emptySettings()
  let committing = false
  const store = createSettingsStore({
    async load() {
      await source.reload()
      const current = source.getSnapshot()
      if (!current.ready || current.error) throw new Error(current.error ?? 'No se pudo cargar la configuración.')
      baseRevision = current.revision
      savedSettings = current.settings
      return { settings: current.settings, revision: baseRevision }
    },
    async save(settings, revision) {
      if (!committing) return revision ?? 0
      if (!await source.save(settings, baseRevision)) throw new Error(source.getSnapshot().error ?? 'No se pudo guardar la configuración.')
      baseRevision = source.getSnapshot().revision
      savedSettings = source.getSnapshot().settings
      return baseRevision ?? 0
    },
  })
  return {
    store,
    getSavedSettings: () => savedSettings,
    async commit(settings: AppSettings) {
      if (store.getSnapshot().saving || committing) return false
      committing = true
      try {
        const saved = await store.save(settings, store.getSnapshot().revision)
        if (saved) for (const key of Object.keys(store.getSnapshot().numberDrafts) as SettingsNumberKey[]) store.setNumberDraft(key, null)
        return saved
      }
      finally { committing = false }
    },
  }
}
let browserSettings: SettingsStore | undefined
export function getSettingsStore() { browserSettings ??= createSettingsStore(new SettingsRepository()); return browserSettings }
