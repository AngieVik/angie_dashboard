import type { RefObject } from 'react'
import { ClipboardCheck, ClipboardPen, ClipboardX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogCancel, AlertDialogForm, AlertDialogFooter } from '@/components/ui/alert-dialog'
import type { DocumentSnapshot } from './documentStore'
import { FileDialogContent } from './FileDialog'

export type Naming = 'new' | 'rename'

interface FileMenuDialogsProps {
  snapshot: DocumentSnapshot
  nameInput: RefObject<HTMLInputElement | null>
  naming: {
    mode: Naming; value: string; busy: boolean; nameError: string | null; error: string | null
    onChange: (value: string) => void; onSubmit: () => void; onClose: () => void
  } | null
  pending: { onClose: () => void; onSave: () => void; onContinue: () => void } | null
  closing: { title: string; onClose: () => void; onConfirm: () => void } | null
  onCloseFocus: () => void
}

export function FileMenuDialogs({ snapshot, nameInput, naming, pending, closing, onCloseFocus }: FileMenuDialogsProps) {
  const { fileBusy } = snapshot
  return <>
    {naming && <AlertDialog open onOpenChange={open => { if (!open) naming.onClose() }}>
      <FileDialogContent fitToContent title={naming.mode === 'rename' ? 'Cambiar nombre' : 'Nuevo UIBoard'} icon={ClipboardPen} onClose={naming.onClose}
        onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus() }}
        onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); nameInput.current?.select() }}>
        <AlertDialogForm onSubmit={event => { event.preventDefault(); naming.onSubmit() }}>
          <Input ref={nameInput} aria-label="Nombre" placeholder="Nombre" aria-invalid={Boolean(naming.error && naming.nameError)} maxLength={120} value={naming.value} disabled={fileBusy || naming.busy}
            onChange={event => naming.onChange(event.target.value)} />
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
          <Button disabled={fileBusy} onClick={pending.onContinue}>Descartar cambios</Button>
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
