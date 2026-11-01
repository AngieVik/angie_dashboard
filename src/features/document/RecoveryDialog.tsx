import { useEffect, useState } from 'react'
import { ArrowBigLeft, ArrowBigRight, CalendarDays, ClipboardClock, FolderArchive, FolderBookmark, FolderSync, FolderTree, ScanSquare, Trash, createLucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { RecoverableDocument } from '@/storage/documentRepository'
import { FileDialogContent } from './FileDialog'
import { useDocumentStore } from './documentStore'
import type { DocumentStore } from './documentStore'
import { formatTimelineTime } from '../timeline/timelineCommands'
import styles from './recoveryDialog.module.css'
import { StorageUsage } from './StorageUsage'
import type { CatalogEntry, LibraryStorage, RecoveryCursor, RecoveryPage, RetainedRemoval } from '@/storage/documentCatalog'

type View = 'default' | 'folder' | 'device' | 'total'
// Lucide folder-users (ISC), not exported by the installed version.
// https://github.com/lucide-icons/lucide/blob/main/icons/folder-users.svg
const FolderUsers = createLucideIcon('FolderUsers', [
  ['path', { d: 'M5.254 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2V9.255', key: 'folder' }],
  ['circle', { cx: '13', cy: '15', r: '3', key: 'user' }],
  ['path', { d: 'M17 22a4 4 0 0 0-8 0', key: 'body' }],
  ['path', { d: 'M22 22A4 4 0 0 0 20.24 18.686 1 1 0 0 1 20.1 17.143 3 3 0 0 0 19.5 12.402', key: 'second' }],
])
const PAGE_SIZE = 10
const dateLabel = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
const versionLabels: Record<string, string> = { board: 'Actual', snapshot: 'Instantánea', archive: 'Archivo', previous: 'Anterior', active: 'Sesión', damaged: 'Sin validar' }
const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' })
function shortName(title: string) {
  const letters = Array.from(segmenter.segment(title), part => part.segment)
  return letters.length > 20 ? letters.slice(0, 19).join('') + '…' : title
}

export function RecoveryDialog({ store, busy, error, onRefresh, onClose, onOpen, onRecent }: {
  store: DocumentStore; busy: boolean; error: string | null; onRefresh: () => void; onClose: () => void
  onOpen: (copy: RecoverableDocument) => void; onRecent: () => void
}) {
  const { fileBusy, active, document } = useDocumentStore(store)
  const [view, setView] = useState<View>('default')
  const [range, setRange] = useState<DateRange>()
  const [history, setHistory] = useState<RecoveryCursor[]>([])
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<RecoveryPage>({ entries: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [storage, setStorage] = useState<LibraryStorage>()
  const [refresh, setRefresh] = useState(0)
  const [removal, setRemoval] = useState<{ entry: CatalogEntry; request: RetainedRemoval }>()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const from = range?.from ? format(range.from, 'yyyy-MM-dd') : undefined
  const to = range?.to ? format(range.to, 'yyyy-MM-dd') : from
  const cursor = history.at(-1)
  const source = view === 'folder' || view === 'total' ? 'folder' : view === 'device' ? 'device' : 'all'
  useEffect(() => {
    if (busy) return
    let current = true
    setLoading(true); setLoadError(null)
    void store.listRecoveryPage({ cursor, limit: PAGE_SIZE, search, fromDay: from, toDay: to }, source)
      .then(value => { if (current) { setResult(value); setLoadError(value.warning ?? null) } })
      .catch(error => { if (current) setLoadError(error instanceof Error ? error.message : 'No se pudo leer el catálogo.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [store, cursor, source, search, from, to, refresh, busy])
  useEffect(() => {
    let current = true
    void Promise.resolve(store.measureStorage()).then(value => { if (current) setStorage(value) })
      .catch(() => { if (current) setStorage({ documents: 0, versions: 0, estimateError: 'No se pudo consultar el almacenamiento.' }) })
    return () => { current = false }
  }, [store, refresh, busy])
  const visible = result.entries
  const selected = visible.find(copy => copy.key === selectedKey)
  const disabled = busy || fileBusy || loading
  const canRemove = selected?.source === 'device' && !(active && selected.documentId === document.document.id)
  function reset() { setHistory([]); setSelectedKey(null) }
  function toggle(next: View) { setView(view === next ? 'default' : next); reset() }
  async function removeSelection() {
    if (!removal) return
    try {
      await store.removeRetained(removal.request)
      setRemoval(undefined); reset(); setRefresh(value => value + 1)
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'No se pudo eliminar la selección.'); setRemoval(undefined) }
  }
  return <><AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
    <FileDialogContent title="Recuperar UIBoard" icon={ClipboardClock} onClose={onClose} width={620} height={400} className={styles.dialog}>
      <div className={styles.base}>
        <header className={styles.toolbar} aria-label="Acciones de recuperación">
          <Button disabled={disabled} onClick={() => { reset(); setRefresh(value => value + 1); onRefresh() }} aria-label="Actualizar recuperaciones"><FolderSync aria-hidden="true" /></Button>
          <Button disabled={disabled || !selected} onClick={() => { if (selected) onOpen(selected) }}><ScanSquare aria-hidden="true" />Abrir</Button>
          <Button disabled={disabled} onClick={onRecent}><FolderBookmark aria-hidden="true" />Abrir reciente</Button>
          <Popover>
            <PopoverTrigger asChild><Button disabled={disabled} aria-label="Filtrar por fecha" aria-pressed={Boolean(range?.from)}><CalendarDays aria-hidden="true" /></Button></PopoverTrigger>
            <PopoverContent align="start" className={styles.calendar} aria-label="Filtro por fecha">
              <Calendar mode="range" selected={range} onSelect={value => { setRange(value); reset() }} timeZone="Europe/Madrid" />
              <Button disabled={!range} onClick={() => { setRange(undefined); reset() }}>Quitar filtro</Button>
            </PopoverContent>
          </Popover>
          <div className={styles.group} role="group" aria-label="Vistas de recuperación">
            <Button disabled={disabled} aria-label="Vista carpeta" aria-pressed={view === 'folder'} onClick={() => toggle('folder')}><FolderArchive aria-hidden="true" /></Button>
            <Button disabled={disabled} aria-label="Vista dispositivo" aria-pressed={source === 'device'} onClick={() => toggle('device')}><FolderUsers aria-hidden="true" /></Button>
            <Button disabled={disabled} aria-label="Vista total de la carpeta" aria-pressed={view === 'total'} onClick={() => toggle('total')}><FolderTree aria-hidden="true" /></Button>
          </div>
        </header>
        <div className={styles.management}>
          <Input aria-label="Buscar guardados" placeholder="Buscar por título" maxLength={256} value={search} onChange={event => { setSearch(event.target.value); reset() }} />
          <Button disabled={disabled || !canRemove || !selected} onClick={() => {
            if (!selected) return
            setLoadError(null)
            setRemoval({ entry: selected, request: { ...(selected.kind === 'board' ? { documentId: selected.documentId } : { key: selected.key }),
              expectedRevision: selected.revision, expectedSavedAt: selected.savedAt } })
          }}><Trash aria-hidden="true" />{selected?.kind === 'board' ? 'Eliminar documento' : 'Eliminar versión'}</Button>
        </div>
        <div className={styles.list} data-slot="recovery-list" data-minimum-scroll-content aria-label="Versiones recuperables" aria-busy={disabled}>
          {visible.map(copy => <Button key={copy.key} className={styles.row} disabled={disabled} aria-pressed={selectedKey === copy.key} aria-label={`${copy.title || 'Sin nombre'}, ${dateLabel.format(new Date(copy.savedAt))}, ${formatTimelineTime(copy.savedAt)}, ${copy.source === 'folder' ? 'Carpeta' : 'Dispositivo'}`}
            onClick={() => setSelectedKey(copy.key)} onDoubleClick={() => onOpen(copy)}>
            <span className={styles.name} title={`${copy.title || 'Sin nombre'} · ${copy.key}`}>{shortName(copy.title || 'Sin nombre')}</span>
            <time dateTime={copy.savedAt}>{dateLabel.format(new Date(copy.savedAt))}</time>
            <span className="technical-data">{formatTimelineTime(copy.savedAt)}</span>
            <span>{copy.source === 'folder' ? 'Carpeta' : 'Dispositivo'}{copy.kind ? ` · ${versionLabels[copy.kind] ?? copy.kind}` : ''}{copy.revision !== undefined ? ` · r${copy.revision}` : ''}</span>
          </Button>)}
          {!visible.length && !error && !loadError && !disabled && <p>No hay guardados para esta vista.</p>}
        </div>
        {(loadError || error) && <p role="alert">{loadError || error}</p>}
        <nav className={styles.group} aria-label="Páginas de recuperación">
          <Button disabled={disabled || !history.length} aria-label="Página anterior" onClick={() => { setHistory(value => value.slice(0, -1)); setSelectedKey(null) }}><ArrowBigLeft aria-hidden="true" /></Button>
          <span className={styles.page} aria-live="polite">Página {history.length + 1}</span>
          <Button disabled={disabled || !result.nextCursor} aria-label="Página siguiente" onClick={() => { if (result.nextCursor) setHistory(value => [...value, result.nextCursor!]); setSelectedKey(null) }}><ArrowBigRight aria-hidden="true" /></Button>
        </nav>
        <footer className={styles.capacity}>
          {storage && <span>{storage.documents} documentos · {storage.versions} versiones locales</span>}
          <StorageUsage capacity={storage} />
        </footer>
      </div>
    </FileDialogContent>
  </AlertDialog>
    {removal && <AlertDialog open onOpenChange={open => { if (!open && !fileBusy) setRemoval(undefined) }}>
      <FileDialogContent title="Eliminar del dispositivo" icon={Trash} onClose={() => { if (!fileBusy) setRemoval(undefined) }} width={460} height={190}>
        <p>Eliminar {removal.request.documentId ? 'el documento y todas sus versiones locales' : 'esta versión'} de «{removal.entry.title || 'Sin nombre'}».</p>
        <p>Los recursos sin otras referencias se retirarán también. Las copias de la carpeta se conservan.</p>
        <div className={styles.toolbar}>
          <Button disabled={fileBusy} onClick={() => setRemoval(undefined)}>Cancelar</Button>
          <Button disabled={fileBusy} onClick={() => { void removeSelection() }}>Confirmar eliminación</Button>
        </div>
      </FileDialogContent>
    </AlertDialog>}
  </>
}
