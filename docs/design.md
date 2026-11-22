# Diseño e integración de interfaz

Este documento reúne el diseño objetivo y su integración visual. Las medidas son píxeles lógicos antes del zoom. «Pendiente» indica una decisión abierta; la lectura de CSS describe implementación, y la validación visual corresponde al desarrollador. Consulta [Arquitectura](architecture.md) para contratos y propietarios funcionales.

## Tipografía, espacios y superficies

Usa las variables de `src/styles/tokens.css` según su función. Conserva el peso (300, 500, 700 o 900) y el interlineado del CSS propietario; una nueva regla transversal de interlineado está pendiente.

Button centraliza sus sombras de reposo, interacción y pulsación en `--shadow-button`, `--shadow-button-hover` y `--shadow-button-active`. Leaflet reutiliza los colores semánticos de texto, texto secundario y módulo; el fondo del mapa, las superficies de atribución/escala y las sombras de marcadores tienen tokens propios. El modo normal conserva sus valores originales. En alto contraste, las superficies del mapa son opacas y se desactivan las sombras decorativas de estas dos áreas; la sombra que refuerza la selección del pin se conserva.

| Uso                                          | Especificación                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Texto general / secundario                   | Roboto Condensed, 13px; `#F2F2F2` / `#ADADAD`. Reserva con fuente del sistema.        |
| Títulos                                      | Roboto Condensed, 16px.                                                               |
| Cifras críticas de Reloj y temporizadores    | Rajdhani, con cifras tabulares donde corresponda.                                     |
| Sonner                                       | Tamaño del texto general.                                                             |
| Espacios                                     | 4px entre controles y 6px entre grupos; padding interior aplicado una vez.            |
| Capitalización                               | Sentence case; acrónimos y `ZULU TIME` conservan mayúsculas.                          |
| Escritorio / ventana / campo / opción activa | `#0C0C0C` / `#181818` / `#111111` / `#303030`.                                        |
| Botón / hover                                | Degradado `#333333 → #252525` / `#404040 → #303030`.                                  |
| Borde campo / botón / separador              | `#555555` / `#3D3D3D` / `#3D3D3D`.                                                    |
| Acento rojo / neutro                         | `#D63A3A80` / `#D6D6D280`; asigna el neutro a consumidores con especificación propia. |

El foco visible usa un único contorno interior de 2 px en rojo al 30 % y un halo interior gris azulado. Conserva el fondo del control y cabe dentro de campos agrupados. Los modos de [Accesibilidad](#accesibilidad) ajustan el indicador. Los indicadores operativos usan `--color-status-*`, con significado en [Arquitectura](architecture.md#estados-operativos).

## Controles e indicadores

Base de campos y botones de texto: altura 25px, padding `0 2px`, borde 1px y radio 3px, con ancho según contenido previsto. Campos usan superficie de campo; botones usan el acabado de botón. Textarea parte de esta base y el consumidor resuelve el crecimiento multilínea.

| Elemento                          | Especialización de la base                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| InputGroup                        | Un marco compartido para entrada y acciones; descuenta sus bordes de la altura interior.                                                                                                                             |
| Checkbox                          | 15 × 15px, padding 0, superficie de campo.                                                                                                                                                                           |
| RadioGroup                        | Casilla y marca de Checkbox, con selección única y teclado Radix; distribución de opciones sin marco adicional. El tamaño interior del indicador queda pendiente.                                                    |
| Select                            | Disparador sobre DropdownMenu; `sizeToOptions` estima ancho estable según opción más larga, padding e icono, limitado al disponible.                                                                                 |
| Button de solo icono              | 25 × 25px, padding 0; transparente y sin marco en reposo, acabado de interacción al pasar el puntero. La variante integrada conserva transparencia y cambia el icono.                                                |
| Icono Lucide visible              | 15 × 15px, distinto de la superficie accionable.                                                                                                                                                                     |
| Slider                            | Altura de control común; pista de 4px y tirador de 15 × 15px centrados verticalmente. Ancho, padding y demás acabados quedan pendientes.                                                                             |
| Texto de una línea / dato técnico | Contenedor de 17px; dato técnico con padding `0 2px`.                                                                                                                                                                |
| Título de contenido               | Contenedor de 15px, padding 0.                                                                                                                                                                                       |
| Estado de Información             | Ocupa su columna, con 120 px de referencia para la medición y 25 px de alto. Comparte con Operativo el acabado, la tipografía, el padding de 2 px y el margen vertical de 1 px; reserva total vertical 27px, incluido «Sin estado».                                                     |
| Estado de Operativo               | Las medidas del estado de Información son mínimos de columna y fila; reparte espacio en ambas direcciones y crece con ventana/contenido. Los botones interiores se estiran; el editor visible conserva altura común. |
| Miniatura de pin en listas        | 80 × 40px, padding 0, dibujo completo centrado y proporcional.                                                                                                                                                       |
| Fila de Elementos/Dotaciones      | Altura por contenido, padding 0, borde de selección y radio 2px. Reserva pin/nombre y conserva desplazamiento de lista.                                                                                              |
| Tarjeta de Información            | Altura por contenido, padding 2px, separador inferior y reserva de pin, nombre, estado y márgenes.                                                                                                                   |

### Etiquetas de Button

`button.tsx` envuelve hijos directos contiguos de texto/número en `span[data-slot="button-label"]`. Conserva los hijos React estructurados; el consumidor mantiene su composición y nombre accesible. El atributo manual por sí solo conserva su función identificadora; la clase compartida aporta el estilo. La detección de texto elige variante cuando se omite, sin reescribir hijos estructurados.

`button.module.css` separa altura de botón y etiqueta mediante `--button-label-height`, con reserva en `--text-container-height`. El texto común ocupa una línea. El consumidor que necesite multilínea ajusta localmente salto de texto, altura de etiqueta y espacio del botón. Ejemplos observados: paleta de Pizarra y teclado de Calculadora; mantienen su alcance local.

## Ventanas

Los tiradores de módulos y diálogos son botones accesibles por Tab. Con el foco en el tirador, izquierda/derecha reducen/amplían el ancho y arriba/abajo reducen/amplían el alto, en pasos de 10px lógicos; Mayús aumenta el paso a 50px. El nombre identifica la acción, las instrucciones están disponibles como descripción accesible y tooltip, y un estado accesible anuncia el tamaño resultante. Las ventanas recogidas no muestran el tirador. Los límites y la confirmación se describen en [Ventanas y navegación](architecture.md#ventanas-y-navegación).

| Zona                  | Medidas y acabado                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Marco (`ModuleFrame`) | Borde 1px `#484848`, radio 3px, padding 0.                                                                                            |
| Título                | 27px alto, padding `0 2px`, degradado `#383838 → #2C2C2C → #222222`, separador 1px `#080808`.                                         |
| Herramientas          | 32px alto, padding `3px 5px`, degradado `#2E2E2E → #1D1D1D`, separador 1px hacia contenido.                                           |
| Barra inferior        | 25px alto y fondo de ventana. Padding `0 54px 0 2px` con Autoajuste o `0 27px 0 2px` sin él; reserva derecha para acciones y tirador. |

| Módulos                                   | Apertura        | Autoajuste de altura                             | Herramientas      |
| ----------------------------------------- | --------------- | ------------------------------------------------ | ----------------- |
| Pizarra, Mapa, Plano operativo, Informes  | 510 × 420       | Según capacidad actual: sin autoajuste continuo. | Sí                |
| Calculadora                               | 240 × contenido | Sin autoajuste continuo.                         | Sí                |
| Elementos, Dotaciones, Registro, Cuaderno | 240 × contenido | Hasta 500px.                                     | Sí                |
| Información, Reloj                        | 240 × contenido | Hasta 500px.                                     | Sin barra propia. |
| Coordenadas, Calendario                   | 240 × contenido | Sin autoajuste continuo.                         | Sin barra propia. |
| Operativo                                 | 150 × contenido | Sin autoajuste continuo.                         | Sin barra propia. |

Crear, reabrir o expandir desde barra/icono recupera el tamaño de apertura. La altura por contenido incluye estructura, herramientas y datos presentes; vacío conserva estructura/herramientas. Es independiente del autoajuste continuo. Colapsar conserva ancho de apertura y altura de título; contraer usa 27 × 27px.

El ajuste manual puede superar el ancho base y el máximo automático. Desactiva Autoajuste hasta reactivarlo. [Reloj](#reloj) adapta la altura a los cambios en el número de temporizadores también en modo manual. Al reducir, conserva acceso a herramientas y desplazamiento del contenido; Operativo puede bajar de su ancho de apertura hasta el mínimo medido. Al ampliar, listas, textos y superficies reciben espacio y los controles de una línea conservan su altura. El algoritmo de colocación y los mínimos técnicos están en [Arquitectura](architecture.md#ventanas-y-navegación).

Recoger todos usa columnas contiguas, omitiendo módulos cerrados y columnas vacías, desde el origen y con el zoom actual. Una columna que no cabe a la derecha continúa debajo de la fila previa:

| Columna    | Orden superior a inferior                              |
| ---------- | ------------------------------------------------------ |
| Ancha      | Pizarra, Mapa, Plano operativo, Informes.              |
| Listas     | Elementos, Dotaciones, Información, Registro.          |
| Utilidades | Reloj, Calculadora, Calendario, Cuaderno, Coordenadas. |
| Operativo  | Operativo.                                             |

Cada columna toma el ancho de apertura de sus módulos. Mantén las ventanas contiguas, con cuadrícula sin márgenes ni padding.

## Composición por módulo

Usa la técnica CSS adecuada al contenido. Asigna el desplazamiento a la zona que desborda y conserva controles, selección y acciones accesibles.

| Módulo               | Composición                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elementos/Dotaciones | Herramientas arriba y lista debajo; filas sin contracción que superponga pines. Nombre multilínea arriba a la derecha del pin, con tipografía de título.                                                  |
| Información          | Tarjetas apiladas con reparto flexible. Pin, nombre arriba y estado debajo con inicio/ancho común; acciones en columna independiente. Las coordenadas del plano aparecen al expandir la tarjeta.                                                                     |
| Operativo            | Filas y columnas flexibles; una columna cuando solo cabe una. Conserva acceso a estados y edición.                                                                                                        |
| Cuaderno             | Herramientas arriba; notas/checklists apilados en su orden, cada nuevo bloque bajo el último. Crecen con contenido; el espacio sobrante queda al final. Lista flexible con scroll y bloques `flex: none`. |
| Registro             | Al cambiar el alto, el registro conserva la distancia al final de la lista. Las entradas nuevas siguen visibles si se estaba leyendo la última.                                                                                                                                 |
| Calculadora          | Operación/resultado arriba, teclado que aprovecha su zona e historial desplegable consultable.                                                                                                            |
| Coordenadas          | Conversión automática y validación con Intro. Copiar muestra el valor en Sonner. Maps, OsmAnd y Plus Code ofrecen la acción Abrir.                                                                                                                |
| Pizarra/Mapa/Plano   | Herramientas propias y superficie de trabajo ocupando el resto.                                                                                                                                           |
| Informes             | La barra reúne A4, orientación y ancho de vista previa. El panel de selección y la vista previa tienen desplazamiento propio.                                                                                                                                 |

`PinThumbnail.tsx` y `pinSummary.module.css` comparten miniatura y cuadrícula pin/contenido/acciones para las listas. Usa `--pin-thumbnail-*-base`, `minmax(0, 1fr)` y `object-fit: contain`, liberando mínimos intrínsecos de imagen. Las reglas de lista conservan transformaciones de pines en superficies de trabajo. `operationalStatus.module.css` comparte el aspecto de los estados de Información y Operativo. Operativo consume ancho como mínimo con máximo `1fr`; la medición mínima libera contención y usa una columna.

### Reloj

Al añadir o eliminar temporizadores, Reloj adapta la altura de la ventana. En modo manual suma o resta la altura de las filas y conserva el ancho elegido. La hora principal se adapta al espacio, con padding `0 2px`. Referencia `ZULU TIME`, o `ZT` si falta ancho, y cifras se alinean por línea base con tamaño técnico; hora Zulu conserva padding 0. AM/PM se presenta separado y proporcional.

T-Zero, T-Minus y Advisory comparten campo de duración de 25px de alto, padding 2px, borde/radio de campo, Rajdhani de 13px y ancho real de seis dígitos tabulares y dos puntos. Conserva dimensiones en edición, marcha, pausa y finalización, con acciones junto al valor. `TimerRow.module.css` mide `00:00:00` en un pseudoelemento invisible con fuente y zoom efectivos; `DurationInput`, output y reconocimiento ocupan ese mismo campo.

### Calendario

La primera fila reúne la fecha y el interruptor de eventos. Las flechas, Hoy, Semana y Mes forman un solo grupo en la segunda fila. Semana o Mes queda marcado según la vista activa. La selección usa el acabado común de Button que también utilizan Pizarra, PNG/TXT y los volteos. Hoy selecciona la fecha actual en esa misma vista. El texto de fecha sigue los formatos de [Configuración](architecture.md#formatos-y-accesibilidad); en la presentación larga usa día, mes con inicial mayúscula y año («15 de Noviembre de 2026»).

`CalendarModule` superpone el texto a un Input de fecha nativo, reserva icono y añade 2px de padding a cada lado respecto al campo base, escalados con zoom. Un clic en el campo, Intro o Espacio abre el selector mediante `showPicker()` cuando existe, respetando bloqueo.

Al mostrar u ocultar eventos, la ventana suma o recupera el espacio del panel en su eje, tomando como referencia las dimensiones de la cuadrícula de días. Agenda debajo en estrecho y a la derecha cuando ambas áreas caben según su contenido; vuelve debajo al desbordar. Mantén acceso a navegación, fechas y eventos mediante scroll. Grid alinea áreas y Flex distribuye interiores en el CSS actual; el umbral lateral sigue el contenido.

### Mapa y Plano

El pin de selección Leaflet usa `L.divIcon` de 18 × 26px con punta en `[9, 26]`. Los marcadores guardados conservan bandera y geometría propia. La selección de rutas GPX ajusta a 14px.

## Configuración y superficies flotantes

La barra principal conserva separador inferior y sombra exterior, con extremo superior limpio de borde y brillo interior.

Configuración reutiliza `FileDialogContent` y `Dialog` no modal (`modal={false}`, `dismissOnOutside={false}`): permite usar el escritorio, conserva movimiento/tamaño/recogida y cierra explícitamente o con Escape. La superficie exterior deja pasar punteros; marco y portales conservan interacción. Otros diálogos mantienen sus opciones por defecto.

`SettingsDialog` abre en General con Sheet izquierdo permanente y contenido a la derecha; cada zona tiene scroll independiente. El footer Guardar queda fuera del scroll. La sección activa usa `aria-current`/`aria-controls`; etiquetas completas pueden partirse al reducir ancho. Los paneles sin opciones conservan cuerpo vacío.

Orden lateral: General, Avisos, Pizarra, Mapa, Plano operativo, Informes, Calculadora, Elementos, Dotaciones, Registro, Cuaderno, Información, Reloj, Coordenadas, Calendario, Operativo, Zoom, Vistas, Iman, Accesibilidad, Ubicación, Almacenamiento y permisos.

| Panel o acción            | Presentación                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| General                   | Formatos y Limpieza más Restablecer los valores predeterminados. Limpieza mantiene el grupo vacío; la selección se realiza en su confirmación.                                                                                                                                                                           |
| Formatos / Accesibilidad  | Tres Select en columna, con ancho estable según opciones. Los valores pertenecen a [Arquitectura](architecture.md#formatos-y-accesibilidad).                                                                                                                                                                             |
| Zoom                      | Zoom inicial únicamente aquí y paso porcentual; inputs compactos para tres dígitos, flechas nativas y padding, independientes del ancho de etiqueta.                                                                                                                                                                     |
| Vistas                    | Grupo Vista inicial con casilla por módulo en orden lateral y Select de disposición con ancho por opción más larga. Grupo Disposiciones guardadas con Nombre/Vista guardada de igual ancho fijo estimado de 24ch, limitado al disponible; Guardar alineado con Nombre, Cargar/Eliminar con Vista guardada.               |
| Iman                      | Casilla de activación inicial, distancia compacta de tres dígitos y casilla de alineación, en columna.                                                                                                                                                                                                                   |
| Avisos                    | Visibilidad con selección única y aspecto de casilla; Registro separado igual que el padding izquierdo/inferior del grupo. Duración numérica, niveles con casillas y salto de línea; mensajes como casilla más texto completo de lectura multilínea. Los grupos parciales usan marca horizontal mediante `CheckboxMark`. |
| Registro de avisos        | Fecha, hora y texto, recientes arriba. `NoticeHistoryDialog` usa AlertDialog sobre Configuración, con retorno del foco al botón Registro y apilado local con `overlayClassName`.                                                                                                                                         |
| Menú de avisos vacío      | «No hay avisos pendientes».                                                                                                                                                                                                                                                                                              |
| Ubicación                 | Lupa dentro de Localidad (32ch estimados); Coordenadas 30ch; Zona horaria por opción más larga. Campos limitados al ancho disponible, nombre único en Localidad y acciones comunes en footer.                                                                                                                            |
| Almacenamiento y permisos | «Solicitar permiso», «Solicitando…» durante petición; rechazo «No concedido» conserva botón y orientación en Sonner. «Actualizar» muestra «Estimación de espacio actualizada.» o error. Usa el cierre exterior común.                                                                                                    |

Guardar se desactiva sin cambios efectivos o con campos numéricos incompletos; vuelve a desactivarse tras éxito o recuperar valores originales. El guardado ordinario conserva la ventana y muestra Sonner. Al cerrar con cambios: «Actualmente hay cambios sin guardar.» con Guardar/Cerrar; `SettingsExitActions` dispone acciones con salto de línea. El contrato del borrador y las acciones inmediatas están en [Arquitectura](architecture.md#configuración).

La confirmación de Limpieza usa AlertDialog y Checkbox, casilla Todos con estado parcial y selección inicial según acción. Su ancho de apertura llega a 760 px para seleccionar módulos y revisar el resumen, las conservaciones y los efectos compartidos. En pantallas estrechas deja 32 px de margen horizontal total y las casillas pasan de dos columnas a una. Cabecera/footer quedan fuera del scroll. «Limpiar selección» se desactiva sin selección y bloquea casillas/cierre durante ejecución; Cancelar queda accesible antes. Los nombres proceden del registro de módulos.

## Accesibilidad

`tokens.css` deriva tipografía y alturas desde `--accessibility-text-scale`; `accessibility.css` aplica contraste/foco y movimiento. La escala se añade al zoom existente y alcanza portales. Campos, controles, herramientas y cabecera principal ganan altura según el texto; las cabeceras de módulos mantienen geometría compacta. Sonner usa la altura adaptable de cabecera para su posición.

Alto contraste: superficies planas oscuras, texto secundario claro, bordes reforzados y foco amarillo visible. Los controles prescinden del halo en este modo. Con colores forzados usan el contorno del sistema. Movimiento reducido: minimiza transiciones/animaciones y usa desplazamiento inmediato; el comportamiento del mapa se describe en [Arquitectura](architecture.md#formatos-y-accesibilidad).

## Integración compartida

| Propietario                                             | Uso                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/layers.css`                                 | Orden `reset, vendor, base, components, overrides, utilities`; se importa primero en `main.tsx`.                                                                                                                                       |
| `global.css`, `fonts.css`, `utilities.css`, `print.css` | Reset/base, fuentes, utilidades y estilos de impresión respectivamente. Fuentes/licencias locales en `public/assets/fonts/`; informes autónomos en [Arquitectura](architecture.md#cartografía-informes-y-funcionamiento-sin-conexión). |
| `src/styles/integrations/`                              | CSS externo en `vendor`, con adaptaciones acotadas.                                                                                                                                                                                    |
| `tokens.css`                                            | Primitivos y semánticos; usa `--space-1`, `--space-2`, `--control-gap`, `--section-gap` según función y medidas derivadas con una aplicación del zoom.                                                                                 |
| `src/components/ui/`                                    | Base de componentes compartidos, nombres React PascalCase y carpetas/archivos kebab-case, CSS Module e índices explícitos. Consumidores especializan por variante/clase local.                                                         |
| `layout/moduleToolbar.module.css`                       | Base de herramientas; Mapa integra tokens en su composición propia.                                                                                                                                                                    |
| `OverlayPortalContext`                                  | Contenedor de menús, popovers, Select, ContextMenu y Sheet; conserva viewport, scroll y foco aunque esté fuera de `app-shell`.                                                                                                         |
| `FileDialog` / `AlertDialog` / `Sheet`                  | Marco y movimiento sobre ModuleFrame, confirmaciones y paneles modales/no modales. Archivo conserva tamaño expandido durante su apertura; Informes usa Sheet no modal.                                                                 |
| ReportSelectionResize | Separador de Informes. Usa la clase local handle y permite ajustar el ancho con el puntero o el teclado. |

Conserva `data-slot`, clases funcionales y estados accesibles de consumidores, medición y gestos. Reserva inline para posiciones, dimensiones, colores elegidos y zoom dinámicos. Mantén reglas funcionales sin capa y prioridades de medición/movimiento al ajustar estilos; la prioridad CSS depende de cascada/especificidad. Una especialización local conserva la base y los tokens globales.

## Decisiones pendientes

Completar composición, dimensiones y excepciones de Archivo, Configuración, menús, paneles y avisos fuera de lo definido aquí. Concretar medidas/acabados de DropdownMenu, ContextMenu y Menubar, indicador interior de RadioGroup y propiedades restantes de Slider. Las excepciones multilínea sin especificación y una regla transversal de interlineado siguen pendientes. La comprobación en navegador de las composiciones descritas sigue [Operaciones](OPERATIONS.md#comprobación-manual).
