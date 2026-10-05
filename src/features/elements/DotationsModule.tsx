import { ElementsModule } from './ElementsModule'
import type { ElementsModuleProps } from './ElementsModule'

export function DotationsModule(props: ElementsModuleProps) {
  return <ElementsModule {...props} isUnit />
}
