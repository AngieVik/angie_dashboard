# Angie Dashboard

Las normas de este documento forman el estándar de la interfaz y se aplican por defecto. Los componentes con un comportamiento específico conservan las excepciones que necesiten.

- Se conserva la personalidad industrial de Angie.
- El borde rojo de resaltado, pierde su función si lo usamos para todo.

## Organización y contrato de estilos

- `AGENTS.md` contiene las normas generales de trabajo; este documento reúne las decisiones vigentes de diseño.
- `src/app/` ensambla la aplicación; `src/layout/` contiene ventanas y navegación; `src/features/` conserva la interfaz y lógica de cada funcionalidad. `src/hooks/` aloja los hooks compartidos y `src/pages/` queda reservado para pantallas completas. Se conservan las convenciones existentes de cada área.
- Cada componente compartido de `src/components/ui/` tiene carpeta y archivos en `kebab-case`, con TypeScript, CSS Module e `index.ts`, aunque el CSS esté vacío. Los nombres públicos de React permanecen en `PascalCase`; las primitivas relacionadas pueden compartir carpeta.
- Los índices exportan explícitamente componentes y tipos públicos. Se evitan barriles generales de toda la interfaz, dependencias circulares e importaciones internas desde el propio índice.
- `@/` apunta a `src/` mediante `paths` de TypeScript y `resolve.alias` de Vite. El destino de Vite se resuelve desde su configuración ESM, con independencia del directorio de ejecución. Se usa para dependencias entre áreas; las rutas relativas cortas permanecen dentro de la misma carpeta de componente.
- CSS Modules aísla los nombres locales. La base, variantes y estados pertenecen al componente; la distribución y las especializaciones exclusivas pertenecen a su consumidor. Una clase adicional modifica solo las propiedades necesarias y siempre conserva la base.
- Antes de mover o renombrar estilos, se localizan sus importaciones, selectores del DOM, mediciones, observadores y consumidores externos. Se actualizan conjuntamente y se retira lo sustituido dentro del alcance acordado.

## Tokens y cascada

- `src/styles/tokens.css` contiene únicamente variables: paleta y medidas primitivas, seguidas de asignaciones semánticas. Los componentes consumen los tokens semánticos; los valores específicos de una composición permanecen locales.
- Las medidas efectivas de los módulos se derivan de sus medidas base y del zoom una sola vez. Una especialización local modifica solo los valores necesarios.
- `src/styles/layers.css` fija el orden único `reset, vendor, base, components, overrides, utilities` y se carga antes de los componentes. No se redefine el orden desde una funcionalidad.
- Las hojas externas de Leaflet, React Grid Layout y react-resizable se importan únicamente desde `src/styles/integrations/`, dentro de `vendor`. Las adaptaciones de Angie tienen su ámbito explícito.
- El reseteo pertenece a `reset`, los estilos generales a `base`, las bases de los componentes a `components` y sus especializaciones a `overrides`. `utilities` contiene solo utilidades transversales de estructura y accesibilidad.
- La clase base de un componente se conserva al añadir una variante. El orden de las clases en `className` no determina la prioridad CSS. Las excepciones funcionales de medición y movimiento no se sustituyen por cambios visuales.
- Las especializaciones utilizan clases locales o variables del componente. No se cambia un token global para resolver una excepción local ni se copia la base completa para cambiar una propiedad. Las declaraciones abreviadas no deben reiniciar propiedades ajenas al cambio.
- Las reglas sin capa y los `!important` funcionales conservan su prioridad cuando la medición, el movimiento o una integración lo requieren. Permanecen en su propietario y no se usan como solución ordinaria para conflictos de apariencia.
- Los estilos inline se reservan para valores dinámicos, como coordenadas, dimensiones, colores elegidos y zoom; las decisiones visuales estáticas pertenecen al CSS.
- Los tokens admiten una sustitución futura por tema. El acabado vigente es oscuro; habilitar un tema claro o una preferencia persistida requiere su propio acuerdo.

## Responsabilidades de las hojas de estilo

| Archivo o ámbito | Responsabilidad |
| --- | --- |
| `src/styles/layers.css` | Orden inicial y único de las capas, cargado antes de los componentes desde `main.tsx`. |
| `src/styles/tokens.css` | Variables primitivas y semánticas; sin estilos de controles. |
| `src/styles/fonts.css` | Declaraciones locales de `@font-face`; sin tamaños ni clases de presentación. |
| `src/styles/global.css` | Reseteo y base general: documento, herencia tipográfica, foco, cifras técnicas, iconos y scroll. Sin bases paralelas de controles, ventanas o funcionalidades. |
| `src/styles/utilities.css` | Estructura y accesibilidad transversales. Incluye `visually-hidden` y la distribución de avisos `document-notices`, sin modificar la apariencia de `Alert`. |
| `src/styles/integrations/` | Únicas importaciones de CSS de proveedores y adaptaciones a sus clases externas, acotadas a las superficies de Angie. |
| `src/styles/print.css` | Impresión del documento de la app; el informe autónomo incorpora sus propios estilos. |
| CSS Module del propietario | Base, estados, variantes y composición de cada componente, ventana o funcionalidad. |

- Los estilos de menús, diálogos y ayudas se aplican a sus superficies y portales sin depender de que estén dentro de `app-shell`. La carga diferida y el orden de importación no deben introducir otra base ni cambiar la prioridad acordada.

## Tipografía

- Roboto Condensed es la fuente común de la interfaz, controles y datos técnicos.
- El contenido de Reloj y sus temporizadores utiliza Rajdhani; la cabecera común conserva Roboto Condensed. La excepción se aplica mediante el token local de fuente, manteniendo el estilo base de los controles.
- Las declaraciones activas de ambas familias se centralizan en `src/styles/fonts.css`, con archivos locales de `public/assets/fonts/` para el funcionamiento offline. Se conservan los originales y sus licencias, sin fuentes remotas. Solo se declaran los pesos y estilos disponibles; el fallback es genérico.
- Las cifras tabulares se conservan donde corresponda. Tamaños, pesos y escalado se definen por su cometido, sin introducir otras familias para datos técnicos.
- `--font-interface-default` identifica Roboto Condensed sin la sustitución local de Reloj. Los avisos y etiquetas compartidos utilizan esta referencia común en todas las funcionalidades.
- Los informes comparten Roboto Condensed y deben incorporar sus fuentes para abrirse sin conexión.

## Botones

- Los botones compartidos utilizan `Button`, con base, variantes de texto e icono y estados en su CSS Module. La base se conserva siempre al combinar `className`; las especializaciones modifican únicamente las propiedades necesarias.
- La variante se deduce del contenido y puede indicarse mediante `variant="text"` o `variant="icon"` cuando el cometido del control lo requiera, como las teclas de Calculadora.
- Las acciones integradas utilizan `appearance="integrated"`: mantienen la variante y la base, con acabado transparente y sin borde ni resaltado de foco. Su composición y tamaño específicos pertenecen al consumidor.
- `data-slot="button"` identifica el control compartido para las integraciones locales; no se depende del nombre generado por CSS Modules. Las excepciones de cabecera se aplican en `overrides`.
- La altura base común de los botones de texto es de 25 px al 100 % de zoom, alineada con las herramientas de icono; el zoom interno escala esa altura.

## Campos

- Los campos compartidos de una línea utilizan `Input`, con base y estados en su CSS Module. `className` se combina siempre con la base; las excepciones locales no la sustituyen.
- `InputGroup` controla su marco, el error conjunto y la composición del campo interior en su CSS Module. Conserva la base de `Input`, adapta únicamente su distribución y evita un segundo borde. Sus acciones reutilizan `Button` con `appearance="integrated"`.
- Los campos multilínea compartidos utilizan `Textarea`, con base y estados en su CSS Module. Las particularidades de cada funcionalidad se declaran en `overrides`, conservando la clase base y modificando solo las propiedades necesarias.
- Los campos de una línea tienen una altura base de 25 px al 100 % de zoom. El zoom interno escala esa altura.
- Al aumentar la altura de una ventana, los campos de una línea conservan su altura; el espacio adicional se distribuye entre los contenedores flexibles.
- Los campos no muestran resaltado de foco ni borde rojo al pasar el puntero. Cambiar esta norma requiere acordar una señal de foco de teclado; una reorganización no elimina otras señales de foco existentes.

## Controles de elección

- Todas las casillas utilizan `Checkbox`, con la composición Base UI de shadcn/ui adaptada a los tokens de Angie. Comparten tamaño de 16 × 16 px y el mismo acabado marcado y desmarcado; no hay variantes locales de tamaño, color ni selección parcial. Las clases del consumidor solo organizan su posición y separación.
- Las casillas de los menús reutilizan el mismo aspecto de `Checkbox`, mientras el elemento del menú conserva la interacción y el foco.
- En Informes, la casilla de cabecera está marcada cuando hay al menos un campo seleccionado y desmarcada cuando no hay ninguno. Al marcarla se seleccionan todos los campos de la sección; al desmarcarla se vacía la selección.
- Los listados de elección única utilizan `Select` como adaptador de campo sobre el componente compartido `DropdownMenu` de shadcn/ui Radix. Comparten base, lista, estados y tipografía; el consumidor conserva únicamente la distribución necesaria. Los valores y las opciones deshabilitadas se mantienen explícitos.
- `RadioGroup` y `Slider` tienen carpeta propia, CSS Module y exportaciones explícitas. Conservan las primitivas Radix y sus comportamientos existentes. Su clase base se combina siempre con `className`; las especializaciones de composición utilizan sus atributos `data-slot` estables.

## Menús

- Los menús de Archivo, Módulos, Vista y Limpieza pertenecen a una única `Menubar` en la barra superior, con la composición Radix de shadcn/ui. Conservan sus acciones, referencias de foco y opciones deshabilitadas.
- Los listados de `Select` y el fondo cartográfico utilizan el componente compartido `DropdownMenu` de shadcn/ui Radix. `Select` conserva únicamente la composición del campo, el valor y las opciones; no mantiene otra implementación de lista ni estilos propios para sus opciones.
- `Menubar` y `DropdownMenu` comparten las clases de superficie, opciones y estados del CSS Module de `DropdownMenu`. No hay acabados locales de menú en funcionalidades ni reglas paralelas en `global.css`. Sus carpetas tienen exportaciones explícitas y siempre conservan sus clases base.
- Las listas de elección única utilizan el grupo y las opciones radio del menú. Las opciones de casilla reutilizan `Checkbox`, sin selección parcial, y todos los separadores reutilizan `Separator`, sin excepciones visuales.
- Los portales mantienen límites de viewport y desplazamiento. El adaptador de campo transmite la tipografía calculada de su activador para conservar el zoom interno; esta transmisión no define un acabado local.

## Popovers y ayudas

- `Popover` y `Tooltip` tienen carpeta propia, CSS Module y exportaciones explícitas. Sus clases base se conservan siempre al añadir `className`; sus contenidos se identifican con `data-slot="popover-content"` y `data-slot="tooltip-content"`.
- La apariencia de cada familia se define en su componente, sin bases paralelas en `global.css` ni excepciones locales de fuente, fondo, borde o sombra. Comparten Roboto Condensed; el texto de Popover utiliza 13 px y el de Tooltip 11 px. Tooltip conserva su superficie translúcida mediante los tokens `--surface-tooltip` y `--shadow-tooltip`.
- Popover conserva el ancho base de 210 px y el relleno de 10 px, también para los controles de puntos kilométricos. Los portales mantienen los límites de espacio disponible y viewport, la colocación, el cierre y la devolución del foco existentes.
- La leyenda cartográfica conserva su composición en columna, ancho de 360 px, ampliación hasta 1000 px, cabecera y desplazamiento interior. La paleta de nombres conserva su cuadrícula. Estas adaptaciones de composición pertenecen a `overrides` y mantienen el acabado común.
- `HelpTooltip` conserva la consulta táctil de 800 ms, la cancelación al superar 8 px de movimiento y la coordinación de cierre entre ayudas. Un toque breve mantiene la acción del botón; una consulta mantenida consume únicamente su clic posterior. No añadir ayudas ni textos por rutina.

## Diálogos

- `AlertDialog` conserva la composición Radix, con carpeta propia, CSS Module y exportaciones explícitas. Sus partes compartidas centralizan el contenido centrado, títulos, descripciones, formularios y filas de acciones. Las clases adicionales siempre conservan la base.
- Los diálogos centrados mantienen el ancho inicial máximo de 460 px, límites respecto al viewport, relleno de 20 px, fondo atenuado y tirador de redimensionado. Usan Roboto Condensed y los tokens de superficie y sombra de diálogo; no se definen bases paralelas en `global.css`.
- `FileDialog` mantiene su ubicación en Documentos y su CSS Module. Conserva la superficie ajustada al viewport visible, fondo transparente, `ModuleFrame`, movimiento, redimensionado y contenido con relleno de 8 px. Sus límites se toman del espacio de trabajo real de la app, compartido con las demás ventanas, sin un desplazamiento propio respecto a la cabecera.
- `OverlayPortalContext` permite que Popover y Tooltip se monten dentro de la superficie de Archivo. Sus bases y estados siguen siendo los compartidos, y los controles flotantes quedan por encima de la ventana dentro de su capa.
- Ambas composiciones reutilizan la superposición de `AlertDialog`, con apariencia atenuada o transparente, y las partes compartidas de formulario y acciones. Los botones y campos mantienen sus componentes comunes. Los atributos `data-slot` identifican las superficies y partes para las integraciones de la app.
- Se conservan los portales, títulos accesibles, foco inicial y de retorno, Escape y restricciones durante guardado o recuperación. En Archivo, pulsar fuera ejecuta la misma acción de cierre que su botón, con los mismos bloqueos; arrastrar, usar ayudas o manipular el panel flotante de zoom no cuenta como pulsar fuera. La reorganización del estilo no modifica los procesos de archivos, permisos ni persistencia y no añade textos de ayuda.

## Avisos, etiquetas y separadores

- `Alert`, `Badge` y `Separator` tienen carpeta propia, CSS Module y exportaciones explícitas. Su apariencia se define únicamente dentro del componente, sin excepciones en app, layout o funcionalidades, incluidos los estilos aplicados mediante roles o selectores de contexto.
- No añadir a sus consumidores estilos inline, clases ni reglas que cambien fuentes, tamaños, colores, bordes, rellenos, márgenes o tratamiento de textos. Los contenedores organizan su ubicación; no modifican su base.
- `Alert` y `Badge` comparten Roboto Condensed, peso normal y tamaño de texto base de 14 px, escalado por el zoom interno común. No heredan la fuente particular de Reloj ni tamaños específicos de Información o Registro.
- Las variantes `secondary` y `outline` de `Badge` se definen dentro del componente y son las mismas en todos sus consumidores. El contenido, los indicadores de datos y las acciones conservan su significado.
- `Separator` centraliza el grosor, color y espaciado de cada orientación. Los separadores de menú y herramientas utilizan esa misma base, sin márgenes ni alturas particulares; `decorative` conserva su función semántica.
- Los avisos conservan sus textos, acciones y roles `alert` o `status`. Los mensajes de validación junto a campos mantienen su cometido y presentación local; no se convierten en avisos de bloque por rutina.

## Estructura de la aplicación y barra superior

- `App` conserva el estado, las acciones y el ensamblaje de funcionalidades. `AppHeader` compone la presentación de la barra superior a partir de sus datos y callbacks, reutilizando Menubar, botones, ayudas y ZoomControl existentes.
- `app.module.css` contiene la estructura del contenedor de aplicación, el área de trabajo y el contenido del documento. La clase `app-shell` se conserva únicamente como identificador de ámbito para los consumidores existentes; no mantiene una segunda base estructural en `global.css`.
- `appHeader.module.css` contiene la apariencia y composición de la barra: altura de 36 px al 100 % de zoom, logo de 24 × 24 px, orden y desplazamiento horizontal existentes.
- Los accesos a módulos, imán y origen conservan su acabado sin marco, los estados de sus botones y las ayudas existentes. Las adaptaciones de los controles de la barra pertenecen a su CSS Module; la base compartida de cada control se conserva.
- `data-slot="app-header"` identifica la cabecera para medir el espacio disponible y comprobar la visibilidad del activador de zoom. El zoom sigue aplicándose a la cabecera y se conservan las referencias de foco, el reinicio del control al cambiar de documento y los cálculos de navegación existentes.
- `FileMenu.module.css` contiene la composición de los detalles de guardado del menú Archivo. App y Archivo comparten el contenedor estructural `document-notices` de utilidades; los avisos mantienen la base de `Alert`.

## Marco de ventana y controles comunes

- `ModuleFrame`, `ZoomControl` y `WindowResize` definen sus estilos en sus CSS Modules. El marco conserva su cabecera, contenido, controles, estados, localizador y escalado, sin una base paralela en `global.css`.
- Las clases funcionales de marco, cabecera, contenido y zona escalada se mantienen para los consumidores de medición, arrastre y estilos de funcionalidades. No se añaden nombres generados a los descendientes del contenido que se utilizan para guardar el desplazamiento; la clave del contenedor principal sigue siendo `content`.
- Los atributos `data-slot` identifican las partes del marco y del zoom. Los botones conservan `data-slot="button"` y utilizan `data-control` para identificar su cometido. La ocultación del control por falta de espacio conserva la misma medición y visibilidad, sin modificar su valor.
- Los botones de control del marco, del zoom y de la barra superior reutilizan `Button` y el acabado de `controlButton.module.css`. Las etiquetas de valor y salida de los deslizadores reutilizan `controlValueLabel.module.css`.
- ZoomControl conserva sus manejadores y límites de 25–200 %. Sus variantes de presentación `header` y `module` mantienen la tipografía y distribución existentes; la colocación del popover se configura por separado.
- El campo nativo de porcentaje pertenece a `zoomControl.module.css`. Los selectores nativos de archivo y color conservan su cometido y geometría en sus propietarios; no se restablece una base global alternativa para campos nativos.
- WindowResize conserva el tirador de 24 × 24 px de los diálogos y su conversión de coordenadas, anclaje y cancelación. Los tiradores de React Grid Layout/react-resizable pertenecen a su integración específica.
- `windowContentSize.ts` centraliza el cálculo de mínimos por contenido que reutilizan el escritorio y las ventanas de Archivo. Los tamaños recogidos se solicitan desde los controles de cabecera; el tirador respeta el mínimo del contenido expandido.
- Las reglas del marco para medición, altura automática, tipografía de etiquetas, escalado de iconos y scroll pertenecen a su CSS Module y conservan la prioridad necesaria frente a las funcionalidades. La altura automática mantiene la excepción de Registro y los identificadores utilizados por sus consumidores.

## Escritorio e integración de ventanas

- Las importaciones de React Grid Layout y react-resizable se mantienen en `styles/integrations/react-grid-layout.css`, dentro de `vendor`. Las adaptaciones propias se centralizan en ese mismo archivo, en `overrides`, acotadas mediante `data-grid-surface` al escritorio y a las ventanas de Archivo.
- Se conservan las clases externas, configuración, eventos y variables de geometría de las librerías. Las reglas de transformación y tamaño durante el gesto mantienen los `!important` necesarios para presentar la geometría en curso sobre los estilos inline de la librería.
- `MobileViewport` utiliza su CSS Module para el contenedor, el espacio lógico y las barras de desplazamiento. Archivo reutiliza la misma base del espacio lógico, conservando sus límites y composición propios.
- `logical-workspace`, `viewport-scrollbar` y `data-testid="mobile-viewport"` conservan su función en los consumidores existentes. Los roles, referencias y relaciones accesibles de las barras no se sustituyen por cambios de estilo.
- Se conservan los cálculos de traslación, escala, rangos y sincronización de las barras. Sus pseudoelementos pertenecen a la capa `components` de `mobileViewport.module.css` y especializan el scroll general de `base`.
- El tirador de notas de Pizarra conserva su presentación en su ámbito; no comparte selectores con las adaptaciones de las librerías.

## Tamaño de las ventanas estándar

- Coordenadas es la referencia del comportamiento de tamaño: los contenedores flexibles crecen proporcionalmente y la reducción vertical se detiene cuando sus contenidos y márgenes llegan al mínimo.
- El mínimo vertical depende de la composición, del ancho disponible y del zoom interno; incluye la cabecera, los controles visibles, los bordes y los márgenes necesarios.
- El ancho mínimo de una ventana expandida depende de su contenido, sus controles, sus márgenes y el zoom interno.
- Tanto el mínimo horizontal como el vertical se calculan con los márgenes y las separaciones en su mínimo, sin incluir espacio flexible sobrante ni recortar el contenido o los controles.
- El tirador no permite reducir una ventana expandida por debajo de sus mínimos ni convertirla en barra o icono. Para recogerla se utilizan los controles de colapsar o contraer.
- Los módulos especiales, como Pizarra, conservan el tratamiento específico que requiera su contenido. La extensión del patrón estándar se concreta por componente.

## Contenido variable y desplazamiento

- Registro e Información se rellenan automáticamente: su crecimiento automático tiene un máximo de 600 px de altura total. Si el contenido supera ese límite o no cabe en la ventana, aparece la barra vertical a la derecha. El tamaño elegido con el tirador se recuerda y prevalece sobre el ajuste automático.
- Elementos, Dotaciones, Cuaderno y Reloj se rellenan manualmente: crecen y se reducen con el contenido, con un máximo automático de 600 px de altura total. Cuando el contenido supera ese límite o no cabe en la ventana, aparece la barra vertical a la derecha.
- En estos módulos, el mínimo vertical permite ver la cabecera, los controles y una fila de la lista, con márgenes y separaciones al mínimo. El resto del contenido puede desplazarse.
- Los 600 px limitan el ajuste automático; el redimensionado manual puede superar esa altura.
- Colapsar o contraer conserva el tamaño expandido. Restaurarlo no debe desencadenar otro ajuste automático.

## Estados de ventana y cabecera

- Las dimensiones de estos estados incluyen los bordes y se expresan al 100 % de zoom global: colapsada, 200 × 27 px; contraída a icono, 27 × 27 px.
- La ventana colapsada mantiene su tamaño fijo. El tirador de redimensionado solo aparece en la ventana expandida.
- En la cabecera expandida o colapsada, cerrar ocupa el extremo superior derecho y colapsar queda inmediatamente a su izquierda.
- En el estado contraído se muestra únicamente el icono del módulo, que permite restaurar la ventana.

## Control de zoom

- El control y el indicador de zoom interno se ocultan cuando no caben completos en su espacio, respetando el área del tirador de redimensionado.
- Vuelven a mostrarse cuando recuperan espacio suficiente, sin alterar el valor de zoom ni superponerse a otros controles.

## Herramientas de icono

- Los símbolos de 15 px se centran en controles de 25 × 25 px, con 5 px de espacio visual por lado al 100 % de zoom.
- Los iconos integrados en campos no muestran bordes ni resaltados rojos; Coordenadas es la referencia de este acabado.
- Quitar y eliminar comparten el acabado de las demás acciones, sin una diferenciación roja específica. Eliminar utiliza la papelera.

## Coordenadas

- La composición de Coordenadas pertenece a `coordinates.module.css`, acotada a la raíz del módulo. Conserva la columna flexible, el formulario y las cinco filas DD, DMS, DMM, UTM y Maps, con resultados que distribuyen el espacio disponible y respetan su altura mínima escalada.
- La entrada reutiliza `InputGroup`, `Input` y los botones integrados, sin tamaños propios de icono ni sombra adicional de error. La validación del campo utiliza el estado compartido; el mensaje de validación mantiene su presentación local y su relación accesible con la entrada.
- Se conservan los identificadores de resultados, valores y mensajes utilizados por sus consumidores. Las reglas específicas de medición pertenecen al CSS Module del módulo y no se mantienen en `global.css`.
- Las filas mantienen la copia mediante puntero y teclado, los estados de disponibilidad y bloqueo, el mensaje temporal y el respeto a movimiento reducido. Los cambios de presentación no modifican conversión, portapapeles, selección desde Plano ni comunicación con Informes.

## Calculadora

- La composición de Calculadora pertenece a `calculator.module.css`, acotada a su formulario raíz. Conserva el campo de operación, resultado, mensajes y teclado de cuatro columnas y seis filas, con el botón de igual ocupando toda su fila.
- El campo reutiliza `Input` y su estado de error compartido. Las teclas reutilizan `Button`, conservando su base y estados; las adaptaciones locales se limitan a distribución, tamaño, relleno y cifras tabulares. El resultado y los mensajes mantienen su presentación propia.
- El resultado y el teclado conservan su reparto proporcional del espacio, las alturas mínimas escaladas y los tamaños de texto actuales. El retroceso mantiene la variante de texto del botón y el icono compartido.
- Las reglas específicas de ajuste al contenido y medición de ancho o alto pertenecen al CSS Module. Los identificadores del teclado y resultado se conservan para sus consumidores, sin duplicar estas reglas en `global.css`.
- La reorganización de estilos no modifica la evaluación de expresiones, edición, acciones del teclado, mensajes ni bloqueo de interacción.

## Elementos y editor compartido con Dotaciones

- La composición del listado, barra de acciones y editor pertenece a `elements.module.css`, acotada a la raíz de `ElementsModule`. Dotaciones reutiliza esa misma interfaz; no mantiene una segunda base de estilos.
- Dotaciones conserva el filtrado de unidades, sus textos y el catálogo de Ambulancia, Pathfinder y Quad. La separación entre icono y nombre se aplica dentro del CSS Module compartido mediante `data-unit`, sin estilos de controles alternativos.
- Se conservan las filas flexibles, nombres en varias líneas, selección individual y múltiple, edición por lotes y desplazamiento del listado y editor. Sus clases utilizadas por medición, gestos y restauración del desplazamiento permanecen estables.
- El mínimo expandido de Elementos y Dotaciones se calcula con todo su contenido y márgenes pequeños. Las tarjetas reparten el espacio disponible sin escalar sus textos ni símbolos; la cabecera de ventana conserva su tamaño y comportamiento. El ajuste automático muestra el listado completo, sin el límite de altura de 600 px aplicado a otros listados.
- Los campos, acciones, casillas, selector y radios reutilizan los componentes comunes. Las herramientas conservan su área pulsable escalada y sus símbolos reciben una sola aplicación del zoom desde la base compartida. PNG y Emoji conservan su elección única, con el control centrado en la misma columna de 16 px utilizada por la casilla de ocultar el nombre.
- El tamaño de letra del nombre es numérico y editable entre 8 y 72 px. La escala utiliza un valor editable de 1 a 100, convertido linealmente al rango de 25–400 %. Ambos controles utilizan `AArrowDown` y `AArrowUp`, con pasos de una unidad. El giro utiliza `RotateCcw` y `RotateCw`, con pasos de 10°, y conserva su valor visible y las inversiones horizontal y vertical.
- La previsualización conserva su geometría, punto de anclaje y muestras de colores del nombre. Las reglas de medición y ajuste al contenido del listado y editor pertenecen a `elements.module.css`; el nombre comparte la clase de presentación definida en `BoardPin.module.css` con los pines de Pizarra. Las dimensiones y transformaciones calculadas del símbolo permanecen en el renderizado existente.
- La reorganización de estilos no modifica creación, guardado, duplicación, borrado, visibilidad, selección, gestos ni datos de los elementos.

## Operativo

- La composición de Operativo y su medición pertenecen a `OperationsModule.module.css`, acotadas a la raíz del módulo. Las tarjetas conservan la cuadrícula adaptable, el reparto del espacio y los umbrales existentes para mostrar abreviaturas y ocultar la herramienta de edición al estrecharse.
- Los controles heredan las fuentes y la altura común de 25 px al 100 % desde la base escalada del módulo. Las tarjetas pueden crecer con el espacio disponible.
- Los estados operativos reutilizan `Button` y sus acabados comunes; la selección conserva su borde, superficie e indicador lateral específicos. Las acciones dentro de las tarjetas de anotación y etiquetas utilizan `appearance="integrated"`; los campos conservan `Input` y `Textarea` con su composición interior.
- Las tarjetas de anotación y etiquetas mantienen su superficie propia y aplican la atenuación de deshabilitado una sola vez, sin volver a atenuar sus controles interiores. Se conservan nombres, abreviaturas, color, mensajes, ayudas y estados de edición.
- Los cambios de presentación no modifican selección de dotaciones, transiciones operativas, registro de cambios, guardado de anotaciones o etiquetas, bloqueo de interacción ni mecanismos de ventana.

## Información

- La composición de Información pertenece a `information.module.css`, acotada a la raíz del módulo. Conserva tarjetas, identidad, coordenadas del Plano, estado operativo, hora, etiquetas y texto; las reglas específicas de medición y ajuste al contenido pertenecen al mismo CSS Module.
- Una tarjeta se abre al pulsar su botón de expandir y se cierra al volver a pulsarlo o abrir otra. Solo hay una tarjeta abierta; los detalles cerrados permanecen ocultos e inactivos. La apertura y el cierre son directos, sin transiciones ni animaciones.
- Los botones de expandir y quitar etiquetas utilizan la herramienta común de 25 × 25 px al 100 %, escalada con el zoom. El resumen reserva el espacio necesario para el botón de expansión. La selección de identidad reutiliza el acabado integrado de `Button`.
- Las etiquetas y el estado operativo conservan `Badge` sin excepciones locales de apariencia. Los tamaños de las imágenes y emojis de identidad, la muestra del color personalizado y la jerarquía de texto pertenecen a la composición específica de la tarjeta.
- La barra vertical de Información se sitúa a la derecha. Se conservan los identificadores utilizados por medición y navegación, el límite de altura automática y los mecanismos existentes de tamaño y desplazamiento.
- Los cambios de presentación no modifican selección de elementos, datos operativos, coordenadas, fechas, eliminación de etiquetas, guardado ni bloqueo de interacción.

## Registro

- La composición de Registro pertenece a `timeline.module.css`, acotada a la raíz del módulo. Conserva la lista cronológica, horas, entradas corregidas, edición y campo de nueva entrada. Las reglas específicas de medición pertenecen al mismo CSS Module.
- El listado mantiene su barra vertical a la derecha y el seguimiento existente de la última entrada. El campo de nueva entrada permanece debajo, fuera del área desplazable; el contenido conserva la dirección de lectura de izquierda a derecha.
- Las herramientas de editar y eliminar utilizan `Button`, con área común de 25 × 25 px al 100 % escalada con el zoom. Las filas respetan esa altura mínima y crecen cuando su contenido lo necesita; los símbolos usan la escala compartida de la ventana.
- La nueva entrada reutiliza `Input`. La edición reutiliza `Textarea` y sus estados comunes, conservando el mínimo local de 45 px, relleno de 4 px, desplazamiento y redimensionado vertical. El distintivo «Corregida» reutiliza `Badge` sin excepciones locales.
- Los identificadores utilizados por medición, ajuste y desplazamiento permanecen estables. Los cambios de presentación no modifican orden, seguimiento de entradas, creación, corrección, eliminación, fechas, foco, validación, guardado ni bloqueo de interacción.

## Cuaderno

- La estructura, barra de acciones, listado, bloques y reglas de medición de Cuaderno pertenecen a `notebook.module.css`, acotadas a la raíz del módulo. La composición del checklist pertenece a `ChecklistBlock.module.css`; las especializaciones de sus campos y los de las notas permanecen en los CSS Modules de cada bloque.
- Se conservan el reparto flexible del espacio, el autocrecimiento de los textos, el ajuste de tamaño y la barra vertical a la derecha. Los identificadores utilizados por reordenación, navegación y medición permanecen estables.
- La franja de reordenación mantiene su altura de 16 px escalada, el foco visible y los gestos existentes mediante `Button` con acabado integrado. Los bloques conservan sus indicadores de arrastre y destino.
- Eliminar un bloque utiliza la papelera; los elementos posteriores del checklist utilizan «−» para quitar y «+» para añadir. Estas herramientas conservan el acabado integrado y el área común de 25 × 25 px al 100 %, escalada con el zoom; los campos reservan espacio para sus acciones.
- Las casillas utilizan `Checkbox` sin variantes locales de apariencia. Los campos reutilizan `Textarea`; el texto de los elementos marcados conserva su color secundario.
- Los cambios de presentación no modifican creación, edición, marcado, eliminación, reordenación por puntero o teclado, foco, autocrecimiento, bloqueo de interacción ni guardado de los bloques.

## Reloj

- La composición de la hora española, referencias, Zulu, barra de herramientas y lista pertenece a `clock.module.css`. Las filas y la señal visual de alarma pertenecen a `TimerRow.module.css`; la presentación del campo de duración pertenece a `DurationInput.module.css`.
- El contenido y los temporizadores conservan Rajdhani mediante el token local de fuente. La cabecera y los avisos mantienen sus componentes compartidos; no hay reglas generales de Reloj que sustituyan el aspecto de todos los botones o de `Alert`.
- Las herramientas de alta, prueba de sonido, cierre, inicio/pausa y reinicio/desactivación utilizan `Button` con acabado integrado y área común de 25 × 25 px al 100 %, escalada con el zoom. Zulu conserva el espacio flexible entre las herramientas en su orden actual.
- Las cifras de la hora se adaptan al ancho y alto disponibles sin un tope fijo; las de los temporizadores conservan el ancho reservado para sus dos herramientas y separaciones, con un tamaño más contenido. La hora ocupa el espacio sobrante y las filas mantienen su altura necesaria. El contenido del reloj y los temporizadores utiliza el fondo negro de `Input` mediante `--color-field`. Las reglas de medición y ajuste al contenido pertenecen al CSS Module de cada superficie.
- El mínimo expandido conserva la composición compacta de referencia: 208 px de ancho de contenido y 64 px para la fila de la hora al 100 %, además de referencias, herramientas, cabecera y controles comunes. Estas medidas siguen el zoom interno y la medición compartida de la ventana; los temporizadores añaden su altura necesaria al mínimo.
- `DurationInput` reutiliza la base y estados de `Input`, con presentación digital sin borde, tamaño de las cifras y altura de una línea de esas cifras. Conserva la máscara `hh:mm:ss`, edición, selección y pegado existentes.
- La alarma conserva su parpadeo, colores, sombras y ciclo actuales, el sonido y el reconocimiento mediante la fila o su botón. Las reglas de alarma quedan acotadas a las filas de temporizador.
- Se mantienen los identificadores utilizados por foco, medición y navegación. Al añadir temporizadores, la ventana crece solo si falta espacio para mostrarlos; al quitarlos puede ajustarse a la baja. La barra vertical permanece a la derecha. Los cambios de presentación no modifican motor, cálculos horarios, normalización de duración, acciones, sonido, recuperación, conflictos ni almacenamiento independiente.

## Mapa e integración Leaflet

- La estructura del visor compartido por Mapa y Plano operativo pertenece a `map.module.css`, acotada a la raíz de `MapModule`. Conserva barra, apertura de paneles, área cartográfica, avisos, resultados de búsqueda y controles de zoom geográfico.
- El buscador reutiliza `InputGroup`, `Input` y acciones integradas de `Button`, con el borde y estados comunes. Sus resultados reutilizan `Button` con composición multilínea; conservan nombre, descripción y coordenadas.
- Las herramientas de paneles y zoom parten del área común de 25 × 25 px al 100 %, escalada con el zoom. Se mantienen el reparto y la adaptación al espacio disponible de la barra de paneles, sus estados abiertos y el fondo legible de los controles superpuestos al mapa.
- La composición del panel GPX pertenece a `map.module.css`; la del listado y edición de marcadores pertenece a `MapMarkers.module.css`. Ambos reutilizan los estilos de contenedor, cabecera, barra de acciones, herramientas y selector nativo de color definidos en `map.module.css`.
- Los nombres GPX reutilizan `Button` y conservan selección y estado de disponibilidad. Los nombres de marcadores reutilizan `Input` con composición integrada en su fila; seleccionar y editar utilizan `Button` con acabado integrado. Las herramientas mantienen el área común de 25 × 25 px al 100 % escalada con el zoom, y las filas acomodan su contenido.
- El contenido de PK conserva `Popover` y `Slider` sin sustituir sus bases. Su ámbito privado se aplica directamente al contenido del portal para mantener cabecera, valor y escalas de separación; los intervalos y las acciones de visibilidad mantienen su comportamiento.
- La papelera identifica retirar un GPX del mapa y borrar un marcador; las X cierran los paneles. Retirar un GPX elimina la referencia del mapa y conserva el archivo original.
- La leyenda pertenece a `MapLegend.module.css`, con su ámbito privado aplicado al contenido del portal. Conserva dimensiones, ampliación, desplazamiento interior, recursos y fondos blancos de las muestras; sus acciones reutilizan `Button` y el tamaño común de iconos.
- El perfil GPX pertenece a `GpxElevationProfile.module.css`, incluido el botón montado en la barra del panel. Conserva geometría y colores del gráfico, tramos sin altitud, selección de puntos, navegación por teclado y foco; el gráfico interactivo mantiene su semántica y sus manejadores.
- La banda de datos y el alojamiento del botón de perfil pertenecen a `map.module.css`. Se mantienen separadas la altitud GPX y la altitud del terreno, con sus fuentes y consultas existentes; la presentación no modifica cálculos ni peticiones.
- Las adaptaciones de clases externas y elementos creados por Leaflet pertenecen a `src/styles/integrations/leaflet.css`, junto con su única importación de proveedor dentro de `vendor`. Se acotan a `.map-canvas` y `.reports-map-surface` según sus consumidores.
- Mapa y Plano conservan fondo, atribuciones y escala oscuros. El visor de Informes comparte tipografía y atribuciones oscuras; sus páginas y los recursos destinados al informe conservan su presentación propia.
- Los marcadores, sus etiquetas y los puntos kilométricos creados por Leaflet conservan nombres de clase, geometría y estados; sus estilos se aplican en el ámbito cartográfico de la integración.
- Los identificadores utilizados por Plano, navegación, gestos y medición permanecen estables. La medición del visor conserva la referencia de 600 × 400 px y la prioridad necesaria frente a las reglas generales del marco.
- La reorganización de presentación no modifica búsqueda, conversiones, centro, zoom geográfico, capas, proveedores, encuadre, datos GPX, selección, arrastre ni persistencia.

## Plano operativo

- La composición de Plano operativo pertenece a `plan.module.css`, acotada a la raíz de `PlanModule`. Conserva la barra flexible de herramientas, el selector de recursos, los avisos, el visor compartido y la banda del recurso seleccionado.
- Las herramientas reutilizan `Button`, con su base y estados comunes, área de 25 × 25 px al 100 % escalada mediante los tokens efectivos del módulo y selección del modo activo. El selector conserva el componente compartido `Select`, sin acabado local de campo ni menú. La papelera identifica retirar el pin; la acción conserva el recurso original.
- `PlanStrokeControls.module.css` organiza el selector nativo de color oculto y conserva su geometría dentro de la barra. El grosor reutiliza `Popover`, `Slider` y la etiqueta de valor compartida, sin estilos locales para sus bases ni cambios de foco o cierre.
- La superficie de interacción del dibujo pertenece a `PlanDrawing.module.css`. Conserva posición, prioridad, activación, cursores y captura de gestos según el modo existente.
- Los pines creados por Leaflet se presentan en `src/styles/integrations/leaflet.css`, acotados a `.map-canvas.leaflet-container`. Conservan clases, geometría, etiquetas, estados, foco, tiradores y transición asociada al zoom geográfico. Los estilos calculados a partir de la posición, el recurso y su escala permanecen en su renderizado actual.
- La reorganización de estilos no modifica dibujo, borrado, colocación, movimiento, escala, selección, encuadre, portapapeles, coordenadas ni persistencia. El visor de Plano sigue reutilizando Mapa; la representación destinada a Informes conserva sus propios cálculos y presentación.

## Pizarra

- La estructura del módulo, el área y las capas del lienzo, el cursor y los controles geométricos de la imagen pertenecen a `board.module.css`, acotados a la raíz de `BoardModule`. Conservan posiciones, orden de capas, cursores, `touch-action` y transformaciones existentes. La regla de medición del área pertenece a este mismo CSS Module y mantiene su prioridad frente al marco de ventana.
- La barra y los selectores nativos de color pertenecen a `BoardToolbar.module.css`. Su ámbito se aplica desde la raíz del módulo para conservar las clases de la barra utilizadas por el desplazamiento guardado y por el cierre del popover al salir del área visible.
- Las herramientas reutilizan `Button`, con su base y estados comunes, símbolos de 15 px y área de 25 × 25 px. La barra conserva su desplazamiento horizontal, orden, selección de modo, disponibilidad y navegación por teclado. El zoom del lienzo conserva su mecanismo independiente, sin escalar de nuevo los controles de la barra.
- Grosor, ayudas y separadores reutilizan `Slider`, `Popover`, `HelpTooltip` y `Separator`, sin acabados locales para sus bases. Los selectores nativos de color permanecen ocultos y conservan sus referencias y geometría.
- El error de imagen utiliza `Alert` sin excepciones visuales, colocado por un contenedor superpuesto al lienzo. El aviso conserva su texto y rol, y el paso de los eventos hacia el lienzo se mantiene mediante una regla funcional de `pointer-events`.
- Las notas rápidas y su elemento oculto de medición comparten la base de `QuickNote.module.css`, con papel amarillo, bordes, selección y foco locales. La medición conserva el ancho inicial de 180 px y la misma composición del texto que la nota visible.
- Ambos textos reutilizan `Textarea`, conservando su base y la fuente común. La especialización local mantiene el fondo transparente, color de tinta, relleno, alto disponible, saltos de línea y tamaño inicial de 32 px; el tamaño efectivo lo sigue calculando el ajuste de texto existente.
- La X de la nota reutiliza `Button` integrado y conserva su posición y tamaño común. El tirador mantiene su geometría de 12 × 12 px y trama de 8 × 8 px en el CSS Module de la nota, sin reglas paralelas en `global.css`.
- La presentación de notas no modifica borradores, composición de texto, confirmación al salir o cerrar, cancelación con Escape, foco, colocación, movimiento, límites de tamaño ni persistencia. Se conservan las clases y referencias utilizadas por gestos y medición.
- La presentación de los pines pertenece a `BoardPin.module.css`, con un ámbito propio para selección, símbolo y tirador. La clase de presentación del nombre se comparte con la previsualización del editor de Elementos y Dotaciones; las clases utilizadas por gestos y medición permanecen estables.
- La paleta aplica su ámbito directamente al contenido de `Popover`, conservando la base del portal y su cuadrícula de dos columnas. Sus opciones reutilizan `Button`, admiten el ajuste del texto y mantienen la selección y el foco visibles. Los colores de cada muestra se toman de `PIN_NAME_COLORS`, sin sustituir la base del botón.
- Los controles geométricos del pin conservan dimensiones, anclajes, etiquetas, estados y manejadores de movimiento, escala y edición. La apertura y el cierre de la paleta, la elección de color y los cálculos compartidos con Plano e Informes mantienen su implementación existente.
- La separación de estilos no modifica trazos, goma, carga y transformación de imagen, coordenadas, anclajes, navegación, cancelación de gestos, datos ni persistencia.

## Informes

- La estructura principal, barra de formato, selección de campos, acciones, incidencias de recursos y contenedor de previsualización pertenecen a `reports.module.css`, acotados a la raíz de `ReportsModule`.
- La barra de formato utiliza `reports-page-toolbar`, con su propia composición flexible. Los controles de orientación y calidad conservan `Select`; los campos seleccionables, acciones y avisos conservan `Checkbox`, `Button` y `Alert` sin acabados locales alternativos.
- Se conservan la cuadrícula de secciones, la selección de cabecera cuando hay algún campo marcado, los bloqueos durante la generación y las acciones de reintentar u omitir recursos. La reorganización de estilos no modifica selección, generación, guardado, descarga, permisos ni datos congelados del informe.
- El contenedor de previsualización conserva el `iframe`, su mínimo de 320 px, fondo blanco y borde. La composición de la interfaz no sustituye los estilos del documento generado ni su mecanismo de ajuste de escala, paginación o impresión.
- Los visores de encuadre utilizan las superficies oscuras de Angie, incluidas las atribuciones cartográficas.
- La composición compartida de los visores de Mapa, Plano y Pizarra pertenece a `reportFraming.module.css`, aplicada a la raíz de cada visor. Conserva cuadrículas, listados, etiquetas, estados, barras y avisos, con vistas de 280 px de altura y listados desplazables de hasta 160 px.
- Las superficies y el canvas superpuesto de Mapa y Plano pertenecen a `ReportMap.module.css`; la imagen de Pizarra pertenece a `ReportBoard.module.css`. Las clases cartográficas permanecen estables para la integración Leaflet existente, y se mantiene el fondo blanco cuando se desactiva «Fondo».
- Las barras de encuadre reutilizan `Button` con herramientas de 25 × 25 px al 100 %, escaladas mediante los tokens efectivos del módulo. Casillas y selectores conservan `Checkbox` y `Select`, sin acabados locales alternativos.
- El área seleccionada pertenece a `ReportMapArea.module.css`. Conserva el sombreado exterior, borde, tiradores de 14 px, controles de movimiento y redimensionado, foco, cursores, captura de punteros y navegación por teclado. Sus posiciones y dimensiones calculadas permanecen en el renderizado existente.
- La separación de estilos de los visores no modifica selección de recursos y capas, modos de encuadre, capturas, coordenadas, cálculos ni datos del informe. Las zonas de desplazamiento conservan sus clases y estructura.
- El CSS del documento autónomo pertenece a `documentReport.css` y se incorpora como texto dentro del HTML generado, junto con sus reglas de previsualización. El ajuste de escala conserva su contenedor y variables calculadas; no mantiene otra copia del CSS en el componente de la app.
- `reportTypography.ts` prepara las fuentes normales variables de Roboto Condensed, latina y latina extendida, a partir de las declaraciones de `src/styles/fonts.css` y de los archivos originales de `public/assets/fonts/`. Conserva los pesos disponibles y los rangos de caracteres, e incorpora los bytes WOFF2 como datos dentro del HTML. Rajdhani no se incorpora al informe; los temporizadores impresos utilizan la fuente del documento.
- El HTML permite fuentes incrustadas mediante `font-src data:` y conserva las demás restricciones de su política. La tipografía del documento no depende de rutas del servidor ni de la caché de la PWA al abrir el informe fuera de la app.
- La preparación de la fuente precede a las capturas y a la medición de Pizarra; los visores cartográficos reajustan el encuadre al completarla. La paginación espera las fuentes del documento y la decodificación de imágenes. La previsualización se mide y habilita para imprimir cuando su fuente está lista, descartando resultados de un documento anterior del `iframe`.
- La preparación se reutiliza durante la sesión y los reintentos conservan el CSS de fuente del informe congelado. Los puntos de espera respetan la generación del UIBoard; los informes guardados permanecen intactos. Una fuente no disponible se comunica por los canales de error existentes, sin generar una salida con sustitución silenciosa.
- El formato A4 conserva 210 × 297 mm en vertical y 297 × 210 mm en horizontal. `REPORT_PAGE_MARGIN_MM`, definido en `reportPagination.ts`, fija los 12 mm interiores y se comparte con el límite de tamaño de las imágenes. La calidad mantiene 150/300 ppp y las protecciones de memoria existentes.
- `documentReport.css` reúne la presentación estática de páginas, tablas, composiciones gráficas y medios de pantalla e impresión. `reportPageStyles` incorpora únicamente las medidas dinámicas mediante variables CSS y la orientación de `@page`, sin margen de papel adicional al espacio interior del contenido.
- La paginación explícita conserva el cálculo de columnas, las cabeceras repetidas, la división de filas largas y el ajuste de imágenes con sus leyendas. Las cabeceras de tabla admiten el ajuste de palabras largas; se mantienen los avisos de contenido que no cabe, sin recortar u ocultar datos. La impresión conserva página blanca, saltos y eliminación de sombras, y solicita respetar los colores del documento.
- `src/styles/print.css` se carga desde `main.tsx` y actúa únicamente en impresión de la app: oculta cabecera de aplicación, barras de herramientas, acciones, menús, ayudas, controles de ventana, tiradores y barras de desplazamiento. Sus ámbitos estables son `app-shell`, `file-dialog-content` y `alert-dialog-content`; los portales se identifican por sus `data-slot`.
- La salida del informe continúa imprimiéndose desde su propio HTML, con las fuentes y reglas incorporadas. La limpieza de controles de la app conserva los nombres, símbolos y valores de contenido, así como la geometría y navegación del escritorio.

## Cambios de diseño y comprobaciones

- Antes de ejecutar un cambio se delimita la superficie, sus consumidores y el resultado visual. Se acuerda qué conservar, quitar, centralizar o añadir, distinguiendo reorganización de cambios visibles.
- Se conservan nombres accesibles, semántica, referencias, eventos y estados aplicables: selección, apertura, foco, deshabilitado, ocupado, error y solo lectura. La apariencia no se resuelve eliminando atributos ni comportamientos.
- Las comprobaciones requieren aceptación expresa y un alcance concreto según `AGENTS.md`. Para cambios visuales se proponen los tamaños, estados, contenido y niveles de zoom afectados; teclado, táctil u offline se incluyen cuando corresponda.
- El diff y la compilación no acreditan el resultado visual. Se distingue revisión de código, navegador, emulación, Windows/Android físicos, HTML autónomo reabierto offline, PDF e impresión física. No se crean históricos ni galerías permanentes para documentar el cierre.
