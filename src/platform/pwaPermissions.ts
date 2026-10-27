import { rememberWorkDirectoryAccess, readWorkDirectoryConfiguration } from '../storage/workDirectoryAccessRepository'
import type { WorkDirectoryHandle } from '../storage/workDirectoryAccessRepository'

export type PermissionStatus = 'granted' | 'pending' | 'denied' | 'unavailable' | 'error'
export interface PermissionSnapshot { status: PermissionStatus; message?: string }
export interface WorkDirectoryPermission extends PermissionSnapshot { handle: WorkDirectoryHandle | null; prepared?: boolean; isContainer?: boolean }

export function directoryErrorMessage(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : ''
  if (name === 'NotAllowedError') return 'Acceso no autorizado. Revisa el permiso de archivos del sitio.'
  if (name === 'SecurityError') return 'El acceso a carpetas requiere HTTPS o localhost.'
  if (name === 'NotFoundError') return 'La carpeta contenedora no está disponible.'
  if (name === 'QuotaExceededError') return 'No hay espacio disponible.'
  if (name === 'TypeMismatchError') return 'Existe un archivo llamado angie_dashboard en esa ubicación.'
  if (name === 'NoModificationAllowedError') return 'No se puede escribir en esa ubicación.'
  return error instanceof Error ? error.message : 'No se pudo preparar la carpeta.'
}

type DirectoryBrowser = Window & {
  showDirectoryPicker?: (options: { id: string; mode: 'readwrite'; startIn: 'documents' }) => Promise<WorkDirectoryHandle>
}

function directoryPicker() {
  return window.isSecureContext === false ? undefined : (window as DirectoryBrowser).showDirectoryPicker
}

function permissionStatus(permission: PermissionState): PermissionStatus {
  return permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'pending'
}

function cancelled(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export async function readPersistentStorage(): Promise<PermissionSnapshot> {
  if (!navigator.storage?.persisted || !navigator.storage.persist) return { status: 'unavailable' }
  try { return { status: await navigator.storage.persisted() ? 'granted' : 'pending' } }
  catch { return { status: 'error', message: 'No se pudo consultar el almacenamiento persistente.' } }
}

export async function requestPersistentStorage(): Promise<PermissionSnapshot> {
  if (!navigator.storage?.persist) return { status: 'unavailable' }
  try {
    return await navigator.storage.persist() ? { status: 'granted' } : {
      status: 'pending', message: 'El navegador no ha concedido el almacenamiento persistente.',
    }
  } catch { return { status: 'error', message: 'No se pudo solicitar el almacenamiento persistente.' } }
}

export async function readWorkDirectory(): Promise<WorkDirectoryPermission> {
  if (!directoryPicker()) return { handle: null, status: 'unavailable', message: window.isSecureContext === false
    ? 'El acceso a carpetas requiere HTTPS o localhost.' : undefined }
  let handle: WorkDirectoryHandle | null = null
  let isContainer: boolean | undefined
  try {
    const configuration = await readWorkDirectoryConfiguration()
    handle = configuration?.handle ?? null
    isContainer = configuration?.isContainer
    return { handle, isContainer,
      status: handle ? permissionStatus(await handle.queryPermission({ mode: 'readwrite' })) : 'pending' }
  } catch (error) { return { handle, isContainer, status: 'error', message: handle ? directoryErrorMessage(error) : 'No se pudo consultar la carpeta recordada.' } }
}

async function rememberAuthorizedDirectory(handle: WorkDirectoryHandle, isContainer?: boolean): Promise<WorkDirectoryPermission> {
  if (!handle.getDirectoryHandle) return { handle, status: 'unavailable', message: 'Este navegador no permite preparar carpetas.' }
  try {
    const root = isContainer || handle.name.toLowerCase() !== 'angie_dashboard' ? await handle.getDirectoryHandle('angie_dashboard', { create: true }) : handle
    if (!root.getFileHandle || !root.removeEntry) return { handle, isContainer, status: 'unavailable', message: 'Este navegador no permite preparar la carpeta de trabajo.' }
    const token = crypto.randomUUID(), name = '.angie-acceso-' + token
    let created = false
    try {
      const file = await root.getFileHandle(name, { create: true })
      created = true
      const stream = await file.createWritable()
      try { await stream.write(token); await stream.close() }
      catch (error) { try { await stream.abort?.() } catch { /* Preserve the original failure. */ } throw error }
      if (await (await file.getFile()).text() !== token) throw new Error('No se pudo verificar la escritura en esa ubicación. Elige otra carpeta de trabajo.')
      await root.removeEntry(name)
      created = false
    } finally { if (created) await root.removeEntry(name).catch(() => {}) }
  } catch (error) { return { handle, isContainer, status: 'error', message: directoryErrorMessage(error) } }
  try {
    await rememberWorkDirectoryAccess(handle, isContainer)
    return { handle, isContainer, prepared: true, status: 'granted' }
  } catch {
    return { handle, isContainer, prepared: true, status: 'granted', message: 'Ubicación disponible solo durante esta sesión.' }
  }
}

export async function chooseWorkDirectory(current: WorkDirectoryPermission): Promise<WorkDirectoryPermission> {
  const pick = directoryPicker()
  if (!pick) return { ...current, status: 'unavailable', message: window.isSecureContext === false
    ? 'El acceso a carpetas requiere HTTPS o localhost.' : undefined }
  try {
    // Invoke the native picker before any await to preserve user activation.
    const handle = await pick.call(window, { id: 'angie-dashboard-work-directory', mode: 'readwrite', startIn: 'documents' })
    const permission = await handle.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      return { ...current, prepared: false, status: current.handle ? current.status : permissionStatus(permission),
        message: current.handle ? 'No se autorizó la nueva carpeta. Se conserva la selección anterior.' : 'Acceso a la carpeta no autorizado.' }
    }
    // New selections always authorize the container so Angie can recreate its root.
    const selected = await rememberAuthorizedDirectory(handle, true)
    // A failed selection must not replace the displayed, remembered location.
    return selected.prepared ? selected : { ...current, prepared: false, status: current.handle ? current.status : selected.status, message: selected.message }
  } catch (error) {
    return cancelled(error) ? { ...current, prepared: false } : { ...current, prepared: false, status: current.handle ? current.status : 'error', message: directoryErrorMessage(error) }
  }
}

export async function authorizeWorkDirectory(current: WorkDirectoryPermission): Promise<WorkDirectoryPermission> {
  if (!current.handle) return chooseWorkDirectory(current)
  try {
    // Renew only from a button press, never while opening the panel.
    const permission = await current.handle.requestPermission({ mode: 'readwrite' })
    return permission === 'granted' ? await rememberAuthorizedDirectory(current.handle, current.isContainer) : {
      ...current, prepared: false, status: permissionStatus(permission), message: directoryErrorMessage(new DOMException('', 'NotAllowedError')),
    }
  } catch (error) {
    if (cancelled(error)) return { ...current, prepared: false }
    // A rejected renewal must not leave a previously granted label on screen.
    const status = await current.handle.queryPermission({ mode: 'readwrite' }).then(permissionStatus, () => 'error' as const)
    return { ...current, prepared: false, status: status === 'granted' ? 'error' : status, message: directoryErrorMessage(error) }
  }
}
