import { useSyncExternalStore } from 'react'
import { useSettings } from '../settings/useSettings'
import { formatInstant } from '@/platform/formatting'
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { noticeHistoryStore } from './noticeHistoryStore'
import { NOTICE_LEVEL_LABELS } from './noticePreferences'
import styles from './noticeHistory.module.css'


export function NoticeHistoryDialog({ onClose, onCloseFocus }: { onClose: () => void; onCloseFocus: () => void }) {
  const entries = useSyncExternalStore(noticeHistoryStore.subscribe, noticeHistoryStore.getSnapshot)
  const { settings } = useSettings()
  return <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
    <AlertDialogContent className={styles.dialog} overlayClassName={styles.overlay} aria-describedby={undefined}
      onEscapeKeyDown={event => { event.preventDefault(); onClose() }}
      onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
      <AlertDialogTitle>Registro de avisos</AlertDialogTitle>
      <div className={styles.entries}>
        {entries.length === 0 ? <p>No hay avisos en esta sesión.</p> : <ol>
          {entries.map(entry => <li key={entry.id}>
            <div><time dateTime={new Date(entry.at).toISOString()}>{formatInstant(entry.at, settings.formats)}</time><span>{NOTICE_LEVEL_LABELS[entry.level]}</span></div>
            <p>{entry.message}</p>
          </li>)}
        </ol>}
      </div>
      <Button onClick={onClose}>Cerrar</Button>
    </AlertDialogContent>
  </AlertDialog>
}
