# guia_aqrquitectura_angie

## Habilidades

| Habilidades propuesta | Qué aportaría |
| --------------------- | ------------- |

| Habilidades creadas           | Qué aportaría                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`angie-modulos`**           | Guiar cambios en módulos siguiendo su registro, ventana, tamaños, zoom y conexión con el documento. Identificar qué piezas necesita cada cambio, sin generar estructuras innecesarias. |
| **`angie-gestos-geometria`**  | Ayudar con arrastre, redimensionado, zoom, coordenadas y cancelación multitáctil. Distinguir geometría del documento y navegación local.                                               |
| **`angie-persistencia`**      | Seguir el recorrido de los datos entre JSON, IndexedDB, carpetas, recursos externos y recuperación. Detectar consecuencias para compatibilidad y posibles sobrescrituras.              |
| **`angie-interfaz-compacta`** | Localizar y reutilizar controles, estilos y patrones existentes. Traducir una petición visual en cambios concretos de tamaño, alineación y estados, respetando el diseño solicitado.   |
| **`angie-cartografia`**       | Orientar cambios entre Mapa, Plano operativo, Coordenadas, pines y GPX, prestando atención a proyecciones, sincronización y referencias externas.                                      |
| **`angie-integraciones`**     | Investigar una fuente externa antes de implementarla: acceso directo desde la PWA, formato, CORS, claves, límites, atribución y comportamiento sin conexión.                           |

### Modulos con estilo y excepciones

| Módulo              | Componentes que utiliza                                                                                                                          | Estilos del módulo                                                     | Excepciones o particularidades                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Coordenadas**     | Button, Input, InputGroup, HelpTooltip                                                                                                           | Base + composición propia                                              | Filas flexibles; resultados técnicos; aviso de copia                                                    |
| **Calculadora**     | Button, Input                                                                                                                                    | Base con excepciones + teclado específico                              | Teclas elásticas; tamaño de cifras; alineación derecha                                                  |
| **Elementos**       | ElementEditor; Button, Input, Textarea, Checkbox, Select, RadioGroup, Slider, HelpTooltip                                                        | Base con excepciones + editor propio                                   | Anchos de campos; selección de transformaciones; paleta del nombre; punto de anclaje                    |
| **Dotaciones**      | ElementsModule y sus componentes                                                                                                                 | Misma base y estilos que Elementos                                     | Separación entre icono y nombre; presentación de unidades                                               |
| **Operativo**       | UnitTags; Button, Input, Textarea, HelpTooltip; selector nativo de color                                                                         | Base con excepciones + tarjetas propias                                | Tarjetas flexibles; selección de estado; campos integrados sin borde; abreviaturas                      |
| **Información**     | Button, Badge                                                                                                                                    | Base + tarjetas propias, con adaptaciones de Button                    | Tarjetas desplegables; identidad visual; tamaños de imágenes; botón de identidad integrado              |
| **Registro**        | Button, Input, Textarea, Badge                                                                                                                   | Base con excepciones + listado propio                                  | Editor redimensionable; altura y relleno del editor; relleno de entrada; desplazamiento del listado     |
| **Cuaderno**        | NoteBlock, ChecklistBlock; Button, Textarea, Checkbox, HelpTooltip                                                                               | Base con excepciones + bloques propios                                 | Autocrecimiento; espacio reservado para acciones; franja de arrastre; texto marcado                     |
| **Reloj**           | TimerRow, DurationInput; Button, Input, Alert                                                                                                    | Base con excepciones + presentación digital                            | Rajdhani; cifras adaptables; campo digital sin borde; señal visual de alarma                            |
| **Mapa**            | MapMarkers, MapLegend, MapElevation, GpxElevationProfile; Button, Input, InputGroup, Select, DropdownMenu, Popover, Slider, HelpTooltip; Leaflet | Base con excepciones + estilos cartográficos específicos               | Buscador integrado; filas de marcadores; leyenda ampliable; perfil de elevación; controles superpuestos |
| **Plano operativo** | MapModule y sus componentes; PlanDrawing, PlanPins, PlanStrokeControls; Button, Select, HelpTooltip, AlertDialog                                 | Base + estilos compartidos de Mapa + dibujo específico                 | Pines y nombres; tiradores geométricos; superficie de dibujo; selector de color oculto                  |
| **Pizarra**         | BoardToolbar, QuickNote, BoardPin; Button, Textarea, Alert, Popover, Slider, Separator, HelpTooltip; lienzo Konva                                | Base con excepciones + estilos específicos de lienzo, notas y pines    | Papel amarillo; texto adaptable; colores de nombres; tiradores; capas del lienzo                        |
| **Informes**        | ReportMap, ReportBoard, ReportMapArea, WorkDirectoryDialog; Button, Checkbox, Select, Alert, AlertDialog, HelpTooltip; Leaflet e iframe          | Base + composición propia + documento autónomo con estilos específicos | Visores de encuadre; tiradores geométricos; páginas blancas A4; tipografía y paginación del informe     |

## Pines

### Elementos

icon_chincheta
Icon_cp
icon_eh
icon_finish
icon_medical
icon_peligro

### Dotaciones

icon_quad
icon_start
icon_vir

## dependencias

### Bibliotecas de la aplicación

| Dependencia                     | Versión declarada | Uso                                              |
| ------------------------------- | ----------------- | ------------------------------------------------ |
| `react`                         | ^19.3.0           | Interfaz                                         |
| `react-dom`                     | ^19.3.0           | Renderizado de React                             |
| `@base-ui/react`                | ^1.9.0            | Componentes de interfaz                          |
| `@radix-ui/react-alert-dialog`  | ^1.1.23           | Diálogos modales                                 |
| `@radix-ui/react-dropdown-menu` | ^2.1.24           | Menús desplegables                               |
| `@radix-ui/react-menubar`       | ^1.2.1            | Barra de menús                                   |
| `@radix-ui/react-popover`       | ^1.1.23           | Paneles flotantes                                |
| `@radix-ui/react-radio-group`   | ^1.4.8            | Selección de opciones                            |
| `@radix-ui/react-separator`     | ^1.1.15           | Separadores                                      |
| `@radix-ui/react-slider`        | ^1.4.7            | Deslizadores                                     |
| `@radix-ui/react-tooltip`       | ^1.2.16           | Ayudas emergentes                                |
| `lucide-react`                  | ^1.49.0           | Iconos                                           |
| `react-grid-layout`             | ^2.2.4            | Distribución de ventanas                         |
| `react-draggable`               | 4.7.2             | Arrastre; indirecta de `react-grid-layout`       |
| `react-resizable`               | 3.2.0             | Redimensionado; indirecta de `react-grid-layout` |
| `konva`                         | ^10.7.0           | Dibujo sobre lienzo                              |
| `react-konva`                   | ^19.3.0           | Integración Konva–React                          |
| `leaflet`                       | 1.9.4             | Mapas                                            |
| `proj4`                         | ^2.22.0           | Conversión de coordenadas                        |
| `dexie`                         | ^4.4.6            | Almacenamiento IndexedDB                         |
| `ajv`                           | ^8.20.0           | Validación JSON Schema                           |
| `ajv-formats`                   | ^3.0.1            | Formatos adicionales de validación               |

### Herramientas, plugins y dependencias de desarrollo

| Dependencia                   | Versión declarada | Uso                                   |
| ----------------------------- | ----------------- | ------------------------------------- |
| `typescript`                  | ^6.0.3            | Lenguaje y comprobación de tipos      |
| `vite`                        | ^8.3.1            | Desarrollo y compilación              |
| `@vitejs/plugin-react`        | ^6.1.1            | Plugin React para Vite                |
| `vite-plugin-pwa`             | ^1.3.0            | PWA y service worker                  |
| `eslint`                      | ^10.11.0          | Análisis del código                   |
| `@eslint/js`                  | ^10.0.1           | Reglas JavaScript                     |
| `typescript-eslint`           | ^8.71.0           | Integración TypeScript–ESLint         |
| `eslint-plugin-react-hooks`   | ^7.1.1            | Reglas de hooks                       |
| `eslint-plugin-react-refresh` | ^0.5.7            | Reglas de actualización en desarrollo |
| `globals`                     | ^17.12.0          | Definiciones de variables globales    |
| `@types/leaflet`              | 1.9.21            | Tipos de Leaflet                      |
| `@types/node`                 | ^26.6.3           | Tipos de Node.js                      |
| `@types/react`                | ^19.3.0           | Tipos de React                        |
| `@types/react-dom`            | ^19.3.0           | Tipos de React DOM                    |

### También forman parte de la base técnica

| Elemento            | Integración                                     |
| ------------------- | ----------------------------------------------- |
| **shadcn/ui**       | Composiciones adaptadas dentro del código local |
| **Workbox 7.4.1**   | Dependencia indirecta para la PWA               |
| **Rolldown 1.2.11** | Dependencia indirecta para empaquetado          |
| **Node.js 24.12.0** | Entorno de referencia                           |
| **npm 11.6.2**      | Gestor de dependencias de referencia            |

## Componentes

Incluyo los componentes compartidos y las piezas específicas mencionadas en la tabla anterior, agrupando las partes internas de menús y diálogos.

Leaflet y Konva son las librerías de representación cartográfica y de lienzo; el `iframe` aloja la previsualización del informe.

| Componente              | Función                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Button**              | Ejecutar acciones mediante botones de texto o icono.                           |
| **Input**               | Introducir o editar un valor de una línea.                                     |
| **Textarea**            | Introducir o editar texto multilínea.                                          |
| **InputGroup**          | Agrupar un campo y sus acciones dentro de un mismo marco.                      |
| **Checkbox**            | Marcar o desmarcar una opción independiente.                                   |
| **RadioGroup**          | Elegir una sola opción entre varias alternativas visibles.                     |
| **Slider**              | Ajustar un valor mediante un deslizador.                                       |
| **Select**              | Elegir un valor de una lista desplegable; utiliza DropdownMenu.                |
| **DropdownMenu**        | Mostrar una lista desplegable de acciones u opciones.                          |
| **Menubar**             | Organizar los menús de la barra superior.                                      |
| **Popover**             | Mostrar un panel flotante asociado a un control.                               |
| **Tooltip**             | Mostrar una ayuda breve junto a un elemento.                                   |
| **HelpTooltip**         | Adaptar las ayudas a puntero y pulsación táctil mantenida.                     |
| **Alert**               | Mostrar avisos, errores o mensajes de estado.                                  |
| **AlertDialog**         | Presentar un diálogo modal para confirmar acciones o completar operaciones.    |
| **Badge**               | Identificar estados o etiquetas mediante un distintivo compacto.               |
| **Separator**           | Separar visualmente grupos de contenido o herramientas.                        |
| **ModuleFrame**         | Proporcionar la cabecera, el contenido y los controles comunes de una ventana. |
| **ZoomControl**         | Consultar y ajustar el porcentaje de zoom.                                     |
| **WindowResize**        | Redimensionar los diálogos que utilizan este tirador.                          |
| **ElementsModule**      | Mostrar y gestionar el listado de elementos y su editor.                       |
| **ElementEditor**       | Editar las propiedades y la representación de elementos o dotaciones.          |
| **UnitTags**            | Añadir, editar y gestionar las etiquetas de una dotación.                      |
| **NoteBlock**           | Presentar un bloque de texto editable en Cuaderno.                             |
| **ChecklistBlock**      | Presentar y editar una lista de tareas con casillas.                           |
| **TimerRow**            | Mostrar un temporizador, sus controles y su estado de alarma.                  |
| **DurationInput**       | Editar una duración con formato `hh:mm:ss`.                                    |
| **MapModule**           | Componer el visor cartográfico y sus herramientas; también lo reutiliza Plano. |
| **MapMarkers**          | Gestionar el listado, selección y edición de marcadores del mapa.              |
| **MapLegend**           | Mostrar la leyenda cartográfica y sus símbolos.                                |
| **MapElevation**        | Consultar y mostrar la altitud del terreno en un punto.                        |
| **GpxElevationProfile** | Mostrar el perfil de elevación de un recorrido GPX.                            |
| **PlanDrawing**         | Gestionar la superficie de dibujo del Plano operativo.                         |
| **PlanPins**            | Representar y manipular los pines geográficos del Plano.                       |
| **PlanStrokeControls**  | Elegir el color y grosor de los trazos del Plano.                              |
| **BoardToolbar**        | Reunir las herramientas de dibujo, notas y fondo de Pizarra.                   |
| **QuickNote**           | Mostrar y editar una nota rápida sobre Pizarra.                                |
| **BoardPin**            | Representar y manipular un elemento y su nombre sobre Pizarra.                 |
| **ReportMap**           | Seleccionar y encuadrar el contenido de Mapa o Plano destinado al informe.     |
| **ReportBoard**         | Seleccionar y encuadrar el contenido de Pizarra destinado al informe.          |
| **ReportMapArea**       | Mover y redimensionar el rectángulo de encuadre del informe.                   |
| **WorkDirectoryDialog** | Configurar y autorizar la carpeta de trabajo.                                  |

## Iconos

| Icono                               | Icono                             | Icono               |
| ----------------------------------- | --------------------------------- | ------------------- |
| AlarmClock                          | Ambulance                         | ArrowDownToLine     |
| Calculator                          | Check                             | ChevronDown         |
| ClipboardCheck                      | ClipboardClock                    | ClipboardList       |
| ClipboardPaste                      | ClipboardPen                      | ClipboardPlus       |
| ClipboardX                          | Clock3                            | CloudRain           |
| CloudSun                            | Copy                              | CopyPlus            |
| Crosshair                           | Delete                            | Eraser              |
| Eye                                 | EyeOff                            | FileBracesCorner    |
| FileImage                           | FileText                          | Flag                |
| Focus                               | FolderCog                         | FolderKey           |
| FolderOpen                          | FolderSync                        | GitCommitHorizontal |
| GitCommitVertical                   | Hand                              | HandleBottomRight   |
| ImageOff                            | Info                              | Layers              |
| ListChevronsDownUp                  | ListChevronsUpDown                | LocateFixed         |
| Magnet                              | Map                               | MapPin              |
| MapPinned                           | Maximize2                         | Minimize2           |
| Minus                               | MopSparkles                       | MousePointer2       |
| NotebookPen                         | Package                           | PaintRoller         |
| Palette                             | PanelsTopLeft                     | Pause               |
| Pencil                              | PenLine                           | Play                |
| Plus                                | Pointer                           | Proportions         |
| Radio                               | RefreshCw                         | RotateCcwClock      |
| Route                               | Scan                              | Search              |
| Settings2                           | Square                            | SquareDimensions    |
| StickyNote                          | Trash                             | Trash2              |
| TrianglesCenterlineDashedHorizontal | TrianglesCenterlineDashedVertical | Undo2               |
| Watch                               | Wrench                            | X                   |

## gestos y acciones

Biblioteca de las interacciones implementadas. PC incluye ratón y teclado; Android describe la entrada táctil. `—` indica que no hay un gesto táctil equivalente específico; un teclado externo puede utilizar los atajos de la columna PC.

El gesto depende de dónde empieza: escritorio, cabecera, contenido, Pizarra o mapa. Los campos de texto y los controles conservan su interacción propia.

### Navegación y zoom

| Acción                              | PC                                                                                 | Android                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Desplazar el escritorio             | Arrastrar una zona vacía con el botón izquierdo.                                   | Arrastrar una zona vacía con un dedo.                                                    |
| Usar las barras del escritorio      | Arrastrar la barra horizontal o vertical.                                          | Deslizar sobre la barra disponible.                                                      |
| Desplazar contenido de un módulo    | Arrastrar una zona desplazable, fuera de campos y controles excluidos.             | Deslizar con un dedo sobre esa zona.                                                     |
| Desplazar listados con la rueda     | Rueda en módulos de listado o contenido editable. No todos los módulos la admiten. | Deslizar el listado con un dedo.                                                         |
| Cambiar el zoom global              | Control de zoom global; `Ctrl + rueda` cuando no hay un módulo activo.             | Control de zoom global; pellizco de dos dedos cuando el gesto pertenece al escritorio.   |
| Cambiar el zoom interno             | Control del módulo; `Ctrl + rueda` con un módulo activo, fuera del mapa.           | Control del módulo; pellizco cuando el gesto pertenece al módulo activo, fuera del mapa. |
| Elegir un porcentaje de zoom        | Escribirlo y pulsar `Enter` o salir del campo.                                     | Tocar el porcentaje, escribirlo y salir del campo.                                       |
| Ajustar el zoom con deslizador      | Abrir su icono y arrastrar el deslizador.                                          | Tocar el icono y arrastrar el deslizador.                                                |
| Descartar un porcentaje sin aplicar | `Escape` mientras se edita el campo.                                               | —                                                                                        |
| Volver al origen del escritorio     | Clic en Volver al origen.                                                          | Toque en Volver al origen.                                                               |

El zoom global y el de los módulos admiten 25–200 %. Sin navegación guardada empiezan al 100 %. Al cambiarlo se conserva la esquina superior izquierda visible. El zoom geográfico de Leaflet es independiente.

### Ventanas y selección de módulo

| Acción                                 | PC                                                                                    | Android                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| Activar un módulo                      | Clic dentro de la ventana o foco en uno de sus controles.                             | Toque dentro de la ventana.                   |
| Seleccionar o localizar desde la barra | Clic en el acceso del módulo abierto. Si ya está activo, se señala y se hace visible. | Toque en el mismo acceso.                     |
| Quitar el módulo activo                | Clic en una zona vacía del escritorio, sin arrastrar.                                 | Toque en una zona vacía, sin arrastrar.       |
| Mover una ventana                      | Arrastrar la cabecera, incluido su icono; los demás botones quedan excluidos.         | Arrastrar la cabecera con un dedo.            |
| Cambiar el tamaño de una ventana       | Arrastrar el tirador inferior derecho.                                                | Arrastrar el tirador con un dedo.             |
| Recoger a icono o restaurar            | Clic en el icono de cabecera, sin arrastrarlo.                                        | Toque breve en el icono.                      |
| Colapsar o expandir                    | Clic en el control de colapsado.                                                      | Toque en ese control.                         |
| Activar el imán de ventanas            | Clic en Imán de módulos; después, arrastrar la ventana.                               | Toque en Imán de módulos; después, arrastrar. |

En modo icono no se muestra el tirador. Los diálogos que utilizan `FileDialogContent` también se mueven por su cabecera y se redimensionan mediante su tirador.

### Ayudas y controles compartidos

| Acción                            | PC                                                     | Android                                                            |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Consultar una ayuda `HelpTooltip` | Pasar el ratón o dar foco al control.                  | Mantener pulsado unos 800 ms, sin desplazar el dedo.               |
| Ejecutar un control con ayuda     | Clic breve.                                            | Toque breve; una consulta mantenida de la ayuda consume ese toque. |
| Consultar un `title`              | Pasar el ratón; la presentación depende del navegador. | No hay una ayuda táctil propia asociada a `title`.                 |
| Abrir un menú o panel flotante    | Clic en su control.                                    | Toque en su control.                                               |
| Accionar un botón con teclado     | `Enter` o `Espacio`, según el control enfocado.        | —                                                                  |
| Mover el foco entre controles     | `Tab` / `Mayús + Tab`.                                 | Tocar el control.                                                  |

### Elementos y Dotaciones

| Acción                                                | PC                                                                      | Android                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Seleccionar una ficha                                 | Clic en la ficha.                                                       | Toque en la ficha.                                      |
| Abrir el editor de una ficha                          | Doble clic, o botón Modificar.                                          | Doble toque en menos de 350 ms, o botón Modificar.      |
| Entrar en selección múltiple                          | Mantener pulsada una ficha unos 500 ms.                                 | Mantener un dedo unos 500 ms sobre la ficha.            |
| Cambiar la selección múltiple                         | Clic en las casillas de las fichas.                                     | Toque en las casillas.                                  |
| Salir de selección múltiple                           | Clic en Salir de selección múltiple.                                    | Toque en ese control.                                   |
| Ajustar el punto de coordenadas del pin               | Arrastrar la cruz de la previsualización.                               | Arrastrarla con un dedo.                                |
| Ajustar ese punto con teclado                         | Flechas; `Mayús + flechas` para un paso más fino.                       | —                                                       |
| Repetir un ajuste de tamaño, escala, giro o inversión | Mantener pulsado su botón: empieza a repetir a los 400 ms, cada 120 ms. | Mantener el dedo sobre el botón con los mismos tiempos. |
| Interrumpir la repetición                             | Soltar, mover el puntero más de 4 px o perder el foco.                  | Levantar, mover el dedo más de 4 px o añadir otro dedo. |

La pulsación para selección múltiple se cancela si se desplaza más de 4 px o interviene otro puntero. El editor sigue siendo contenido del módulo, no un modal nuevo.

### Pizarra

| Acción                                   | PC                                                                                    | Android                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Desplazar el lienzo                      | Arrastrar el fondo en Seleccionar/mover; también con el botón central.                | Arrastrar el fondo con un dedo en Seleccionar/mover.    |
| Dibujar                                  | Arrastrar sobre el lienzo con Lápiz.                                                  | Arrastrar un dedo con Lápiz.                            |
| Borrar dibujo                            | Arrastrar sobre los trazos con Goma.                                                  | Arrastrar un dedo con Goma.                             |
| Quitar la selección                      | Clic en el fondo, sin arrastrar.                                                      | Toque en el fondo, sin arrastrar.                       |
| Seleccionar un pin                       | Clic en el pin o en su nombre.                                                        | Toque en el pin o en su nombre.                         |
| Mover un pin o su nombre                 | Mantener 250 ms y arrastrar el pin o el nombre.                                       | Mantener 250 ms y arrastrar con un dedo.                |
| Cambiar la escala de un pin              | Seleccionarlo y arrastrar su tirador.                                                 | Seleccionarlo y arrastrar el tirador con un dedo.       |
| Editar un pin                            | Doble clic en el pin o su nombre.                                                     | Doble toque en menos de 350 ms.                         |
| Abrir la paleta del nombre               | Enfocar el nombre y pulsar `Enter` o `Espacio`.                                       | —                                                       |
| Mover una nota rápida                    | Mantener 250 ms sobre su cabecera y arrastrar.                                        | Mantener 250 ms y arrastrar la cabecera.                |
| Cambiar el tamaño de una nota            | Seleccionarla y arrastrar su tirador.                                                 | Seleccionarla y arrastrar el tirador.                   |
| Editar una nota rápida                   | Clic en el texto; salir del campo confirma la edición. `Escape` descarta el borrador. | Toque en el texto; salir del campo confirma la edición. |
| Mover o redimensionar la imagen de fondo | Activar Ajustar imagen y arrastrar la imagen o sus tiradores.                         | Activar Ajustar imagen y arrastrar con un dedo.         |
| Cambiar de herramienta con teclado       | Flechas izquierda/derecha; `Inicio` / `Fin` en el grupo de herramientas.              | —                                                       |

Mover pines, nombres y notas requiere Seleccionar/mover. Sus tiradores no necesitan la espera de 250 ms. El arrastre no debe ejecutar además la acción de clic.

### Mapa y base cartográfica del Plano operativo

| Acción                           | PC                                                                                     | Android                                              |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Desplazar la cartografía         | Arrastrar el mapa con el botón izquierdo.                                              | Arrastrar el mapa con un dedo.                       |
| Cambiar el zoom geográfico       | Rueda sobre el mapa, o botones Acercar/Alejar.                                         | Pellizco de dos dedos, o botones Acercar/Alejar.     |
| Acercar con doble pulsación      | Doble clic sobre el mapa. `Mayús + doble clic` aleja.                                  | Doble toque sobre el mapa, gestionado por Leaflet.   |
| Acercar a una zona rectangular   | `Mayús + arrastrar` sobre el mapa.                                                     | —                                                    |
| Navegar con el mapa enfocado     | Flechas para desplazar; `+` / `−` para zoom. `Mayús` amplía el paso.                   | —                                                    |
| Seleccionar una coordenada       | Clic en el mapa. Cerca de un GPX visible se selecciona el punto próximo del recorrido. | Toque en el mapa, con el mismo ajuste al GPX.        |
| Buscar un lugar o coordenadas    | Escribir en el buscador y pulsar `Enter`.                                              | Escribir y enviar el formulario desde el teclado.    |
| Cerrar buscador o paneles        | `Escape` dentro del panel correspondiente.                                             | Tocar su control de cierre.                          |
| Seleccionar un marcador          | Clic en el marcador o su fila.                                                         | Toque en el marcador o su fila.                      |
| Mover un marcador                | Arrastrarlo; con foco, también mediante flechas.                                       | Arrastrarlo con un dedo.                             |
| Editar el nombre del marcador    | Pulsar Editar marcador; `Enter`, `Escape` o salir del campo terminan la edición.       | Tocar Editar marcador y salir del campo al terminar. |
| Desplazar la lista de marcadores | Arrastrar la lista; un arrastre no selecciona una fila al soltar.                      | Deslizar la lista con un dedo.                       |
| Seleccionar un GPX de la lista   | Clic en su nombre.                                                                     | Toque en su nombre.                                  |

Leaflet recibe los gestos que empiezan en la cartografía. Su zoom no es el porcentaje de zoom del módulo. Los modos de dibujo o colocación del Plano operativo tienen sus propias interacciones.

### Perfil GPX

| Acción                              | PC                                                                      | Android                             |
| ----------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Abrir o cerrar el perfil            | Clic en Perfil GPX; `Escape` también lo cierra desde su interior.       | Toque en Perfil GPX.                |
| Seleccionar una posición del perfil | Clic en un punto del gráfico, sin arrastrar.                            | Toque en el gráfico, sin arrastrar. |
| Recorrer las muestras con teclado   | Flechas; `Inicio` / `Fin` para extremos; `RePág` / `AvPág` para saltos. | —                                   |

La selección por pulsación se cancela al desplazar el puntero más de 5 px. El perfil no implementa selección continua por arrastre.

### Recursos y trazos del Plano operativo

| Acción                             | PC                                                                  | Android                                               |
| ---------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Seleccionar un recurso             | En modo Seleccionar, clic en el pin; con foco, `Enter` o `Espacio`. | En modo Seleccionar, toque en el pin.                 |
| Mover un recurso o su nombre       | En modo Seleccionar, arrastrar el pin o su nombre.                  | Arrastrar con un dedo en ese modo.                    |
| Cambiar la escala de un recurso    | Arrastrar su tirador; con foco en el tirador, usar flechas.         | Arrastrar el tirador con un dedo.                     |
| Ajustar posición con teclado       | Flechas sobre el pin o su nombre.                                   | —                                                     |
| Abrir el editor del recurso        | Doble clic en el pin o nombre; también Modificar recurso.           | Tocar Modificar recurso con el recurso seleccionado.  |
| Colocar un recurso                 | Activar Colocar pin y hacer clic en el mapa, sin arrastrar.         | Activar Colocar pin y tocar el mapa.                  |
| Dibujar un trazo                   | Activar Dibujar, arrastrar y soltar.                                | Activar Dibujar, arrastrar con un dedo y levantarlo.  |
| Borrar un trazo                    | En Borrar trazo, clic sobre el trazo, sin arrastrar.                | En Borrar trazo, toque sobre el trazo.                |
| Cancelar una manipulación en curso | `Escape` en las interacciones del plano.                            | Añadir un segundo dedo cancela la manipulación local. |

El traslado de pines y nombres del plano no utiliza la espera de 250 ms de Pizarra. El segundo dedo interrumpe un trazo sin guardar su borrador.

### Cuaderno y fichas de Información

| Acción                               | PC                                                                       | Android                                 |
| ------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------- |
| Reordenar un bloque del Cuaderno     | Arrastrar su franja de arrastre. Con foco en ella, flechas arriba/abajo. | Arrastrar la franja con un dedo.        |
| Desplazar la lista al reordenar      | Llevar el bloque hacia el borde superior o inferior del listado.         | Llevarlo con el dedo hacia esos bordes. |
| Marcar un elemento de checklist      | Clic en su casilla; `Espacio` con la casilla enfocada.                   | Toque en la casilla.                    |
| Seleccionar una ficha de Información | Clic en la identidad o en una zona de la tarjeta sin otro control.       | Toque en esa zona.                      |
| Expandir la información de una ficha | Clic en su control Expandir/Contraer.                                    | Toque en ese control.                   |

### Campos, atajos y temporizadores

| Acción                                            | PC                                                                                   | Android                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Guardar el UIBoard                                | `Ctrl + S`, cuando el flujo de archivo lo permite.                                   | Tocar Guardar en Archivo.                                     |
| Validar coordenadas                               | `Enter` en el campo o botón Validar coordenadas.                                     | Enviar el campo o tocar Validar coordenadas.                  |
| Copiar coordenadas o enlace Maps                  | Clic en la fila; también `Enter` o `Espacio` con foco en ella.                       | Toque en la fila.                                             |
| Calcular una expresión                            | `Enter` o `=` en el campo de operación; también botón `=`.                           | Enviar el formulario o tocar `=`.                             |
| Añadir una entrada al Registro                    | Escribir y pulsar `Enter` en Acontecimiento.                                         | Escribir y enviar el campo desde el teclado.                  |
| Terminar la edición de una anotación de Operativo | `Enter` sin Mayús o `Escape`.                                                        | Tocar el control Terminar edición.                            |
| Añadir o cerrar la edición de una etiqueta        | `Enter` envía la etiqueta; `Escape` sale del editor.                                 | Tocar Agregar etiqueta o su control de edición.               |
| Introducir una duración                           | Escribir o pegar dígitos en el campo `hh:mm:ss`; salir del campo normaliza el valor. | Usar el teclado numérico; salir del campo normaliza el valor. |
| Reconocer una alarma de Reloj                     | Clic en el tiempo o en la zona de su fila que no sea otro control.                   | Toque en el tiempo o esa zona de la fila.                     |

### Diálogos y encuadres de Informes

| Acción                                 | PC                                                                                  | Android                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cerrar un diálogo                      | `Escape` cuando el diálogo permite cerrar; también su control de cierre o Cancelar. | Tocar el control de cierre o Cancelar disponible.                        |
| Navegar por la cartografía del informe | En Área seleccionada: arrastre, rueda y controles geográficos.                      | En Área seleccionada: arrastre con un dedo y pellizco.                   |
| Mover el área seleccionada del informe | Arrastrar el interior del rectángulo.                                               | Arrastrarlo con un dedo.                                                 |
| Cambiar el tamaño del área             | Arrastrar uno de los cuatro tiradores de esquina.                                   | Arrastrar un tirador con un dedo.                                        |
| Ajustar área con teclado               | Flechas sobre el área o una esquina; `Mayús` pasa de 1 a 10 px.                     | —                                                                        |
| Cancelar el ajuste del área            | `Escape` o pérdida de foco de la ventana recuperan el área inicial.                 | Un segundo puntero o la cancelación del toque recuperan el área inicial. |

En Informes, Vista actual y Contenido seleccionado no habilitan la navegación manual del visor cartográfico. Los tiradores de área también se utilizan para el encuadre de Pizarra.

### Cancelación táctil y prioridades

| Situación                                                | Comportamiento                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Aparece un segundo dedo fuera del mapa                   | Cancela el arrastre o edición geométrica en curso y entrega la interacción al zoom del escritorio o del módulo activo. |
| Aparece un segundo dedo en el mapa                       | Impide continuar el arrastre con un dedo y su selección residual; el zoom táctil corresponde a Leaflet.                |
| Aparece un tercer dedo                                   | Cancela el gesto hasta levantar todos los dedos.                                                                       |
| Queda un solo dedo tras un gesto múltiple                | No reanuda la manipulación anterior. Hay que terminar la secuencia y empezar otra.                                     |
| Termina un arrastre o una consulta mantenida de ayuda    | Se evita que el clic residual active además el control.                                                                |
| Se mueve un control de repetición o interviene otro dedo | Se detiene la repetición del ajuste.                                                                                   |

### Referencias de implementación

| Zona                         | Código                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escritorio, zoom y ventanas  | [useViewportGestures](../src/layout/useViewportGestures.ts), [ModuleFrame](../src/layout/ModuleFrame.tsx), [DashboardGrid](../src/layout/DashboardGrid.tsx), [ZoomControl](../src/layout/ZoomControl.tsx) |
| Ayudas y pulsación mantenida | [HelpTooltip](../src/components/ui/tooltip/tooltip.tsx)                                                                                                                                                   |
| Elementos y editor           | [ElementsModule](../src/features/elements/ElementsModule.tsx), [ElementEditor](../src/features/elements/ElementEditor.tsx)                                                                                |
| Pizarra, pines y notas       | [BoardModule](../src/features/board/BoardModule.tsx), [BoardPin](../src/features/elements/BoardPin.tsx), [QuickNote](../src/features/board/QuickNote.tsx)                                                 |
| Mapa, marcadores y perfil    | [MapModule](../src/features/map/MapModule.tsx), [MapMarkers](../src/features/map/MapMarkers.tsx), [GpxElevationProfile](../src/features/map/GpxElevationProfile.tsx)                                      |
| Plano operativo              | [PlanDrawing](../src/features/plan/PlanDrawing.tsx), [PlanPins](../src/features/plan/PlanPins.tsx)                                                                                                        |
| Reordenación del Cuaderno    | [useNotebookReorder](../src/features/notebook/useNotebookReorder.ts)                                                                                                                                      |
| Área de informe              | [ReportMapArea](../src/features/document/ReportMapArea.tsx), [ReportMap](../src/features/document/ReportMap.tsx)                                                                                          |

## Botones

{…} indica texto variable

| Botón / texto visible                                  | Módulo o ubicación                                           |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Archivo                                                | Barra principal                                              |
| Nuevo UIBoard                                          | Archivo                                                      |
| Abrir UIBoard…                                         | Archivo                                                      |
| Guardar                                                | Archivo                                                      |
| Guardar como…                                          | Archivo                                                      |
| Cambiar nombre…                                        | Archivo                                                      |
| Cerrar UIBoard                                         | Archivo                                                      |
| Recuperar UIBoard…                                     | Archivo                                                      |
| Descargar JSON                                         | Archivo                                                      |
| Elegir carpeta de trabajo                              | Archivo                                                      |
| Permisos                                               | Archivo                                                      |
| Módulos                                                | Barra principal                                              |
| Pizarra                                                | Menú Módulos                                                 |
| Elementos                                              | Menú Módulos                                                 |
| Dotaciones                                             | Menú Módulos                                                 |
| Información                                            | Menú Módulos                                                 |
| Operativo                                              | Menú Módulos                                                 |
| Coordenadas                                            | Menú Módulos                                                 |
| Mapa                                                   | Menú Módulos                                                 |
| Plano operativo                                        | Menú Módulos                                                 |
| Reloj                                                  | Menú Módulos                                                 |
| Calculadora                                            | Menú Módulos                                                 |
| Cuaderno                                               | Menú Módulos                                                 |
| Registro                                               | Menú Módulos                                                 |
| Informes                                               | Menú Módulos                                                 |
| Vista                                                  | Barra principal                                              |
| Columnas                                               | Vista                                                        |
| Colapsados en filas                                    | Vista                                                        |
| Colapsados en columnas                                 | Vista                                                        |
| Distribución automática                                | Vista                                                        |
| Ajustar módulo activo al contenido                     | Vista                                                        |
| Configurar columnas…                                   | Vista                                                        |
| Cancelar                                               | Vista → Configurar columnas                                  |
| Aceptar                                                | Vista → Configurar columnas                                  |
| Limpieza                                               | Barra principal                                              |
| Limpiar módulo activo                                  | Limpieza                                                     |
| Limpiar y cerrar módulo activo                         | Limpieza                                                     |
| Limpiar todos                                          | Limpieza                                                     |
| Limpiar y cerrar todos                                 | Limpieza                                                     |
| Cancelar                                               | Confirmación de limpieza                                     |
| Limpiar / Limpiar y cerrar                             | Confirmación de limpieza                                     |
| Carpeta de trabajo                                     | Nuevo UIBoard, si falla la operación                         |
| Aceptar / Preparando…                                  | Nuevo UIBoard                                                |
| Cancelar                                               | Nuevo UIBoard                                                |
| Carpeta de trabajo                                     | Cambiar nombre, si falla la operación                        |
| Aceptar / Preparando…                                  | Cambiar nombre                                               |
| Cancelar                                               | Cambiar nombre                                               |
| Carpeta de trabajo                                     | Guardar como, si falla la operación                          |
| Aceptar / Preparando…                                  | Guardar como                                                 |
| Cancelar                                               | Guardar como                                                 |
| Guardar y continuar                                    | Aviso de cambios sin guardar                                 |
| Continuar sin guardar                                  | Aviso de cambios sin guardar                                 |
| Cancelar                                               | Aviso de cambios sin guardar                                 |
| Reintentar / Consultando…                              | Recuperar UIBoard                                            |
| Carpeta de trabajo                                     | Recuperar UIBoard                                            |
| `{nombre} · {fecha} · Carpeta/Dispositivo`             | Recuperar UIBoard; uno por versión                           |
| Abrir recuperación en rama                             | Recuperar UIBoard                                            |
| Reintentar                                             | Aviso de error de guardado en carpeta                        |
| Carpeta de trabajo                                     | Aviso de error de guardado en carpeta                        |
| Abrir recuperación en rama                             | Aviso de cambios en otra pestaña                             |
| Reintentar recuperación local                          | Aviso de recuperación local no disponible                    |
| Descargar JSON                                         | Aviso de recuperación local no disponible                    |
| Continuar                                              | Recuperación de la última sesión                             |
| Ir al inicio                                           | Recuperación de la última sesión                             |
| Reintentar                                             | Aviso «No se pudo guardar el trabajo actual»                 |
| Descargar JSON                                         | Aviso «No se pudo guardar el trabajo actual»                 |
| Cancelar                                               | Aviso «No se pudo guardar el trabajo actual»                 |
| Autorizar                                              | Permisos → Almacenamiento persistente                        |
| Elegir carpeta de trabajo                              | Permisos → Carpeta de trabajo                                |
| Autorizar acceso / Reintentar                          | Permisos → Carpeta de trabajo                                |
| Descargar JSON                                         | Permisos → Carpeta de trabajo, si no está disponible o falla |
| Continuar                                              | Permisos → Carpeta de trabajo, sin acceso concedido          |
| Elegir carpeta de trabajo                              | Diálogo Carpeta de trabajo                                   |
| Autorizar acceso / Reintentar                          | Diálogo Carpeta de trabajo                                   |
| Descargar JSON                                         | Diálogo Carpeta de trabajo, si no está disponible o falla    |
| Continuar                                              | Diálogo Carpeta de trabajo, sin acceso concedido             |
| Crear / Guardar                                        | Elementos                                                    |
| Aplicar                                                | Elementos → Editor                                           |
| Atrás                                                  | Elementos → Editor                                           |
| `{nombre del elemento}`                                | Elementos; uno por elemento                                  |
| Aa                                                     | Elementos → Color negro/blanco                               |
| Aa                                                     | Elementos → Color blanco/negro                               |
| Aa                                                     | Elementos → Color amarillo/negro                             |
| Aa                                                     | Elementos → Color azul/blanco                                |
| Aa                                                     | Elementos → Color verde/blanco                               |
| Aa                                                     | Elementos → Color rojo/blanco                                |
| Crear / Guardar                                        | Dotaciones                                                   |
| Aplicar                                                | Dotaciones → Editor                                          |
| Atrás                                                  | Dotaciones → Editor                                          |
| `{nombre de la dotación}`                              | Dotaciones; uno por dotación                                 |
| Aa                                                     | Dotaciones → Color negro/blanco                              |
| Aa                                                     | Dotaciones → Color blanco/negro                              |
| Aa                                                     | Dotaciones → Color amarillo/negro                            |
| Aa                                                     | Dotaciones → Color azul/blanco                               |
| Aa                                                     | Dotaciones → Color verde/blanco                              |
| Aa                                                     | Dotaciones → Color rojo/blanco                               |
| `{nombre del recurso}`                                 | Pizarra → Nombre del pin; uno por recurso                    |
| Negro / blanco                                         | Pizarra → Paleta del nombre                                  |
| Blanco / negro                                         | Pizarra → Paleta del nombre                                  |
| Amarillo / negro                                       | Pizarra → Paleta del nombre                                  |
| Azul / blanco                                          | Pizarra → Paleta del nombre                                  |
| Verde / blanco                                         | Pizarra → Paleta del nombre                                  |
| Rojo / blanco                                          | Pizarra → Paleta del nombre                                  |
| `{nombre del recurso}`                                 | Información; uno por recurso                                 |
| Disponible / DISP                                      | Operativo                                                    |
| Activada / ACT                                         | Operativo                                                    |
| Aproximandose / RUTA                                   | Operativo                                                    |
| Interviniendo / ASIS                                   | Operativo                                                    |
| Trasladando / TRAS                                     | Operativo                                                    |
| Transfiriendo / ENTR                                   | Operativo                                                    |
| Operativa / REAC                                       | Operativo                                                    |
| Inoperativa / BLK                                      | Operativo                                                    |
| Personalizado / `{anotación}` / PER                    | Operativo                                                    |
| Etiqueta / `{texto de etiqueta}` / ETQ                 | Operativo                                                    |
| DD y `{resultado}`                                     | Coordenadas → Fila pulsable para copiar                      |
| DMS y `{resultado}`                                    | Coordenadas → Fila pulsable para copiar                      |
| DMM y `{resultado}`                                    | Coordenadas → Fila pulsable para copiar                      |
| UTM y `{resultado}`                                    | Coordenadas → Fila pulsable para copiar                      |
| Maps y `www.google.com/maps/...`                       | Coordenadas → Fila pulsable para copiar                      |
| OpenStreetMap                                          | Mapa → Fondo del mapa                                        |
| Foto aérea PNOA                                        | Mapa → Fondo del mapa                                        |
| Topográfico IGN                                        | Mapa → Fondo del mapa                                        |
| Información                                            | Mapa → Fondo PNOA                                            |
| Ver GPX                                                | Mapa → Aviso de GPX pendientes                               |
| `{lugar} · {dirección} · {coordenadas}`                | Mapa → Resultados de búsqueda; uno por resultado             |
| `{nombre del marcador}` / Marcador                     | Mapa → Lista de marcadores                                   |
| PK                                                     | Mapa → Controles GPX                                         |
| `{nombre del archivo}` / `{nombre} · Pendiente`        | Mapa → Lista GPX                                             |
| Perfil GPX                                             | Mapa → Perfil de elevación                                   |
| Ampliar / Ajustar                                      | Mapa → Leyenda de IGNBaseOrto                                |
| Ampliar / Ajustar                                      | Mapa → Leyenda topográfica con imagen                        |
| OpenStreetMap                                          | Plano operativo → Fondo del mapa                             |
| Foto aérea PNOA                                        | Plano operativo → Fondo del mapa                             |
| Topográfico IGN                                        | Plano operativo → Fondo del mapa                             |
| Información                                            | Plano operativo → Fondo PNOA                                 |
| Ver GPX                                                | Plano operativo → Aviso de GPX pendientes                    |
| `{lugar} · {dirección} · {coordenadas}`                | Plano operativo → Resultados de búsqueda                     |
| `{nombre del marcador}` / Marcador                     | Plano operativo → Lista de marcadores                        |
| PK                                                     | Plano operativo → Controles GPX                              |
| `{nombre del archivo}` / `{nombre} · Pendiente`        | Plano operativo → Lista GPX                                  |
| Perfil GPX                                             | Plano operativo → Perfil de elevación                        |
| Ampliar / Ajustar                                      | Plano operativo → Leyenda de IGNBaseOrto                     |
| Ampliar / Ajustar                                      | Plano operativo → Leyenda topográfica con imagen             |
| `{nombre del recurso}`                                 | Plano operativo → Nombre del pin                             |
| Cancelar                                               | Plano operativo → Confirmación de borrado                    |
| Borrar trazos                                          | Plano operativo → Confirmación de borrado                    |
| Activar sonido                                         | Reloj → Aviso de sonido bloqueado                            |
| Reintentar / Recargar temporizadores                   | Reloj → Aviso de almacenamiento                              |
| `{tiempo hh:mm:ss}`                                    | Reloj → Reconocer una alerta activa                          |
| C                                                      | Calculadora                                                  |
| (                                                      | Calculadora                                                  |
| )                                                      | Calculadora                                                  |
| 7                                                      | Calculadora                                                  |
| 8                                                      | Calculadora                                                  |
| 9                                                      | Calculadora                                                  |
| ÷                                                      | Calculadora                                                  |
| 4                                                      | Calculadora                                                  |
| 5                                                      | Calculadora                                                  |
| 6                                                      | Calculadora                                                  |
| ×                                                      | Calculadora                                                  |
| 1                                                      | Calculadora                                                  |
| 2                                                      | Calculadora                                                  |
| 3                                                      | Calculadora                                                  |
| −                                                      | Calculadora                                                  |
| %                                                      | Calculadora                                                  |
| 0                                                      | Calculadora                                                  |
| ,                                                      | Calculadora                                                  |
| +                                                      | Calculadora                                                  |
| =                                                      | Calculadora                                                  |
| Nota                                                   | Cuaderno                                                     |
| Checklist                                              | Cuaderno                                                     |
| Guardar entrada                                        | Registro → Editor de entrada                                 |
| Cancelar                                               | Registro → Editor de entrada                                 |
| Generar vista previa / Actualizar informe / Generando… | Informes                                                     |
| Guardar informe / Guardando…                           | Informes                                                     |
| Imprimir / PDF                                         | Informes                                                     |
| Descargar informe                                      | Informes                                                     |
| Reintentar                                             | Informes; uno por recurso con incidencia                     |
| Omitir                                                 | Informes; uno por recurso con incidencia                     |
| Carpeta de trabajo                                     | Informes → Aviso de carpeta                                  |

## Avisos de alerta, estado y ayuda

- Las ayudas HelpTooltip se muestran al pasar el ratón, recibir foco o mantener pulsado aproximadamente 800 ms. 
- Las ayudas title dependen del navegador. 
- Agrupo en una misma fila los textos que comparten activación.
