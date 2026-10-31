import { useEffect, useRef } from 'react'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { MODULE_REGISTRY } from '../../layout/moduleRegistry'
import type { ModuleId } from '../../layout/layoutTypes'

export interface CleanupRequest { ids: readonly ModuleId[]; close: boolean; generation: number }

const contents: Record<ModuleId, string> = {
  board: 'Trazos, notas e imagen de fondo.',
  elements: 'Incluye sus pines. Las Dotaciones se conservan.',
  dotations: 'Incluye sus pines. El Registro se conserva.',
  information: 'Estados y anotaciones compartidos con Operativo. El Registro se conserva.',
  operations: 'Estados y anotaciones compartidos con Información. El Registro se conserva.',
  coordinates: 'Entrada y resultados.',
  map: 'GPX y selección. Los archivos originales se conservan.',
  plan: 'Trazos y ubicaciones. Recursos y GPX se conservan.',
  clock: 'Incluye los temporizadores guardados y sus alarmas.',
  calendar: 'Restablece la vista. Los eventos de la agenda transversal se conservan.',
  calculator: 'Operación y resultado.',
  notebook: 'Notas y listas.',
  timeline: 'Incluye los estados actuales de las Dotaciones.',
  reports: 'Selección y vista previa. Los informes guardados se conservan.',
}

export function CleanupMenu({ active, disabled, request, onRequest, onCancel, onConfirm, error }: {
  active: ModuleId | null; disabled: boolean; request: CleanupRequest | null
  onRequest: (id: ModuleId | null, close: boolean) => void; onCancel: () => void; onConfirm: () => void; error: string | null
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (error) toast.error(error, { id: 'cleanup' })
    else toast.dismiss('cleanup')
  }, [error])
  const all = request && request.ids.length > 1
  const target = request ? all ? 'todos los módulos' : MODULE_REGISTRY[request.ids[0]!].name : ''
  return <>
    <MenubarMenu>
      <MenubarTrigger asChild><Button ref={trigger}>Limpieza</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (request) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={disabled || !active} onSelect={() => onRequest(active, false)}>Limpiar módulo activo</MenubarItem>
          <MenubarItem disabled={disabled || !active} onSelect={() => onRequest(active, true)}>Limpiar y cerrar módulo activo</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={disabled} onSelect={() => onRequest(null, false)}>Limpiar todos</MenubarItem>
          <MenubarItem disabled={disabled} onSelect={() => onRequest(null, true)}>Limpiar y cerrar todos</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    <AlertDialog open={Boolean(request)} onOpenChange={open => { if (!open) onCancel() }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <AlertDialogTitle>{request?.close ? 'Limpiar y cerrar ' : 'Limpiar '}{target}</AlertDialogTitle>
        <AlertDialogDescription>
          {all ? 'Incluye módulos cerrados, temporizadores y alarmas.' : request ? contents[request.ids[0]!] : ''}
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <Button disabled={disabled} onClick={onConfirm}>{request?.close ? 'Limpiar y cerrar' : 'Limpiar'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
