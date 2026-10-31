# Estándar visual de Angie Dashboard

Esta referencia conserva las decisiones visuales compartidas. Los valores de tamaños, zoom, autoajuste y gestos se consultan en su código propietario, localizado desde [ARQUITECTURA.md](ARQUITECTURA.md). [AGENTS.md](AGENTS.md) contiene las reglas de trabajo. Mapa, Plano e Informes conservan su tratamiento específico y quedan pendientes de su propia revisión; esta referencia no acredita comprobaciones de funcionamiento.

## Composición y lenguaje visual

- Conserva la personalidad industrial, el acabado oscuro y la composición compacta. El rojo de selección mantiene su significado; no se extiende por rutina a controles y superficies.
- Reutiliza `src/components/ui/` y sus variantes. La base pertenece al componente; la distribución y las especializaciones exclusivas pertenecen a su consumidor.
- Los nombres públicos de React son PascalCase. Los componentes compartidos tienen carpeta y archivos en kebab-case, CSS Module e índices con exportaciones explícitas.
- Conserva los atributos `data-slot`, clases funcionales y estados accesibles utilizados por consumidores, mediciones, gestos y portales.
- Los controles de una línea mantienen su altura necesaria al ampliar una ventana. Los contenedores flexibles reciben el espacio adicional.
- Las barras de herramientas de Calculadora, Pizarra, Cuaderno, Elementos y Dotaciones comparten `layout/moduleToolbar.module.css`: fondo `--surface-toolbar`, borde inferior, márgenes, botones cuadrados y selección. Cada módulo organiza sus acciones; Calculadora mantiene el radar a la derecha y Elementos/Dotaciones conservan la fila adicional de selección múltiple cuando corresponde.

## Tokens y cascada

- `src/styles/tokens.css` contiene las variables primitivas y semánticas. Una excepción local no redefine un token global ni duplica la base completa de un control.
- `layers.css` fija `reset, vendor, base, components, overrides, utilities` y se carga antes de los componentes desde `main.tsx`.
- Las hojas externas se importan desde `styles/integrations/` dentro de `vendor`. Sus adaptaciones se acotan a las superficies de Angie.
- El reseteo y las reglas generales pertenecen a `global.css`; fuentes a `fonts.css`; utilidades transversales a `utilities.css`; impresión de la app a `print.css`.
- Cada propietario mantiene su CSS Module. Añadir una clase conserva la base; el orden de `className` no determina la prioridad CSS.
- Los estilos inline se reservan para valores dinámicos: posiciones, dimensiones, colores elegidos y zoom. Las reglas funcionales sin capa y los `!important` de medición o movimiento no se sustituyen por cambios visuales.
- Las medidas efectivas derivan de la base y del zoom una sola vez. No añadas una segunda escala para compensar una composición local.

## Tipografía y medidas comunes

- Roboto Condensed es la fuente común. Reloj y temporizadores usan Rajdhani en su contenido; cabeceras y avisos conservan la fuente compartida.
- Las fuentes y sus licencias permanecen locales en `public/assets/fonts/`. Los informes incorporan Roboto Condensed en su HTML autónomo.
- Las cifras técnicas conservan su presentación tabular donde corresponde.
- Las medidas comunes de controles de una línea, herramientas e iconos se definen en los tokens del propietario y reciben el zoom una sola vez.

## Componentes compartidos

- `Button` centraliza base, estados y variantes de texto e icono. `appearance="integrated"` conserva el control con acabado transparente, sin introducir otra implementación.
- `Input`, `Textarea` e `InputGroup` centralizan los campos y sus estados. El consumidor organiza su distribución y conserva la composición y validación existentes.
- `Checkbox` usa la composición Radix adaptada a los tokens de Angie, sin selección parcial. Las clases del consumidor organizan su posición.
- `Select` adapta el campo al `DropdownMenu` compartido. `Menubar`, `DropdownMenu`, `RadioGroup`, `Slider` y `Separator` conservan sus primitivas, estados y exportaciones compartidas.
- `Badge` centraliza su acabado y tipografía. Los consumidores conservan sus excepciones de composición actuales; los indicadores de estado no se convierten en nuevas bases de distintivos.
- Sonner centraliza los avisos temporales en `components/ui/sonner/`. Los estados que requieren resolución y sus acciones permanecen accesibles en su propietario; cerrar un toast no resuelve una incidencia.
- `Calendar` adapta React DayPicker a los botones, colores y tipografía compartidos y admite selección individual o por rango. Recuperación lo utiliza para filtrar fechas; el nombre abreviado de cada guardado conserva su nombre completo en la ayuda emergente solicitada para esa fila.
- `ContextMenu` reutiliza la base visual de `DropdownMenu`, compartida también con `Menubar`. Ofrece submenús, opciones marcables, selección única y atajos; cada consumidor define sus acciones.
- `Sheet` adapta Dialog de Radix a un panel desde cualquiera de los cuatro lados, con cabecera, cuerpo desplazable, pie y cierre. Conserva el foco modal y el contenedor de portales de su contexto.
- `ResizablePanelGroup`, `ResizablePanel` y `ResizableHandle` adaptan react-resizable-panels para divisiones horizontales o verticales, con límites y controles de teclado de la librería. En su API, utiliza tamaños porcentuales explícitos como `defaultSize="50%"` cuando corresponda; los números representan píxeles.
- Configuración se abre desde Archivo y agrupa Ubicación y Almacenamiento y permisos. Los cambios de ubicación se confirman con Guardar; Cancelar conserva el valor previo. La búsqueda usa el mismo servicio de Mapa y se lanza mediante Buscar. Los portales de DropdownMenu respetan el contenedor del diálogo, también al utilizar Select.
- `RadarButton` comparte estado y presentación entre Cabecera, Coordenadas y Calculadora. Solo su instancia en la cabecera general utiliza amarillo al activarse; queda a la derecha del imán, con los avisos a la izquierda. Los horarios solares conservan los crepúsculos del mismo ciclo y marcan «+1» si terminan al día siguiente.

## Superficies flotantes y ventanas

- Menús y popovers funcionales conservan sus bases compartidas, límites de viewport, desplazamiento y devolución del foco. Su estilo no depende de que el portal sea descendiente de `app-shell`.
- Los controles conservan nombres accesibles sin ayudas emergentes ni títulos nativos explicativos. Sonner comunica los fallos al ejecutar acciones; los formularios y paneles con acciones de resolución mantienen su función. La leyenda del mapa permanece disponible.
- `AlertDialog` centraliza las partes del diálogo. `FileDialog` reutiliza `ModuleFrame` y el espacio visible del escritorio, con sus movimientos, bloqueos y cierre existentes.
- `OverlayPortalContext` permite alojar popovers dentro de Archivo sin duplicar su apariencia.
- La barra superior pertenece a `AppHeader` y su CSS Module. `ModuleFrame`, `ZoomControl` y los tiradores conservan sus propietarios y reglas funcionales de medición.
- El tirador respeta los mínimos de contenido expandido. Recoger y restaurar utilizan las acciones de cabecera; los estados recogidos no sustituyen el tamaño expandido guardado.

## Particularidades por área

| Área                   | Composición que debe conservarse                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Coordenadas            | Formulario y filas técnicas flexibles, altura mínima escalada, conversión y copia existentes.               |
| Calculadora            | Cabecera con iconos de aritmética y sol/crepúsculos, radar a la derecha. El ajuste del huso usa `columns-3-cog` justo antes del radar; el reintento, cuando corresponde, también se sitúa en la cabecera. Las filas de datos conservan su altura de texto. El resultado sustituye la operación en el propio input; el teclado ocupa el espacio restante. La vista solar muestra nombre y estado del radar en una línea, coordenadas y «dd/MM/yyyy · UTC…». Usa la fecha seleccionada en Calendario, sin selector propio ni botón Hoy, también con radar activo. El desfase y los horarios corresponden a esa fecha. El radar resuelve la zona del punto; su botón de ajuste permite corregirla o volver a Automática. Mientras se resuelve o si falla, no se presentan horarios con otra zona. |
| Elementos y Dotaciones | Editor y listado compartidos, selección, presentación de nombres y geometría de la previsualización.        |
| Operativo              | Cuadrícula adaptable, abreviaturas y edición de estados personalizados existentes.                          |
| Información            | Tarjetas con una sola expansión activa y detalles cerrados ocultos e inactivos.                             |
| Registro y Cuaderno    | Listados, editores, autocrecimiento, reordenación y zonas de desplazamiento existentes.                     |
| Reloj                  | Hora flexible en la zona configurada, con ciudad/zona y desfase UTC efectivo; Zulu permanece en UTC. Independiente del radar. Temporizadores con altura necesaria, Rajdhani y fondo oscuro compartido con sus campos. |
| Calendario             | Mes o semana con agenda diaria y edición en línea. Al ampliar el ancho, calendario y agenda se colocan lado a lado. El día seleccionado muestra fase lunar e iluminación. Los eventos pertenecen a la agenda transversal. |
| Mapa y Plano           | Herramientas, paneles y superficie Leaflet; las adaptaciones del proveedor pertenecen a su integración CSS. |
| Pizarra                | Herramientas independientes del zoom del lienzo; notas, pines e imagen conservan sus ámbitos y geometría.   |
| Informes               | Interfaz de selección y encuadre separada del HTML autónomo, sus fuentes, páginas y estilos de impresión.   |

## Cambios y evidencia

- Una petición visual puede evolucionar la superficie acordada. Conserva semántica, foco, estados, datos e interacciones dentro del alcance solicitado.
- Si un ejemplo o documento local contradice estas referencias, contrasta el código y las decisiones disponibles antes de copiarlo. Las propuestas locales no constituyen decisiones aceptadas.
- Aplica la política de comprobaciones de `AGENTS.md` y distingue lectura estática, compilación, navegador, emulación y dispositivo físico.
