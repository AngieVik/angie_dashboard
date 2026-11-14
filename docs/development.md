# Development

Este documento es propietario del diseño objetivo: reglas visuales comunes, tamaños y composición de los módulos. Su integración en componentes y CSS Modules pertenece a [design.md](design.md); los contratos y límites técnicos, a [architecture.md](architecture.md); las reglas de trabajo, a [AGENTS.md](../AGENTS.md#responsabilidades-de-la-documentación).

El código y los documentos históricos aportan evidencia de implementación, pero no convierten una decisión ausente en una especificación aprobada. Los apartados pendientes se indican expresamente.

## Convenciones de estado

| Término           | Significado                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| Sí                | La función o característica está prevista.                              |
| No                | La función o característica está expresamente descartada para ese caso. |
| No aplica         | La propiedad no corresponde al elemento descrito.                       |
| Pendiente         | Falta concretar el valor o resolver su significado. No equivale a «No». |
| Propuesta         | Existe una alternativa concreta, todavía por decidir.                   |
| Base común        | Se utiliza la regla compartida indicada, sin una variante propia.       |
| Padding 2 valores | Primer valor (Top/Bottom); Segundo valor (Right/Left).                  |
| Padding 4 valores | Arriba; Derecha; Abajo; Izquierda.                                      |

En las tablas, «Pendiente» señala una decisión visual sin acreditar; «Base común» remite a la fila o sección indicada; «No aplica» identifica una propiedad ajena al elemento. Ninguno de estos estados se completa copiando una diferencia observada en el código. Los valores de tamaño son medidas base antes del zoom, salvo indicación expresa.

## Glosario

| Término               | Definición                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Padding               | Espacio interior entre el borde y el contenido. Se aplica una sola vez sobre el mismo contenido.                                                                           |
| Separación            | Espacio entre dos elementos o grupos. No duplica el padding interior.                                                                                                      |
| Barra de título       | Barra superior con el nombre del módulo y las acciones de ventana.                                                                                                         |
| Barra de herramientas | Barra interior con las herramientas propias del módulo. En versiones anteriores de esta guía se denomina SectionHeader; no existe un componente compartido con ese nombre. |
| Barra inferior        | Zona de zoom, Autoajuste y tirador de redimensionado.                                                                                                                      |
| Autoajuste            | Función que adapta el ancho y la altura cuando cambia el contenido. Es independiente del cálculo inicial del tamaño básico.                                                |
| Reparto flexible      | Distribución del espacio adicional entre los contenedores que pueden crecer. No exige que todos los controles crezcan ni determina por sí sola una técnica CSS.            |
| Icono visible         | Dibujo mostrado dentro de un control. Su tamaño es distinto del tamaño del botón y de su superficie accionable.                                                            |

## Tipografía y espacios

La configuración tipográfica debe reflejarse en `src/styles/tokens.css`

| Propiedad                          | Regla                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuente general                     | `Roboto Condensed`. El tamaño base es 13px y para títulos 16px. #F2F2F2                                                                                                                               |
| Texto secundario y de ejemplo      | `Roboto Condensed`. El tamaño base es 13px. #ADADAD                                                                                                                                                   |
| Fuente métrica                     | `Rajdhani`. Uso exclusivo para números donde la alineación es crítica: módulo Reloj, temporizadores, horas Zulu y hora principal.                                                                     |
| Fuente alternativa                 | Si la fuente principal no está disponible, se utiliza la fuente del sistema del dispositivo.                                                                                                          |
| Avisos Sonner                      | Tamaño de fuente de 13.                                                                                                                                                                               |
| Padding                            | El diseño es altamente compacto. Se estandariza un padding entre elementos de `4px` y entre grupos de `6px`. Los campos y botones suelen usar `0px 2px`.                                              |
| Peso tipográfico y altura de línea | `300` Fino, `500` Mediano, `700` Negrita, `900` Black, Se conservan los valores del CSS Module propietario de cada componente.                                                                        |
| Altura de línea                    | Se conserva la del CSS Module propietario, como indica la regla anterior. Pendiente cualquier nueva regla numérica transversal; los espacios entre elementos se rigen por el padding y la separación. |
| Capitalización                     | Sentence case estricto. Mayúsculas sostenidas solo para acrónimos (DRP, PSA).                                                                                                                         |

## Colores y superficies

| Función                        | Color o acabado                |
| ------------------------------ | ------------------------------ |
| Fondo de escritorio            | #0C0C0C                        |
| Fondo de campo                 | #111111                        |
| Fondo de opción activa         | #303030                        |
| Fondo de Botón                 | Degradado de #333333 a #252525 |
| Hover                          | Degradado de #404040 a #303030 |
| Borde de campo                 | #555555                        |
| Borde de botón                 | #3D3D3D                        |
| Separador                      | #3D3D3D                        |
| Acento de selección            | #D63A3A80                      |
| Acento de selección 2 (neutro) | #D6D6D280                      |

- Las reglas de altura de etiquetas y sus excepciones se mantienen en [Etiquetas y multilínea](#etiquetas-y-multilínea); el reparto de responsabilidades de `Button`, en [Integración de etiquetas](design.md#integración-de-etiquetas-de-button).
- **Focos (Focus):** Los `Input` y `Textarea` no deben mostrar el contorno predeterminado del navegador al recibir el foco, se gestiona mediante tokens.
- Los acentos de selección identifican casillas marcadas, opciones activas y bordes de selección donde corresponda. Se mantienen las variantes roja y neutra.
- Los diálogos de Archivo y Configuración suprimen los contornos de foco de sus controles.

## Estados operativos

Los estados de las dotaciones se mapean a tokens de color semánticos:

| Nombre        | Indicador        | Significado                                    |
| ------------- | ---------------- | ---------------------------------------------- |
| Disponible    | 🟢 Verde          | Recurso preparado en su punto de cobertura.    |
| Activada      | 🟡 Amarillo       | Recurso activado ante un aviso prioritario.    |
| Aproximándose | 🔵 Azul           | En ruta al aviso.                              |
| Interviniendo | 🔴 Rojo           | Asistencia e intervención en el aviso.         |
| Trasladando   | 💠 Símbolo        | Paciente en traslado al centro de destino.     |
| Transfiriendo | 🟠 Naranja        | Transferencia del paciente al equipo receptor. |
| Operativa     | 🟢 Verde          | Reactivación y retorno al punto de cobertura.  |
| Inoperativa   | ⚫ Gris oscuro    | Recurso temporalmente fuera de servicio.       |
| Personalizado | ⚪ Personalizable | Sin significado                                |

## Campos y controles

| Elemento                       | Componente o selector               | Ancho                    | Alto      | Padding   | Font Name          | Font Size | Fondo     | Borde     | Radio     |
| ------------------------------ | ----------------------------------- | ------------------------ | --------- | --------- | ------------------ | --------- | --------- | --------- | --------- |
| Campos de texto y entrada      | Input (texto, números, fechas)      | Según contenido previsto | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De campo  | 1         | 3         |
| Campos de texto y entrada      | Input-group (entradas agrupadas)    | Según contenido previsto | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De campo  | 1         | 3         |
| Campos de texto y entrada      | Textarea (texto multilínea)         | Según contenido previsto | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De campo  | 1         | 3         |
| Controles de selección         | Checkbox (casillas)                 | 15px                     | 15px      | 0         | No aplica          | No aplica | De campo  | 1         | 3         |
| Controles de selección         | Radio-group (opciones exclusivas)   | Según contenido          | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De campo  | 1         | 3         |
| Controles de selección         | Select (desplegables)               | Según contenido          | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De campo  | 1         | 3         |
| Botón de solo icono            | Button (variant="icon")             | 25px                     | 25px      | 0         | No aplica          | No aplica | No        | No        | 3         |
| Botón de texto con o sin icono | Button (variant="text")             | Según contenido          | 25px      | 0px 2px   | `Roboto Condensed` | 13        | De botón  | 1         | 3         |
| Menús de acción                | Dropdown-menu (menús desplegables)  | Pendiente                | Pendiente | Pendiente | Pendiente          | Pendiente | Pendiente | Pendiente | Pendiente |
| Menús de acción                | Context-menu (menús contextuales)   | Pendiente                | Pendiente | Pendiente | Pendiente          | Pendiente | Pendiente | Pendiente | Pendiente |
| Menús de acción                | Menubar (barras de navegación)      | Pendiente                | Pendiente | Pendiente | Pendiente          | Pendiente | Pendiente | Pendiente | Pendiente |
| Deslizador                     | Slider (control completo)           | Pendiente                | 25px      | Pendiente | No aplica          | No aplica | Pendiente | Pendiente | Pendiente |
| Específicos de dominio         | DurationInput (campo de duraciones) | Según contenido          | 25px      | 0px 2px   | `Rajdhani`         | 13        | De campo  | 1         | 3         |

Las celdas pendientes de menús se concretarán en [Menús, diálogos y otras superficies](#menús-diálogos-y-otras-superficies); las dimensiones acordadas del deslizador, en [Slider](#slider). Sus demás propiedades siguen pendientes. En Slider, la familia y el tamaño de fuente no se aplican a la pista y el tirador; cualquier etiqueta de texto visible pertenece a su consumidor. La reutilización técnica del contenido de menús se describe en [design.md](design.md#componentes-y-propietarios), sin convertir su CSS actual en valores visuales aprobados.

- Acabados de botón de solo icono:
    - **Normal:** transparente y sin marco visible en reposo; al pasar el puntero muestra el acabado común de interacción.
    - **Integrado:** forma parte de otro control y mantiene fondo transparente y ausencia de marco; al interactuar cambia el aspecto del icono.

### Slider

La altura total del control es la indicada en la tabla de Campos y controles, común con los campos y botones. La pista tiene una altura de **4px** y el tirador mide **15 × 15px**. Ambos se centran verticalmente dentro del control. Son medidas base antes del zoom, según las convenciones de esta guía.

**Pendiente de implementación y validación:** aplicar estas dimensiones en [slider.module.css](../src/components/ui/slider/slider.module.css) y comprobar alineación e interacción en navegador. Esta decisión documental no modifica por sí sola la superficie de interacción ni el comportamiento del control.

## Contenido e indicadores

| Elemento                           | Componente o selector                                      | Ancho              | Alto            | Padding    | Font Name          | Font Size  | Fondo      | Borde      | Radio      |
| ---------------------------------- | ---------------------------------------------------------- | ------------------ | --------------- | ---------- | ------------------ | ---------- | ---------- | ---------- | ---------- |
| Indicador de estado de Información | Badge con clase .information-status                        | Según distribución | 17px            | 0px 2px    | `Roboto Condensed` | 13         | De botón   | 1          | 3          |
| Fila de estado operativo           | Button con clase .operations-state; .operations-custom-row | Según distribución | 17px            | 0px 2px    | `Roboto Condensed` | 13         | De botón   | 1          | 3          |
| Icono visible                      | Componentes de lucide-react con clase .lucide              | 15px               | 15px            | 0          | No aplica          | No aplica  | No         | No         | No         |
| Contenedor del texto               | `span` interior de otro contenedor; token --font-size-body | Según contenido    | 17px            | 0          | `Roboto Condensed` | 13         | No         | No         | No         |
| Título de contenido                | h3, strong y equivalentes; token --font-size-title         | Según contenido    | 15px            | 0          | `Roboto Condensed` | 16         | No         | No         | No         |
| Nombre de tarjeta de Información   | .information-name; token --font-size-title                 | Base común         | Base común      | Base común | Base común         | Base común | Base común | Base común | Base común |
| Dato técnico                       | .technical-data; token --font-size-technical               | Según contenido    | 17px            | 0px 2px    | `Roboto Condensed` | 13         | No         | No         | No         |
| Hora principal                     | ClockModule; .clock-esp                                    | Según contenido    | Según contenido | 0px 2px    | `Rajdhani`         | Adaptable  | No         | No         | No         |
| Temporizadores                     | TimerRow; .timer-value                                     | Según contenido    | 17px            | 0px 2px    | `Rajdhani`         | 13         | No         | No         | No         |
| Hora Zulu                          | ClockModule; .clock-zulu output                            | Según contenido    | 17px            | 0px 2px    | `Rajdhani`         | 13         | No         | No         | No         |
| Fila de contenido                  | .element-row en [elements.module.css]                      | Según contenido    | 17px            | 0px 2px    | `Roboto Condensed` | 13         | No         | No         | No         |
| Tarjeta de contenido               | .information-card en [information.module.css]              | Según contenido    | 17px            | 0px 2px    | `Roboto Condensed` | 13         | No         | No         | No         |

En la fila «Nombre de tarjeta de Información», «Base común» remite a «Título de contenido».

### Etiquetas y multilínea

La altura base del contenedor de texto de una línea es 17px, distinta de la altura del botón y de los iconos visibles. En `Button`, `--button-label-height` permite una excepción local y, si no se define, se usa `--text-container-height`; dentro de una ventana esta última incorpora el zoom una vez.

La base de `Button` mantiene el texto sin salto de línea. La altura de una línea no promete multilínea automática: una composición que la necesite debe definir en su consumidor el ajuste de texto, la altura de la etiqueta y el espacio del botón según su especificación. `--button-label-height: auto` por sí solo no habilita los saltos ni elimina una altura fija del botón. Las excepciones visuales sin especificación permanecen pendientes; su implementación se describe en [design.md](design.md#integración-de-etiquetas-de-button).

## Estructura de las ventanas

| Elemento              | Componente o selector                                  | Ancho   | Alto   | Padding          | Font Name          | Font Size | Fondo                                    | Borde                      | Radio |
| --------------------- | ------------------------------------------------------ | ------- | ------ | ---------------- | ------------------ | --------- | ---------------------------------------- | -------------------------- | ----- |
| Marco de ventana      | ModuleFrame; clase y data-slot module-frame            | Modulo  | Modulo | No               | No aplica          | No aplica | No aplica                                | 1, #484848                 | 3     |
| Barra inferior        | div de ModuleFrame; clase y data-slot module-controls  | Ventana | 25px   | 0px 27px 0px 2px | `Roboto Condensed` | 13        | #181818                                  | No                         | Marco |
| Barra de título       | header de ModuleFrame; clase y data-slot module-header | Ventana | 27px   | 0px 2px          | `Roboto Condensed` | 13        | Degradado de #383838 a #2C2C2C a #222222 | Separador de 1, #080808    | Marco |
| Barra de herramientas | toolbarStyles.base en moduleToolbar.module.css         | Ventana | 27px   | 3px 5px          | `Roboto Condensed` | 13        | Degradado de #2E2E2E a #1D1D1D           | Separador de 1 a contenido | Marco |

Fondo de ventana; #181818

## Tamaños y comportamiento por módulo

Esta tabla mantiene los tamaños objetivo y sus capacidades visuales en una única ubicación. `DashboardGrid`, `moduleRegistry.ts` y la medición de contenido implementan el recorrido descrito en [Arquitectura](architecture.md#conexión-de-los-módulos). Una diferencia entre sus valores actuales y esta tabla no autoriza a cambiar el objetivo ni acredita que la implementación lo cumpla.

| Módulo          | Ancho | Alto            | Colapsado  | Contraido | Max. Autoajuste | Barra Herr. |
| --------------- | ----- | --------------- | ---------- | --------- | --------------- | ----------- |
| Pizarra         | 510px | 420px           | 510 × 27px | 27 x 27px | No              | Sí          |
| Mapa            | 510px | 420px           | 510 × 27px | 27 x 27px | No              | Sí          |
| Plano operativo | 510px | 420px           | 510 × 27px | 27 x 27px | No              | Sí          |
| Informes        | 240px | Según contenido | 240 × 27px | 27 x 27px | No              | Si          |
| Calculadora     | 240px | Según contenido | 240 × 27px | 27 x 27px | No              | Sí          |
| Elementos       | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | Sí          |
| Dotaciones      | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | Sí          |
| Registro        | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | Si          |
| Cuaderno        | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | Sí          |
| Información     | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | No          |
| Reloj           | 240px | Según contenido | 240 × 27px | 27 x 27px | 500px           | No          |
| Coordenadas     | 240px | Según contenido | 240 × 27px | 27 x 27px | No              | No          |
| Calendario      | 240px | Según contenido | 240 × 27px | 27 x 27px | No              | No          |
| Operativo       | 150px | Según contenido | 150 × 27px | 27 x 27px | No              | No          |

### Reglas de tamaño

- Tamaño: Al crear un módulo o cerrarlo y abrirlo, o expandirlo desde barra o icono, vuelve al ancho y calcula la altura necesaria para su estructura, herramientas y datos presentes.
    - Colapsado (en barra): Mantiene las medidas de la tabla.
    - Contraido (en icono): Todos los módulos miden 27 × 27.
    - Según contenido: Se refiere a este cálculo inicial, que no implica autoajuste continuo.
    - Sin datos: Ocupa lo necesario para estructura y herramientas.

- Reglas de Autoajuste:
    - Solo los módulos compatibles crecen en altura dinámicamente según su contenido, hasta un máximo (generalmente 500px), momento en el cual habilitan el scroll interno.
    - Al redimensionar manualmente una ventana arrastrando la esquina, el autoajuste se desactiva temporalmente para respetar la preferencia del usuario.

- Redimensionado manual:
    - Permite superar la altura máxima automática y el ancho basico, desactiva el autoajuste hasta que el usuario lo reactive. Sus límites son independientes de los del crecimiento automático.
    - Reducir: Mantiene accesibles las herramientas y permite desplazar listas o textos, sin exigir que todo el contenido permanezca visible.
    - Ampliar: Las listas, áreas de texto, vistas y contenedores ampliables reciben el espacio según el reparto de cada módulo. Los controles de una línea conservan su altura.

## Especificaciones de UI y Componentes

### Dimensiones de Módulos (Grid Layout)

Base común: utiliza la tabla y las [reglas de tamaño por módulo](#tamaños-y-comportamiento-por-módulo), sin una segunda lista de anchos.

### Marcadores del Mapa (Leaflet)

- **Iconos (SVG):** Se renderizan como `L.divIcon` con dimensiones de 18 × 26 px.
- **Anclaje:** La punta inferior del marcador se ancla en las coordenadas `[9, 26]`.
- **Interacción:** El umbral de ajuste de píxeles (snap) para la selección de rutas GPX es de 14 píxeles.

## Menús, diálogos y otras superficies

Las reglas comunes de controles, tipografía, colores y foco se consultan en [Campos y controles](#campos-y-controles), [Tipografía y espacios](#tipografía-y-espacios) y [Colores y superficies](#colores-y-superficies).

**Pendiente:** completar las decisiones visuales específicas de Archivo, Configuración, menús, paneles y avisos. No se han acreditado especificaciones completas de composición, dimensiones y excepciones en la guía histórica revisada. Las pautas de implementación existentes se conservan en [Medición y superficies flotantes](design.md#medición-y-superficies-flotantes); no sustituyen una decisión visual.

## Composición por módulo

Los tamaños y las capacidades ya descritos pertenecen a [Tamaños y comportamiento por módulo](#tamaños-y-comportamiento-por-módulo).

La composición siguiente es el diseño objetivo acordado. Los controles conservan su orden, función y alturas comunes; las listas, textos y superficies de trabajo reciben el espacio adicional según su cometido. El contenido que no quepa debe seguir siendo consultable mediante desplazamiento en su zona correspondiente.

| Módulos                         | Composición interior                                                  | Reparto del espacio y desplazamiento                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elementos y Dotaciones          | Herramientas arriba y lista debajo.                                   | La lista recibe el espacio adicional y se desplaza cuando su contenido supera el área disponible.                                                                           |
| Información                     | Tarjetas apiladas con reparto flexible.                               | Las tarjetas conservan su estructura y reparten el espacio adicional; los controles mantienen su altura. El contenido debe seguir siendo consultable al reducir la ventana. |
| Operativo                       | Estados en distribución vertical flexible.                            | Se conservan el orden y los controles de los estados; el espacio adicional se distribuye verticalmente y los estados permanecen accesibles al reducir la ventana.           |
| Cuaderno y Registro             | Herramientas arriba y contenido debajo.                               | El contenido se desplaza en su área. Las notas admiten crecimiento y texto multilínea; las acciones conservan su espacio.                                                   |
| Reloj                           | Hora principal, referencias y temporizadores en sus zonas propias.    | La hora principal se adapta al espacio; referencias y temporizadores conservan sus medidas específicas y deben permanecer accesibles.                                       |
| Calculadora                     | Operación y resultado arriba, teclado debajo e historial desplegable. | El teclado aprovecha su zona disponible y la operación, el resultado y el historial se mantienen consultables.                                                              |
| Coordenadas                     | Entradas y acciones agrupadas; resultados debajo.                     | Los resultados reciben el espacio disponible y permiten consultar los valores largos.                                                                                       |
| Pizarra, Mapa y Plano operativo | Herramientas y controles propios, junto a la superficie de trabajo.   | La superficie ocupa el espacio restante, conservando los mecanismos de navegación e interacción de cada módulo.                                                             |
| Informes                        | Selección y vista previa con su separador existente.                  | Cada zona gestiona su contenido y desplazamiento; el separador conserva su función.                                                                                         |

Los tamaños exteriores, el autoajuste y el zoom siguen las reglas ya definidas. Esta especificación no impone Flex o Grid como técnica universal: el resultado visual y la accesibilidad del contenido determinan la composición. El contraste con el código y sus pendientes se mantienen en [design.md](design.md#contraste-con-la-composición-aprobada).

### Calendario

| Zona             | Composición acordada                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Primera fila     | Mes/año y acción de mostrar u ocultar eventos.                                                                                     |
| Segunda fila     | Navegación y selector Hoy / Semana / Mes, conservando su diseño y redondeado.                                                      |
| Zona principal   | Calendario mensual o semanal, que recibe el espacio disponible.                                                                    |
| Agenda           | Debajo en ventanas estrechas; a la derecha cuando ambas zonas caben sin recortar contenido. Si deja de caber, vuelve debajo.       |
| Ventana reducida | Navegación, fechas y eventos permanecen accesibles mediante desplazamiento donde sea necesario; los controles conservan su altura. |

La posición lateral de la agenda depende del espacio que realmente necesiten sus contenidos y los del calendario. Esta decisión no fija un nuevo umbral numérico ni autoriza a ocultar datos o acciones para hacerlos caber. El paso entre ambas posiciones debe conservar el acceso a fechas y eventos.

**Pendiente de validación manual:** comprobar vistas mensual y semanal, agenda visible y oculta, muchos eventos, textos largos y cambios de tamaño y zoom. La aprobación de esta composición no acredita por sí sola que el código actual la cumpla.

## Referencias de trabajo y contratos técnicos

Los [límites de entrada y procesamiento](architecture.md#límites-de-entrada-y-procesamiento) pertenecen a Arquitectura; el [flujo de trabajo y control de versiones](../AGENTS.md#flujo-de-trabajo-y-control-de-versiones), a las instrucciones generales.
