import { useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '../../components/ui/alert-dialog'
import { getDocumentStore, useDocumentStore } from './documentStore'
import type { DocumentStore } from './documentStore'

export function FileMenu({ store = getDocumentStore() }: { store?: DocumentStore }) {
  const { fileBusy } = useDocumentStore(store)
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button>Archivo</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => store.newDocument()}>Nuevo</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => input.current?.click()}>Cargar</DropdownMenuItem>
            <DropdownMenuItem disabled={fileBusy} onSelect={() => { void store.saveDocument() }}>Guardar</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
  const { autosaveUnavailable, recoveryPending, fileBusy, fileMessage, fileMessageRevision, downloadFallback } = useDocumentStore(store)
  return (
    <>
      {(autosaveUnavailable || fileMessage) && (
        <div className="document-notices">
          {autosaveUnavailable && (
            <Alert>
              <span>Autoguardado no disponible</span>
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
      <AlertDialog open={recoveryPending}>
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
