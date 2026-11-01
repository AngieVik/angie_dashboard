import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CircleAlert, ClipboardPen, ClipboardList, ClipboardCheck, ClipboardPlus, ClipboardX, ClipboardClock, FileBracesCorner, FolderSync, FolderCog, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/sonner'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { MenubarMenu, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator, MenubarTrigger } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogCancel, AlertDialogForm, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { FileDialogContent } from './FileDialog'
import { RecoveryDialog } from './RecoveryDialog'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore, DocumentSnapshot } from './documentStore'
import type { ReportsNotice } from './ReportsModule'
import type { MapNotice } from '../map/MapModule'
import { REPORT_SECTIONS } from './documentReport'
import { formatReportIssue, reportIssueKey } from './reportIssues'
import { formatTimelineDate, formatTimelineTime } from '../timeline/timelineCommands'
import { WorkDirectoryDialog } from './PermissionsDialog'
import type { SettingsSection } from '../settings/SettingsDialog'
import { filterWorkspaceName, workspaceNameError } from '../../platform/files/workspaceNames'
import './permissions.css'
import styles from './FileMenu.module.css'
import controlStyles from '@/layout/controlButton.module.css'

const SettingsDialog = lazy(() => import('../settings/SettingsDialog').then(module => ({ default: module.SettingsDialog })))

function saveLabels(snapshot: DocumentSnapshot) {
  const local = snapshot.autosaveSaving ? 'Guardando en este dispositivo…' : snapshot.autosaveUnavailable ? 'Recuperación del dispositivo no disponible' :
    snapshot.document.map?.gpx.some(reference => !snapshot.localGpxFingerprints.includes(reference.fingerprint)) ? 'Dispositivo: GPX pendientes de protección local' :
    snapshot.localSavedAt ? 'Dispositivo: guardado ' + formatTimelineTime(snapshot.localSavedAt) : 'Dispositivo: pendiente de guardar'
  const folder = snapshot.workspaceStatus === 'unconfigured' ? 'Carpeta: sin configurar' : snapshot.workspaceStatus === 'saving' ? 'Guardando en carpeta…' :
    snapshot.workspaceStatus === 'saved' ? 'Carpeta: guardado' + (snapshot.workspaceSavedAt ? ' ' + formatTimelineTime(snapshot.workspaceSavedAt) : '') : 'Carpeta: pendiente de guardar'
  return { local, folder }
}
type Naming = 'new' | 'rename' | 'saveAs'

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
      <MenubarTrigger asChild><Button ref={trigger}>Archivo</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (naming || recovering || configuration || pending || closing) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => showNaming('new')}><ClipboardPen aria-hidden="true" />Nuevo UIBoard</MenubarItem>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void selectFile() }}><ClipboardList aria-hidden="true" />Abrir UIBoard…</MenubarItem>
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
    {configuration && <Suspense fallback={null}><SettingsDialog initialSection={configuration} onClose={closeConfiguration} onCloseFocus={() => { if (naming) nameInput.current?.focus(); else trigger.current?.focus() }} onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} onDownload={active ? () => store.downloadJson() : undefined} /></Suspense>}
    <AlertDialog open={Boolean(naming)} onOpenChange={open => { if (!open && !fileBusy && !namingBusy) setNaming(null) }}>
      <FileDialogContent fitToContent title={naming === 'rename' ? 'Cambiar nombre' : naming === 'saveAs' ? 'Guardar como' : 'Nuevo UIBoard'} icon={naming === 'saveAs' ? ClipboardPlus : ClipboardPen} onClose={() => { if (!store.getSnapshot().fileBusy && !namingSubmission.current) setNaming(null) }}
        onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); nameInput.current?.select() }}>
        <AlertDialogForm onSubmit={event => { event.preventDefault(); void acceptName() }}>
          <Input ref={nameInput} aria-label="Nombre" placeholder="Nombre" aria-invalid={Boolean(nameError)} maxLength={100} value={name} disabled={fileBusy || namingBusy}
            onChange={event => { setName(filterWorkspaceName(event.target.value)); setDialogError(null) }} />

          {dialogError && <Button disabled={fileBusy} onClick={() => setConfiguration('storage')}>Carpeta de trabajo</Button>}
          <AlertDialogFooter>
            <Button type="submit" disabled={fileBusy || namingBusy}>{fileBusy || namingBusy ? 'Preparando…' : 'Aceptar'}</Button>
            <AlertDialogCancel asChild><Button disabled={fileBusy || namingBusy}>Cancelar</Button></AlertDialogCancel></AlertDialogFooter>
        </AlertDialogForm>
      </FileDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open && !fileBusy) setPending(null) }}>
      <FileDialogContent title="Cambios sin guardar" icon={ClipboardCheck} onClose={() => { if (!store.getSnapshot().fileBusy) setPending(null) }}>

        <AlertDialogFooter>
          <Button disabled={fileBusy} onClick={() => { void store.saveDocument().then(async saved => {
            if (saved && pending) { const action = pending; setPending(null); await action() }
            else { setDialogError(store.getSnapshot().workspaceMessage ?? store.getSnapshot().fileMessage); if (store.getSnapshot().workspacePermissionRequired) setConfiguration('storage') }
          }) }}>Guardar y continuar</Button>
          <Button disabled={fileBusy || (snapshot.autosaveUnavailable && snapshot.workspaceStatus !== 'saved')} onClick={() => { if (pending) { const action = pending; setPending(null); void action() } }}>Continuar sin guardar</Button>
          <AlertDialogCancel asChild><Button disabled={fileBusy}>Cancelar</Button></AlertDialogCancel>
        </AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
    <AlertDialog open={closing} onOpenChange={setClosing}>
      <FileDialogContent title="Cerrar UIBoard" icon={ClipboardX} onClose={() => setClosing(false)} fitToContent>
        <p>¿Cerrar «{document.document.title || 'Sin nombre'}»?</p>
        <AlertDialogFooter>
          <Button disabled={fileBusy} onClick={() => { setClosing(false); void transition(() => store.closeDocument(true)) }}>Cerrar</Button>
          <AlertDialogCancel asChild><Button disabled={fileBusy}>Cancelar</Button></AlertDialogCancel>
        </AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
    {recovering && <RecoveryDialog store={store} busy={recoveryBusy} error={dialogError} onRefresh={() => { void showRecovery() }} onClose={closeRecovery}
      onOpen={copy => { closeRecovery(); void transition(() => store.restoreDocument(copy.key, copy)) }}
      onRecent={() => { closeRecovery(); void transition(() => store.openRecentDocument()) }} />}
    <input ref={input} type="file" accept=".json,application/json" aria-label="Abrir archivo JSON" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (file) void transition(() => store.loadDocument(file))
    }} />
  </>
}

export function DocumentNotices({ store = getDocumentStore(), reports = null, maps = {}, board = null, clock = null }: { store?: DocumentStore; reports?: ReportsNotice | null; maps?: Partial<Record<'map' | 'plan', MapNotice>>; board?: { message: string; busy: boolean; onChoose: () => void } | null; clock?: { storage: 'conflict' | 'unavailable' | null; audio: string | null; onRetry: () => void; onActivate: () => void } | null }) {
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
        <PopoverContent align="end" aria-label="Incidencias pendientes" className={styles.noticePanel}>
          {workspaceProblem && <section>
            <h3>Guardado en carpeta pendiente</h3>
            <p>{workspaceMessage ?? 'Selecciona una carpeta de trabajo para guardar.'}</p>
            {snapshot.workspacePath && <p>{snapshot.workspacePath}</p>}
            <div className={styles.noticeActions}>
              <Button disabled={snapshot.fileBusy || snapshot.workspaceStatus === 'saving'} onClick={() => { void store.saveWorkspaceNow() }}><FolderSync aria-hidden="true" />Reintentar</Button>
              <Button disabled={snapshot.fileBusy} onClick={() => { setOpen(false); setPermissions(true) }}><FolderCog aria-hidden="true" />Carpeta de trabajo</Button>
            </div>
          </section>}
          {localProblem && <section>
            <h3>{snapshot.storageConflict ? 'Cambios en otra pestaña' : 'Recuperación del dispositivo no disponible'}</h3>
            {snapshot.localStorageMessage && <p>{snapshot.localStorageMessage}</p>}
            <p>{!snapshot.active ? fileMessage ?? 'No se pudo leer la recuperación de este dispositivo.' : snapshot.storageConflict ? 'Abre una recuperación en rama para conservar tus cambios.' : snapshot.workspaceStatus === 'saved' ? 'El trabajo está guardado en carpeta.' : 'Los cambios de esta sesión aún no tienen protección confirmada.'}</p>
            <div className={styles.noticeActions}>
              {snapshot.storageConflict ? <Button disabled={snapshot.fileBusy || branching} onClick={() => {
                if (branchRequest.current) return
                branchRequest.current = true; setBranching(true)
                void store.recoverCurrent().finally(() => { branchRequest.current = false; setBranching(false) })
              }}>Abrir recuperación en rama</Button> : <Button disabled={snapshot.fileBusy || snapshot.autosaveSaving} onClick={() => { void store.retryAutosave() }}>Reintentar recuperación local</Button>}
            </div>
          </section>}
          {pendingGpx.length > 0 && <section>
            <h3>GPX sin protección local</h3>
            <p>{pendingGpx.map(reference => reference.name).join(', ')}. Su copia local todavía no está confirmada.</p>
            <div className={styles.noticeActions}><Button disabled={snapshot.fileBusy || snapshot.autosaveSaving} onClick={() => { void store.retryAutosave() }}>Reintentar protección local</Button></div>
          </section>}
          {fileProblem && <section><h3>Archivo</h3><p>{fileMessage}</p></section>}
          {snapshot.active && issueKey && <div className={styles.noticeActions}><Button disabled={snapshot.fileBusy} onClick={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</Button></div>}
          {clock && <section>
            <h3>Reloj</h3>
            {clock.audio && <section>
              <p>{clock.audio}</p>
              {clock.audio === 'Sonido bloqueado' && <div className={styles.noticeActions}><Button onClick={clock.onActivate}>Activar sonido</Button></div>}
            </section>}
            {clock.storage && <section>
              <p>{clock.storage === 'conflict' ? 'Otra pestaña ha cambiado los temporizadores. Recargar sustituirá los cambios locales pendientes.' : 'Autoguardado no disponible'}</p>
              <div className={styles.noticeActions}><Button onClick={clock.onRetry}>{clock.storage === 'conflict' ? 'Recargar temporizadores' : 'Reintentar'}</Button></div>
            </section>}
          </section>}
          {board && <section>
            <h3>Pizarra · Imagen de fondo</h3><p>{board.message}</p>
            <div className={styles.noticeActions}><Button disabled={board.busy || snapshot.replacing} onClick={() => { board.onChoose() }}>Elegir imagen de fondo</Button></div>
          </section>}
          {mapEntries.map(([source, notice]) => <section key={source}>
            <h3>{source === 'map' ? 'Mapa' : 'Plano operativo'}</h3>
            {notice.cartography.map(message => <p key={message}>{message}</p>)}
            {notice.access.length > 0 && <p>Acceso al GPX original no recordado: {notice.access.join(', ')}.</p>}
            {notice.errors.map((message, index) => <p key={index}>{message}</p>)}
            {notice.errors.length > 0 && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose() }}>Seleccionar GPX</Button></div>}
            {notice.missing.map(file => <section key={file.id}>
              <p>GPX pendiente: {file.name}</p>
              <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose(file.id) }}>Seleccionar GPX</Button></div>
            </section>)}
            {(notice.missing.length > 0 || notice.access.length > 0) && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { setOpen(false); notice.onOpenGpx() }}>Ver GPX</Button></div>}
          </section>)}
          {reports && <section>
            <h3>Informes</h3>
            {reports.preparation.map(({ section, message }) => <p key={section}>{REPORT_SECTIONS[section].title} · {message}</p>)}
            {reports.issues.map(issue => <section key={reportIssueKey(issue)} role="group" aria-label={REPORT_SECTIONS[issue.section].title + ': ' + issue.label}>
              <p>{REPORT_SECTIONS[issue.section].title} · {formatReportIssue(issue)}</p>
              <div className={styles.noticeActions}>
                <Button disabled={reports.busy || snapshot.replacing} onClick={() => { void reports.onResolve(issue, 'retry') }}>Reintentar</Button>
                <Button disabled={reports.busy || snapshot.replacing} onClick={() => { void reports.onResolve(issue, 'omit') }}>Omitir</Button>
              </div>
            </section>)}
            {reports.saveError && <section>
              <h3>Informe pendiente de guardar</h3><p>{reports.saveError}</p>
              <div className={styles.noticeActions}>
                <Button disabled={reports.busy || snapshot.replacing} onClick={() => { void reports.onSave() }}>Reintentar guardado</Button>
                {reports.directoryNeeded && <Button disabled={reports.busy || snapshot.replacing} onClick={() => { setOpen(false); reports.onDirectory() }}>Carpeta de trabajo</Button>}
              </div>
            </section>}
          </section>}
          {snapshot.recoveryPending && <section>
            <h3>Sesión disponible</h3><p>{snapshot.recoveryTitle || 'UIBoard sin nombre'}</p>
            {snapshot.recoverySeenAt && <p>{formatTimelineDate(snapshot.recoverySeenAt)}</p>}
            <div className={styles.noticeActions}><Button disabled={snapshot.fileBusy} onClick={() => { void store.confirmRecovery(true) }}>Continuar</Button></div>
          </section>}
        </PopoverContent>
      </Popover>
    </div>
    {permissions && <WorkDirectoryDialog onClose={() => setPermissions(false)} onCloseFocus={() => trigger.current?.focus()} onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} onDownload={snapshot.active ? () => store.downloadJson() : undefined} />}
    <AlertDialog open={snapshot.replacementBlocked} onOpenChange={open => { if (!open) store.cancelReplacement() }}>
      <FileDialogContent title="No se pudo guardar el trabajo actual" icon={ClipboardCheck} onClose={() => store.cancelReplacement()}>
        <p>El trabajo permanece abierto. Reintenta el guardado o descarga una copia antes de continuar.</p>
        <AlertDialogFooter><Button onClick={() => { void store.retryAutosave() }}>Reintentar</Button><Button onClick={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</Button><AlertDialogCancel asChild><Button onClick={() => store.cancelReplacement()}>Cancelar</Button></AlertDialogCancel></AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>
  </>
}
