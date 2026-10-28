import { useEffect, useRef, useState } from 'react'
import { ClipboardPen, ClipboardList, ClipboardCheck, ClipboardPlus, ClipboardX, ClipboardClock, FileBracesCorner, FolderSync, FolderCog, FolderKey } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { MenubarMenu, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator, MenubarTrigger } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogCancel, AlertDialogForm, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { FileDialogContent } from './FileDialog'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore, DocumentSnapshot } from './documentStore'
import { formatTimelineDate, formatTimelineTime } from '../timeline/timelineCommands'
import { PermissionsDialog, WorkDirectoryDialog } from './PermissionsDialog'
import { readWorkDirectoryConfiguration } from '../../storage/workDirectoryAccessRepository'
import { filterWorkspaceName, workspaceNameError } from '../../platform/files/workspaceNames'
import './permissions.css'
import styles from './FileMenu.module.css'

function saveLabels(snapshot: DocumentSnapshot) {
  const local = snapshot.autosaveSaving ? 'Guardando en este dispositivo…' : snapshot.autosaveUnavailable ? 'Recuperación del dispositivo no disponible' :
    snapshot.localSavedAt ? 'Dispositivo: guardado ' + formatTimelineTime(snapshot.localSavedAt) : 'Dispositivo: pendiente de guardar'
  const folder = snapshot.workspaceStatus === 'unconfigured' ? 'Carpeta: sin configurar' : snapshot.workspaceStatus === 'saving' ? 'Guardando en carpeta…' :
    snapshot.workspaceStatus === 'saved' ? 'Carpeta: guardado' + (snapshot.workspaceSavedAt ? ' ' + formatTimelineTime(snapshot.workspaceSavedAt) : '') : 'Carpeta: pendiente de guardar'
  return { local, folder }
}
type Naming = 'new' | 'rename' | 'saveAs'

export function FileMenu({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const snapshot = useDocumentStore(store)
  const { active, ready, fileBusy, document, recoverable } = snapshot
  const labels = saveLabels(snapshot)
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null)
  const [naming, setNaming] = useState<Naming | null>(null)
  const [name, setName] = useState('')
  const [namingBusy, setNamingBusy] = useState(false)
  const namingSubmission = useRef(false)
  const [recovering, setRecovering] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const recoveryRequest = useRef(0)
  const [permissions, setPermissions] = useState<'setup' | 'permissions' | null>(null)
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const nameError = workspaceNameError(name)

  useEffect(() => {
    if (!ready || active || snapshot.recoveryPending) return
    let seen = false
    try { seen = localStorage.getItem('angie.workspace.setup-seen') === 'true' } catch { /* Setup remains available manually. */ }
    if (seen) return
    let mounted = true
    void readWorkDirectoryConfiguration().then(configuration => {
      if (mounted && !configuration) setPermissions('setup')
    }).catch(() => { if (mounted) setPermissions('setup') })
    return () => { mounted = false }
  }, [ready, active, snapshot.recoveryPending])

  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (active && !fileBusy && !naming && !pending && !permissions && !recovering) {
          void store.saveDocument().then(saved => { if (!saved && store.getSnapshot().workspacePermissionRequired) setPermissions('setup') })
        }
      }
    }
    window.addEventListener('keydown', save)
    return () => window.removeEventListener('keydown', save)
  }, [active, fileBusy, naming, pending, permissions, recovering, store])

  function closePermissions() {
    if (permissions === 'setup') {
      try { localStorage.setItem('angie.workspace.setup-seen', 'true') } catch { /* Optional first-opening hint. */ }
    }
    setPermissions(null)
  }
  async function transition(action: () => Promise<unknown>, onPending?: () => void) {
    setDialogError(null)
    await store.flushWorkspaceSave()
    const current = store.getSnapshot()
    if (current.active && ((!store.isWorkingLocally() && current.workspaceStatus !== 'saved') || current.autosaveUnavailable)) {
      onPending?.()
      setPending(() => action)
    }
    else await action()
  }
  function showNaming(mode: Naming) {
    setName(mode === 'rename' ? document.document.title : '')
    setDialogError(null); setNaming(mode)
  }
  async function acceptName() {
    if (nameError || !naming || namingSubmission.current || store.getSnapshot().fileBusy) return
    const mode = naming, requested = name
    namingSubmission.current = true
    setNamingBusy(true)
    const action = async () => {
      const success = mode === 'rename' ? await store.setTitle(requested) : mode === 'saveAs' ? await store.saveAs(requested) : await store.newDocument(requested)
      if (success) setNaming(null)
      else {
        setNaming(mode)
        setDialogError(store.getSnapshot().fileMessage ?? 'No se pudo completar la acción.')
      }
    }
    try {
      if (mode === 'new') await transition(action, () => setNaming(null))
      else await action()
    } finally { namingSubmission.current = false; setNamingBusy(false) }
  }
  async function selectFile() {
    if (!store.hasOpenPicker()) { input.current?.click(); return }
    const selected = await store.pickDocument()
    if (selected) await transition(() => store.loadDocument(selected.file, selected.handle))
  }
  async function showRecovery() {
    const request = ++recoveryRequest.current
    setDialogError(null); setRecoveryKey(null); setRecovering(true); setRecoveryBusy(true)
    try {
      const error = await store.refreshRecoverable()
      if (request === recoveryRequest.current) setDialogError(error)
    } finally { if (request === recoveryRequest.current) setRecoveryBusy(false) }
  }
  function closeRecovery() {
    recoveryRequest.current++
    setRecovering(false); setRecoveryBusy(false)
  }

  return <>
    <MenubarMenu>
      <MenubarTrigger asChild><Button ref={trigger}>Archivo</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (naming || recovering || permissions || pending) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => showNaming('new')}><ClipboardPen aria-hidden="true" />Nuevo UIBoard</MenubarItem>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void selectFile() }}><ClipboardList aria-hidden="true" />Abrir UIBoard…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.saveDocument().then(saved => { if (!saved && store.getSnapshot().workspacePermissionRequired) setPermissions('setup') }) }}><ClipboardCheck aria-hidden="true" />Guardar</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => showNaming('saveAs')}><ClipboardPlus aria-hidden="true" />Guardar como…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => showNaming('rename')}><ClipboardPen aria-hidden="true" />Cambiar nombre…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void transition(() => store.closeDocument(true)) }}><ClipboardX aria-hidden="true" />Cerrar UIBoard</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void showRecovery() }}><ClipboardClock aria-hidden="true" />Recuperar UIBoard…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={fileBusy} onSelect={() => setPermissions('setup')}><FolderCog aria-hidden="true" />Elegir carpeta de trabajo</MenubarItem>
          <MenubarItem disabled={fileBusy} onSelect={() => setPermissions('permissions')}><FolderKey aria-hidden="true" />Permisos</MenubarItem>
          {active && <><MenubarSeparator /><div role="status" className={styles.saveDetails}><span>{labels.local}</span><span>{labels.folder}</span>{snapshot.workspacePath && <span>{snapshot.workspacePath}</span>}</div></>}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    {permissions === 'setup' && <WorkDirectoryDialog onClose={closePermissions} onCloseFocus={() => { if (naming) nameInput.current?.focus(); else trigger.current?.focus() }} onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} onDownload={active ? () => store.downloadJson() : undefined} />}
    {permissions === 'permissions' && <PermissionsDialog onClose={closePermissions} onCloseFocus={() => trigger.current?.focus()} onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} onDownload={active ? () => store.downloadJson() : undefined} />}
    <AlertDialog open={Boolean(naming)} onOpenChange={open => { if (!open && !fileBusy && !namingBusy) setNaming(null) }}>
      <FileDialogContent title={naming === 'rename' ? 'Cambiar nombre' : naming === 'saveAs' ? 'Guardar como' : 'Nuevo UIBoard'} icon={naming === 'saveAs' ? ClipboardPlus : ClipboardPen} onClose={() => { if (!store.getSnapshot().fileBusy && !namingSubmission.current) setNaming(null) }}
        onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); nameInput.current?.select() }}>
        <AlertDialogForm onSubmit={event => { event.preventDefault(); void acceptName() }}>
          <Input ref={nameInput} aria-label="Nombre" placeholder="Nombre" aria-invalid={Boolean(nameError)} maxLength={100} value={name} disabled={fileBusy || namingBusy}
            onChange={event => { setName(filterWorkspaceName(event.target.value)); setDialogError(null) }} />
          {(nameError || dialogError) && <p role="alert">{nameError || dialogError}</p>}
          {dialogError && <Button disabled={fileBusy} onClick={() => setPermissions('setup')}>Carpeta de trabajo</Button>}
          <AlertDialogFooter>
            <Button type="submit" disabled={fileBusy || namingBusy || Boolean(nameError)}>{fileBusy || namingBusy ? 'Preparando…' : 'Aceptar'}</Button>
            <AlertDialogCancel asChild><Button disabled={fileBusy || namingBusy}>Cancelar</Button></AlertDialogCancel></AlertDialogFooter>
        </AlertDialogForm>
      </FileDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open && !fileBusy) setPending(null) }}>
      <FileDialogContent title="Hay cambios sin guardar." icon={ClipboardCheck} onClose={() => { if (!store.getSnapshot().fileBusy) setPending(null) }}>
        {dialogError && !snapshot.workspacePermissionRequired && <p role="alert">{dialogError}</p>}
        <AlertDialogFooter>
          <Button disabled={fileBusy} onClick={() => { void store.saveDocument().then(async saved => {
            if (saved && pending) { const action = pending; setPending(null); await action() }
            else { setDialogError(store.getSnapshot().workspaceMessage ?? store.getSnapshot().fileMessage); if (store.getSnapshot().workspacePermissionRequired) setPermissions('setup') }
          }) }}>Guardar y continuar</Button>
          <Button disabled={fileBusy || (snapshot.autosaveUnavailable && snapshot.workspaceStatus !== 'saved')} onClick={() => { if (pending) { const action = pending; setPending(null); void action() } }}>Continuar sin guardar</Button>
          <AlertDialogCancel asChild><Button disabled={fileBusy}>Cancelar</Button></AlertDialogCancel>
        </AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
    <AlertDialog open={recovering} onOpenChange={open => { if (!open) closeRecovery() }}>
      <FileDialogContent title="Recuperar UIBoard" icon={ClipboardClock} onClose={closeRecovery} height={360}>
        {dialogError && <p role="alert">{dialogError}</p>}
        <AlertDialogFooter>
          <Button disabled={fileBusy || recoveryBusy} onClick={() => { void showRecovery() }}><FolderSync aria-hidden="true" />{recoveryBusy ? 'Consultando…' : 'Reintentar'}</Button>
          <Button disabled={fileBusy} onClick={() => { closeRecovery(); setPermissions('setup') }}><FolderCog aria-hidden="true" />Carpeta de trabajo</Button>
        </AlertDialogFooter>
        <div className="document-recovery-list" aria-label="Versiones recuperables">
          {recoverable.map(copy => <Button key={copy.key} disabled={fileBusy || recoveryBusy} aria-pressed={recoveryKey === copy.key} onClick={() => setRecoveryKey(copy.key)}>
            {copy.title || 'Sin nombre'} · {formatTimelineDate(copy.savedAt)} · {copy.source === 'folder' ? 'Carpeta' : 'Dispositivo'}</Button>)}
          {!recoverable.length && !dialogError && !recoveryBusy && <p>No hay versiones recuperables.</p>}
        </div>
        <AlertDialogFooter><Button disabled={fileBusy || recoveryBusy || !recoverable.some(copy => copy.key === recoveryKey)} onClick={() => {
            const copy = recoverable.find(copy => copy.key === recoveryKey)
            if (!copy) return
            closeRecovery()
            void transition(() => store.restoreDocument(copy.key, copy))
          }}>Abrir recuperación en rama</Button></AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
    <input ref={input} type="file" accept=".json,application/json" aria-label="Abrir archivo JSON" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (file) void transition(() => store.loadDocument(file))
    }} />
  </>
}

export function DocumentNotices({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const snapshot = useDocumentStore(store)
  const [permissions, setPermissions] = useState(false)
  const [branching, setBranching] = useState(false)
  const branchRequest = useRef(false)
  const workspaceMessage = store.isWorkingLocally() ? null : snapshot.workspaceMessage
  const fileMessage = snapshot.recoveryPending ? null : snapshot.fileMessage
  return <>
    {(fileMessage || workspaceMessage || (snapshot.active && snapshot.autosaveUnavailable)) && <div className="document-notices">
      {workspaceMessage && <Alert><span>{workspaceMessage}</span>
        <Button disabled={snapshot.fileBusy} onClick={() => { void store.saveWorkspaceNow() }}><FolderSync aria-hidden="true" />Reintentar</Button>
        <Button disabled={snapshot.fileBusy} onClick={() => setPermissions(true)}><FolderCog aria-hidden="true" />Carpeta de trabajo</Button></Alert>}
      {snapshot.active && snapshot.autosaveUnavailable && <Alert><span>{snapshot.storageConflict ? 'Hay cambios en otra pestaña.' : snapshot.workspaceStatus === 'saved' ? 'Recuperación del dispositivo no disponible. El trabajo está guardado en carpeta.' : 'Cambios únicamente en esta sesión: la recuperación del dispositivo no está disponible y la carpeta está pendiente.'}</span>
        {snapshot.storageConflict ? <Button disabled={snapshot.fileBusy || branching} onClick={() => {
          if (branchRequest.current) return
          branchRequest.current = true; setBranching(true)
          void store.recoverCurrent().finally(() => { branchRequest.current = false; setBranching(false) })
        }}>Abrir recuperación en rama</Button> : <Button disabled={snapshot.fileBusy} onClick={() => { void store.retryAutosave() }}>Reintentar recuperación local</Button>}
        <Button disabled={snapshot.fileBusy} onClick={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</Button></Alert>}
      {fileMessage && <FileValidationNotice key={snapshot.fileMessageRevision} message={fileMessage} />}
    </div>}
    {permissions && <WorkDirectoryDialog onClose={() => setPermissions(false)} onCloseFocus={() => {}} onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} onDownload={snapshot.active ? () => store.downloadJson() : undefined} />}
    <AlertDialog open={snapshot.recoveryPending} onOpenChange={open => { if (!open) void store.confirmRecovery(false) }}>
      <FileDialogContent title={snapshot.recoveryTitle ? `¿Quieres continuar con «${snapshot.recoveryTitle}»?` : '¿Quieres continuar?'} icon={ClipboardClock} onClose={() => { void store.confirmRecovery(false) }}>
        {snapshot.recoverySeenAt && <p>Última sesión: {formatTimelineDate(snapshot.recoverySeenAt)}</p>}
        {snapshot.fileMessage && <p role="alert">{snapshot.fileMessage}</p>}
        <AlertDialogFooter><Button disabled={snapshot.fileBusy} onClick={() => { void store.confirmRecovery(true) }}>Continuar</Button>
          <Button disabled={snapshot.fileBusy} onClick={() => { void store.confirmRecovery(false) }}>Ir al inicio</Button></AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
    <AlertDialog open={snapshot.replacementBlocked} onOpenChange={open => { if (!open) store.cancelReplacement() }}>
      <FileDialogContent title="No se pudo guardar el trabajo actual" icon={ClipboardCheck} onClose={() => store.cancelReplacement()}>
        <p>El trabajo permanece abierto. Reintenta el guardado o descarga una copia antes de continuar.</p>
        <AlertDialogFooter><Button onClick={() => { void store.retryAutosave() }}>Reintentar</Button><Button onClick={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</Button><AlertDialogCancel asChild><Button onClick={() => store.cancelReplacement()}>Cancelar</Button></AlertDialogCancel></AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
  </>
}

function FileValidationNotice({ message }: { message: string }) {
  const [notice] = useValidationNotice(message)
  return notice ? <Alert role={message === 'Guardado' || message === 'Sin cambios pendientes' || message === 'Descarga JSON iniciada' ? 'status' : 'alert'}><span>{notice}</span></Alert> : null
}
