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
  granted: 'Autorizado', pending: 'No concedido', denied: 'No concedido', unavailable: 'No disponible', error: 'Error',
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
    if (loading || busy) return
    setBusy(true)
    try {
      const next = await requestPersistentStorage()
      if (!dismissed.current) {
        setStorage(next)
        if (next.status === 'denied') toast.warning('En Chrome o Edge puedes instalar Angie o añadirla a favoritos y volver a solicitarlo. Esto puede favorecer la concesión, pero no la garantiza.', { notice: 'storagePermission', id: 'storage-permission' })
        else toast.dismiss('storage-permission')
      }
    } finally { if (!dismissed.current) setBusy(false) }
  }

  async function updateCapacity() {
    const next = await readStorageCapacity()
    if (dismissed.current) return
    setCapacity(next)
    if (next.estimateError || next.usage === undefined || next.quota === undefined) {
      toast.error(next.estimateError ?? 'Estimación de espacio no disponible.', { notice: 'storageEstimateError', id: 'storage-capacity' })
    } else toast.success('Estimación de espacio actualizada.', { notice: 'storageEstimated', id: 'storage-capacity' })
  }

  return <div className="permissions-list" aria-busy={loading || busy}>
    <section className="permission-section" aria-labelledby="storage-permission-title">
      <div className="permission-heading">
        <h3 id="storage-permission-title">Almacenamiento persistente</h3>
        <span role="status">{loading ? 'Consultando…' : busy ? 'Solicitando…' : labels[storage.status]}</span>
      </div>
      <Button disabled={loading || busy || storage.status === 'unavailable' || storage.status === 'granted'} onClick={() => { void requestStorage() }}>{busy ? 'Solicitando…' : 'Solicitar permiso'}</Button>
      {storage.message && <p role={storage.status === 'error' ? 'alert' : 'status'}>{storage.message}</p>}
      <StorageUsage capacity={capacity} />
      <Button disabled={busy} onClick={() => { void updateCapacity() }}>Actualizar</Button>
    </section>
  </div>
}
