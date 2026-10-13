import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '../../components/ui/alert-dialog'
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={trigger} className="document-button dashboard-menu-trigger">Vista</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={event => { if (configuring) event.preventDefault() }}>
        <DropdownMenuItem disabled={disabled} onSelect={() => onArrange('columns', columns)}>Columnas</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => onArrange('collapsed-rows', columns)}>Colapsados en filas</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => onArrange('collapsed-columns', columns)}>Colapsados en columnas</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled} onSelect={onAutoArrange}>Distribución automática</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled || !active} onSelect={onFitActive}>Ajustar módulo activo al contenido</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { setDraft(String(columns)); setConfiguring(true) }}>Configurar columnas…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={configuring} onOpenChange={setConfiguring}>
      <AlertDialogContent onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); input.current?.select() }}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <AlertDialogTitle>Configurar columnas</AlertDialogTitle>
        <AlertDialogDescription>El número se aplicará al elegir Columnas y se recordará en este dispositivo. No modifica el documento.</AlertDialogDescription>
        <form className="document-name-form" onSubmit={event => {
          event.preventDefault()
          const next = Number(draft)
          if (!Number.isInteger(next) || next < 1 || next > maximumColumns) { input.current?.reportValidity(); return }
          setColumns(next)
          try { localStorage.setItem(columnsKey, String(next)) } catch { /* Keep the preference for this session. */ }
          setConfiguring(false)
        }}>
          <label htmlFor="dashboard-columns">Número de columnas</label>
          <Input ref={input} id="dashboard-columns" type="number" min={1} max={maximumColumns} step={1} required value={draft} onChange={event => setDraft(event.target.value)} />
          <div className="document-dialog-actions">
            <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
            <Button type="submit">Aceptar</Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
