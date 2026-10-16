import { readWorkDirectoryAccess, rememberWorkDirectoryAccess } from '../storage/workDirectoryAccessRepository'
import type { WorkDirectoryHandle } from '../storage/workDirectoryAccessRepository'

export type PermissionStatus = 'granted' | 'pending' | 'denied' | 'unavailable' | 'error'
export interface PermissionSnapshot { status: PermissionStatus; message?: string }
export interface WorkDirectoryPermission extends PermissionSnapshot { handle: WorkDirectoryHandle | null }

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
  if (!directoryPicker()) return { handle: null, status: 'unavailable' }
  let handle: WorkDirectoryHandle | null = null
  try {
    handle = await readWorkDirectoryAccess()
    return { handle, status: handle ? permissionStatus(await handle.queryPermission({ mode: 'readwrite' })) : 'pending' }
  } catch { return { handle, status: 'error', message: 'No se pudo consultar la carpeta recordada.' } }
}

async function rememberAuthorizedDirectory(handle: WorkDirectoryHandle): Promise<WorkDirectoryPermission> {
  try {
    await rememberWorkDirectoryAccess(handle)
    return { handle, status: 'granted' }
  } catch {
    return { handle, status: 'granted', message: 'No se pudo recordar la carpeta. Autorizada solo para esta apertura.' }
  }
}

export async function chooseWorkDirectory(current: WorkDirectoryPermission): Promise<WorkDirectoryPermission> {
  const pick = directoryPicker()
  if (!pick) return { ...current, status: 'unavailable' }
  try {
    // Invoke the native picker before any await to preserve user activation.
    const handle = await pick.call(window, { id: 'angie-dashboard-work-directory', mode: 'readwrite', startIn: 'documents' })
    if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      return { ...current, message: 'No se autorizó la nueva carpeta. Se conserva la selección anterior.' }
    }
    return await rememberAuthorizedDirectory(handle)
  } catch (error) {
    return cancelled(error) ? current : { ...current, message: 'No se pudo autorizar la carpeta. Se conserva la selección anterior.' }
  }
}

export async function authorizeWorkDirectory(current: WorkDirectoryPermission): Promise<WorkDirectoryPermission> {
  if (!current.handle) return chooseWorkDirectory(current)
  try {
    // Renew only from a button press, never while opening the panel.
    const permission = await current.handle.requestPermission({ mode: 'readwrite' })
    return permission === 'granted' ? await rememberAuthorizedDirectory(current.handle) : {
      handle: current.handle, status: permissionStatus(permission), message: 'El navegador no ha autorizado el acceso a la carpeta.',
    }
  } catch (error) {
    if (cancelled(error)) return current
    // A rejected renewal must not leave a previously granted label on screen.
    const status = await current.handle.queryPermission({ mode: 'readwrite' }).then(permissionStatus, () => 'error' as const)
    return { handle: current.handle, status, message: 'No se pudo renovar el acceso. Puedes volver a seleccionar la carpeta.' }
  }
}
