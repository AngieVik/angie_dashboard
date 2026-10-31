import { useState } from 'react'
import { ArrowBigLeft, ArrowBigRight, CalendarDays, ClipboardClock, FolderArchive, FolderBookmark, FolderSync, FolderTree, ScanSquare, createLucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { RecoverableDocument } from '@/storage/documentRepository'
import { FileDialogContent } from './FileDialog'
import { useDocumentStore } from './documentStore'
import type { DocumentStore } from './documentStore'
import { formatTimelineTime } from '../timeline/timelineCommands'
import styles from './recoveryDialog.module.css'

type View = 'default' | 'folder' | 'device' | 'total'
// Lucide folder-users (ISC), not exported by the installed version.
// https://github.com/lucide-icons/lucide/blob/main/icons/folder-users.svg
const FolderUsers = createLucideIcon('FolderUsers', [
  ['path', { d: 'M5.254 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2V9.255', key: 'folder' }],
  ['circle', { cx: '13', cy: '15', r: '3', key: 'user' }],
  ['path', { d: 'M17 22a4 4 0 0 0-8 0', key: 'body' }],
  ['path', { d: 'M22 22A4 4 0 0 0 20.24 18.686 1 1 0 0 1 20.1 17.143 3 3 0 0 0 19.5 12.402', key: 'second' }],
])
const PAGE_SIZE = 10, MAX_PAGES = 9
const dateLabel = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' })
function shortName(title: string) {
  const letters = Array.from(segmenter.segment(title), part => part.segment)
  return letters.length > 20 ? letters.slice(0, 19).join('') + '…' : title
}

export function RecoveryDialog({ store, busy, error, onRefresh, onClose, onOpen, onRecent }: {
  store: DocumentStore; busy: boolean; error: string | null; onRefresh: () => void; onClose: () => void
  onOpen: (copy: RecoverableDocument) => void; onRecent: () => void
}) {
  const { recoverable, fileBusy } = useDocumentStore(store)
  const [view, setView] = useState<View>('default')
  const [range, setRange] = useState<DateRange>()
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const from = range?.from ? format(range.from, 'yyyy-MM-dd') : null
  const to = range?.to ? format(range.to, 'yyyy-MM-dd') : from
  const filtered = recoverable.filter(copy => {
    if ((view === 'folder' || view === 'total') && copy.source !== 'folder') return false
    if (view === 'device' && copy.source === 'folder') return false
    const day = dateKey.format(new Date(copy.savedAt))
    return !from || day >= from && (!to || day <= to)
  })
  const entries = view === 'total' ? filtered : filtered.slice(0, PAGE_SIZE * MAX_PAGES)
  const pages = view === 'total' ? 1 : Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visible = view === 'total' ? entries : entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const selected = visible.find(copy => copy.key === selectedKey)
  const disabled = busy || fileBusy
  function reset() { setPage(0); setSelectedKey(null) }
  function toggle(next: View) { setView(view === next ? 'default' : next); reset() }
  return <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
    <FileDialogContent title="Recuperar UIBoard" icon={ClipboardClock} onClose={onClose} width={620} height={400} className={styles.dialog}>
      <div className={styles.base}>
        <header className={styles.toolbar} aria-label="Acciones de recuperación">
          <Button disabled={disabled} onClick={() => { reset(); onRefresh() }} aria-label="Actualizar recuperaciones"><FolderSync aria-hidden="true" /></Button>
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
            <Button disabled={disabled} aria-label="Vista dispositivo" aria-pressed={view === 'device'} onClick={() => toggle('device')}><FolderUsers aria-hidden="true" /></Button>
            <Button disabled={disabled} aria-label="Vista total de la carpeta" aria-pressed={view === 'total'} onClick={() => toggle('total')}><FolderTree aria-hidden="true" /></Button>
          </div>
        </header>
        <div key={`${view}-${currentPage}-${from}-${to}`} className={styles.list} data-slot="recovery-list" data-minimum-scroll-content aria-label="Versiones recuperables">
          {visible.map(copy => <Button key={copy.key} className={styles.row} disabled={disabled} aria-pressed={selectedKey === copy.key} aria-label={`${copy.title || 'Sin nombre'}, ${dateLabel.format(new Date(copy.savedAt))}, ${formatTimelineTime(copy.savedAt)}, ${copy.source === 'folder' ? 'Carpeta' : 'Dispositivo'}`}
            onClick={() => setSelectedKey(copy.key)} onDoubleClick={() => onOpen(copy)}>
            <span className={styles.name} title={copy.title || 'Sin nombre'}>{shortName(copy.title || 'Sin nombre')}</span>
            <time dateTime={copy.savedAt}>{dateLabel.format(new Date(copy.savedAt))}</time>
            <span className="technical-data">{formatTimelineTime(copy.savedAt)}</span>
            <span>{copy.source === 'folder' ? 'Carpeta' : 'Dispositivo'}</span>
          </Button>)}
          {!visible.length && !error && !busy && <p>No hay guardados para esta vista.</p>}
        </div>
        {view !== 'total' && <nav className={styles.group} aria-label="Páginas de recuperación">
          <Button disabled={disabled || currentPage === 0} aria-label="Página anterior" onClick={() => { setPage(currentPage - 1); setSelectedKey(null) }}><ArrowBigLeft aria-hidden="true" /></Button>
          {Array.from({ length: pages }, (_, index) => <Button key={index} disabled={disabled} aria-label={`Página ${index + 1}`} aria-current={currentPage === index ? 'page' : undefined} aria-pressed={currentPage === index} onClick={() => { setPage(index); setSelectedKey(null) }}>{index + 1}</Button>)}
          <Button disabled={disabled || currentPage === pages - 1} aria-label="Página siguiente" onClick={() => { setPage(currentPage + 1); setSelectedKey(null) }}><ArrowBigRight aria-hidden="true" /></Button>
        </nav>}
      </div>
    </FileDialogContent>
  </AlertDialog>
}
