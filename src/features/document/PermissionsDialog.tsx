import { useEffect, useRef, useState } from 'react'
import { FolderCog, FolderKey } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AlertDialog, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { FileDialogContent } from './FileDialog'
import { authorizeWorkDirectory, chooseWorkDirectory, readPersistentStorage, readWorkDirectory, requestPersistentStorage } from '../../platform/pwaPermissions'
import type { PermissionSnapshot, PermissionStatus, WorkDirectoryPermission } from '../../platform/pwaPermissions'
import './permissions.css'

const labels: Record<PermissionStatus, string> = {
  granted: 'Autorizado', pending: 'Pendiente', denied: 'No autorizado', unavailable: 'No disponible', error: 'Error',
}

interface DialogProps { onClose: () => void; onCloseFocus: () => void }
interface DirectoryActions {
  onDirectoryAuthorized: () => Promise<unknown>
  onContinueLocally?: () => void
  onDownload?: () => Promise<void>
}

export function PermissionsDialog({ onClose, onCloseFocus, onDirectoryAuthorized, onContinueLocally, onDownload }: DialogProps & DirectoryActions) {
  const [storage, setStorage] = useState<PermissionSnapshot>({ status: 'pending' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const dismissed = useRef(false)

  useEffect(() => {
    dismissed.current = false
    let active = true
    void readPersistentStorage().then(local => {
      if (active) { setStorage(local); setLoading(false) }
    })
    return () => { active = false; dismissed.current = true }
  }, [])

  async function requestStorage() {
    setBusy(true)
    try {
      const next = await requestPersistentStorage()
      if (!dismissed.current) setStorage(next)
    } finally { if (!dismissed.current) setBusy(false) }
  }

  return (
    <AlertDialog open onOpenChange={open => { if (!open) { dismissed.current = true; onClose() } }}>
      <FileDialogContent title="Permisos" icon={FolderKey} onClose={() => { dismissed.current = true; onClose() }} width={360} height={280}
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
        <div className="permissions-list" aria-busy={loading || busy}>
          <section className="permission-section" aria-labelledby="storage-permission-title">
            <div className="permission-heading">
              <h3 id="storage-permission-title">Almacenamiento persistente</h3>
              <span role="status">{loading ? 'Consultando…' : labels[storage.status]}</span>
            </div>
            <Button disabled={loading || busy || storage.status === 'unavailable' || storage.status === 'granted'} onClick={() => { void requestStorage() }}>Autorizar</Button>
            {storage.message && <Alert><span>{storage.message}</span></Alert>}
          </section>
          <WorkDirectorySection onDirectoryAuthorized={onDirectoryAuthorized} onStorageChange={setStorage} onDownload={onDownload}
            onContinueLocally={() => { onContinueLocally?.(); dismissed.current = true; onClose() }} />
        </div>
      </FileDialogContent>
    </AlertDialog>
  )
}

export function WorkDirectoryDialog({ onClose, onCloseFocus, onDirectoryAuthorized, onContinueLocally, onDownload }: DialogProps & DirectoryActions) {
  return (
    <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
      <FileDialogContent title="Carpeta de trabajo" icon={FolderCog} onClose={onClose} width={360} height={180}
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
        <div className="permissions-list">
          <WorkDirectorySection showHeading={false} onDirectoryAuthorized={onDirectoryAuthorized} onDownload={onDownload}
            onContinueLocally={() => { onContinueLocally?.(); onClose() }} />
        </div>
      </FileDialogContent>
    </AlertDialog>
  )
}

function WorkDirectorySection({ onDirectoryAuthorized, onContinueLocally, onDownload, onStorageChange, showHeading = true }: DirectoryActions & { onStorageChange?: (permission: PermissionSnapshot) => void; showHeading?: boolean }) {
  const [directory, setDirectory] = useState<WorkDirectoryPermission>({ handle: null, status: 'pending' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const dismissed = useRef(false)
  const requesting = useRef(false)

  useEffect(() => {
    dismissed.current = false
    let active = true
    void readWorkDirectory().then(folder => {
      if (active) { setDirectory(folder); setLoading(false) }
    })
    return () => { active = false; dismissed.current = true }
  }, [])

  async function requestDirectory(select: boolean) {
    if (requesting.current) return
    requesting.current = true
    setBusy(true)
    try {
      const operation = select ? chooseWorkDirectory(directory) : authorizeWorkDirectory(directory)
      // Keep the automatic storage request independent of folder preparation.
      void requestPersistentStorage().then(storage => { if (!dismissed.current) onStorageChange?.(storage) })
      const next = await operation
      if (!dismissed.current) setDirectory(next)
      if (!dismissed.current && next.prepared && next.status === 'granted') {
        // Folder writes have their own status; they must never trap this panel.
        void onDirectoryAuthorized().catch(() => {})
      }
    }
    finally { requesting.current = false; if (!dismissed.current) setBusy(false) }
  }

  const container = directory.isContainer ?? directory.handle?.name.toLowerCase() !== 'angie_dashboard'
  const location = directory.handle ? container ? directory.handle.name + '/angie_dashboard' : directory.handle.name : 'Sin seleccionar'
  return (
    <section className="permission-section" aria-busy={loading || busy}>
      <div className="permission-heading">
        {showHeading ? <h3>Carpeta de trabajo</h3> : <p>Ubicación: <strong>{location}</strong></p>}
        <span role="status">{loading ? 'Consultando…' : labels[directory.status]}</span>
      </div>
      {showHeading && <p>Ubicación: <strong>{location}</strong></p>}
      <div className="permission-actions">
        <Button disabled={loading || busy || directory.status === 'unavailable'} onClick={() => { void requestDirectory(true) }}>Elegir carpeta de trabajo</Button>
        {directory.handle && directory.status !== 'granted' && <Button disabled={loading || busy || directory.status === 'unavailable'} onClick={() => { void requestDirectory(false) }}>{directory.status === 'error' ? 'Reintentar' : 'Autorizar acceso'}</Button>}
        {onDownload && (directory.status === 'unavailable' || directory.status === 'error') && <Button disabled={loading || busy} onClick={() => { void onDownload() }}>Descargar JSON</Button>}
      </div>
      {directory.status === 'unavailable' && !directory.message && <Alert><span>Este navegador no permite seleccionar carpetas.</span></Alert>}
      {directory.message && <Alert><span>{directory.message}</span></Alert>}
      {!loading && !busy && directory.status !== 'granted' && onContinueLocally && <AlertDialogFooter>
        <Button onClick={onContinueLocally}>Continuar</Button>
      </AlertDialogFooter>}
    </section>
  )
}
