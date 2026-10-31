import { emptySettings, validateSettings } from './appSettings'
import type { AppSettings } from './appSettings'
import { SettingsRepository } from './settingsRepository'
import type { SettingsStorage } from './settingsRepository'

export function createSettingsStore(repository: SettingsStorage) {
  let state = { settings: emptySettings(), revision: null as number | null, ready: false, loading: false, saving: false, error: null as string | null }
  const listeners = new Set<() => void>()
  function update(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo acceder a la configuración.'
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async reload() {
      if (state.loading || state.saving) return
      update({ loading: true })
      try { update({ ...await repository.load(), ready: true, error: null }) }
      catch (error) { update({ ready: false, error: message(error) }) }
      finally { update({ loading: false }) }
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
  }
}
export type SettingsStore = ReturnType<typeof createSettingsStore>
let browserSettings: SettingsStore | undefined
export function getSettingsStore() { browserSettings ??= createSettingsStore(new SettingsRepository()); return browserSettings }
