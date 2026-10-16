import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../../components/ui/alert-dialog'
import { authorizeWorkDirectory, chooseWorkDirectory, readPersistentStorage, readWorkDirectory, requestPersistentStorage } from '../../platform/pwaPermissions'
import type { PermissionSnapshot, PermissionStatus, WorkDirectoryPermission } from '../../platform/pwaPermissions'
import './permissions.css'

const labels: Record<PermissionStatus, string> = {
  granted: 'Autorizado', pending: 'Pendiente', denied: 'No autorizado', unavailable: 'No disponible', error: 'Error de consulta',
}

export function PermissionsDialog({ onClose, onCloseFocus, onDirectoryAuthorized }: { onClose: () => void; onCloseFocus: () => void; onDirectoryAuthorized: () => Promise<unknown> }) {
  const [storage, setStorage] = useState<PermissionSnapshot>({ status: 'pending' })
  const [directory, setDirectory] = useState<WorkDirectoryPermission>({ handle: null, status: 'pending' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([readPersistentStorage(), readWorkDirectory()]).then(([local, folder]) => {
      if (active) { setStorage(local); setDirectory(folder); setLoading(false) }
    })
    return () => { active = false }
  }, [])

  async function requestStorage() {
    setBusy(true)
    try { setStorage(await requestPersistentStorage()) }
    finally { setBusy(false) }
  }

  async function requestDirectory(select: boolean) {
    setBusy(true)
    try {
      const next = await (select ? chooseWorkDirectory(directory) : authorizeWorkDirectory(directory))
      setDirectory(next)
      if (next.status === 'granted') await onDirectoryAuthorized()
    }
    finally { setBusy(false) }
  }

  return (
    <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
        <AlertDialogTitle>Permisos</AlertDialogTitle>
        <AlertDialogDescription>Autorizaciones de Angie en este dispositivo.</AlertDialogDescription>
        <div className="permissions-list" aria-busy={loading || busy}>
          <section className="permission-section" aria-labelledby="storage-permission-title">
            <div className="permission-heading">
              <h3 id="storage-permission-title">Almacenamiento persistente</h3>
              <span role="status">{loading ? 'Consultando…' : labels[storage.status]}</span>
            </div>
            <p>Protege el autoguardado frente a la limpieza automática. Puedes seguir borrando los datos del navegador.</p>
            <Button disabled={loading || busy || storage.status === 'unavailable' || storage.status === 'granted'} onClick={() => { void requestStorage() }}>Autorizar almacenamiento</Button>
            {storage.message && <Alert><span>{storage.message}</span></Alert>}
          </section>
          <section className="permission-section" aria-labelledby="directory-permission-title">
            <div className="permission-heading">
              <h3 id="directory-permission-title">Carpeta de trabajo</h3>
              <span role="status">{loading ? 'Consultando…' : labels[directory.status]}</span>
            </div>
            <p>{directory.handle ? <>Carpeta: <strong>{directory.handle.name.toLowerCase() === 'angie_dashboard' ? directory.handle.name : directory.handle.name + '/angie_dashboard'}</strong></> : 'Selecciona angie_dashboard o una carpeta donde crearla.'}</p>
            <div className="permission-actions">
              <Button disabled={loading || busy || directory.status === 'unavailable'} onClick={() => { void requestDirectory(true) }}>{directory.handle ? 'Cambiar carpeta' : 'Seleccionar carpeta'}</Button>
              {directory.handle && directory.status !== 'granted' && <Button disabled={loading || busy || directory.status === 'unavailable'} onClick={() => { void requestDirectory(false) }}>Autorizar carpeta</Button>}
            </div>
            {directory.status === 'unavailable' && <p>Este navegador no permite autorizar una carpeta. Puedes continuar guardando mediante descarga.</p>}
            {directory.message && <Alert><span>{directory.message}</span></Alert>}
            <p>Los dashboards se guardan automáticamente en su propia carpeta.</p>
          </section>
        </div>
        <div className="document-dialog-actions">
          <AlertDialogCancel asChild><Button disabled={busy}>Cerrar</Button></AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
