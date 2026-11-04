import type { RefObject } from 'react'
import { ClipboardCheck, ClipboardPen, ClipboardPlus, ClipboardX, FileBracesCorner } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogCancel, AlertDialogForm, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { filterWorkspaceName } from '../../platform/files/workspaceNames'
import type { DocumentSnapshot, DocumentStore } from './documentStore'
import { FileDialogContent } from './FileDialog'

export type Naming = 'new' | 'rename' | 'saveAs'

interface FileMenuDialogsProps {
  snapshot: DocumentSnapshot
  nameInput: RefObject<HTMLInputElement | null>
  naming: {
    mode: Naming; value: string; busy: boolean; nameError: string | null; hasError: boolean
    onChange: (value: string) => void; onSubmit: () => void; onClose: () => void; onDirectory: () => void
  } | null
  pending: { onClose: () => void; onSave: () => void; onContinue: () => void } | null
  closing: { title: string; onClose: () => void; onConfirm: () => void } | null
  onCloseFocus: () => void
}

export function FileMenuDialogs({ snapshot, nameInput, naming, pending, closing, onCloseFocus }: FileMenuDialogsProps) {
  const { fileBusy } = snapshot
  return <>
    {naming && <AlertDialog open onOpenChange={open => { if (!open) naming.onClose() }}>
      <FileDialogContent fitToContent title={naming.mode === 'rename' ? 'Cambiar nombre' : naming.mode === 'saveAs' ? 'Guardar como' : 'Nuevo UIBoard'} icon={naming.mode === 'saveAs' ? ClipboardPlus : ClipboardPen} onClose={naming.onClose}
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}
        onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); nameInput.current?.select() }}>
        <AlertDialogForm onSubmit={event => { event.preventDefault(); naming.onSubmit() }}>
          <Input ref={nameInput} aria-label="Nombre" placeholder="Nombre" aria-invalid={Boolean(naming.nameError)} maxLength={100} value={naming.value} disabled={fileBusy || naming.busy}
            onChange={event => naming.onChange(filterWorkspaceName(event.target.value))} />
          {naming.hasError && <Button disabled={fileBusy} onClick={naming.onDirectory}>Carpeta de trabajo</Button>}
          <AlertDialogFooter>
            <Button type="submit" disabled={fileBusy || naming.busy}>{fileBusy || naming.busy ? 'Preparando…' : 'Aceptar'}</Button>
            <AlertDialogCancel asChild><Button disabled={fileBusy || naming.busy}>Cancelar</Button></AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogForm>
      </FileDialogContent>
    </AlertDialog>}
    {pending && <AlertDialog open onOpenChange={open => { if (!open) pending.onClose() }}>
      <FileDialogContent title="Cambios sin guardar" icon={ClipboardCheck} onClose={pending.onClose}
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
        <AlertDialogFooter>
          <Button disabled={fileBusy} onClick={pending.onSave}>Guardar y continuar</Button>
          <Button disabled={fileBusy || (snapshot.autosaveUnavailable && snapshot.workspaceStatus !== 'saved')} onClick={pending.onContinue}>Continuar sin guardar</Button>
          <AlertDialogCancel asChild><Button disabled={fileBusy}>Cancelar</Button></AlertDialogCancel>
        </AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>}
    {closing && <AlertDialog open onOpenChange={open => { if (!open) closing.onClose() }}>
      <FileDialogContent title="Cerrar UIBoard" icon={ClipboardX} onClose={closing.onClose} fitToContent
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
        <p>¿Cerrar «{closing.title || 'Sin nombre'}»?</p>
        <AlertDialogFooter>
          <Button disabled={fileBusy} onClick={closing.onConfirm}>Cerrar</Button>
          <AlertDialogCancel asChild><Button disabled={fileBusy}>Cancelar</Button></AlertDialogCancel>
        </AlertDialogFooter>
      </FileDialogContent>
    </AlertDialog>}
  </>
}

export function ReplacementBlockedDialog({ store, onCloseFocus }: { store: DocumentStore; onCloseFocus: () => void }) {
  return <AlertDialog open onOpenChange={open => { if (!open) store.cancelReplacement() }}>
    <FileDialogContent title="No se pudo guardar el trabajo actual" icon={ClipboardCheck} onClose={() => store.cancelReplacement()}
      onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}>
      <p>El trabajo permanece abierto. Reintenta el guardado o descarga una copia antes de continuar.</p>
      <AlertDialogFooter><Button onClick={() => { void store.retryAutosave() }}>Reintentar</Button><Button onClick={() => { void store.downloadJson() }}><FileBracesCorner aria-hidden="true" />Descargar JSON</Button><AlertDialogCancel asChild><Button onClick={() => store.cancelReplacement()}>Cancelar</Button></AlertDialogCancel></AlertDialogFooter>
    </FileDialogContent>
  </AlertDialog>
}
