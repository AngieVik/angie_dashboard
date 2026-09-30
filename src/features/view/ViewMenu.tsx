import { Button } from '../../components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuCheckboxItem } from '../../components/ui/dropdown-menu'
import { MODULE_REGISTRY } from '../../layout/moduleRegistry'
import type { ModuleId } from '../../layout/layoutTypes'

export function ViewMenu({ visible, onToggle }: { visible: readonly ModuleId[]; onToggle: (id: ModuleId) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button>Ver</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          {(Object.keys(MODULE_REGISTRY) as ModuleId[]).map(id => (
            <DropdownMenuCheckboxItem key={id} checked={visible.includes(id)} onCheckedChange={() => onToggle(id)}>
              {MODULE_REGISTRY[id].name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
