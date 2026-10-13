import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore, DocumentSnapshot } from './documentStore'
import { formatTimelineDate, formatTimelineTime } from '../timeline/timelineCommands'

function saveLabels(snapshot: DocumentSnapshot) {
  const local = !snapshot.ready ? 'Recuperando documento…' : snapshot.autosaveUnavailable ? 'Autoguardado no disponible' : snapshot.autosaveSaving ? 'Guardando en este dispositivo…' :
    'Guardado en este dispositivo' + (snapshot.localSavedAt ? ' · ' + formatTimelineTime(snapshot.localSavedAt) : '')
  const file = snapshot.fileDirty ? 'Cambios pendientes de guardar en archivo' : snapshot.fileSavedAt ? 'Archivo actualizado · ' + formatTimelineTime(snapshot.fileSavedAt) : 'Sin cambios pendientes de exportar'
  return { local, file }
}

export function FileMenu({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const snapshot = useDocumentStore(store)
  const { fileBusy, document, ready, recoverable } = snapshot
  const labels = saveLabels(snapshot)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [recovering, setRecovering] = useState(false)
  return (
    <>
      <DropdownMenu onOpenChange={open => { if (open) void store.refreshRecoverable() }}>
        <DropdownMenuTrigger asChild><Button ref={trigger} className="document-button dashboard-menu-trigger">Archivo</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={event => { if (editingName || recovering) event.preventDefault() }}>
          <div className="document-menu-name"><span>Documento</span><strong data-document-name>{document.document.title || 'Sin nombre'}</strong></div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={fileBusy || !ready} onSelect={() => { void store.newDocument() }}>Nuevo</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => { if (store.hasOpenPicker()) void store.openDocument(); else input.current?.click() }}>Abrir…</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => { void store.saveDocument() }}>Guardar</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => { void store.saveDocument(true) }}>Guardar como…</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => {
              setName(store.getSnapshot().document.document.title)
              setEditingName(true)
            }}>Cambiar nombre…</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={fileBusy || !ready} onSelect={() => setRecovering(true)}>Recuperar documento local…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <div role="status" className="document-save-details"><span>{labels.local}</span><span>{labels.file}</span>{snapshot.downloadStartedAt && <span>Descarga iniciada · {formatTimelineTime(snapshot.downloadStartedAt)}</span>}</div>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={recovering} onOpenChange={setRecovering}>
        <AlertDialogContent>
          <AlertDialogTitle>Recuperar documento local</AlertDialogTitle>
          <AlertDialogDescription>El documento actual se protegerá antes de abrir la copia elegida. Estas copias permanecen en este dispositivo.</AlertDialogDescription>
          <div className="document-recovery-list">
            {recoverable.length ? recoverable.map(copy => <Button key={copy.key} disabled={fileBusy} onClick={() => { setRecovering(false); void store.restoreDocument(copy.key) }}>
              {copy.key === 'previous' ? 'Copia anterior · ' : ''}{copy.title || 'Sin título'} · {formatTimelineDate(copy.savedAt)}
            </Button>) : <p>No hay documentos recuperables.</p>}
          </div>
          <AlertDialogCancel asChild><Button>Cerrar</Button></AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={editingName} onOpenChange={setEditingName}>
        <AlertDialogContent onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); nameInput.current?.select() }}
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
          <AlertDialogTitle>Cambiar nombre</AlertDialogTitle>
          <AlertDialogDescription>Nombre del documento para identificarlo al guardar.</AlertDialogDescription>
          <form className="document-name-form" onSubmit={event => { event.preventDefault(); store.setTitle(name); setEditingName(false) }}>
            <Input ref={nameInput} aria-label="Título del documento" placeholder="Nombre del documento" value={name} onChange={event => setName(event.target.value)} />
            <div className="document-dialog-actions">
              <AlertDialogCancel asChild><Button type="button">Cancelar</Button></AlertDialogCancel>
              <Button type="submit">Aceptar</Button>
            </div>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      <input ref={input} type="file" accept=".json,application/json" aria-label="Cargar documento JSON" hidden
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void store.loadDocument(file)
        }} />
    </>
  )
}

export function DocumentNotices({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const { autosaveUnavailable, recoveryPending, replacementBlocked, storageConflict, recoveredPrevious, fileBusy, fileMessage, fileMessageRevision, downloadFallback } = useDocumentStore(store)
  return (
    <>
      {(autosaveUnavailable || fileMessage || recoveredPrevious) && (
        <div className="document-notices">
          {recoveredPrevious && <Alert><span>Se recuperó la copia anterior válida. El registro dañado se conserva en este dispositivo.</span></Alert>}
          {autosaveUnavailable && (
            <Alert>
              <span>Autoguardado no disponible{storageConflict ? ": hay cambios guardados desde otra pestaña." : ""}</span>
              <Button onClick={() => { void store.retryAutosave() }}>Reintentar</Button>
              <Button disabled={fileBusy} onClick={() => { void store.downloadJson() }}>Guardar JSON</Button>
            </Alert>
          )}
          {fileMessage && (downloadFallback ? (
            <Alert>
              <span>{fileMessage}</span>
              <Button disabled={fileBusy} onClick={() => { void store.acceptDownloadFallback() }}>Descargar JSON</Button>
            </Alert>
          ) : <FileValidationNotice key={fileMessageRevision} message={fileMessage} />)}
        </div>
      )}
      <AlertDialog open={replacementBlocked}>
        <AlertDialogContent>
          <AlertDialogTitle>No se pudo proteger el documento</AlertDialogTitle>
          <AlertDialogDescription>El documento actual sigue abierto. Puedes exportarlo, cancelar o descartar expresamente estos cambios para continuar.</AlertDialogDescription>
          <div className="document-dialog-actions">
            <Button disabled={fileBusy} onClick={() => { void store.downloadJson() }}>Guardar JSON</Button>
            <AlertDialogCancel asChild><Button disabled={fileBusy} onClick={() => store.cancelReplacement()}>Cancelar sustitución</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button disabled={fileBusy} onClick={() => store.discardReplacement()}>Descartar y continuar</Button></AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={recoveryPending && !replacementBlocked}>
        <AlertDialogContent>
          <AlertDialogTitle>Recuperar documento local</AlertDialogTitle>
          <AlertDialogDescription>
            Hay un documento guardado en este dispositivo. ¿Quieres recuperarlo y reemplazar los cambios actuales en memoria?
          </AlertDialogDescription>
          <div className="document-dialog-actions">
            <AlertDialogCancel asChild><Button onClick={() => { void store.confirmRecovery(false) }}>Conservar cambios actuales</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={() => { void store.confirmRecovery(true) }}>Recuperar documento</Button></AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function FileValidationNotice({ message }: { message: string }) {
  const [notice] = useValidationNotice(message)
  return notice ? <Alert><span>{notice}</span></Alert> : null
}
