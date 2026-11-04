# frontend_style

## excepciones

- Los archivos se modifican cuando se solicita, nunca sin aprobación del usuario.

## guía de la guía

- Todas las medidas están en píxeles, con el zoom al 100 %. Los tamaños se escriben como **ancho × alto**.
- La medida de una ventana incluye borde, barra de título, contenido y barra inferior. La medida de un control incluye su borde y su espacio interior.
- Para cambiar una medida común, se modifica su regla en esta guía y se aplica desde la base compartida de la app. Los componentes nuevos utilizan esa misma base.
- Una excepción se anota aquí con su motivo. Estar en otro módulo o haberse construido de otra manera no justifica por sí mismo una apariencia diferente.
- **Padding** significa espacio interior entre el borde y el contenido. **Separación** significa espacio entre dos elementos. Ambos se aplican una sola vez.
- **Barra de título:** barra superior con el nombre del módulo y acciones de ventana.
- **SectionHeader:** barra interior con las herramientas propias del módulo. Su presencia se indica en la tabla.
- **Barra inferior:** zona de zoom, ajuste automático y acceso al redimensionado.
- **Porcentaje de la barra inferior:** el campo numérico de zoom conserva las medidas comunes, con fondo transparente y sin borde para integrarse en la barra.

## Módulos: tamaños y comportamiento

| Módulo          | Tamaño básico                | Recogido en barra | ¿SectionHeader? | ¿Ajuste automático? | Altura máxima automática | Flex |
| --------------- | ---------------------------- | ----------------- | --------------- | ------------------- | ------------------------ | ---- |
| Operativo       | 150 × según contenido        | 150 × 27          | No              | No                  | —                        | Si   |
| Calculadora     | 150 × mínimo según contenido | 150 × 27          | Sí              | No                  | —                        | Si   |
| Elementos       | 180 × según contenido        | 180 × 27          | Sí              | Sí                  | 350                      | Si   |
| Dotaciones      | 180 × según contenido        | 180 × 27          | Sí              | Sí                  | 350                      | Si   |
| Información     | 210 × según contenido        | 210 × 27          | No              | Sí                  | 350                      | Si   |
| Reloj           | 210 × mínimo según contenido | 210 × 27          | No              | Sí                  | 500                      | Si   |
| Cuaderno        | 210 × según contenido        | 210 × 27          | Sí              | Sí                  | 500                      | Si   |
| Registro        | 250 × según contenido        | 250 × 27          | No              | Sí                  | 350                      | Si   |
| Coordenadas     | 250 × mínimo según contenido | 250 × 27          | No              | No                  | —                        | Si   |
| Calendario      | 400 × 310                    | 400 × 27          | No              | No                  | —                        | Si   |
| Informes        | 400 × 400                    | 400 × 27          | Sí              | No                  | —                        | Si   |
| Pizarra         | 400 × 400                    | 400 × 27          | Sí              | No                  | —                        | No   |
| Mapa            | 400 × 400                    | 400 × 27          | Sí              | No                  | —                        | No   |
| Plano operativo | 400 × 400                    | 400 × 27          | Sí              | No                  | —                        | No   |

### Reglas de tamaño

- **Según contenido:** sin datos, la ventana ocupa el espacio necesario para su estructura y herramientas. Al añadir o eliminar contenido, crece o reduce su altura. No puede crecer mas del máximo automático indicado.
- **Mínimo según contenido:** Calculadora, Reloj y Coordenadas calculan su altura básica a partir del espacio necesario para la estructura, las herramientas y el contenido presente, con el ancho indicado en la tabla. Ese mínimo sustituye una altura fija y conserva el reparto flexible del espacio al ampliar la ventana. El ajuste automático sigue dependiendo de su columna: solo Reloj lo admite entre estos tres módulos, hasta 500px.
- **Al alcanzar el máximo:** la ventana deja de crecer automáticamente. El contenido adicional queda accesible mediante una barra de desplazamiento vertical.
- **Ampliación manual:** se permite superar la altura máxima automática utilizando el redimensionado manual.
- **Mínimo al reducir:** en módulos con altura básica fija, se respeta ese tamaño básico. En los de altura según contenido, se respeta el espacio necesario para la estructura y el contenido, hasta el límite automático; el resto puede desplazarse. Ese límite no obliga a medir 350 o 500 cuando hay pocos datos.
- **Restauración:** al crear un módulo nuevo, expandirlo desde barra o icono, o cerrarlo y abrirlo, vuelve al tamaño básico. Si su altura es según contenido, se calcula con los datos presentes y su límite automático.
- **Recogido:** se utiliza el ancho de barra indicado para cada módulo, también al recoger varios mediante la distribución general. Todos pueden recogerse a un icono de **27 × 27**.
- **Control de ajuste automático:** se muestra únicamente en los módulos que admiten esa función.
- **Espacio adicional:** al ampliar una ventana, los controles de una línea mantienen su altura. El espacio adicional lo reciben las listas, áreas de texto, vistas y contenedores que pueden crecer.

## Elementos: una base común para toda la app

**Cada fila define un tipo de elemento. Su regla se aplica a todos los elementos de ese tipo, presentes y futuros.** Los ejemplos sirven para reconocerlos; no son una lista cerrada. Un campo de texto es el recuadro donde se escribe, se busca o aparece un resultado. La regla de ese campo no se extiende a todo el texto del módulo.

Los campos, botones de acción y selectores de una línea comparten texto de 13, altura de 25, padding de 2 por cada lado, borde de 1 y radio de 3. El ancho se adapta al contenido o al espacio disponible. Las fuentes especiales se indican en su fila. Las teclas del teclado de Calculadora tienen su distribución y tamaños propios; no están incluidas en la fila de botones de texto.

| Elemento                                  | Qué incluye o dónde se usa                                                                                                                                                               | Tamaño                                              | Padding interior                                     | Aspecto y comportamiento                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campo de texto de una línea (input)       | Todo recuadro para escribir, buscar o mostrar un resultado de una línea: operación/resultado de Calculadora, nombres, búsquedas, coordenadas, título de evento, emoji y Acontecimiento   | Alto 25; ancho según distribución                   | 2 por cada lado                                      | Roboto Condensed de 13; fondo de campo; radio 3                                                                                                                     |
| Campo numérico                            | Recuadro para editar un número: tamaño de letra, escala, número de columnas y porcentaje de zoom                                                                                         | Alto 25; ancho según el valor previsto              | 2 por cada lado                                      | Roboto Condensed de 13; fondo de campo; radio 3; conserva unidades y límites de valor                                                                               |
| Campo de fecha, mes u hora                | Recuadro para editar una fecha, un mes o una hora: mes de Calendario, fechas Desde/Hasta y hora del evento                                                                               | Alto 25; ancho según distribución                   | 2 por cada lado                                      | Roboto Condensed de 13; fondo de campo; radio 3; conserva su icono y función                                                                                        |
| Selector desplegable                      | Recuadro que permite elegir una opción de una lista: PIN, zona horaria, formato de coordenadas y opciones de Informes                                                                    | Alto 25; ancho según distribución                   | 2 por cada lado                                      | Roboto Condensed de 13; fondo de campo; radio 3; espacio propio para la flecha                                                                                      |
| Área de texto de varias líneas (textarea) | Recuadro para texto que admite varias líneas: Información de Elementos/Dotaciones, edición de Registro, notas y listas de Cuaderno, notas de Pizarra y nombres de estados personalizados | Alto inicial mínimo 25; puede crecer                | 2 por cada lado                                      | Roboto Condensed de 13; fondo de campo; radio 3; crecimiento o desplazamiento según su función; sigue siendo multilínea aunque inicialmente muestre una sola línea  |
| Botón de texto o icono y texto            | Hoy, Mes, Semana y otras acciones con nombre                                                                                                                                             | Alto 25; ancho según contenido                      | 2 por cada lado                                      | Roboto Condensed de 13; radio 3; separación de 4 entre icono y texto                                                                                                |
| Selector de estado                        | Estado de una dotación en Información                                                                                                                                                    | Alto 25; ancho según distribución                   | 2 por cada lado                                      | Roboto Condensed de 13; radio 3; separación de 4 entre indicador de estado y texto                                                                                  |
| Fila de estado operativo                  | Disponible, Activada, Interviniendo y demás estados de Operativo                                                                                                                         | Alto mínimo 25; puede crecer si necesita más líneas | 2 por cada lado                                      | Roboto Condensed de 13; conserva su indicador y su distribución particular                                                                                          |
| Fila o tarjeta de contenido               | Entradas de Registro, tarjetas de Información y listas similares                                                                                                                         | Alto según contenido                                | 2 por cada lado de su texto                          | Roboto Condensed de 13; los campos y botones interiores mantienen su propia medida; no se duplica el padding sobre el mismo texto                                   |
| Barra de título                           | Nombre, icono y acciones del módulo                                                                                                                                                      | Alto 27                                             | 0 arriba y abajo; 2 a cada lado                      | Roboto Condensed de 13; Nombre, icono y botones alineados en una fila y centrados verticalmente.                                                                    |
| Barra inferior                            | Zoom, ajuste automático y redimensionado                                                                                                                                                 | Alto 25                                             | 0 arriba y abajo; 2 a cada lado                      | Roboto Condensed de 13; Zoom a la izquierda; ajuste automático y tirador de redimensionado a la derecha, cada uno con su espacio y sin superponerse; fondo de barra |
| SectionHeader                             | Barra interior de herramientas                                                                                                                                                           | Alto mínimo 32; crece si requiere otra fila         | 3 arriba y abajo; 5 a cada lado                      | Roboto Condensed de 13; Separación de 4 entre controles no agrupados; fondo de herramientas                                                                         |
| Texto y etiquetas                         | Nombres, explicaciones, etiquetas y contenido general                                                                                                                                    | Fuente 13                                           | Lo aporta el contenedor, una sola vez                | Roboto Condensed de 13; mismo tamaño para textos equivalentes                                                                                                       |
| Dato técnico                              | Coordenadas, fechas, medidas y valores similares                                                                                                                                         | Fuente 13                                           | Lo aporta el contenedor                              | Roboto Condensed de 13; cifras alineadas cuando se presentan en columnas                                                                                            |
| Campo de duración                         | Duración inicial del temporizador, escrita como horas:minutos:segundos                                                                                                                   | Alto 25; ancho para mostrar la duración             | 2 por cada lado                                      | Roboto Condensed de 13; Rajdhani por pertenecer al temporizador; mismo borde y radio que los campos                                                                 |
| Hora y temporizadores                     | Cifras del Reloj y sus temporizadores                                                                                                                                                    | Tamaño de cifras según su función                   | 2 alrededor del texto, aplicado una sola vez         | Rajdhani para las cifras; etiquetas y controles mantienen la fuente común                                                                                           |
| Título de contenido                       | Título dentro de un módulo, distinto del nombre de la ventana                                                                                                                            | Fuente 16                                           | Lo aporta el contenedor                              | Roboto Condensed de 16                                                                                                                                              |
| Botón de solo icono                       | Añadir, aceptar, borrar, herramientas y acciones similares                                                                                                                               | 25 × 25                                             | 0; icono centrado                                    | Radio 3; puede tener fondo o acabado transparente según su función                                                                                                  |
| Icono visible                             | Dibujo dentro de un botón o junto a un texto                                                                                                                                             | 15 × 15                                             | 0                                                    | Esta medida corresponde al dibujo; el botón sigue midiendo 25 × 25                                                                                                  |
| Casilla de selección                      | Checkbox con o sin etiqueta                                                                                                                                                              | Casilla de 15 × 15                                  | 0                                                    | Borde 1; radio 3; sin margen propio; separación de 4 respecto a su etiqueta                                                                                         |
| Marco de ventana                          | Borde exterior del módulo                                                                                                                                                                | Borde 1; radio 4                                    | El espacio del contenido se define por sus elementos | Fondo de ventana y borde común; selección marcada con el acento rojo con 50% de opacidad                                                                            |

### Campos localizados en la app

Esta relación ayuda a encontrar los campos que ya existen. Las medidas se consultan en la fila de su tipo, para mantener una sola regla común.

- **Calculadora:** campo de operación y resultado. En la vista solar, selector de zona horaria.
- **Coordenadas:** input de coordenadas.
- **Elementos y Dotaciones:** Nombre y Emoji son campos de una línea; tamaño de letra y escala son numéricos; PIN es un selector; Información es un área de varias líneas.
- **Registro:** Acontecimiento es un campo de una línea; la edición de una entrada utiliza un área de varias líneas.
- **Calendario:** título del evento; mes y año; fechas Desde y Hasta; hora del evento. La elección de color es un selector de color, no un campo de texto.
- **Cuaderno:** texto de cada nota y de cada elemento de una lista, ambos en áreas de varias líneas.
- **Operativo:** nombre editable de los estados personalizados, en un área de varias líneas. La elección de su color es otro tipo de control.
- **Mapa y Plano operativo:** búsqueda de lugar, dirección o coordenadas y nombre editable de cada marcador. También tienen selectores, como el formato de coordenadas; Plano añade el selector de recurso.
- **Pizarra:** texto de las notas rápidas, en áreas de varias líneas. Los controles de color y carga de imagen tienen funciones propias.
- **Reloj:** campo de duración inicial de cada temporizador.
- **Archivo y recuperación:** nombre en Nuevo UIBoard, Cambiar nombre y Guardar como; búsqueda por título de los guardados. La recuperación de emergencia también puede mostrar un área de varias líneas para copiar el documento recuperable, de solo lectura.
- **Configuración:** búsqueda de localidad, nombre de la ubicación y coordenadas de la ubicación; selector de zona horaria.
- **Vista y zoom:** número de columnas de la distribución; porcentaje editable de zoom en la barra general y en las barras de los módulos.
- **Informes:** selectores de tamaño de vista previa, orientación, calidad, encuadre y fondo. Son elecciones de una lista, no campos de escritura libre.

### Reglas para evitar diferencias innecesarias

- **Campos de entrada:** todos los campos de una línea utilizan la altura de 25, texto de 13 y padding de 2 por cada lado definidos en su tipo. Esto incluye los campos de módulos, menús, configuración y diálogos; los nuevos campos siguen la misma regla. Las áreas de varias líneas comparten el padding y la base de texto, con altura variable. Las fuentes especiales expresamente indicadas en la tabla conservan su función.
- Un campo y un área de texto pueden tener distinta altura y compartir el mismo padding. Un selector de estado y un botón pueden compartir apariencia y realizar acciones diferentes.
- La separación habitual entre elementos es **4**. Entre grupos de contenido es **6**. Los **2** del padding no se suman otra vez al texto o al icono interior.
- Los controles de una línea centran su contenido verticalmente. Los textos de varias líneas empiezan arriba. Los textos con funciones equivalentes utilizan también el mismo grosor y espacio entre líneas.
- Un icono añadido al campo o botón tiene su espacio reservado dentro del control. Mantiene la separación respecto al texto y no lo tapa.
- **Teclado de Calculadora:** conserva la distribución y el tamaño de sus teclas y cifras. La regla del campo de entrada y resultado no se extiende al teclado ni al resto del módulo. Las cifras grandes del Reloj, las imágenes, los mapas y los lienzos también tienen tamaños propios.

## Colores de partida

Se conserva el aspecto oscuro de Angie. Estos colores se asignan por función y se comparten entre módulos:

- **Fondo del escritorio:** `#0C0C0C`.
- **Fondo de ventana:** `#181818`.
- **Fondo de campos y casillas sin marcar:** `#111111`.
- **Fondo de barra inferior:** propuesta `#282828`.
- **Botones:** degradado de `#333333` a `#252525`. Al pasar el puntero, de `#404040` a `#303030`.
- **Barras de título:** degradado de `#383838` a `#222222`, pasando por `#2C2C2C`. **SectionHeader:** de `#2E2E2E` a `#1D1D1D`.
- **Texto principal:** `#F2F2F2`. **Texto secundario y de ejemplo:** `#ADADAD`.
- **Borde de ventana:** `#484848`. **Borde de campo:** `#555555`. **Borde de botón y separadores:** `#3D3D3D`.
- **Acento de selección:** `#D63A3A80` — rojo con aproximadamente un 50 % de opacidad. Se utiliza en casillas marcadas y bordes de selección o interacción.
- **Opción activa:** fondo `#303030`, con el mismo criterio para controles equivalentes.
- Los colores que expresan un estado operativo conservan su significado. La paleta completa de estados queda pendiente de concretar aquí.
