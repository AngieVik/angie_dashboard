import { useEffect, useRef, useState } from 'react'
import { CircleAlert, ClipboardPen, ClipboardList, ClipboardCheck, ClipboardPlus, ClipboardX, Settings } from 'lucide-react'
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
import { documentNameError } from '../../domain/document/documentName'
import { LazySurface } from '../../app/recovery/LazySurface'
import styles from './FileMenu.module.css'
import controlStyles from '@/layout/controlButton.module.css'

const loadFileMenuDialogs = () => import('./FileMenuDialogs').then(module => ({ default: module.FileMenuDialogs }))
const loadDocumentNoticeDetails = () => import('./DocumentNoticeDetails').then(module => ({ default: module.DocumentNoticeDetails }))
const loadSettingsDialog = () => import('../settings/SettingsDialog').then(module => ({ default: module.SettingsDialog }))

function saveLabels(snapshot: DocumentSnapshot) {
  const local = snapshot.storageConflict ? 'Dispositivo: copia modificada en otra pestaña' : snapshot.autosaveSaving ? 'Guardando en este dispositivo…' : snapshot.autosaveUnavailable ? 'Recuperación del dispositivo no disponible' :
    snapshot.localSavedAt ? 'Dispositivo: guardado ' + formatTimelineTime(snapshot.localSavedAt) : 'Dispositivo: pendiente de guardar'
  const file = snapshot.fileBusy ? 'Procesando archivo…' : snapshot.fileDirty ? 'Archivo: cambios sin guardar' :
    snapshot.fileSavedAt ? 'Archivo: guardado ' + formatTimelineTime(snapshot.fileSavedAt) : snapshot.fileName ? 'Archivo: abierto sin cambios' : 'Archivo: sin guardar'
  const download = snapshot.downloadStartedAt ? 'Descarga iniciada ' + formatTimelineTime(snapshot.downloadStartedAt) : null
  return { local, file, download }
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
          <MenubarItem disabled={fileBusy} onSelect={() => setConfiguration('location')}><Settings aria-hidden="true" />Configuración…</MenubarItem>
          {active && <><MenubarSeparator /><div role="status" className={styles.saveDetails}><span>{labels.local}</span><span>{labels.file}</span>{snapshot.fileName && <span>{snapshot.fileName}</span>}{labels.download && <span>{labels.download}</span>}</div></>}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    {configuration && <LazySurface load={loadSettingsDialog} name="Configuración" onClose={closeConfiguration} onCloseFocus={() => trigger.current?.focus()}
      componentProps={{ initialSection: configuration, onClose: closeConfiguration, onCloseFocus: () => trigger.current?.focus() }} />}
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
  clock?: { storage: 'conflict' | 'unavailable' | null; audio: string | null; onRetry: () => void; onActivate: () => void } | null
}

export function DocumentNotices({ store = getDocumentStore(), reports = null, maps = {}, board = null, clock = null }: DocumentNoticesProps) {
  const snapshot = useDocumentStore(store)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const fileMessage = snapshot.fileMessage
  const localProblem = snapshot.autosaveUnavailable || snapshot.storageConflict
  const fileProblem = Boolean(fileMessage && !['Guardado', 'Descarga iniciada'].includes(fileMessage))
  const issueKey = [localProblem && 'local', fileProblem && 'file'].filter(Boolean).join(',')
  const notified = useRef(new Set<string>())
  const mapEntries = Object.entries(maps) as ['map' | 'plan', MapNotice][]
  const hasNotices = Boolean(issueKey || reports || mapEntries.length || board || clock)
  useEffect(() => {
    const current = issueKey ? issueKey.split(',') : []
    const added = current.find(key => !notified.current.has(key))
    notified.current = new Set(current)
    if (added) toast.error(added === 'local' ? 'Recuperación del dispositivo no disponible.' : 'No se pudo completar la operación.', { id: 'document-notice' })
  }, [issueKey])
  if (!hasNotices && open) setOpen(false)
  useEffect(() => () => { toast.dismiss('document-notice') }, [])
  return <>
    <div className={styles.noticeSlot} data-empty={!hasNotices} aria-hidden={!hasNotices}>
      <Popover open={open && hasNotices} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button ref={trigger} className={controlStyles.base} disabled={!hasNotices}
          aria-label="Incidencias pendientes">
          <CircleAlert aria-hidden="true" />
        </Button></PopoverTrigger>
        {open && hasNotices && <LazySurface load={loadDocumentNoticeDetails} name="Mensajes" presentation="popover" onClose={() => setOpen(false)}
          componentProps={{ store, snapshot, reports, maps, board, clock, status: { localProblem, fileProblem }, onClose: () => setOpen(false) }} />}
      </Popover>
    </div>
  </>
}
