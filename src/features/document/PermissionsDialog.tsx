import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { readPersistentStorage, requestPersistentStorage } from '../../platform/pwaPermissions'
import type { PermissionSnapshot, PermissionStatus } from '../../platform/pwaPermissions'
import './permissions.css'
import { readStorageCapacity } from '@/platform/storageCapacity'
import type { StorageCapacity } from '@/platform/storageCapacity'
import { StorageUsage } from './StorageUsage'

const labels: Record<PermissionStatus, string> = {
  granted: 'Autorizado', pending: 'Pendiente', denied: 'No autorizado', unavailable: 'No disponible', error: 'Error',
}

export function StoragePermissionsPanel() {
  const [storage, setStorage] = useState<PermissionSnapshot>({ status: 'pending' })
  const [capacity, setCapacity] = useState<StorageCapacity>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const dismissed = useRef(false)

  useEffect(() => {
    dismissed.current = false
    let active = true
    void readPersistentStorage().then(local => {
      if (active) { setStorage(local); setLoading(false) }
    })
    void readStorageCapacity().then(value => { if (active) setCapacity(value) })
    return () => { active = false; dismissed.current = true }
  }, [])

  async function requestStorage() {
    setBusy(true)
    try {
      const next = await requestPersistentStorage()
      if (!dismissed.current && next.status !== 'granted') toast.error(next.message ?? 'No se pudo autorizar el almacenamiento.', { id: 'storage-permission' })
      if (!dismissed.current) setStorage(next)
    } finally { if (!dismissed.current) setBusy(false) }
  }

  return <div className="permissions-list" aria-busy={loading || busy}>
    <section className="permission-section" aria-labelledby="storage-permission-title">
      <div className="permission-heading">
        <h3 id="storage-permission-title">Almacenamiento persistente</h3>
        <span role="status">{loading ? 'Consultando…' : labels[storage.status]}</span>
      </div>
      <Button disabled={loading || busy || storage.status === 'unavailable' || storage.status === 'granted'} onClick={() => { void requestStorage() }}>Autorizar</Button>
      <StorageUsage capacity={capacity} />
      <Button disabled={busy} onClick={() => { void readStorageCapacity().then(value => { if (!dismissed.current) setCapacity(value) }) }}>Actualizar espacio</Button>
    </section>
  </div>
}
