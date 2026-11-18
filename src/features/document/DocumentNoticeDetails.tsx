import type { ReactNode } from 'react'
import { Bell, ClipboardPlus, Clock, FileText, HardDrive, Image, Map, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PopoverContent } from '@/components/ui/popover'
import type { DocumentSnapshot, DocumentStore } from './documentStore'
import type { MapNotice } from '../map/MapModule'
import type { DocumentNoticesProps } from './FileMenu'
import styles from './FileMenu.module.css'
import { useSettings } from '../settings/useSettings'
import { noticeEnabled, noticeText } from '../notices/noticePreferences'
import { localStorageNoticeMessages, timerStorageNoticeMessage } from './documentNoticeMessages'

interface DocumentNoticeDetailsProps extends Required<DocumentNoticesProps> {
  store: DocumentStore
  snapshot: DocumentSnapshot
  status: { localProblem: boolean; fileProblem: boolean }
  onClose: () => void
}

function NoticeCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return <section className={styles.noticeCard}>
    <h3><Icon aria-hidden="true" /><span>{title}</span></h3>
    {children}
  </section>
}

export function DocumentNoticeDetails({ store, snapshot, status, reports, maps, board, clock, onClose }: DocumentNoticeDetailsProps) {
  const { settings } = useSettings()
  const preferences = settings.notices
  const { localProblem, fileProblem } = status
  const fileMessage = snapshot.fileMessage
  const mapEntries = Object.entries(maps) as ['map' | 'plan', MapNotice][]
  return (
    <PopoverContent align="end" aria-label="Centro de mensajes" className={styles.noticePanel}>
      <header className={styles.noticeHeader}>
        <Bell aria-hidden="true" /><h2>Mensajes</h2>
        <Button aria-label="Cerrar mensajes" onClick={onClose}><X aria-hidden="true" /></Button>
      </header>
      <div className={styles.noticeList}>
        {!localProblem && !fileProblem && !clock && !board && !reports && mapEntries.length === 0 && <p>No hay avisos pendientes.</p>}
        {localProblem && <NoticeCard icon={HardDrive} title={snapshot.storageConflict ? 'Cambios en otra pestaña' : 'Recuperación del dispositivo no disponible'}>
          {localStorageNoticeMessages(snapshot).filter(message => noticeEnabled(preferences, 'centerLocal', 'warning', message))
            .map(message => <p key={message}>{noticeText(preferences, 'centerLocal', message)}</p>)}
          <div className={styles.noticeActions}>
            {!snapshot.storageConflict && <Button disabled={snapshot.fileBusy || snapshot.autosaveSaving} onClick={() => { void store.retryAutosave() }}>Reintentar recuperación local</Button>}
            {snapshot.active && <Button disabled={snapshot.fileBusy} onClick={() => { void store.saveAs() }}><ClipboardPlus aria-hidden="true" />Guardar como…</Button>}
          </div>
        </NoticeCard>}
        {fileProblem && <NoticeCard icon={FileText} title="Archivo"><p>{noticeText(preferences, 'centerFile', fileMessage ?? '')}</p></NoticeCard>}
        {clock && <NoticeCard icon={Clock} title="Reloj">
          {clock.audio && <section>
            <p>{noticeText(preferences, 'centerClock', clock.audio)}</p>
            {clock.audio === 'Sonido bloqueado' && <div className={styles.noticeActions}><Button onClick={clock.onActivate}>Activar sonido</Button></div>}
          </section>}
          {clock.storage && <section>
            <p>{noticeText(preferences, 'centerClock', timerStorageNoticeMessage(clock.storage))}</p>
            <div className={styles.noticeActions}><Button onClick={clock.onRetry}>{clock.storage === 'conflict' ? 'Recargar temporizadores' : 'Reintentar'}</Button></div>
          </section>}
        </NoticeCard>}
        {board && <NoticeCard icon={Image} title="Pizarra · Imagen de fondo">
          <p>{noticeText(preferences, 'centerBoard', board.message)}</p>
          <div className={styles.noticeActions}><Button disabled={board.busy || snapshot.replacing} onClick={() => { board.onChoose() }}>Elegir imagen de fondo</Button></div>
        </NoticeCard>}
        {mapEntries.map(([source, notice]) => <NoticeCard key={source} icon={Map} title={source === 'map' ? 'Mapa' : 'Plano operativo'}>
          {notice.cartography.map(message => <p key={message}>{noticeText(preferences, source === 'map' ? 'centerMap' : 'centerPlan', message)}</p>)}
          {notice.errors.map((message, index) => <p key={index}>{noticeText(preferences, source === 'map' ? 'centerMap' : 'centerPlan', message)}</p>)}
          {notice.errors.length > 0 && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose() }}>Seleccionar GPX</Button></div>}
          {notice.missing.map(file => <section key={file.id}>
            <p>{noticeText(preferences, source === 'map' ? 'centerMap' : 'centerPlan', `GPX pendiente: ${file.name}`)}</p>
            <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose(file.id) }}>Seleccionar GPX</Button></div>
          </section>)}
          {notice.missing.length > 0 && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { onClose(); notice.onOpenGpx() }}>Ver GPX</Button></div>}
        </NoticeCard>)}
        {reports && <NoticeCard icon={FileText} title="Informes">
          <p>{noticeText(preferences, 'centerReports', reports.message)}</p>
          <div className={styles.noticeActions}><Button disabled={reports.busy || snapshot.replacing} onClick={() => { void reports.onRetry() }}>Reintentar</Button></div>
        </NoticeCard>}
      </div>
    </PopoverContent>
  )
}
