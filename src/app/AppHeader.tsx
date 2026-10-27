import type { ComponentProps, RefObject } from 'react'
import { LocateFixed, Magnet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem } from '@/components/ui/menubar'
import { HelpTooltip } from '@/components/ui/tooltip'
import { FileMenu } from '@/features/document/FileMenu'
import { ViewMenu } from '@/features/view/ViewMenu'
import { CleanupMenu } from '@/features/view/CleanupMenu'
import { ZoomControl } from '@/layout/ZoomControl'
import { MODULE_ICONS, MODULE_REGISTRY } from '@/layout/moduleRegistry'
import type { ModuleId } from '@/layout/layoutTypes'
import styles from './appHeader.module.css'
import controlStyles from '@/layout/controlButton.module.css'

interface AppHeaderProps {
  scale: number
  documentGeneration: number
  fileMenu: ComponentProps<typeof FileMenu>
  modulesMenu: {
    trigger: RefObject<HTMLButtonElement | null>; modules: readonly { id: ModuleId }[]; disabled: boolean
    onToggle: (id: ModuleId) => void
  }
  viewMenu: ComponentProps<typeof ViewMenu>
  cleanupMenu: ComponentProps<typeof CleanupMenu>
  moduleShortcuts: {
    modules: readonly { id: ModuleId }[]; active: ModuleId | null; disabled: boolean
    onSelect: (id: ModuleId) => void
  }
  magnet: { active: boolean; onToggle: () => void }
  onOrigin: () => void
  onZoom: (scale: number) => void
}

export function AppHeader({ scale, documentGeneration, fileMenu, modulesMenu, viewMenu, cleanupMenu, moduleShortcuts, magnet, onOrigin, onZoom }: AppHeaderProps) {
  return <header data-slot="app-header" className={styles.base} style={{ zoom: scale }}>
    <h1 className={styles.heading}><img className={styles.logo} src="/assets/elements/icon_chincheta.png" alt="Angie Dashboard" /></h1>
    <Menubar aria-label="Menú principal">
      <FileMenu {...fileMenu} />
      <MenubarMenu>
        <MenubarTrigger asChild><Button ref={modulesMenu.trigger}>Módulos</Button></MenubarTrigger>
        <MenubarContent align="start">
          <MenubarGroup>
            {(Object.keys(MODULE_REGISTRY) as ModuleId[]).map(id => {
              const Icon = MODULE_ICONS[id], isOpen = modulesMenu.modules.some(module => module.id === id)
              return <MenubarItem key={id} aria-label={MODULE_REGISTRY[id].name} aria-describedby={'module-state-' + id} disabled={modulesMenu.disabled} onSelect={() => modulesMenu.onToggle(id)}>
                <Icon data-open={isOpen} aria-hidden="true" />
                {MODULE_REGISTRY[id].name}<span id={'module-state-' + id} className="visually-hidden">{isOpen ? 'Abierto' : 'Cerrado'}</span>
              </MenubarItem>
            })}
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
      <ViewMenu {...viewMenu} />
      <CleanupMenu {...cleanupMenu} />
    </Menubar>
    <nav className={styles.openModules} aria-label="Módulos abiertos">
      {moduleShortcuts.modules.map(({ id }) => {
        const Icon = MODULE_ICONS[id], name = MODULE_REGISTRY[id].name
        return <HelpTooltip key={id} text={(moduleShortcuts.active === id ? 'Localizar ' : 'Seleccionar ') + name}>
          <Button className={controlStyles.base} aria-label={'Seleccionar módulo ' + name} aria-pressed={moduleShortcuts.active === id}
            disabled={moduleShortcuts.disabled} onClick={() => moduleShortcuts.onSelect(id)}><Icon aria-hidden="true" /></Button>
        </HelpTooltip>
      })}
    </nav>
    <HelpTooltip text="Imán de módulos"><Button className={`${controlStyles.base} ${styles.magnet}`} aria-label="Imán de módulos" aria-pressed={magnet.active} onClick={magnet.onToggle}><Magnet aria-hidden="true" /></Button></HelpTooltip>
    <HelpTooltip text="Volver al origen"><Button className={controlStyles.base} aria-label="Volver al origen" onClick={onOrigin}><LocateFixed size={19} aria-hidden="true" /></Button></HelpTooltip>
    <ZoomControl variant="header" key={documentGeneration} label="Zoom actual" scale={scale} onChange={onZoom} />
  </header>
}
