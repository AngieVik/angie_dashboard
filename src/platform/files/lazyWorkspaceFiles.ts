import type { WorkspaceFiles } from './workspaceFiles'

// One facade per browser store keeps the service's write queue, conflict
// baselines and catalog together, without loading the service at startup.
export function createLazyBrowserWorkspaceFiles(): Required<WorkspaceFiles> {
  let files: Required<WorkspaceFiles> | undefined
  let loading: Promise<Required<WorkspaceFiles>> | undefined
  function load() {
    loading ??= import('./workspaceFiles').then(module => {
      files = module.createBrowserWorkspaceFiles()
      return files
    }).catch(error => {
      loading = undefined
      throw new Error('No se pudo cargar la gestión de carpetas. Reintenta la operación.', { cause: error })
    })
    return loading
  }

  // The store passes immutable document revisions and prepared snapshots.
  // Forward those same arguments after loading; do not read the active store.
  return {
    save: (...args) => load().then(service => service.save(...args)),
    create: (...args) => load().then(service => service.create(...args)),
    rename: (...args) => load().then(service => service.rename(...args)),
    saveReport: (...args) => load().then(service => service.saveReport(...args)),
    readGpx: (...args) => load().then(service => service.readGpx(...args)),
    availableName: (...args) => load().then(service => service.availableName(...args)),
    listRecoverable: (...args) => load().then(service => service.listRecoverable(...args)),
    listRecoveryPage: (...args) => load().then(service => service.listRecoveryPage(...args)),
    loadRecoverable: (...args) => load().then(service => service.loadRecoverable(...args)),
    // Before initialization there is no in-memory catalog to invalidate.
    invalidateRecoveryCatalog: () => files?.invalidateRecoveryCatalog(),
  }
}
