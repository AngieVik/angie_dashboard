import { Button } from '@/components/ui/button'
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem, MenubarSeparator } from '@/components/ui/menubar'

export function ViewMenu({ disabled, active, onAutoArrange, onCollapseAll, onFitActive }: {
  disabled: boolean; active: boolean; onAutoArrange: () => void; onCollapseAll: () => void; onFitActive: () => void
}) {
  return <MenubarMenu>
    <MenubarTrigger asChild><Button>Vista</Button></MenubarTrigger>
    <MenubarContent align="start">
      <MenubarGroup>
        <MenubarItem disabled={disabled} onSelect={onAutoArrange}>Ordenar módulos</MenubarItem>
        <MenubarItem disabled={disabled} onSelect={onCollapseAll}>Recoger todos en barras</MenubarItem>
        <MenubarSeparator />
        <MenubarItem disabled={disabled || !active} onSelect={onFitActive}>Ajustar activo al contenido</MenubarItem>
      </MenubarGroup>
    </MenubarContent>
  </MenubarMenu>
}
