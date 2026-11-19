import { useEffect, useRef, useState } from 'react'
import { CircleAlert, ClipboardPen, ClipboardList, ClipboardCheck, ClipboardPlus, ClipboardX, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/sonner'
import { useSettings } from '../settings/useSettings'
import { noticeHistoryStore } from '../notices/noticeHistoryStore'
import { noticeEnabled, noticeText } from '../notices/noticePreferences'
import type { NoticeId } from '../notices/noticePreferences'
import type { NoticeHistoryEntry } from '../notices/noticeHistoryStore'
import { localStorageNoticeMessages, timerStorageNoticeMessage } from './documentNoticeMessages'
import type { DesktopViewsController } from '../settings/savedDesktopViews'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { MenubarMenu, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator, MenubarTrigger } from '@/components/ui/menubar'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore, DocumentSnapshot } from './documentStore'
import type { Naming } from './FileMenuDialogs'
import type { ReportsNotice } from './ReportsModule'
import type { MapNotice } from '../map/MapModule'
import { formatTimelineTime } from '../timeline/timelineCommands'
import type { SettingsSection } from '../settings/SettingsDialog'
import type { FormatPreferences } from '../settings/formatPreferences'
import { documentNameError } from '../../domain/document/documentName'
import { LazySurface } from '../../app/recovery/LazySurface'
import styles from './FileMenu.module.css'
import controlStyles from '@/layout/controlButton.module.css'

const loadFileMenuDialogs = () => import('./FileMenuDialogs').then(module => ({ default: module.FileMenuDialogs }))
const loadDocumentNoticeDetails = () => import('./DocumentNoticeDetails').then(module => ({ default: module.DocumentNoticeDetails }))
const loadSettingsDialog = () => import('../settings/SettingsDialog').then(module => ({ default: module.SettingsDialog }))

function saveLabels(snapshot: DocumentSnapshot, formats: FormatPreferences) {
  const local = snapshot.storageConflict ? 'Dispositivo: copia modificada en otra pestaña' : snapshot.autosaveSaving ? 'Guardando en este dispositivo…' : snapshot.autosaveUnavailable ? 'Recuperación del dispositivo no disponible' :
    snapshot.localSavedAt ? 'Dispositivo: guardado ' + formatTimelineTime(snapshot.localSavedAt, formats) : 'Dispositivo: pendiente de guardar'
  const file = snapshot.fileBusy ? 'Procesando archivo…' : snapshot.fileDirty ? 'Archivo: cambios sin guardar' :
    snapshot.fileSavedAt ? 'Archivo: guardado ' + formatTimelineTime(snapshot.fileSavedAt, formats) : snapshot.fileName ? 'Archivo: abierto sin cambios' : 'Archivo: sin guardar'
  const download = snapshot.downloadStartedAt ? 'Descarga iniciada ' + formatTimelineTime(snapshot.downloadStartedAt, formats) : null
  return { local, file, download }
}
export function FileMenu({ store = getDocumentStore(), desktopViews }: { store?: DocumentStore; desktopViews?: DesktopViewsController }) {
  const snapshot = useDocumentStore(store)
  const { active, ready, fileBusy, document } = snapshot
  const { settings } = useSettings()
  const labels = saveLabels(snapshot, settings.formats)
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null)
  const [naming, setNaming] = useState<Naming | null>(null)
  const [name, setName] = useState('')
  const [namingBusy, setNamingBusy] = useState(false)
  const namingSubmission = useRef(false)
  const [closing, setClosing] = useState(false)
  const [configuration, setConfiguration] = useState<SettingsSection | null>(null)
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null)
  const [dialogError, setDialogError] = useValidationNotice(null, 0, null)
  const nameError = documentNameError(name)

  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (active && !fileBusy && !naming && !pending && !configuration && !closing) {
          void store.saveDocument()
        }
      }
    }
    window.addEventListener('keydown', save)
    return () => window.removeEventListener('keydown', save)
  }, [active, fileBusy, naming, pending, configuration, closing, store])

  function closeConfiguration() {
    setConfiguration(null)
  }
  function cancelFileDialogs() {
    setNaming(null); setPending(null); setClosing(false); setDialogError(null)
  }
  async function transition(action: () => Promise<unknown>, onPending?: () => void) {
    setDialogError(null)
    const current = store.getSnapshot()
    if (current.active && current.fileDirty) {
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
      const success = mode === 'rename' ? await store.setTitle(requested) : await store.newDocument(requested)
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

  return <>
    <MenubarMenu>
      <MenubarTrigger asChild><Button ref={trigger} aria-busy={snapshot.documentReading}>Archivo</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (naming || configuration || pending || closing) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => showNaming('new')}><ClipboardPen aria-hidden="true" />Nuevo UIBoard</MenubarItem>
          <MenubarItem disabled={!ready || fileBusy} onSelect={() => { void selectFile() }}><ClipboardList aria-hidden="true" />Abrir UIBoard…</MenubarItem>
          {snapshot.documentReading && <>
            <div role="status" className={styles.saveDetails}>Abriendo UIBoard…</div>
            <MenubarItem onSelect={() => store.cancelDocumentRead()}><ClipboardX aria-hidden="true" />Cancelar apertura</MenubarItem>
          </>}
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.saveDocument() }}><ClipboardCheck aria-hidden="true" />Guardar</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => { void store.saveAs() }}><ClipboardPlus aria-hidden="true" />Guardar como…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => showNaming('rename')}><ClipboardPen aria-hidden="true" />Cambiar nombre…</MenubarItem>
          <MenubarItem disabled={!active || fileBusy} onSelect={() => setClosing(true)}><ClipboardX aria-hidden="true" />Cerrar UIBoard</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={fileBusy} onSelect={() => setConfiguration('general')}><Settings aria-hidden="true" />Configuración…</MenubarItem>
          {active && <><MenubarSeparator /><div role="status" className={styles.saveDetails}><span>{labels.local}</span><span>{labels.file}</span>{snapshot.fileName && <span>{snapshot.fileName}</span>}{labels.download && <span>{labels.download}</span>}</div></>}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    {configuration && <LazySurface load={loadSettingsDialog} name="Configuración" onClose={closeConfiguration} onCloseFocus={() => trigger.current?.focus()}
      componentProps={{ initialSection: configuration, onClose: closeConfiguration, onCloseFocus: () => trigger.current?.focus(), desktopViews }} />}
    {(naming || pending || closing) && <LazySurface load={loadFileMenuDialogs} name="Archivo" onClose={cancelFileDialogs} onCloseFocus={() => trigger.current?.focus()}
      componentProps={{ snapshot, nameInput,
      naming: naming ? { mode: naming, value: name, busy: namingBusy, nameError, error: dialogError,
        onChange: value => { setName(value); setDialogError(null) }, onSubmit: () => { void acceptName() },
        onClose: () => { if (!store.getSnapshot().fileBusy && !namingSubmission.current) setNaming(null) } } : null,
      pending: pending ? { onClose: () => { if (!store.getSnapshot().fileBusy) setPending(null) },
        onSave: () => { void store.saveDocument().then(async saved => {
          if (saved && pending && !store.getSnapshot().fileDirty) { const action = pending; setPending(null); await action() }
          else setDialogError(saved ? 'Hay nuevos cambios pendientes. Guarda de nuevo antes de continuar.' : store.getSnapshot().fileMessage)
        }) }, onContinue: () => { const action = pending; setPending(null); void action() } } : null,
      closing: closing ? { title: document.document.title, onClose: () => setClosing(false),
        onConfirm: () => { setClosing(false); void transition(() => store.closeDocument()) } } : null,
      onCloseFocus: () => trigger.current?.focus() }} />}
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
  clock?: { storage: 'conflict' | 'corrupt' | 'unavailable' | null; audio: string | null; onRetry: () => void; onActivate: () => void
    onRescue: () => Promise<string>; onReset: () => Promise<boolean> } | null
}

export function DocumentNotices({ store = getDocumentStore(), reports = null, maps = {}, board = null, clock = null }: DocumentNoticesProps) {
  const snapshot = useDocumentStore(store)
  const { settings } = useSettings()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const fileMessage = snapshot.fileMessage
  const localProblem = snapshot.autosaveUnavailable || snapshot.storageConflict
  const fileProblem = Boolean(fileMessage && !['Guardado', 'Descarga iniciada'].includes(fileMessage))
  const issueKey = [localProblem && 'local', fileProblem && 'file'].filter(Boolean).join(',')
  const notified = useRef(new Set<string>())
  const mapEntries = Object.entries(maps) as ['map' | 'plan', MapNotice][]
  const visibleStatus = {
    localProblem: localProblem && localStorageNoticeMessages(snapshot).some(message => noticeEnabled(settings.notices, 'centerLocal', 'warning', message)),
    fileProblem: fileProblem && noticeEnabled(settings.notices, 'centerFile', 'warning', fileMessage ?? ''),
  }
  const visibleReports = reports && noticeEnabled(settings.notices, 'centerReports', 'warning', reports.message) ? reports : null
  const visibleBoard = board && noticeEnabled(settings.notices, 'centerBoard', 'warning', board.message) ? board : null
  const visibleAudio = clock?.audio && noticeEnabled(settings.notices, 'centerClock', 'warning', clock.audio) ? clock.audio : null
  const visibleTimerStorage = clock?.storage && noticeEnabled(settings.notices, 'centerClock', 'warning', timerStorageNoticeMessage(clock.storage)) ? clock.storage : null
  const visibleClock = clock && (visibleAudio || visibleTimerStorage) ? { ...clock, audio: visibleAudio, storage: visibleTimerStorage } : null
  const visibleMaps = Object.fromEntries(mapEntries.flatMap(([id, notice]) => {
    const noticeId = id === 'map' ? 'centerMap' : 'centerPlan'
    const cartography = notice.cartography.filter(message => noticeEnabled(settings.notices, noticeId, 'warning', message))
    const errors = notice.errors.filter(message => noticeEnabled(settings.notices, noticeId, 'warning', message))
    const missing = notice.missing.filter(file => noticeEnabled(settings.notices, noticeId, 'warning', `GPX pendiente: ${file.name}`))
    return cartography.length || errors.length || missing.length ? [[id, { ...notice, cartography, errors, missing }] as const] : []
  }))
  const hasNotices = Boolean(visibleStatus.localProblem || visibleStatus.fileProblem || visibleReports || Object.keys(visibleMaps).length || visibleBoard || visibleClock)
  const menuVisible = hasNotices || settings.noticesAlwaysVisible
  const historySources = useRef<string[]>([])
  const historyItem = (source: string, notice: NoticeId, original: string) => ({ source, notice, original, message: noticeText(settings.notices, notice, original) })
  const historyKey = JSON.stringify([
    ...(localProblem ? localStorageNoticeMessages(snapshot).map((message, index) => historyItem(`center:local:${index}`, 'centerLocal', message)) : []),
    ...(fileProblem ? [historyItem('center:file', 'centerFile', fileMessage ?? '')] : []),
    ...(reports ? [historyItem('center:reports', 'centerReports', reports.message)] : []),
    ...(board ? [historyItem('center:board', 'centerBoard', board.message)] : []),
    ...(clock?.audio ? [historyItem('center:audio', 'centerClock', clock.audio)] : []),
    ...(clock?.storage ? [historyItem('center:timers', 'centerClock', timerStorageNoticeMessage(clock.storage))] : []),
    ...mapEntries.flatMap(([source, notice]) => [...notice.cartography, ...notice.errors, ...notice.missing.map(file => `GPX pendiente: ${file.name}`)]
      .map((message, index) => historyItem(`center:${source}:${index}`, source === 'map' ? 'centerMap' : 'centerPlan', message))),
  ])
  useEffect(() => {
    const notices = JSON.parse(historyKey) as (Pick<NoticeHistoryEntry, 'message' | 'original' | 'notice'> & { source: string })[]
    const sources = notices.map(notice => notice.source)
    historySources.current.filter(source => !sources.includes(source)).forEach(source => noticeHistoryStore.release(source))
    notices.forEach(notice => noticeHistoryStore.record(notice.message, 'warning', notice.source, notice.original, notice.notice))
    historySources.current = sources
  }, [historyKey])
  useEffect(() => () => { historySources.current.forEach(source => noticeHistoryStore.release(source)) }, [])
  useEffect(() => {
    const current = issueKey ? issueKey.split(',') : []
    const added = current.find(key => !notified.current.has(key))
    notified.current = new Set(current)
    if (added) toast.error(added === 'local' ? 'Recuperación del dispositivo no disponible.' : 'No se pudo completar la operación.', { notice: added === 'local' ? 'documentLocal' : 'documentOperation', id: 'document-notice' })
  }, [issueKey])
  if (!menuVisible && open) setOpen(false)
  useEffect(() => () => { toast.dismiss('document-notice') }, [])
  return <>
    <div className={styles.noticeSlot} data-empty={!menuVisible} aria-hidden={!menuVisible}>
      <Popover open={open && menuVisible} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button ref={trigger} className={controlStyles.base} disabled={!menuVisible}
          aria-label={hasNotices ? 'Incidencias pendientes' : 'Avisos'}>
          <CircleAlert aria-hidden="true" />
        </Button></PopoverTrigger>
        {open && menuVisible && <LazySurface load={loadDocumentNoticeDetails} name="Mensajes" presentation="popover" onClose={() => setOpen(false)}
          componentProps={{ store, snapshot, reports: visibleReports, maps: visibleMaps, board: visibleBoard, clock: visibleClock, status: visibleStatus, onClose: () => setOpen(false) }} />}
      </Popover>
    </div>
  </>
}
