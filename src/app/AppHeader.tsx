import type { ComponentProps, RefObject } from 'react'
import { LocateFixed, Magnet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem } from '@/components/ui/menubar'

import { DocumentNotices, FileMenu } from '@/features/document/FileMenu'
import { ViewMenu } from '@/features/view/ViewMenu'
import { CleanupMenu } from '@/features/view/CleanupMenu'
import { ZoomControl } from '@/layout/ZoomControl'
import { RadarButton } from '@/features/coordinates/RadarButton'
import { MODULE_ICONS, MODULE_REGISTRY } from '@/layout/moduleRegistry'
import type { ModuleId } from '@/layout/layoutTypes'
import styles from './appHeader.module.css'
import controlStyles from '@/layout/controlButton.module.css'

interface AppHeaderProps {
  scale: number
  documentGeneration: number
  fileMenu: ComponentProps<typeof FileMenu>
  reportNotices: ComponentProps<typeof DocumentNotices>['reports']
  mapNotices: ComponentProps<typeof DocumentNotices>['maps']
  boardNotice: ComponentProps<typeof DocumentNotices>['board']
  clockNotice: ComponentProps<typeof DocumentNotices>['clock']
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
  radar: ComponentProps<typeof RadarButton>
  onOrigin: () => void
  onZoom: (scale: number) => void
}

export function AppHeader({ scale, documentGeneration, fileMenu, reportNotices, mapNotices, boardNotice, clockNotice, modulesMenu, viewMenu, cleanupMenu, moduleShortcuts, magnet, radar, onOrigin, onZoom }: AppHeaderProps) {
  const { trigger: modulesTrigger, modules: openModules, disabled: modulesDisabled, onToggle: onModuleToggle } = modulesMenu
  return <header data-slot="app-header" className={styles.base} style={{ zoom: scale }}>
    <h1 className={styles.heading}><img className={styles.logo} src="/assets/elements/icon_chincheta.png" alt="Angie Dashboard" /></h1>
    <Menubar aria-label="Menú principal">
      <FileMenu {...fileMenu} />
      <MenubarMenu>
        <MenubarTrigger asChild><Button ref={modulesTrigger}>Módulos</Button></MenubarTrigger>
        <MenubarContent align="start">
          <MenubarGroup>
            {(Object.keys(MODULE_REGISTRY) as ModuleId[]).map(id => {
              const Icon = MODULE_ICONS[id], isOpen = openModules.some(module => module.id === id)
              return <MenubarItem key={id} aria-label={MODULE_REGISTRY[id].name} aria-describedby={'module-state-' + id} disabled={modulesDisabled} onSelect={() => onModuleToggle(id)}>
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
        return <Button key={id} className={controlStyles.base} aria-label={'Seleccionar módulo ' + name} aria-pressed={moduleShortcuts.active === id}
            disabled={moduleShortcuts.disabled} onClick={() => moduleShortcuts.onSelect(id)}><Icon aria-hidden="true" /></Button>

      })}
    </nav>
    <div className={styles.actions}>
      <DocumentNotices key={'notices-' + documentGeneration} store={fileMenu.store} reports={reportNotices} maps={mapNotices} board={boardNotice} clock={clockNotice} />
      <Button className={controlStyles.base} aria-label="Imán de módulos" aria-pressed={magnet.active} onClick={magnet.onToggle}><Magnet aria-hidden="true" /></Button>
      <RadarButton {...radar} activationColor="yellow" />
      <Button className={controlStyles.base} aria-label="Volver al origen" onClick={onOrigin}><LocateFixed size={19} aria-hidden="true" /></Button>
      <ZoomControl key={documentGeneration} label="Zoom actual" scale={scale} onChange={onZoom} />
    </div>
  </header>
}
