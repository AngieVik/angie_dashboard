export type PermissionStatus = 'granted' | 'pending' | 'denied' | 'unavailable' | 'error'
export interface PermissionSnapshot { status: PermissionStatus; message?: string }

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
