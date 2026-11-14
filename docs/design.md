# Integración del diseño en el frontend

Este documento describe cómo aplicar el diseño de Angie Dashboard en sus componentes y estilos. [development.md](development.md) define el diseño objetivo, incluidas las reglas comunes y las excepciones por módulo. [architecture.md](architecture.md) identifica los propietarios y recorridos funcionales; [AGENTS.md](../AGENTS.md), las reglas de trabajo y comprobaciones.

La implementación actual no acredita por sí sola el cumplimiento del diseño objetivo. Las propuestas y decisiones pendientes de la guía visual siguen abiertas.

## Referencias visuales

Cada regla visual se mantiene en una única sección de la guía. Este documento enlaza esas reglas sin repetir sus medidas o acabados.

| Necesidad                                              | Referencia                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Fuentes, espacios, paleta y significado de los colores | [Tipografía y espacios](development.md#tipografía-y-espacios), [colores y superficies](development.md#colores-y-superficies) y [estados operativos](development.md#estados-operativos) |
| Campos, botones, indicadores y foco                   | [Campos y controles](development.md#campos-y-controles), [contenido e indicadores](development.md#contenido-e-indicadores) y [colores y superficies](development.md#colores-y-superficies) |
| Marco, título, herramientas y barra inferior           | [Estructura de las ventanas](development.md#estructura-de-las-ventanas)                   |
| Tamaños básicos, capacidades, mínimos y autoajuste     | [Tamaños y comportamiento por módulo](development.md#tamaños-y-comportamiento-por-módulo) |
| Archivo, Configuración, avisos y superficies flotantes | [Menús, diálogos y otras superficies](development.md#menús-diálogos-y-otras-superficies)  |
| Composición y excepciones de cada módulo               | [Composición por módulo](development.md#composición-por-módulo)                           |

## Componentes y propietarios

- Reutiliza `src/components/ui/` y sus variantes. La base pertenece al componente compartido; la distribución y las especializaciones exclusivas pertenecen a su consumidor.
- Los nombres públicos de React son PascalCase. Los componentes compartidos tienen carpeta y archivos en kebab-case, CSS Module e índices con exportaciones explícitas.
- Conserva los atributos `data-slot`, clases funcionales y estados accesibles utilizados por consumidores, mediciones, gestos y portales.
- Una especialización añade clases o utiliza variantes sin reemplazar la base completa. El orden de `className` no determina la prioridad CSS.
- `Button` centraliza sus variantes, acabado integrado y etiquetas de texto; su contrato con los consumidores se describe en [Integración de etiquetas](#integración-de-etiquetas-de-button).
- `InputGroup` aporta el marco compartido de campo y acciones, sin duplicar el padding del campo. `Select` adapta el disparador a `DropdownMenu`, que comparte presentación con `Menubar` y `ContextMenu`.
- Los campos editables, indicadores y avisos reutilizan sus componentes compartidos. Los estados que requieren resolución y sus acciones pertenecen al módulo o panel que los produce; cerrar un aviso temporal no resuelve una incidencia.

## Integración de etiquetas de Button

- [button.tsx](../src/components/ui/button/button.tsx) agrupa automáticamente los hijos directos contiguos de texto o número en un `span data-slot="button-label"` con la clase compartida de etiqueta. El consumidor puede escribir `<Button>Guardar</Button>` o combinar un icono con texto directo sin añadir ese envoltorio.
- Los elementos React ya estructurados se conservan como hijos: el componente no recorre su interior para envolverlo o aplicar la clase de etiqueta. Añadir manualmente un `data-slot="button-label"` no aplica por sí solo esa clase CSS. El consumidor conserva la composición y los estilos de sus hijos explícitos.
- Si no recibe `variant`, el componente detecta texto para elegir la variante; la detección de texto dentro de elementos no implica que reescriba su estructura. El consumidor sigue siendo responsable del nombre accesible, de los estados y de las acciones.
- [button.module.css](../src/components/ui/button/button.module.css) define el acabado, el alto del botón y el de la etiqueta como propiedades distintas. La altura de etiqueta utiliza `--button-label-height` con reserva en `--text-container-height`; la medida visual base está en [Etiquetas y multilínea](development.md#etiquetas-y-multilínea).
- Las composiciones que necesiten crecimiento o multilínea ajustan sus propiedades localmente sin redefinir los tokens globales. Como evidencia de implementación, `BoardPin.module.css` combina altura automática y salto de línea en su paleta; `calculator.module.css` usa altura automática para las etiquetas del teclado. Estos usos no establecen una nueva regla visual para los demás consumidores.

## Tokens y cascada

- `src/styles/tokens.css` contiene las variables primitivas y semánticas. Una excepción local no redefine un token global ni duplica la base completa de un control.
- `src/styles/layers.css` fija `reset, vendor, base, components, overrides, utilities` y se carga antes de los componentes desde `src/main.tsx`.
- Las hojas externas se importan desde `src/styles/integrations/` dentro de `vendor`. Sus adaptaciones se acotan a las superficies de Angie.
- El reseteo y las reglas generales pertenecen a `global.css`; las declaraciones de fuentes, a `fonts.css`; las utilidades transversales, a `utilities.css`; la impresión de la app, a `print.css`.
- Las fuentes y sus licencias permanecen locales en `public/assets/fonts/`. El HTML autónomo de Informes tiene su propio recorrido de fuentes incrustadas y estilos, descrito en [Arquitectura](architecture.md#cartografía-informes-y-funcionamiento-sin-conexión).
- Los espacios compartidos se expresan mediante `--space-1`, `--space-2`, `--control-gap` y `--section-gap`, según su función. Una coincidencia numérica entre funciones distintas no exige un token común.
- Los estilos inline se reservan para valores dinámicos: posiciones, dimensiones, colores elegidos y zoom. Las reglas funcionales sin capa y los `!important` de medición o movimiento no se sustituyen por cambios visuales.
- Las medidas efectivas derivan de la base y del zoom una sola vez. Consulta las variables derivadas del propietario antes de multiplicar una medida; no añadas una segunda escala para compensar una composición local.
- Las alturas de etiqueta de los controles y las reservas para iconos se resuelven en su base compartida. Las excepciones de contenido se acotan al consumidor y se describen en la guía visual.

## Medición y superficies flotantes

- `ModuleFrame`, `ZoomControl`, los tiradores y los módulos conservan sus responsabilidades de medición, navegación y zoom. Los recorridos y sus propietarios se consultan en [Conexión de los módulos](architecture.md#conexión-de-los-módulos); las reglas visuales de tamaño se consultan en la guía.
- `layout/moduleToolbar.module.css` contiene la base de las barras de herramientas compartidas. Mapa consume los tokens comunes en su composición propia, sin duplicar esa base.
- `AlertDialog` centraliza las partes de los diálogos. `FileDialog` reutiliza `ModuleFrame` y el espacio visible del escritorio; una adaptación visual conserva sus mecanismos de movimiento, bloqueo y cierre. Los diálogos de Archivo conservan su tamaño expandido en memoria durante su apertura.
- Los menús, popovers, `Select`, `ContextMenu` y `Sheet` respetan el contenedor de portales de `OverlayPortalContext`. El estilo no depende de que el portal sea descendiente de `app-shell`; conserva límites de viewport, desplazamiento y devolución del foco.
- `Sheet` permite paneles modales o no modales según el consumidor. Informes utiliza su variante no modal; su selección y su vista previa conservan el recorrido descrito en Arquitectura.
- `ResizablePanelGroup`, `ResizablePanel` y `ResizableHandle` adaptan `react-resizable-panels`. En esa API, utiliza porcentajes explícitos como `defaultSize="50%"` cuando corresponda; los números representan píxeles. El separador de Informes pertenece a `ReportSelectionResize`, que reutiliza la presentación compartida.
- La implementación observada de Calendario combina Grid para alinear sus áreas y Flex en sus contenedores interiores (`src/features/calendar/calendar.module.css`). La [composición aprobada de Calendario](development.md#calendario) define el resultado visual; estas técnicas conservan su función de implementación, sin convertirse en una exigencia universal.

### Contraste con la composición aprobada

La [composición por módulo](development.md#composición-por-módulo) es la especificación objetivo. La lectura de los estilos actuales identifica estos puntos para una implementación posterior:

- **Operativo:** [OperationsModule.module.css](../src/features/operations/OperationsModule.module.css) distribuye `.operations-cards` con columnas automáticas en Grid. Pendiente adaptar o verificar ese recorrido frente al objetivo de distribución vertical flexible, también al ampliar la ventana.
- **Calendario:** [calendar.module.css](../src/features/calendar/calendar.module.css) sitúa herramientas, navegación, fechas y agenda; permite la agenda lateral y su retorno debajo cuando desborda el ancho. La agenda mantiene tamaño intrínseco y su lista no define desplazamiento propio. Pendiente comprobar y, si resulta necesario, ajustar el acceso a eventos cuando falta altura, además del comportamiento de fechas y controles al reducir la ventana.

El resto de las composiciones requiere validación en navegador con contenidos representativos y distintos tamaños y zoom. Estas observaciones no equivalen a una comprobación funcional ni cambian los tamaños exteriores, controles, navegación o autoajuste. La implementación posterior debe conservar los recorridos descritos en [Arquitectura](architecture.md#conexión-de-los-módulos).

## Estado de la documentación

- Mantén las especificaciones visuales en la sección propietaria de `development.md`. Este documento conserva los enlaces y las pautas de integración; los recorridos funcionales permanecen en `architecture.md`.
- Ante una diferencia entre la guía y el código, distingue el diseño objetivo de la implementación observada. No cambies una decisión visual para dar por cumplida una implementación distinta.
- Una propuesta local o un ejemplo no constituye una decisión aceptada. Si falta una decisión visual, identifícala como pendiente en su sección, sin inventar medidas ni generalizar una excepción.
- La lectura de estos documentos o del CSS no acredita funcionamiento en navegador o dispositivo. Las comprobaciones y la entrega siguen la política de `AGENTS.md`.
