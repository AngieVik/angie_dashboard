import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogForm, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { MODULE_REGISTRY } from '../../layout/moduleRegistry'

export type ViewArrangement = 'columns' | 'collapsed-rows' | 'collapsed-columns'

const columnsKey = 'angie.dashboard.columns'
const maximumColumns = Object.keys(MODULE_REGISTRY).length

function readColumns() {
  try {
    const saved = Number(localStorage.getItem(columnsKey))
    if (Number.isInteger(saved) && saved >= 1 && saved <= maximumColumns) return saved
  } catch { /* The default remains usable without local storage. */ }
  return 2
}

export function ViewMenu({ disabled, active, onArrange, onAutoArrange, onFitActive }: {
  disabled: boolean; active: boolean; onArrange: (mode: ViewArrangement, columns: number) => void
  onAutoArrange: () => void; onFitActive: () => void
}) {
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null)
  const [columns, setColumns] = useState(readColumns)
  const [configuring, setConfiguring] = useState(false)
  const [draft, setDraft] = useState(String(columns))
  return <>
    <MenubarMenu>
      <MenubarTrigger asChild><Button ref={trigger}>Vista</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (configuring) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={disabled} onSelect={() => onArrange('columns', columns)}>Columnas</MenubarItem>
          <MenubarItem disabled={disabled} onSelect={() => onArrange('collapsed-rows', columns)}>Colapsados en filas</MenubarItem>
          <MenubarItem disabled={disabled} onSelect={() => onArrange('collapsed-columns', columns)}>Colapsados en columnas</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={disabled} onSelect={onAutoArrange}>Distribución automática</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={disabled || !active} onSelect={onFitActive}>Ajustar módulo activo al contenido</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={() => { setDraft(String(columns)); setConfiguring(true) }}>Configurar columnas…</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    <AlertDialog open={configuring} onOpenChange={setConfiguring}>
      <AlertDialogContent onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); input.current?.select() }}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <AlertDialogTitle>Configurar columnas</AlertDialogTitle>
        <AlertDialogDescription>El número se aplicará al elegir Columnas y se recordará en este dispositivo. No modifica el documento.</AlertDialogDescription>
        <AlertDialogForm onSubmit={event => {
          event.preventDefault()
          const next = Number(draft)
          if (!Number.isInteger(next) || next < 1 || next > maximumColumns) { input.current?.reportValidity(); return }
          setColumns(next)
          try { localStorage.setItem(columnsKey, String(next)) } catch { /* Keep the preference for this session. */ }
          setConfiguring(false)
        }}>
          <label htmlFor="dashboard-columns">Número de columnas</label>
          <Input ref={input} id="dashboard-columns" type="number" min={1} max={maximumColumns} step={1} required value={draft} onChange={event => setDraft(event.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
            <Button type="submit">Aceptar</Button>
          </AlertDialogFooter>
        </AlertDialogForm>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
