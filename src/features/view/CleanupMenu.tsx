import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { MODULE_REGISTRY } from '../../layout/moduleRegistry'
import type { ModuleId } from '../../layout/layoutTypes'

export interface CleanupRequest { ids: readonly ModuleId[]; close: boolean; generation: number }

const contents: Record<ModuleId, string> = {
  board: 'Se eliminarán los trazos, las notas y la imagen de la Pizarra, y se restablecerá su fondo. Los Elementos y las Dotaciones seguirán disponibles.',
  elements: 'Se eliminarán los Elementos y sus pins. También desaparecerán de Pizarra, Plano operativo e Información. Las Dotaciones se conservarán.',
  dotations: 'Se eliminarán las Dotaciones y sus pins. También desaparecerán de Pizarra, Plano operativo, Información y Operativo. El histórico del Registro se conservará.',
  information: 'Se borrarán los estados, las anotaciones y las etiquetas de todas las Dotaciones, compartidos con Operativo. El histórico del Registro y la información descriptiva se conservarán.',
  operations: 'Se borrarán los estados, las anotaciones y las etiquetas de todas las Dotaciones, compartidos con Información. El histórico del Registro y la información descriptiva se conservarán.',
  coordinates: 'Se borrarán la coordenada introducida y sus resultados.',
  map: 'Se retirarán del mapa los GPX cargados y el punto seleccionado. Los archivos GPX originales se conservarán.',
  plan: 'Se eliminarán los trazos y las ubicaciones del Plano operativo. Los Elementos, las Dotaciones y los GPX compartidos con Mapa se conservarán.',
  clock: 'Se detendrán y eliminarán todos los temporizadores, incluidos los guardados en este dispositivo. Sus alarmas dejarán de sonar.',
  calculator: 'Se borrarán la operación y el resultado de la Calculadora.',
  notebook: 'Se eliminarán todas las notas y listas del Cuaderno.',
  timeline: 'Se eliminará todo el Registro. También se quitarán los estados actuales de las Dotaciones, compartidos con Información y Operativo.',
  reports: 'Se restablecerán la selección de campos y la vista previa de Informes. Los archivos de informes guardados se conservarán.',
}

export function CleanupMenu({ active, disabled, request, onRequest, onCancel, onConfirm, error }: {
  active: ModuleId | null; disabled: boolean; request: CleanupRequest | null
  onRequest: (id: ModuleId | null, close: boolean) => void; onCancel: () => void; onConfirm: () => void; error: string | null
}) {
  const trigger = useRef<HTMLButtonElement>(null)
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
          {all ? 'Se eliminará el contenido de todos los módulos, incluidos los cerrados: Pizarra, Elementos, Dotaciones, datos operativos, Cuaderno y Registro. También se retirarán los GPX del Mapa, se borrarán las entradas de Coordenadas y Calculadora, y se detendrán y eliminarán todos los temporizadores y sus alarmas.' : request ? contents[request.ids[0]!] : ''}
          {' Se conservarán la posición, el tamaño y el zoom.'}
          {request?.close ? all ? ' Después se cerrarán todos los módulos abiertos.' : ' Después se cerrará este módulo.' : ' Los módulos abiertos permanecerán abiertos.'}
        </AlertDialogDescription>
        {error && <p role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <Button disabled={disabled} onClick={onConfirm}>{request?.close ? 'Limpiar y cerrar' : 'Limpiar'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
