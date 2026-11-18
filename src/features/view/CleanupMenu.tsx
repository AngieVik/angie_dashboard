import { useEffect, useRef } from 'react'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CLEANUP_MODULE_IDS } from './cleanupPlan'
import type { CleanupPlan, CleanupRequest } from './cleanupPlan'
import styles from './cleanup.module.css'
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem } from '@/components/ui/menubar'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { MODULE_REGISTRY } from '../../layout/moduleRegistry'
import type { ModuleId } from '../../layout/layoutTypes'

export function CleanupMenu({ active, disabled, busy, request, plan, onSelection, onRequest, onCancel, onConfirm, error }: {
  active: ModuleId | null; disabled: boolean; busy: boolean; request: CleanupRequest | null; plan: CleanupPlan | null
  onSelection: (ids: readonly ModuleId[]) => void
  onRequest: (id: ModuleId | null) => void; onCancel: () => void; onConfirm: () => void; error: string | null
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (error) toast.error(error, { notice: 'cleanup', id: 'cleanup' })
    else toast.dismiss('cleanup')
  }, [error])
  const ids = plan?.ids ?? []
  const blocked = disabled || busy
  const all = ids.length === CLEANUP_MODULE_IDS.length
  return <>
    <MenubarMenu>
      <MenubarTrigger asChild><Button ref={trigger}>Limpieza</Button></MenubarTrigger>
      <MenubarContent align="start" onCloseAutoFocus={event => { if (request) event.preventDefault() }}>
        <MenubarGroup>
          <MenubarItem disabled={disabled || !active} onSelect={() => onRequest(active)}>Limpiar módulo activo</MenubarItem>
          <MenubarItem disabled={disabled} onSelect={() => onRequest(null)}>Limpiar todos</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
    <AlertDialog open={Boolean(request)} onOpenChange={open => { if (!open && !busy) onCancel() }}>
      <AlertDialogContent className={styles.dialog} aria-busy={busy} onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <AlertDialogTitle>Limpieza</AlertDialogTitle>
        <AlertDialogDescription className={styles.description}>Selecciona los módulos y revisa sus efectos antes de confirmar. Puedes incluir módulos cerrados. Las ventanas permanecerán abiertas.</AlertDialogDescription>
        <div className={styles.body}>
          <fieldset className={styles.selection} disabled={blocked}>
            <legend>Módulos</legend>
            <label className={styles.option}><Checkbox checked={all ? true : ids.length ? 'indeterminate' : false} disabled={blocked}
              onCheckedChange={checked => { if (!blocked) onSelection(checked ? [...CLEANUP_MODULE_IDS] : []) }} />Todos</label>
            <div className={styles.modules}>
              {CLEANUP_MODULE_IDS.map(id => <label key={id} className={styles.option}><Checkbox checked={ids.includes(id)} disabled={blocked}
                onCheckedChange={checked => { if (!blocked) onSelection(CLEANUP_MODULE_IDS.filter(module => module === id ? checked : ids.includes(module))) }} />{MODULE_REGISTRY[id].name}</label>)}
            </div>
          </fieldset>
          <section className={styles.preview} aria-label="Vista previa">
            <h3>Vista previa</h3>
            {!ids.length ? <p>Selecciona al menos un módulo.</p> : <>
              <ul className={styles.effects}>
                {plan?.modules.map(module => <li key={module.id}>
                  <h4>{MODULE_REGISTRY[module.id].name}</h4>
                  <p>{module.summary}</p>
                  {module.preserves.length > 0 && <p className={styles.preserved}>Se conserva: {module.preserves.join(' ')}</p>}
                </li>)}
              </ul>
              {Boolean(plan?.shared.length) && <div className={styles.shared}>
                <h4>Efectos en otros módulos</h4>
                <ul>{plan?.shared.map(effect => <li key={effect}>{effect}</li>)}</ul>
              </div>}
            </>}
          </section>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button disabled={busy}>Cancelar</Button></AlertDialogCancel>
          <Button disabled={blocked || !ids.length} onClick={onConfirm}>{busy ? 'Limpiando…' : 'Limpiar selección'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
