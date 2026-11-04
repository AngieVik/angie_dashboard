import { FolderCog, FolderSync, FileBracesCorner } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PopoverContent } from '@/components/ui/popover'
import type { DocumentSnapshot, DocumentStore } from './documentStore'
import type { MapGpxReference } from '../../domain/document/types'
import type { MapNotice } from '../map/MapModule'
import type { DocumentNoticesProps } from './FileMenu'
import { REPORT_SECTIONS } from './reportSections'
import { formatReportIssue, reportIssueKey } from './reportIssues'
import { formatTimelineDate } from '../timeline/timelineCommands'
import styles from './FileMenu.module.css'

interface DocumentNoticeDetailsProps extends Required<DocumentNoticesProps> {
  store: DocumentStore
  snapshot: DocumentSnapshot
  status: { workspaceMessage: string | null; workspaceProblem: boolean; localProblem: boolean; fileProblem: boolean; issueKey: string; pendingGpx: MapGpxReference[] }
  branching: boolean
  onBranch: () => void
  onClose: () => void
  onPermissions: () => void
}

export function DocumentNoticeDetails({ store, snapshot, status, reports, maps, board, clock, branching, onBranch, onClose, onPermissions }: DocumentNoticeDetailsProps) {
  const { workspaceMessage, workspaceProblem, localProblem, fileProblem, issueKey, pendingGpx } = status
  const fileMessage = snapshot.fileMessage
  const mapEntries = Object.entries(maps) as ['map' | 'plan', MapNotice][]
  return (
    <PopoverContent align="end" aria-label="Incidencias pendientes" className={styles.noticePanel}>
      {workspaceProblem && <section>
        <h3>Guardado en carpeta pendiente</h3>
        <p>{workspaceMessage ?? 'Selecciona una carpeta de trabajo para guardar.'}</p>
        {snapshot.workspacePath && <p>{snapshot.workspacePath}</p>}
        <div className={styles.noticeActions}>
          <Button disabled={snapshot.fileBusy || snapshot.workspaceStatus === 'saving'} onClick={() => { void store.saveDocument() }}><FolderSync aria-hidden="true" />Reintentar</Button>
          <Button disabled={snapshot.fileBusy} onClick={onPermissions}><FolderCog aria-hidden="true" />Carpeta de trabajo</Button>
        </div>
      </section>}
      {localProblem && <section>
        <h3>{snapshot.storageConflict ? 'Cambios en otra pestaña' : 'Recuperación del dispositivo no disponible'}</h3>
        {snapshot.localStorageMessage && <p>{snapshot.localStorageMessage}</p>}
        <p>{!snapshot.active ? fileMessage ?? 'No se pudo leer la recuperación de este dispositivo.' : snapshot.storageConflict ? 'Abre una recuperación en rama para conservar tus cambios.' : snapshot.workspaceStatus === 'saved' ? 'El trabajo está guardado en carpeta.' : 'Los cambios de esta sesión aún no tienen protección confirmada.'}</p>
        <div className={styles.noticeActions}>
          {snapshot.storageConflict ? <Button disabled={snapshot.fileBusy || branching} onClick={onBranch}>Abrir recuperación en rama</Button> : <Button disabled={snapshot.fileBusy || snapshot.autosaveSaving} onClick={() => { void store.retryAutosave() }}>Reintentar recuperación local</Button>}
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
        {(notice.missing.length > 0 || notice.access.length > 0) && <div className={styles.noticeActions}><Button disabled={notice.busy || snapshot.replacing} onClick={() => { onClose(); notice.onOpenGpx() }}>Ver GPX</Button></div>}
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
            {reports.directoryNeeded && <Button disabled={reports.busy || snapshot.replacing} onClick={() => { onClose(); reports.onDirectory() }}>Carpeta de trabajo</Button>}
          </div>
        </section>}
      </section>}
      {snapshot.recoveryPending && <section>
        <h3>Sesión disponible</h3><p>{snapshot.recoveryTitle || 'UIBoard sin nombre'}</p>
        {snapshot.recoverySeenAt && <p>{formatTimelineDate(snapshot.recoverySeenAt)}</p>}
        <div className={styles.noticeActions}><Button disabled={snapshot.fileBusy} onClick={() => { void store.confirmRecovery(true) }}>Continuar</Button></div>
      </section>}
    </PopoverContent>
  )
}
