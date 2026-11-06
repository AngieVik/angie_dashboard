# Guía de estilo de la interfaz

## Propósito y estado

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

## Convenciones de medidas

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

## Convenciones de estado

| Término             | Significado                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| Sí                  | La función o característica está prevista.                              |
| No                  | La función o característica está expresamente descartada para ese caso. |
| No aplica           | La propiedad no corresponde al elemento descrito.                       |
| Pendiente           | Falta concretar el valor o resolver su significado. No equivale a «No». |
| Propuesta           | Existe una alternativa concreta, todavía por decidir.                   |
| Según la base común | Se utiliza la regla compartida indicada, sin una variante propia.       |

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

## Base visual compartida

### Tipografía y espacios

| Propiedad                                            | Regla                                                                                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuente general                                       | Roboto Condensed.                                                                                                                                                |
| Texto general, etiquetas, controles y datos técnicos | Tamaño de fuente de 13.                                                                                                                                          |
| Títulos de contenido                                 | Tamaño de fuente de 16; incluye nombres de Elementos/Dotaciones e Información, ubicación solar, recurso seleccionado del Plano y títulos de resultados del mapa. |
| Números del módulo Reloj                             | Rajdhani para horas y duraciones. Hora principal y temporizadores se adaptan al contenedor; Zulu utiliza 16 × zoom del módulo.                                   |
| Separación entre elementos                           | 4.                                                                                                                                                               |
| Separación entre grupos de contenido                 | 6.                                                                                                                                                               |
| Padding común de campos y botones de texto           | 2 por lado, aplicado una sola vez.                                                                                                                               |
| Cabeceras de módulo y avisos Sonner                  | Tamaño de fuente de 13, independiente del zoom del contenido.                                                                                                    |
| Peso tipográfico y altura de línea                   | Se conservan los valores del CSS Module propietario de cada componente, salvo las excepciones expresas de esta guía.                                             |
| Fuentes alternativas                                 | Si la fuente principal no está disponible, se utiliza la fuente del sistema del dispositivo.                                                                     |

### Colores y superficies

| Función                               | Color o acabado                                     |
| ------------------------------------- | --------------------------------------------------- |
| Fondo del escritorio                  | #0C0C0C                                             |
| Fondo de ventana                      | #181818                                             |
| Fondo de campos y casillas sin marcar | #111111                                             |
| Fondo de barra inferior               | #181818                                             |
| Botón en estado normal                | Degradado de #333333 a #252525                      |
| Botón al pasar el puntero             | Degradado de #404040 a #303030                      |
| Barra de título                       | Degradado de #383838 a #222222, pasando por #2C2C2C |
| Barra de herramientas                 | Degradado de #2E2E2E a #1D1D1D                      |
| Texto principal                       | #F2F2F2                                             |
| Texto secundario y de ejemplo         | #ADADAD                                             |
| Borde de ventana                      | #484848                                             |
| Borde de campo                        | #555555                                             |
| Borde de botón y separadores          | #3D3D3D                                             |
| Separador de barra de título          | #080808                                             |
| Acento de selección                   | #D63A3A80; 50 % de opacidad                         |
| Acento de selección 2 (neutro)        | #D6D6D280; 50 % de opacidad                         |
| Fondo de opción activa                | #303030                                             |

- Se conservan la personalidad industrial, el acabado oscuro y la composición compacta de Angie. Los colores se asignan por función y se comparten entre módulos.
- Los acentos de selección identifican casillas marcadas, opciones activas y bordes de selección donde corresponda. Se mantienen las variantes roja y neutra para evitar que todas las selecciones utilicen rojo y este pierda su capacidad de resaltar.
- **Pendiente:** completar el reparto de los acentos rojo y neutro por control o superficie donde no exista una regla expresa en esta guía. No se presupone que el rojo sea el acento de todas las selecciones.
- Los colores de acento ya incorporan aproximadamente un 50 % de opacidad en su hexadecimal; no se aplica una segunda reducción de opacidad.
- Los botones conservan su acabado compartido al pasar el puntero o pulsarlos. Los botones comunes muestran un contorno con el acento de selección correspondiente al recibir el foco del teclado; los integrados y el icono de la cabecera del módulo conservan su acabado sin contorno.
- Los campos mantienen su borde neutro, también con errores de validación. Input y Textarea no muestran contorno al recibir el foco; Select conserva el contorno neutro. Los diálogos de Archivo y Configuración suprimen los contornos de foco de sus controles y conservan los cambios de borde de sus botones. El foco no altera las dimensiones del control.

- Los colores de los estados operativos conservan su significado y se muestran con nombre e indicador. Su color no sustituye el acabado de selección del control:
    - **Disponible:**       verde `#16C60C`; recurso en su punto de cobertura, preparado para activación.
    - **Activada:**         amarillo `#FFF100`; recurso activado ante un aviso prioritario.
    - **Aproximándose:**    azul `#0078D7`; en ruta al incidente.
    - **Interviniendo:**    rojo `#E81224`; asistencia e intervención en el incidente.
    - **Trasladando:**      símbolo 💠; paciente en traslado al centro de destino. Se conserva el símbolo sin sustituirlo por un hexadecimal.
    - **Transfiriendo:**    naranja `#F7630C`; transferencia del paciente al equipo receptor.
    - **Operativa:**        verde `#16C60C`; reactivación y retorno al punto de cobertura.
    - **Inoperativa:**      gris oscuro `#383838`; recurso temporalmente fuera de servicio.
    - **Personalizado:**    nombre y color elegidos por el usuario.

## Componentes comunes

- Los campos, botones de acción y selectores de una línea comparten tamaño de fuente de 13, altura de 25, padding de 2 por lado, borde de 1 y radio de 3, salvo las excepciones expresas de la tabla. El ancho se adapta al contenido o al espacio disponible.

### Campos y controles

| Elemento                       | Componente o selector                                               | Dimensiones                                 | Padding    | Font Name        | Font Size | Fondo                     | Borde                       | Radio | Comportamiento                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------- | ---------- | ---------------- | --------- | ------------------------- | --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| Campo de texto de una línea    | Input                                                               | Altura 25; ancho según contenido previsto   | 2 por lado | Roboto Condensed | 13        | Fondo de campo            | 1, neutro                   | 3     |                                                                                                                  |
| Campo numérico                 | Input con type="number"                                             | Altura 25; ancho según el valor previsto    | 2 por lado | Roboto Condensed | 13        | Fondo de campo            | 1, neutro                   | 3     |                                                                                                                  |
| Campo de fecha, mes u hora     | Input con type="date", type="month" o type="time"                   | Altura 25; ancho según contenido            | 2 por lado | Roboto Condensed | 13        | Fondo de campo            | 1, neutro                   | 3     |                                                                                                                  |
| Selector desplegable           | Select                                                              | Altura 25; ancho según contenido            | 2 por lado | Roboto Condensed | 13        | Fondo de campo            | 1, neutro                   | 3     | Reserva espacio para la flecha.                                                                                  |
| Área de texto de varias líneas | Textarea                                                            | Altura inicial 25; ancho según distribución | 2 por lado | Roboto Condensed | 13        | Fondo de campo            | 1, neutro                   | 3     | Crece y/o se desplaza según su función; Alineación superior del texto                                            |
| Botón de texto o icono y texto | Button con variant="text"; también detecta el texto automáticamente | Altura 25; ancho según contenido            | 2 por lado | Roboto Condensed | 13        | Fondo de botón            | 1                           | 3     |                                                                                                                  |
| Botón de solo icono            | Button con variant="icon"; también lo detecta automáticamente       | 25 × 25                                     | 0          | No aplica        | No aplica | Transparente en reposo    | Sin marco visible en reposo | 3     | La selección permanece visible mientras la función esté activada.                                                |
| Casilla de selección           | Checkbox                                                            | 15 × 15                                     | 0          | No aplica        | No aplica | Fondo de campo sin marcar | 1                           | 3     | Sin estado parcial; el indicador ocupa el interior y su contenedor aporta la separación común respecto al texto. |
| Campo de duración              | DurationInput, construido sobre Input                               | Altura 25; ancho según el valor             | 2 por lado | Rajdhani         | 13        | Fondo de campo            | 1, neutro                   | 3     |                                                                                                                  |

- Acabados de botón de solo icono:
    - **Normal:** transparente y sin marco visible en reposo; al pasar el puntero muestra el acabado común de interacción.
    - **Integrado:** forma parte de otro control y mantiene fondo transparente y ausencia de marco; al interactuar cambia el aspecto del icono.

### Contenido e indicadores

| Elemento                           | Componente o selector                                                                                                                                                            | Dimensiones                                                    | Padding                                       | Font Name                | Font Size               | Fondo                                  | Borde                                        | Radio                             | Comportamiento                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- | ------------------------ | ----------------------- | -------------------------------------- | -------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Icono visible                      | Habitualmente componentes de lucide-react con clase .lucide                                                                                                                      | 15 × 15                                                        | 0                                             | No aplica                | No aplica               | Sin fondo propio                       | Sin borde propio                             | No aplica                         | La medida solamente se aplica a los iconos de interfaz.                                       |
| Indicador de estado de Información | Badge con clase .information-status                                                                                                                                              | Altura 25; ancho según distribución                            | 2 por lado                                    | Roboto Condensed         | 13                      | Fondo de botón                         | 1                                            | 3                                 |                                                                                               |
| Fila de estado operativo           | Button con clase .operations-state; .operations-custom-row para los personalizados                                                                                               | Altura mínima 25; ancho y altura según distribución            | 2 por lado                                    | Roboto Condensed         | 13                      | Fondo de botón; selección según paleta | 1                                            | 3                                 | El editor de nombre conserva la altura de Input; véase [Operativo](#operativo).               |
| Fila o tarjeta de contenido        | .element-row en [elements.module.css](src/features/elements/elements.module.css); .information-card en [information.module.css](src/features/information/information.module.css) | Altura y ancho según contenido                                 | 2 por lado del texto                          | Roboto Condensed         | 13                      | Acabado del componente enlazado        | Bordes y separadores del componente enlazado | Geometría del componente enlazado | No hay un acabado universal de tarjeta; las excepciones de composición se definen por módulo. |
| Contenedor del texto               | `span` interior de otro contenedor; token --font-size-body                                                                                                                       | Altura del contenedor del texto 17; ancho según distribución   | Lo aporta el contenedor exterior una sola vez | Roboto Condensed         | 13                      | Sin fondo propio                       | Sin borde propio                             | No aplica                         |                                                                                               |
| Dato técnico                       | .technical-data; token --font-size-technical                                                                                                                                     | Altura del contenedor del texto 17; ancho según distribución   | Lo aporta el contenedor exterior              | Roboto Condensed         | 13                      | Sin fondo propio                       | Sin borde propio                             | No aplica                         | Cifras alineadas cuando se presentan en columnas.                                             |
| Hora principal y temporizadores    | ClockModule y TimerRow; .clock-esp y .timer-value                                                                                                                                | Cifras adaptadas al espacio de su contenedor                   | 2 alrededor del texto, una sola vez           | Rajdhani para las cifras | Se adapta al contenedor | Sin fondo propio                       | Sin borde propio                             | No aplica                         | Las etiquetas y los controles mantienen la fuente común.                                      |
| Hora Zulu                          | ClockModule; .clock-zulu output                                                                                                                                                  | Ancho según distribución                                       | 2 alrededor del texto, una sola vez           | Rajdhani                 | 16 × zoom del módulo    | Sin fondo propio                       | Sin borde propio                             | No aplica                         | El tamaño de las cifras no se adapta al contenedor.                                           |
| Título de contenido                | h3, strong y equivalentes; token --font-size-title, salvo la excepción de Información                                                                                            | Altura mínima del contenedor 20; ancho según distribución      | Lo aporta el contenedor                       | Roboto Condensed         | 16                      | Sin fondo propio                       | Sin borde propio                             | No aplica                         |                                                                                               |
| Nombre de tarjeta de Información   | .information-name; token --font-size-title                                                                                                                                       | Primera fila con mínimo de 15; sin mínimo de 20 para el nombre | Lo aporta la tarjeta                          | Roboto Condensed         | 16                      | Sin fondo propio                       | Sin borde propio                             | No aplica                         | Interlineado de 15; nombre en una línea con puntos suspensivos.                               |

### Composición y estados

- Los campos comunes se utilizan también en menús, Configuración y diálogos. Los nuevos campos siguen las mismas reglas.
- Los iconos y las acciones añadidos a un campo o botón tienen espacio reservado: mantienen su separación respecto al texto y no lo tapan.
- Los controles de una línea centran el contenido verticalmente. Los textos de varias líneas comienzan arriba.
- Los campos de texto, numéricos, fechas, selectores y áreas de texto conservan bordes neutros, también con errores de validación. El error se comunica mediante un aviso emergente breve que indique cómo corregirlo; no se exige un mensaje junto al campo. Coordenadas y Configuración utilizan estos avisos sin mensajes de error dentro de sus formularios. El color no es la única indicación.
- El aspecto normal y el cambio de fondo de los botones al pasar el puntero se definen en la paleta.
- Durante la pulsación utilizan el fondo activo.
- La selección permanece visible mientras la opción esté elegida.
- El foco del teclado conserva el acabado correspondiente a cada control y las excepciones sin contorno descritas en «Colores y superficies».
- Los controles deshabilitados utilizan una opacidad del 50 % y no responden a pulsaciones. Un contenedor no añade otra atenuación a sus controles deshabilitados; los controles que siguen habilitados conservan su intensidad normal. Los de solo lectura mantienen el contenido legible y seleccionable para consultar o copiar cuando corresponda, sin confundirse con los deshabilitados.
- Los controles conservan nombres accesibles sin ayudas emergentes ni títulos nativos explicativos. Las etiquetas de datos del mapa y su leyenda mantienen su función; esta regla no elimina información cartográfica.
- Las etiquetas simples de botones, los valores de Select, los indicadores de Información y los nombres de estados de Operativo utilizan la altura del contenedor de texto de la tabla. Las composiciones de varias líneas, el teclado de Calculadora y la paleta de nombres de pines permiten altura de etiqueta automática.
- Los campos editables de una línea desplazan el texto dentro del campo mientras se edita. Las notas y la información extensa permiten varias líneas. Los nombres de barras y resúmenes pueden mostrar puntos suspensivos, con acceso al nombre completo al abrir o editar el elemento. Las listas largas se desplazan en su zona manteniendo accesibles las herramientas. Se evitan desplazamientos anidados sin funciones distintas.


## Estructura de las ventanas

| Elemento              | Componente o selector                                  | Dimensiones                              | Padding                                                                        | Fuente y tamaño      | Fondo                    | Borde                                        | Radio                                | Comportamiento                                                                                                                                     |
| --------------------- | ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------ | -------------------- | ------------------------ | -------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marco de ventana      | ModuleFrame; clase y data-slot module-frame            | Según la tabla de módulos                | 0; cada barra y contenido aportan su espacio                                   | No aplica al marco   | Fondo de ventana         | 1                                            | 4                                    | La selección utiliza el acento rojo con aproximadamente un 50 % de opacidad.                                                                       |
| Barra de título       | header de ModuleFrame; clase y data-slot module-header | Altura 27; ancho según ventana           | 0 vertical; 2 horizontal                                                       | Roboto Condensed, 13 | Fondo de barra de título | Separador de 1 en #080808 hacia el contenido | Sin radio propio; lo define el marco | Nombre, icono y botones en una fila, centrados verticalmente.                                                                                      |
| Barra de herramientas | toolbarStyles.base en moduleToolbar.module.css         | Altura fija 32; ancho según distribución | 3 vertical; 5 horizontal                                                       | Roboto Condensed, 13 | Fondo de herramientas    | Separador de 1 hacia el contenido            | Sin radio propio; lo define el marco | Una sola fila, incluidos los grupos y la selección múltiple; separación de 4 entre controles no agrupados y desplazamiento horizontal si no caben. |
| Barra inferior        | div de ModuleFrame; clase y data-slot module-controls  | Altura 25; ancho según ventana           | 0 vertical; 2 a la izquierda; reserva derecha de 54 con autoajuste o 27 sin él | Roboto Condensed, 13 | Fondo de barra inferior  | Sin separador ni borde propio                | Sin radio propio; lo define el marco | Zoom a la izquierda; autoajuste y tirador a la derecha, cada uno con espacio propio y sin superponerse.                                            |

La barra de herramientas tiene una altura fija de 32 al 100 % y escala junto con sus controles al cambiar el zoom del módulo. Su separador de 1 forma parte de esa altura; al 100 %, el padding vertical es de 3 por lado. Los separadores entre barras y contenido se incluyen en las medidas totales: la barra de herramientas utiliza el color común #3D3D3D y la barra de título, #080808. El marco aporta el borde exterior y las esquinas redondeadas, sin duplicarlos en cada barra.

La barra inferior conserva la estructura actual compartida por los módulos: sus controles de 25 encajan en sus 25 de altura porque no tiene padding vertical ni separador propio. La barra y sus controles mantienen su tamaño al cambiar el zoom del contenido del módulo; el borde inferior exterior pertenece al marco de la ventana.

## Tamaños y comportamiento por módulo

| Módulo          | Ancho básico | Tipo de altura básica  | Tamaño recogido en barra | Barra de herramientas | Ajuste automático | Altura máxima automática |
| --------------- | ------------ | ---------------------- | ------------------------ | --------------------- | ----------------- | ------------------------ |
| Operativo       | 150          | Mínimo según contenido | 150 × 27                 | No                    | No                | No aplica                |
| Calculadora     | 150          | Mínimo según contenido | 150 × 27                 | Sí                    | No                | No aplica                |
| Reloj           | 210          | Mínimo según contenido | 210 × 27                 | No                    | Sí                | 500                      |
| Cuaderno        | 210          | Mínimo según contenido | 210 × 27                 | Sí                    | Sí                | 500                      |
| Elementos       | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | Sí                | 350                      |
| Dotaciones      | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | Sí                | 350                      |
| Información     | 240          | Mínimo según contenido | 240 × 27                 | No                    | Sí                | 350                      |
| Coordenadas     | 240          | Mínimo según contenido | 240 × 27                 | No                    | No                | No aplica                |
| Registro        | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | Sí                | 350                      |
| Calendario      | 240          | Mínimo según contenido | 240 × 27                 | No                    | No                | No aplica                |
| Informes        | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | No                | No aplica                |
| Pizarra         | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | No                | No aplica                |
| Mapa            | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | No                | No aplica                |
| Plano operativo | 240          | Mínimo según contenido | 240 × 27                 | Sí                    | No                | No aplica                |

### Reglas de tamaño

- **Tamaño básico:** al crear un módulo, expandirlo desde barra o icono, o cerrarlo y abrirlo, vuelve al ancho básico y calcula la altura necesaria para su estructura, herramientas y datos presentes, respetando su límite automático si existe. Sin datos, ocupa lo necesario para estructura y herramientas. «Según contenido» y «mínimo según contenido» se refieren a este cálculo inicial, que no implica autoajuste continuo.
- **Autoajuste:** solo está disponible en los módulos que lo admiten. Cuando está activo, adapta el ancho y la altura a los cambios de contenido, respetando el ancho básico mínimo y los límites automáticos. Su control actúa sobre ambas dimensiones.
- **Límite automático de altura:** al alcanzarlo, el contenido adicional utiliza desplazamiento vertical. Con pocos datos, la ventana no tiene que alcanzar ese límite. El editor de [Elementos y Dotaciones](#elementos-y-dotaciones) tiene una excepción al límite del listado.
- **Ancho automático:** se calcula según el contenido y los controles, sin reducirse por debajo del ancho básico. Puede superar el espacio visible disponible; el escritorio se amplía para alojar la ventana. Los textos largos se parten o desplazan según su función.
- **Redimensionado manual:** permite superar la altura máxima automática y desactiva el autoajuste hasta que el usuario lo reactive. Sus límites son independientes de los del crecimiento automático.
- **Reducción:** mantiene accesibles las herramientas y permite desplazar listas o textos, sin exigir que todo el contenido permanezca visible. El mínimo expandido conserva el ancho básico y los mínimos estructurales y de contenido de cada módulo. [Calendario](#calendario) admite reducción por debajo de su ancho básico.
- **Espacio adicional:** al ampliar, las listas, áreas de texto, vistas y contenedores ampliables reciben el espacio según el reparto de cada módulo. Los controles de una línea conservan su altura.
- **Recogido:** en barra mantiene las medidas de la tabla, también al recoger varios mediante la distribución general. En icono, todos los módulos miden 27 × 27. La distribución general conserva el orden de los módulos; en filas utiliza el ancho real de cada barra para saltar de fila y en columnas, la barra más ancha determina el inicio de la columna siguiente.

## Menús, diálogos y otras superficies

| Superficie                 | Controles o contenido                                                                                                  | Particularidades                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo                    | Nuevo UIBoard y Cambiar nombre; confirmaciones de cambios pendientes y cierre.                                         | Los formularios de nombre utilizan Input. Guardar y Guardar como utilizan el selector de archivos del navegador; su apariencia depende del navegador o del sistema.                                                          |
| Copia local automática     | Estado de la copia del dispositivo e incidencias en el centro de mensajes.                                             | Se presenta por separado del estado del archivo. Sus recorridos se describen en [Datos y persistencia](ARQUITECTURA.md#datos-y-persistencia).                                                                                |
| Recuperación de emergencia | Aviso de error, reintento y descarga de una copia recuperable.                                                         | Si falla la descarga después de preparar el JSON, se muestra un área de varias líneas de solo lectura para copiarlo. Pertenece a la recuperación de errores de la interfaz, sin catálogo ni filtros de guardados históricos. |
| Configuración              | Ubicación y Almacenamiento y permisos. La ubicación incluye búsqueda de localidad, nombre, coordenadas y zona horaria. | Los grupos usan la separación común entre grupos; Buscar ejecuta la consulta y Guardar/Cancelar cierran la edición de ubicación. Los formularios siguen los campos y selectores comunes.                                     |
| Vista y zoom               | Número de columnas de la distribución; porcentaje editable en la barra general y en las barras de módulos.             | El porcentaje utiliza Input numérico transparente y sin borde; conserva las medidas comunes. El símbolo `%` tiene su propio espacio. Su rango es de 25 a 200.                                                                |

### Menús y selectores

- Los disparadores de Menubar comparten la altura, el padding, la tipografía y el radio de los botones de texto. Su fondo y borde son transparentes; conservan sus estados de texto en el [componente propietario](src/components/ui/menubar/menubar.module.css).
- Los menús y popovers conservan sus límites de viewport, desplazamiento y devolución del foco. Su presentación es la misma dentro o fuera de una ventana de Archivo.
- El disparador de Select utiliza el fondo de campo de la tabla de controles. La flecha tiene su espacio propio, separado por un borde.
- El listado de Select muestra la opción elegida con marca, borde y fondo; distingue el foco del teclado y admite opciones largas en varias líneas. Su altura está limitada a 320 y al espacio disponible, con desplazamiento vertical.

### Barra general y avisos

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

## Composición por módulo

Estas secciones definen la composición y las excepciones locales. Las medidas comunes y los tamaños básicos se consultan en sus tablas, sin extender una excepción a otros módulos.

### Operativo

- Los estados se distribuyen en una cuadrícula adaptable con nombres o abreviaturas según el ancho disponible. Las filas reciben el espacio adicional; los controles de edición conservan su altura común.
- Los estados personalizados presentan indicador de color, nombre y acciones de edición. El nombre se edita mediante Input de una línea, con Enter para confirmar y Escape para cancelar; al pegar varias líneas se sustituyen sus saltos por espacios.

### Calculadora

- La barra de herramientas muestra los modos Aritmética y Sol/crepúsculos a la izquierda y el radar a la derecha. En la vista solar, el ajuste del huso utiliza `columns-3-cog` justo antes del radar; el reintento de zona, cuando corresponde, también aparece en esa barra.
- La pantalla aritmética muestra la operación atenuada a la izquierda del resultado editable. Al empezar otra operación, la expresión anterior se desliza hacia la izquierda y desaparece en 700 ms; con movimiento reducido, no se anima.
- Historial despliega hasta diez cálculos, del más antiguo al reciente. El último cálculo completado aparece en la fila del resultado; al editar una nueva operación, los cálculos anteriores quedan en el historial y la edición ocupa su propia fila.
- El teclado utiliza cuatro columnas y seis filas. Historial, Borrar última operación y «=» ocupan la última fila; «=» abarca dos columnas. Las cifras de sus teclas utilizan una base de 24, escalada con el módulo, y las teclas reparten el espacio disponible. La altura mínima equivale a seis controles; el contenido adicional de la pantalla utiliza el desplazamiento de la ventana cuando falta espacio.
- La vista solar muestra nombre de ubicación y estado del radar en una línea, coordenadas y fecha con formato «dd/MM/yyyy · UTC…». Sus filas de datos conservan la altura de texto; los botones del huso no las estiran.
- Utiliza la fecha seleccionada en Calendario, sin selector propio ni botón Hoy. Los horarios y el desfase corresponden a esa fecha; los crepúsculos del mismo ciclo indican «+1» cuando terminan al día siguiente. Durante la resolución de zona o si falla, no se muestran horarios calculados con otra zona. El recorrido de detección y corrección se describe en [Arquitectura](ARQUITECTURA.md#entradas-y-estructura).

### Reloj

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

### Cuaderno

- La barra reúne Crear nota, Crear checklist y Eliminar bloque. A la derecha agrupa Añadir fila y Eliminar fila del checklist seleccionado.
- La selección de bloque y fila permanece visible; las herramientas sin destino están deshabilitadas. Las acciones se mantienen en la barra, sin controles superpuestos al texto ni padding reservado para ellos.
- Las notas y los textos de checklist crecen según su contenido. Todas las filas de un checklist, incluida la primera, pueden eliminarse; un checklist vacío conserva un campo de entrada. El listado dispone de su zona de desplazamiento y los bloques mantienen su reordenación.
- Cada bloque dispone de un tirador de 8 de alto, escalado con el zoom del módulo, con una línea central de 2 que recibe la misma escala.

### Elementos y Dotaciones

- Los pines utilizan los SVG originales de `public/assets/pins/elementos` y `public/assets/pins/dotaciones`: 17 opciones de Elementos y 5 de Dotaciones. El catálogo compartido define sus nombres, categorías y cajas visuales. VIR y Agua sustituyen las etiquetas anteriores Pathfinder y EH.
- Las imágenes se muestran con su proporción original, sin deformación, mediante `object-fit: contain` en listados, Información, vista previa, Pizarra y Plano. Los nueve pines sustituidos conservan sus cajas básicas y los controles de escala, giro, inversión, anclaje y nombre.
- El control Escala admite valores de 1 a 200, incluidos decimales, con conversión lineal `escala real = valor / 25`. El mínimo es 0,04 veces la caja básica y el máximo, 8 veces; 25 representa el tamaño básico y 100 conserva el máximo anterior de 4 veces. Los botones avanzan una unidad del control. Pizarra y Plano comparten esos límites al redimensionar; los pines ya creados conservan su tamaño real, aunque cambie el número mostrado.
- El título escala proporcionalmente con el pin: su tamaño tipográfico configurado es la referencia, multiplicada por la escala del icono. Su padding, separación y desplazamiento manual respecto al centro acompañan el cambio de escala. El tamaño tipográfico de referencia conserva el rango de 8 a 72.
- En los elementos y dotaciones existentes, los controles Escala y Tamaño del nombre actualizan la representación en tiempo real, tanto en edición individual como múltiple; esos cambios permanecen al salir del editor. Los demás campos conservan Guardar/Aplicar. Durante la creación, el tamaño se incorpora al crear el elemento.
- En Plano, el pin seleccionado en modo Seleccionar muestra un tirador en la esquina inferior derecha. Conserva su tamaño accionable al cambiar el zoom geográfico y redimensiona el pin y su título proporcionalmente, manteniendo el punto geográfico de anclaje. El arrastre cancelado restaura el tamaño anterior.
- La cabecera conserva el icono de aplicación PNG `public/assets/elements/icon_chincheta.png`, su tamaño de 24 × 24 y su presentación actual. La chincheta utilizada como pin pertenece al nuevo catálogo SVG.
- Los marcadores independientes de Mapa conservan sus banderas SVG y su color editable.

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

### Información

- Las tarjetas reparten de forma flexible la altura disponible y alinean su contenido arriba. Solo una tarjeta puede estar desplegada.
- Al desplegar, las alturas actuales de las tarjetas actúan como mínimos temporales para conservar su posición y añadir los detalles hacia abajo. Al cerrar, esos mínimos se liberan.
- Los detalles ocupan únicamente su contenido, alineado arriba, y permanecen ocultos e inactivos cuando están cerrados. El nombre utiliza la excepción de altura e interlineado de la tabla de contenido.

### Coordenadas

- El formulario y las filas de datos técnicos mantienen una distribución flexible y su altura mínima escalada. Las acciones de conversión, copia y radar conservan sus espacios propios junto a los campos.
- Las etiquetas de DD, DMS, DMM, UTM, Plus Code, Maps y OsmAnd comparten una columna ajustada a la etiqueta más ancha, con un margen de `1ch` antes de los resultados alineados verticalmente. Los enlaces muestran una vista abreviada y copian la URL completa; una copia correcta muestra el aviso «Copiado.».

### Registro

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

### Calendario

- La primera fila muestra el input de mes y `calendar-heart` para mostrar u ocultar la agenda. La segunda mantiene siempre el selector `< | Hoy | Semana | Mes | >`, con su diseño y redondeo. Ambas filas se centran respecto a los días, excluyendo el ancho de la agenda.
- Los días crecen o se contraen con el espacio disponible. En la vista semanal, el contenido interior de cada día utiliza una separación de 1 en ambos ejes, distribución flexible y altura automática.
- La selección del día utiliza rojo. El día seleccionado muestra fase lunar e iluminación; los eventos pertenecen a la agenda transversal descrita en Arquitectura.
- La agenda se sitúa a la derecha, alineada con la zona de días, cuando hay ancho suficiente, predomina el ancho sobre el alto y caben ambas zonas con sus mínimos. En los demás casos se coloca debajo.
- La fecha de cabecera, los títulos de eventos y sus horas o intervalos permanecen en una línea. La agenda y sus tarjetas conservan su tamaño por contenido: debajo reservan la altura completa y a la derecha, el ancho completo. Solo la zona de días recibe el espacio adicional.
- La reducción manual puede bajar del ancho básico hasta el mínimo medido de controles y contenido. El mínimo incluye la cabecera, la fase lunar, el texto completo y las acciones de todos los eventos mostrados cuando la agenda está visible.
- Al cambiar contenido o zoom, solo se amplían las dimensiones insuficientes para ese mínimo. Se conserva un tamaño manual mayor y no se activa el autoajuste continuo.

### Mapa y Plano operativo

- La navegación sobre el fondo utiliza la mano con índice (`pointer`); al arrastrar pasa al puño cerrado (`grabbing`). Las herramientas de dibujo, borrado y redimensionado conservan sus cursores específicos.
- La coordenada seleccionada se representa mediante un pin cartográfico SVG rojo con borde blanco y centro blanco, de 18 × 26 px. La punta inferior coincide con la coordenada y el cuerpo queda por encima; su tamaño se mantiene al cambiar el zoom geográfico. La marca deja pasar los clics y no recibe foco de teclado.
- Las búsquedas por lugar o coordenadas centran y marcan el resultado conservando el zoom geográfico actual, tanto en Mapa como en Plano.

1. Guía de estilo de la interfaz
   1. Propósito y estado
   2. Convenciones de medidas
   3. Convenciones de estado
   4. Glosario
   5. Base visual compartida
      1. Tipografía y espacios
      2. Colores y superficies
   6. Componentes comunes
      1. Campos y controles
      2. Contenido e indicadores
      3. Composición y estados
   7. Estructura de las ventanas
   8. Tamaños y comportamiento por módulo
      1. Reglas de tamaño
   9. Menús, diálogos y otras superficies
      1. Menús y selectores
      2. Barra general y avisos
   10. Composición por módulo
       1. Operativo
       2. Calculadora
       3. Reloj
       4. Cuaderno
       5. Elementos y Dotaciones
       6. Información
       7. Coordenadas
       8. Registro
       9. Calendario
       10. Mapa y Plano operativo
       11. Pizarra
       12. Informes

### Pizarra

- Sus herramientas son independientes del zoom del lienzo. Notas, pines e imagen conservan sus espacios de coordenadas y geometría propios.
- Las notas rápidas utilizan Textarea con la fuente general. Sobre la nota amarilla, el área de texto es transparente, sin borde ni radio propios y con padding de 6 arriba, 26 a la derecha, 4 abajo y 5 a la izquierda.
- Su texto no adapta la fuente al tamaño de la nota ni al contenido; si no cabe, utiliza desplazamiento interno. El zoom del lienzo escala la nota y su texto juntos. Esta excepción sustituye la altura y el acabado generales de Textarea.

### Informes

- La barra reúne Contenido del informe, Actualizar, Guardar e Imprimir/PDF, más el selector Ajustar al ancho/Tamaño real para la vista previa.
- El contenido se selecciona en un Sheet no modal a la izquierda, sin cierre interior. El título pertenece al contenido desplazable; la barra de desplazamiento queda pegada al borde derecho, separada de las tarjetas.
- Su ancho se modifica desde una barra separadora fina gris, sin agarre visible y con una zona amplia de arrastre. El panel conserva su ancho al cerrarlo; la vista previa ocupa entonces todo el espacio.
- Los grupos permanecen en una columna. Sus campos se muestran solo cuando está activado el título del grupo y se distribuyen en una, dos o tres columnas: una por defecto, dos desde 20em de ancho del contenido del panel y tres desde 30em. La separación horizontal utiliza el espacio común entre elementos.
- Fechas permite seleccionar Documento creado, Última edición e Informe generado. Las tres están activadas inicialmente y se muestran en la cabecera del informe según la selección.
- El formato es A4 con orientación vertical u horizontal. La vista previa permite ajuste al ancho o tamaño real con desplazamiento y mantiene margen exterior en los cuatro lados, incluido el final de la última página.
- Guardar informe produce un HTML autónomo con sus fuentes, páginas y estilos de impresión; Imprimir/PDF utiliza el diálogo del navegador. El informe presenta los campos textuales y temporizadores disponibles; los encuadres y las capturas de Mapa, Plano y Pizarra están retirados.
