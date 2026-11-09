# Development Guide

- Guía de estilo de la interfaz
- Cómo crear ramas, hacer commits y abrir PRs

## Convenciones de estado

| Término             | Significado                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| Sí                  | La función o característica está prevista.                              |
| No                  | La función o característica está expresamente descartada para ese caso. |
| No aplica           | La propiedad no corresponde al elemento descrito.                       |
| Pendiente           | Falta concretar el valor o resolver su significado. No equivale a «No». |
| Propuesta           | Existe una alternativa concreta, todavía por decidir.                   |
| Según la base común | Se utiliza la regla compartida indicada, sin una variante propia.       |
| Padding 2 valores   | Primer valor top y bottom; Segundo valor right y left.                  |
| Padding 4 valores   | Arriba; Derecha; Abajo; Izquierda.                                      |

## Glosario

| Término               | Definición                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Padding               | Espacio interior entre el borde y el contenido. Se aplica una sola vez sobre el mismo contenido.                                                                           |
| Separación            | Espacio entre dos elementos o grupos. No duplica el padding interior.                                                                                                      |
| Barra de título       | Barra superior con el nombre del módulo y las acciones de ventana.                                                                                                         |
| Barra de herramientas | Barra interior con las herramientas propias del módulo. En versiones anteriores de esta guía se denomina SectionHeader; no existe un componente compartido con ese nombre. |
| Barra inferior        | Zona de zoom, ajuste automático y acceso al redimensionado.                                                                                                                |
| Tamaño básico         | Tamaño al crear o restaurar una ventana. Su altura puede ser fija o calcularse según el contenido.                                                                         |
| Ajuste automático     | Función que adapta el ancho y la altura cuando cambia el contenido. Es independiente del cálculo inicial del tamaño básico.                                                |
| Reparto flexible      | Distribución del espacio adicional entre los contenedores que pueden crecer. No exige que todos los controles crezcan ni determina por sí sola una técnica CSS.            |
| Icono visible         | Dibujo mostrado dentro de un control. Su tamaño es distinto del tamaño del botón y de su superficie accionable.                                                            |

## Tipografía y espacios

| Propiedad                                            | Regla                                                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Fuente general                                       | Roboto Condensed.                                                                                                    |
| Fuentes alternativas                                 | Si la fuente principal no está disponible, se utiliza la fuente del sistema del dispositivo.                         |
| Texto general, etiquetas, controles y datos técnicos | Tamaño de fuente de 13.                                                                                              |
| Títulos de contenido                                 | Tamaño de fuente de 16.                                                                                              |
| Avisos Sonner                                        | Tamaño de fuente de 13.                                                                                              |
| Números del módulo Reloj                             | Rajdhani para horas y temporizadores; Hora principal se adapta al contenedor.                                        |
| Padding entre elementos                              | 4px                                                                                                                  |
| Padding entre grupos de contenido                    | 6px                                                                                                                  |
| Padding de campo                                     | 0px 2px                                                                                                              |
| Padding de boton de texto                            | 0px 2px                                                                                                              |
| Peso tipográfico y altura de línea                   | Se conservan los valores del CSS Module propietario de cada componente, salvo las excepciones expresas de esta guía. |

## Colores y superficies

| Función                        | Color o acabado                          |
| ------------------------------ | ---------------------------------------- |
| Fondo de escritorio            | #0C0C0C                                  |
| Fondo de ventana               | #181818                                  |
| Fondo de campo                 | #111111                                  |
| Fondo de barra inferior        | #181818                                  |
| Fondo de opción activa         | #303030                                  |
| Botón                          | Degradado de #333333 a #252525           |
| Botón hover                    | Degradado de #404040 a #303030           |
| Barra de título                | Degradado de #383838 a #2C2C2C a #222222 |
| Barra de herramientas          | Degradado de #2E2E2E a #1D1D1D           |
| Texto principal                | #F2F2F2                                  |
| Texto secundario y de ejemplo  | #ADADAD                                  |
| Borde de ventana               | #484848                                  |
| Borde de campo                 | #555555                                  |
| Borde de botón y separadores   | #3D3D3D                                  |
| Separador de barra de título   | #080808                                  |
| Acento de selección            | #D63A3A80                                |
| Acento de selección 2 (neutro) | #D6D6D280                                |

- Los acentos de selección identifican casillas marcadas, opciones activas y bordes de selección donde corresponda. Se mantienen las variantes roja y neutra para evitar que todas las selecciones utilicen rojo y este pierda su capacidad de resaltar.
- Input y Textarea no muestran contorno al recibir el foco.
- Los diálogos de Archivo y Configuración suprimen los contornos de foco de sus controles.

## Estados operativos

| Nombre        | Indicador                | Significado                                    |
| ------------- | ------------------------ | ---------------------------------------------- |
| Disponible    | 🟢 Verde #16c60c          | Recurso preparado en su punto de cobertura.    |
| Activada      | 🟡 Amarillo #fff100       | Recurso activado ante un aviso prioritario.    |
| Aproximándose | 🔵 Azul #0078d7           | En ruta al aviso.                              |
| Interviniendo | 🔴 Rojo #e81224           | Asistencia e intervención en el aviso.         |
| Trasladando   | 💠 Se conserva el símbolo | Paciente en traslado al centro de destino.     |
| Transfiriendo | 🟠 Naranja #f7630c        | Transferencia del paciente al equipo receptor. |
| Operativa     | 🟢 Verde #16c60c          | Reactivación y retorno al punto de cobertura.  |
| Inoperativa   | ⚫ Gris oscuro #383838    | Recurso temporalmente fuera de servicio.       |
| Personalizado | ⚪ Personalizable         | Sin significado                                |

## Campos y controles

| Elemento                        | Componente o selector                             | Ancho                    | Alto | Padding | Font Name        | Font Size | Fondo    | Borde | Radio |
| ------------------------------- | ------------------------------------------------- | ------------------------ | ---- | ------- | ---------------- | --------- | -------- | ----- | ----- |
| Casilla de selección            | Checkbox                                          | 15px                     | 15px | 0       | No aplica        | No aplica | De campo | 1     | 3     |
| Selector desplegable            | Select                                            | Según contenido          | 25px | 0px 2px | Roboto Condensed | 13        | De campo | 1     | 3     |
| Botón de solo icono             | Button con variant="icon";                        | 25px                     | 25px | 0       | No aplica        | No aplica | No       | No    | 3     |
| Botón de texto o icono y texto  | Button con variant="text";                        | Según contenido          | 25px | 0px 2px | Roboto Condensed | 13        | De botón | 1     | 3     |
| Campo de texto de una línea     | Input                                             | Según contenido previsto | 25px | 0px 2px | Roboto Condensed | 13        | De campo | 1     | 3     |
| Campo de duración               | DurationInput, construido sobre Input             | Según contenido          | 25px | 0px 2px | Rajdhani         | 13        | De campo | 1     | 3     |
| Campo de texto de varias líneas | Textarea                                          | Según contenido previsto | 25px | 0px 2px | Roboto Condensed | 13        | De campo | 1     | 3     |
| Campo numérico                  | Input con type="number"                           | Según contenido previsto | 25px | 0px 2px | Roboto Condensed | 13        | De campo | 1     | 3     |
| Campo de fecha, mes u hora      | Input con type="date", type="month" o type="time" | Según contenido          | 25px | 0px 2px | Roboto Condensed | 13        | De campo | 1     | 3     |

- Acabados de botón de solo icono:
    - **Normal:** transparente y sin marco visible en reposo; al pasar el puntero muestra el acabado común de interacción.
    - **Integrado:** forma parte de otro control y mantiene fondo transparente y ausencia de marco; al interactuar cambia el aspecto del icono.

## Contenido e indicadores

| Elemento                           | Componente o selector                                      | Ancho              | Alto            | Padding | Font Name        | Font Size | Fondo    | Borde | Radio |
| ---------------------------------- | ---------------------------------------------------------- | ------------------ | --------------- | ------- | ---------------- | --------- | -------- | ----- | ----- |
| Icono visible                      | Componentes de lucide-react con clase .lucide              | 15px               | 15px            | 0       | No aplica        | No aplica | No       | No    | No    |
| Título de contenido                | h3, strong y equivalentes; token --font-size-title         | Según contenido    | 15px            | 0       | Roboto Condensed | 16        | No       | No    | No    |
| Nombre de tarjeta de Información   | .information-name; token --font-size-title                 | Según contenido    | 15px            | 0       | Roboto Condensed | 16        | No       | No    | No    |
| Contenedor del texto               | `span` interior de otro contenedor; token --font-size-body | Según contenido    | 17px            | 0       | Roboto Condensed | 13        | No       | No    | No    |
| Dato técnico                       | .technical-data; token --font-size-technical               | Según contenido    | 17px            | 0px 2px | Roboto Condensed | 13        | No       | No    | No    |
| Indicador de estado de Información | Badge con clase .information-status                        | Según distribución | 17px            | 0px 2px | Roboto Condensed | 13        | De botón | 1     | 3     |
| Fila de estado operativo           | Button con clase .operations-state; .operations-custom-row | Según distribución | 17px            | 0px 2px | Roboto Condensed | 13        | De botón | 1     | 3     |
| Fila de contenido                  | .element-row en [elements.module.css]                      | Según contenido    | 17px            | 0px 2px | Roboto Condensed | 13        | No       | No    | No    |
| Tarjeta de contenido               | .information-card en [information.module.css]              | Según contenido    | 17px            | 0px 2px | Roboto Condensed | 13        | No       | No    | No    |
| Hora principal                     | ClockModule; .clock-esp                                    | Según contenido    | Según contenido | 0px 2px | Rajdhani         | Adaptable | No       | No    | No    |
| Temporizadores                     | TimerRow; .timer-value                                     | Según contenido    | 17px            | 0px 2px | Rajdhani         | 13        | No       | No    | No    |
| Hora Zulu                          | ClockModule; .clock-zulu output                            | Según contenido    | 17px            | 0px 2px | Rajdhani         | 13        | No       | No    | No    |

## Estructura de las ventanas

| Elemento              | Componente o selector                                  | Ancho              | Alto   | Padding          | Font Name        | Font Size | Fondo                    | Borde                      | Radio |
| --------------------- | ------------------------------------------------------ | ------------------ | ------ | ---------------- | ---------------- | --------- | ------------------------ | -------------------------- | ----- |
| Marco de ventana      | ModuleFrame; clase y data-slot module-frame            | Modulo             | Modulo | No               | No aplica        | No aplica | Fondo de ventana         | 1                          | 3     |
| Barra inferior        | div de ModuleFrame; clase y data-slot module-controls  | Según ventana      | 25px   | 0px 27px 0px 2px | Roboto Condensed | 13        | Fondo de barra inferior  | No                         | Marco |
| Barra de título       | header de ModuleFrame; clase y data-slot module-header | Según ventana      | 27px   | 0px 2px          | Roboto Condensed | 13        | Fondo de barra de título | Separador de 1 a contenido | Marco |
| Barra de herramientas | toolbarStyles.base en moduleToolbar.module.css         | Según distribución | 27px   | 3px 5px          | Roboto Condensed | 13        | Fondo de herramientas    | Separador de 1 a contenido | Marco |

## Tamaños y comportamiento por módulo

| Módulo          | Ancho | Alto            | Colapsado  | Contraido | Max Auto. | Barra Herr. |
| --------------- | ----- | --------------- | ---------- | --------- | --------- | ----------- |
| Pizarra         | 510px | 420px           | 510 × 27px | 27 x 27px | No        | Sí          |
| Mapa            | 510px | 420px           | 510 × 27px | 27 x 27px | No        | Sí          |
| Plano operativo | 510px | 420px           | 510 × 27px | 27 x 27px | No        | Sí          |
| Informes        | 240px | Según contenido | 240 × 27px | 27 x 27px | No        | Si          |
| Calculadora     | 240px | Según contenido | 240 × 27px | 27 x 27px | No        | Sí          |
| Elementos       | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | Sí          |
| Dotaciones      | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | Sí          |
| Registro        | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | Si          |
| Cuaderno        | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | Sí          |
| Información     | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | No          |
| Reloj           | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px     | No          |
| Coordenadas     | 240px | Según contenido | 240 × 27px | 27 x 27px | No        | No          |
| Calendario      | 240px | Según contenido | 240 × 27px | 27 x 27px | No        | No          |
| Operativo       | 150px | Según contenido | 150 × 27px | 27 x 27px | No        | No          |

### Reglas de tamaño

- **Tamaño:** Al crear un módulo o cerrarlo y abrirlo, o expandirlo desde barra o icono, vuelve al ancho y calcula la altura necesaria para su estructura, herramientas y datos presentes.
- **Recogido:** Mantiene las medidas de la tabla.
- **Icono:** Todos los módulos miden 27 × 27.
- **Según contenido:** Se refiere a este cálculo inicial, que no implica autoajuste continuo.
- **Sin datos:** Ocupa lo necesario para estructura y herramientas.

- **Autoajuste:** Solo está disponible en los módulos que lo admiten. Cuando está activo, adapta el ancho y la altura a los cambios de contenido, respetando el ancho y los límites automáticos. Su control actúa sobre ambas dimensiones.
    - **Max Auto.:** Al alcanzarlo, el contenido adicional utiliza desplazamiento vertical. Con pocos datos, la ventana no tiene que alcanzar ese límite.
    - **Ancho automático:** Se calcula según el contenido y los controles, sin reducirse por debajo del ancho básico. Puede superar el espacio visible disponible; el escritorio se amplía para alojar la ventana. Los textos largos se parten o se desplazan según su función.

- **Redimensionado manual:** Permite superar la altura máxima automática y el ancho basico, desactiva el autoajuste hasta que el usuario lo reactive. Sus límites son independientes de los del crecimiento automático.
    - **Reducir:** Mantiene accesibles las herramientas y permite desplazar listas o textos, sin exigir que todo el contenido permanezca visible.
    - **Ampliar:** Las listas, áreas de texto, vistas y contenedores ampliables reciben el espacio según el reparto de cada módulo. Los controles de una línea conservan su altura.

## Especificaciones de UI y Componentes

### Sistema de Botones

- **Altura base:** 17px.
- **Composición:** Utilizan la variable CSS `--button-label-height` para mantener el alineamiento en textos multilínea sin romper el diseño. Los nodos de texto simples se agrupan en un `span` con `data-slot="button-label"`.

### Dimensiones de Módulos (Grid Layout)

- **Ancho básico estándar:**
    - 150px para `Operativo`.
    - 240px para `Informes`, `Calculadora`, `Elementos`, `Dotaciones`, `Registro`, `Cuaderno`, `Información`, `Reloj`, `Coordenadas`, `Calendario`.
    - 510px para `Pizarra`, `Mapa`, `Plano operativo`.

### Marcadores del Mapa (Leaflet)

- **Iconos (SVG):** Se renderizan como `L.divIcon` con dimensiones de 18 × 26 px.
- **Anclaje:** La punta inferior del marcador se ancla en las coordenadas `[9, 26]`.
- **Interacción:** El umbral de ajuste de píxeles (snap) para la selección de rutas GPX es de 14 píxeles.

## Límites de Entrada (InputBudgets)

Para garantizar la estabilidad de la aplicación y el rendimiento en el navegador, se aplican los siguientes límites antes de admitir contenido:

- **Gestos y Navegación:** El umbral para iniciar un arrastre (paneo) en el escritorio o mover pines es de 4px.
- **Archivos de Imagen:**
    - Límite de tamaño: 50 MiB [comprimidos].
    - Límite de dimensiones: Máximo 8192 píxeles por lado y un total de 16.777.216 píxeles. Las imágenes admitidas se reducen a 4096 píxeles en su lado mayor.
- **Archivos GPX:**
    - Límite de sesión: Máximo 20 archivos GPX simultáneos.
    - Límite de tamaño: Máximo 50 MiB en total.
    - Procesamiento: Las tareas se envían al Web Worker en lotes de 512 elementos para no bloquear el hilo principal.

## Contributing

- Este apartado define cómo crear ramas, hacer commits y abrir PRs.
