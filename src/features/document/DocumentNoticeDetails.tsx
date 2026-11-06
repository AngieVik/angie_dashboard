import type { ReactNode } from 'react'
import { Bell, ClipboardPlus, Clock, FileText, HardDrive, Image, Map, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PopoverContent } from '@/components/ui/popover'
import type { DocumentSnapshot, DocumentStore } from './documentStore'
import type { MapNotice } from '../map/MapModule'
import type { DocumentNoticesProps } from './FileMenu'
import styles from './FileMenu.module.css'

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
        {localProblem && <NoticeCard icon={HardDrive} title={snapshot.storageConflict ? 'Cambios en otra pestaña' : 'Recuperación del dispositivo no disponible'}>
          {snapshot.localStorageMessage && <p>{snapshot.localStorageMessage}</p>}
          <p>{snapshot.storageConflict ? 'Otra pestaña cambió la copia local. Esta sesión no puede sobrescribirla. Usa Guardar como para conservar tus cambios en un archivo.' : !snapshot.active ? 'No se pudo leer la recuperación de este dispositivo.' : 'Los cambios de esta sesión no tienen una copia local confirmada.'}</p>
          <div className={styles.noticeActions}>
            {!snapshot.storageConflict && <Button disabled={snapshot.fileBusy || snapshot.autosaveSaving} onClick={() => { void store.retryAutosave() }}>Reintentar recuperación local</Button>}
            {snapshot.active && <Button disabled={snapshot.fileBusy} onClick={() => { void store.saveAs() }}><ClipboardPlus aria-hidden="true" />Guardar como…</Button>}
          </div>
        </NoticeCard>}
        {fileProblem && <NoticeCard icon={FileText} title="Archivo"><p>{fileMessage}</p></NoticeCard>}
        {clock && <NoticeCard icon={Clock} title="Reloj">
          {clock.audio && <section>
            <p>{clock.audio}</p>
            {clock.audio === 'Sonido bloqueado' && <div className={styles.noticeActions}><Button onClick={clock.onActivate}>Activar sonido</Button></div>}
          </section>}
          {clock.storage && <section>
            <p>{clock.storage === 'conflict' ? 'Otra pestaña ha cambiado los temporizadores. Recargar sustituirá los cambios locales pendientes.' : 'Autoguardado no disponible'}</p>
            <div className={styles.noticeActions}><Button onClick={clock.onRetry}>{clock.storage === 'conflict' ? 'Recargar temporizadores' : 'Reintentar'}</Button></div>
          </section>}
        </NoticeCard>}
        {board && <NoticeCard icon={Image} title="Pizarra · Imagen de fondo">
          <p>{board.message}</p>
          <div className={styles.noticeActions}><Button disabled={board.busy || snapshot.replacing} onClick={() => { board.onChoose() }}>Elegir imagen de fondo</Button></div>
        </NoticeCard>}
        {mapEntries.map(([source, notice]) => <NoticeCard key={source} icon={Map} title={source === 'map' ? 'Mapa' : 'Plano operativo'}>
          {notice.cartography.map(message => <p key={message}>{message}</p>)}
          {notice.errors.map((message, index) => <p key={index}>{message}</p>)}
          {notice.errors.length > 0 && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose() }}>Seleccionar GPX</Button></div>}
          {notice.missing.map(file => <section key={file.id}>
            <p>GPX pendiente: {file.name}</p>
            <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { notice.onChoose(file.id) }}>Seleccionar GPX</Button></div>
          </section>)}
          {notice.missing.length > 0 && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { onClose(); notice.onOpenGpx() }}>Ver GPX</Button></div>}
        </NoticeCard>)}
        {reports && <NoticeCard icon={FileText} title="Informes">
          <p>{reports.message}</p>
          <div className={styles.noticeActions}><Button disabled={reports.busy || snapshot.replacing} onClick={() => { void reports.onRetry() }}>Reintentar</Button></div>
        </NoticeCard>}
      </div>
    </PopoverContent>
  )
}
