import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CircleAlert, ClipboardPen, ClipboardList, ClipboardCheck, ClipboardPlus, ClipboardX, ClipboardClock, FileBracesCorner, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/sonner'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { MenubarMenu, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator, MenubarTrigger } from '@/components/ui/menubar'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore, DocumentSnapshot } from './documentStore'
import type { Naming } from './FileMenuDialogs'
import type { ReportsNotice } from './ReportsModule'
import type { MapNotice } from '../map/MapModule'
import { formatTimelineTime } from '../timeline/timelineCommands'
import type { SettingsSection } from '../settings/SettingsDialog'
import { workspaceNameError } from '../../platform/files/workspaceNames'
import styles from './FileMenu.module.css'
import controlStyles from '@/layout/controlButton.module.css'

const FileMenuDialogs = lazy(() => import('./FileMenuDialogs').then(module => ({ default: module.FileMenuDialogs })))
const ReplacementBlockedDialog = lazy(() => import('./FileMenuDialogs').then(module => ({ default: module.ReplacementBlockedDialog })))
const DocumentNoticeDetails = lazy(() => import('./DocumentNoticeDetails').then(module => ({ default: module.DocumentNoticeDetails })))
const SettingsDialog = lazy(() => import('../settings/SettingsDialog').then(module => ({ default: module.SettingsDialog })))
const RecoveryDialog = lazy(() => import('./RecoveryDialog').then(module => ({ default: module.RecoveryDialog })))
const WorkDirectoryDialog = lazy(() => import('./PermissionsDialog').then(module => ({ default: module.WorkDirectoryDialog })))

function saveLabels(snapshot: DocumentSnapshot) {
  const local = snapshot.autosaveSaving ? 'Guardando en este dispositivo…' : snapshot.autosaveUnavailable ? 'Recuperación del dispositivo no disponible' :
    snapshot.document.map?.gpx.some(reference => !snapshot.localGpxFingerprints.includes(reference.fingerprint)) ? 'Dispositivo: GPX pendientes de protección local' :
    snapshot.localSavedAt ? 'Dispositivo: guardado ' + formatTimelineTime(snapshot.localSavedAt) : 'Dispositivo: pendiente de guardar'
  const folder = snapshot.workspaceStatus === 'saving' ? 'Guardando en carpeta…' :
    snapshot.workspaceStatus === 'saved' ? 'Carpeta: guardado' + (snapshot.workspaceSavedAt ? ' ' + formatTimelineTime(snapshot.workspaceSavedAt) : '') : 'Carpeta: pendiente de guardar'
  return { local, folder }
}
export function FileMenu({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const snapshot = useDocumentStore(store)
  const { active, ready, fileBusy, document } = snapshot
  const labels = saveLabels(snapshot)
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null)
  const [naming, setNaming] = useState<Naming | null>(null)
  const [name, setName] = useState('')
  const [namingBusy, setNamingBusy] = useState(false)
  const namingSubmission = useRef(false)
  const [recovering, setRecovering] = useState(false)
  const [closing, setClosing] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const recoveryRequest = useRef(0)
  const [configuration, setConfiguration] = useState<SettingsSection | null>(null)
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null)
  const [dialogError, setDialogError] = useValidationNotice(null, 0, null)
  const nameError = workspaceNameError(name)

  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (active && !fileBusy && !naming && !pending && !configuration && !recovering && !closing) {
          void store.saveDocument()
        }
      }
    }
    window.addEventListener('keydown', save)
    return () => window.removeEventListener('keydown', save)
  }, [active, fileBusy, naming, pending, configuration, recovering, closing, store])

  function closeConfiguration() {
    setConfiguration(null)
  }
  async function transition(action: () => Promise<unknown>, onPending?: () => void) {
    setDialogError(null)
    await store.flushLocalSave()
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
    if (!naming || namingSubmission.current || store.getSnapshot().fileBusy) return
    if (nameError) { setDialogError(nameError); return }
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
    store.cancelDocumentRead()
    if (!store.hasOpenPicker()) { input.current?.click(); return }
    const selected = await store.pickDocument()
    if (selected) await transition(() => store.loadDocument(selected.file, selected.handle))
  }
  async function showRecovery() {
    const request = ++recoveryRequest.current
    setDialogError(null); setRecovering(true); setRecoveryBusy(true)
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
      <MenubarTrigger asChild><Button ref={trigger} aria-busy={snapshot.documentReading}>Archivo</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (naming || recovering || configuration || pending || closing) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => showNaming('new')}><ClipboardPen aria-hidden="true" />Nuevo UIBoard</MenubarItem>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void selectFile() }}><ClipboardList aria-hidden="true" />Abrir UIBoard…</MenubarItem>
          {snapshot.documentReading && <>
            <div role="status" className={styles.saveDetails}>Abriendo UIBoard…</div>
            <MenubarItem onSelect={() => store.cancelDocumentRead()}><ClipboardX aria-hidden="true" />Cancelar apertura</MenubarItem>
          </>}
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.saveDocument() }}><ClipboardCheck aria-hidden="true" />Guardar</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => showNaming('saveAs')}><ClipboardPlus aria-hidden="true" />Guardar como…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => showNaming('rename')}><ClipboardPen aria-hidden="true" />Cambiar nombre…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => setClosing(true)}><ClipboardX aria-hidden="true" />Cerrar UIBoard</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void showRecovery() }}><ClipboardClock aria-hidden="true" />Recuperar UIBoard…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={fileBusy} onSelect={() => setConfiguration('location')}><Settings aria-hidden="true" />Configuración…</MenubarItem>
          {active && <><MenubarSeparator /><div role="status" className={styles.saveDetails}><span>{labels.local}</span><span>{labels.folder}</span>{snapshot.workspacePath && <span>{snapshot.workspacePath}</span>}</div></>}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    {configuration && <Suspense fallback={null}><SettingsDialog initialSection={configuration} onClose={closeConfiguration} onCloseFocus={() => { if (naming) nameInput.current?.focus(); else trigger.current?.focus() }} onContinueLocally={() => store.continueLocally()} onDownload={active ? () => store.downloadJson() : undefined} /></Suspense>}
    {(naming || pending || closing) && <Suspense fallback={null}><FileMenuDialogs snapshot={snapshot} nameInput={nameInput}
      naming={naming ? { mode: naming, value: name, busy: namingBusy, nameError, hasError: Boolean(dialogError),
        onChange: value => { setName(value); setDialogError(null) }, onSubmit: () => { void acceptName() },
        onClose: () => { if (!store.getSnapshot().fileBusy && !namingSubmission.current) setNaming(null) }, onDirectory: () => setConfiguration('storage') } : null}
      pending={pending ? { onClose: () => { if (!store.getSnapshot().fileBusy) setPending(null) },
        onSave: () => { void store.saveDocument().then(async saved => {
          if (saved && pending) { const action = pending; setPending(null); await action() }
          else { setDialogError(store.getSnapshot().workspaceMessage ?? store.getSnapshot().fileMessage); if (store.getSnapshot().workspacePermissionRequired) setConfiguration('storage') }
        }) }, onContinue: () => { const action = pending; setPending(null); void action() } } : null}
      closing={closing ? { title: document.document.title, onClose: () => setClosing(false),
        onConfirm: () => { setClosing(false); void transition(() => store.closeDocument(true)) } } : null}
      onCloseFocus={() => trigger.current?.focus()} /></Suspense>}
    {recovering && <Suspense fallback={null}><RecoveryDialog store={store} busy={recoveryBusy} error={dialogError} onRefresh={() => { void showRecovery() }} onClose={closeRecovery}
      onOpen={copy => { closeRecovery(); void transition(() => store.restoreDocument(copy.key, copy)) }}
      onRecent={() => { closeRecovery(); void transition(() => store.openRecentDocument()) }} /></Suspense>}
    <input ref={input} type="file" accept=".json,application/json" aria-label="Abrir archivo JSON" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (file) void transition(() => store.loadDocument(file))
    }} />
  </>
}

export interface DocumentNoticesProps {
  store?: DocumentStore
  reports?: ReportsNotice | null
  maps?: Partial<Record<'map' | 'plan', MapNotice>>
  board?: { message: string; busy: boolean; onChoose: () => void } | null
  clock?: { storage: 'conflict' | 'unavailable' | null; audio: string | null; onRetry: () => void; onActivate: () => void } | null
}

export function DocumentNotices({ store = getDocumentStore(), reports = null, maps = {}, board = null, clock = null }: DocumentNoticesProps) {
  const snapshot = useDocumentStore(store)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [permissions, setPermissions] = useState(false)
  const [branching, setBranching] = useState(false)
  const branchRequest = useRef(false)
  const fileMessage = snapshot.fileMessage
  const directoryRequested = fileMessage === 'Selecciona una carpeta de trabajo para guardar.'
  const workspaceMessage = store.isWorkingLocally() ? null : snapshot.workspaceMessage
  const workspaceProblem = !store.isWorkingLocally() && Boolean(workspaceMessage || snapshot.workspacePermissionRequired || (directoryRequested && snapshot.workspaceStatus !== 'saved'))
  const localProblem = snapshot.autosaveUnavailable
  const pendingGpx = snapshot.active ? snapshot.document.map?.gpx.filter(reference => !snapshot.localGpxFingerprints.includes(reference.fingerprint)) ?? [] : []
  const fileProblem = Boolean(fileMessage && !['Guardado', 'Sin cambios pendientes', 'Descarga JSON iniciada'].includes(fileMessage) &&
    fileMessage !== workspaceMessage && !directoryRequested &&
    !(localProblem && (!snapshot.active || snapshot.storageConflict)))
  const issueKey = [workspaceProblem && 'workspace', localProblem && 'local', fileProblem && 'file'].filter(Boolean).join(',')
  const notified = useRef(new Set<string>())
  const mapEntries = Object.entries(maps) as ['map' | 'plan', MapNotice][]
  const hasIssues = Boolean(issueKey || pendingGpx.length || reports || mapEntries.length || board || clock)
  const hasNotices = hasIssues || snapshot.recoveryPending
  useEffect(() => {
    const current = issueKey ? issueKey.split(',') : []
    const added = current.find(key => !notified.current.has(key))
    notified.current = new Set(current)
    if (added) toast.error(added === 'workspace' ? 'Guardado en carpeta pendiente.' : added === 'local' ? 'Recuperación del dispositivo no disponible.' : 'No se pudo completar la operación.', { id: 'document-notice' })
  }, [issueKey])
  if (!hasNotices && open) setOpen(false)
  useEffect(() => () => { toast.dismiss('document-notice') }, [])
  return <>
    <div className={styles.noticeSlot} data-empty={!hasNotices} aria-hidden={!hasNotices}>
      <Popover open={open && hasNotices} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button ref={trigger} className={controlStyles.base} disabled={!hasNotices}
          aria-label={hasIssues ? 'Incidencias pendientes' : 'Recuperación disponible'}>
          {hasIssues ? <CircleAlert aria-hidden="true" /> : <ClipboardClock aria-hidden="true" />}
        </Button></PopoverTrigger>
        {open && hasNotices && <Suspense fallback={null}><DocumentNoticeDetails store={store} snapshot={snapshot} reports={reports} maps={maps} board={board} clock={clock}
          status={{ workspaceMessage, workspaceProblem, localProblem, fileProblem, issueKey, pendingGpx }} branching={branching}
          onBranch={() => {
            if (branchRequest.current) return
            branchRequest.current = true; setBranching(true)
            void store.recoverCurrent().finally(() => { branchRequest.current = false; setBranching(false) })
          }} onClose={() => setOpen(false)} onPermissions={() => { setOpen(false); setPermissions(true) }} /></Suspense>}
      </Popover>
    </div>
    {permissions && <Suspense fallback={null}><WorkDirectoryDialog onClose={() => setPermissions(false)} onCloseFocus={() => trigger.current?.focus()} onContinueLocally={() => store.continueLocally()} onDownload={snapshot.active ? () => store.downloadJson() : undefined} /></Suspense>}
    {snapshot.replacementBlocked && <Suspense fallback={null}><ReplacementBlockedDialog store={store} onCloseFocus={() => trigger.current?.focus()} /></Suspense>}
  </>
}
