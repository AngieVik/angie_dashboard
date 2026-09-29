# Angie Dashboard — esquema conceptual

> Este documento es la fuente de verdad funcional y visual de Angie Dashboard. Recoge únicamente las decisiones aprobadas durante la conversación; cualquier nota auxiliar anterior se considera sustituida cuando exista una definición equivalente en este esquema. Las decisiones aún no tomadas aparecen expresamente como pendientes.

## 1. Propósito

Angie Dashboard será una herramienta operativa configurable para una sola persona. Permitirá preparar los recursos antes de un servicio y utilizar durante este una pizarra, elementos móviles y distintos módulos de apoyo.

Funcionará como una herramienta personal de apoyo y organización, equivalente en finalidad a una libreta de trabajo o un tablero físico. No sustituirá los registros, informes o documentos oficiales que correspondan.

La aplicación funcionará en Windows y Android, incluido el teléfono móvil, como una PWA instalable con una única base de código y una misma interfaz.

## 2. Principios definidos

- Uso individual, sin cuentas ni colaboración entre usuarios.
- No se diseñará como sistema oficial de registro, auditoría o certificación de actuaciones.
- El usuario conservará el control y la responsabilidad sobre la veracidad de los datos introducidos.
- Enfoque local-first: las funciones principales no dependerán de Internet.
- Se presupone que normalmente habrá conexión disponible, por lo que los módulos que lo necesiten podrán utilizar Internet.
- Una pérdida de conexión no deberá bloquear la pizarra, los elementos, estados, notas ni el documento activo; solo afectará a las funciones que dependan expresamente de la red.
- Una sola aplicación e interfaz para Windows y Android.
- Sistema modular con paneles que puedan mostrarse u ocultarse y organizarse dentro del espacio disponible.
- Configuración previa al comienzo de cada servicio.
- Documento de trabajo guardable y recuperable en formato JSON.
- Acciones visibles de `Nuevo`, `Guardar` y `Cargar`.
- No se utilizará el concepto anterior de «nueva sesión que borra automáticamente lo anterior».

## 3. Cabecera y nombre del documento

- La aplicación tendrá una barra de título siempre visible en la cabecera.
- La cabecera incluirá un menú `Archivo` para las acciones relacionadas con el documento.
- `Archivo` incluirá al menos `Nuevo`, `Cargar` y `Guardar`.
- La V1 no incluirá una acción `Cerrar`; la ventana o la PWA se cerrará mediante los controles del sistema.
- La cabecera incluirá un menú `Ver` desde el que se podrán abrir o cerrar todos los módulos.
- El estado visible u oculto de cada módulo se reflejará en el menú `Ver`.
- El título será editable.
- El título se utilizará como nombre del archivo JSON al guardarlo.
- Si el título está vacío, se utilizará `drp_<fecha>`.
- Los caracteres no válidos se eliminarán automáticamente del título.
- La aplicación no intentará inspeccionar las carpetas del usuario para detectar nombres repetidos; la confirmación de sobrescritura o la creación de un nombre alternativo corresponderá al selector nativo, al navegador o al sistema operativo.

## 4. Guardado y recuperación

### Requisito funcional definido

- El estado de trabajo se guardará en un documento JSON.
- El documento podrá guardarse, cargarse y reutilizarse otro día como configuración de partida o como continuación del trabajo.
- La posición de los pines deberá formar parte del estado guardado.
- El texto y la posición de las notas rápidas de pizarra deberán formar parte del estado guardado.
- El color de fondo seleccionado para la pizarra formará parte del estado guardado.
- La imagen JPG o PNG cargada como fondo será un recurso temporal de la sesión: no se guardará su ruta ni su contenido en el JSON o en el guardado automático interno.
- Después de cerrar o recargar la aplicación, o de cargar un documento, el usuario volverá a seleccionar manualmente la imagen local si desea utilizarla otra vez.
- Los trazos sencillos del canvas podrán incluirse en el estado guardado.
- Los datos de los módulos deberán conservarse dentro del documento cuando correspondan al trabajo activo.
- El Módulo Reloj queda excluido del archivo JSON importable y exportable.
- El JSON no incluirá el reloj, `T-Zero`, `T-Minus`, `Advisories`, sus notas ni sus estados de ejecución.
- Cargar un JSON no creará ni restaurará relojes o temporizadores procedentes del archivo.
- La recuperación automática interna de temporizadores tras una suspensión o cierre accidental será independiente del contenido del JSON visible.
- Las acciones `Guardar`, `Cargar` y `Nuevo` no detendrán, reiniciarán ni eliminarán los relojes o temporizadores que estén activos.
- Los relojes y temporizadores se gestionarán y cerrarán individualmente desde el Módulo Reloj.
- Existirá un único documento activo.
- El documento activo tendrá guardado automático interno.
- `Guardar` actualizará o exportará el JSON visible.
- `Cargar` abrirá otro JSON.
- `Nuevo` creará un documento vacío sin borrar archivos anteriores.

### Contenido definido del JSON

El JSON incluirá:

- Versión del formato y título del documento.
- Color de fondo de la pizarra.
- Trazos del lápiz.
- Texto y posición de las notas rápidas.
- Elementos: nombre, identificador del archivo de icono o emote, información, posición y valor del checkbox `Dotación`.
- Estado operativo, anotaciones y etiquetas de las dotaciones.
- Filtros activos del Módulo de elementos.
- Cuaderno: notas, checklist, elementos marcados y orden de los bloques.
- Registro cronológico completo.
- Posición y tamaño de los módulos.

El JSON no incluirá:

- La imagen de fondo de la pizarra ni su ruta local.
- Los archivos PNG; solo se conservará el identificador del icono elegido.
- Ningún dato del Módulo Reloj.
- La operación actual de la calculadora.
- Las coordenadas introducidas, sus conversiones o el enlace generado.
- El elemento seleccionado en ese momento.
- El zoom o la posición actual de la vista, que dependerán del dispositivo.
- La visibilidad momentánea de los módulos; cada sesión comenzará con todos cerrados.
- Modales, menús, herramientas u otros estados momentáneos de la interfaz.

### Estructura general y versionado

El documento se organizará mediante los siguientes bloques raíz:

```json
{
  "format": "angie-dashboard",
  "formatVersion": 1,
  "document": {},
  "board": {},
  "elements": [],
  "notebook": [],
  "timeline": [],
  "moduleLayouts": {},
  "filters": {}
}
```

- `format` identificará el archivo como un documento de Angie Dashboard.
- `formatVersion` identificará la versión de su estructura, independientemente de la versión de la aplicación.
- `document` contendrá el identificador, el título y las fechas de creación y modificación.
- `board` contendrá el color, los trazos y las notas rápidas de la pizarra.
- `elements` contendrá los elementos, dotaciones, iconos o emotes, información, posiciones y datos operativos.
- `notebook` contendrá las notas y checklist del Cuaderno.
- `timeline` contendrá el Registro cronológico.
- `moduleLayouts` contendrá la última posición y el último tamaño de cada módulo, pero no su visibilidad.
- `filters` contendrá los filtros operativos seleccionados.

La aplicación validará la estructura antes de cargar un archivo:

- Un archivo dañado o que no sea de Angie Dashboard no sustituirá el documento activo.
- Las versiones antiguas compatibles se migrarán internamente a la estructura vigente.
- El archivo original importado no se modificará automáticamente.
- Si el archivo procede de una versión futura que la aplicación no reconoce, se mostrará un aviso y no se cargará.
- Después de una migración, el formato vigente solo se exportará cuando el usuario guarde el documento.
- Se mantendrá un esquema de validación independiente basado en JSON Schema 2020-12.

### Campos internos definidos

- `document` utilizará `id`, `title`, `createdAt` y `updatedAt`.
- Los identificadores internos serán estables y permitirán distinguir elementos aunque compartan el mismo nombre visible.
- Las fechas y horas se almacenarán en un formato estándar independiente de la zona horaria y se mostrarán en la interfaz con la hora española.
- `board` utilizará `backgroundColor`, `strokes` y `quickNotes`.
- Cada trazo conservará su identificador, herramienta (`pen` o `eraser`), color cuando corresponda, grosor y puntos recorridos.
- Cada nota rápida conservará su identificador, texto y posición.
- Las posiciones de pines, notas y puntos de los trazos se almacenarán respecto al sistema interno del lienzo, no a los píxeles visibles del módulo, para conservar su ubicación al redimensionarlo.
- Cada entrada de `elements` conservará su identificador, nombre, representación visual, información libre, posición del pin y valor de `Dotación`.
- La representación visual distinguirá entre `emoji` y `asset`; en este último caso almacenará el identificador estable del PNG incluido en la aplicación y su escala proporcional.
- Los elementos marcados como dotación conservarán además su estado operativo, anotaciones y etiquetas.
- El estado operativo solo podrá contener uno de los ocho estados definidos.
- `notebook` conservará bloques identificados como nota o checklist, su contenido y su orden.
- Los checklist conservarán sus elementos y el estado marcado o desmarcado de cada uno.
- `timeline` distinguirá entre entradas manuales y cambios automáticos de estado.
- Cada entrada cronológica conservará un identificador y la fecha y hora completas.
- Los cambios automáticos conservarán la dotación, el estado anterior y el estado nuevo necesarios para la acción `Deshacer`.
- `moduleLayouts` relacionará cada módulo con sus coordenadas y dimensiones dentro del espacio lógico del dashboard.
- `filters` conservará los estados mostrados u ocultos por el filtro del Módulo de elementos.

### Decisión técnica de persistencia

Se combinarán ambas capas: guardado interno automático y archivo JSON importable y exportable.

En una PWA, la escritura sobre un archivo visible elegido por el usuario depende de los permisos y capacidades del navegador. `Guardar` seguirá este comportamiento:

- Cuando el navegador disponga de un selector de archivos compatible, el primer guardado abrirá ese selector con `<título_saneado>.json` como nombre sugerido.
- Si el documento ya está vinculado a un archivo, conserva el mismo título y el navegador mantiene el permiso, los guardados posteriores actualizarán directamente ese archivo.
- Si el título cambia, se abrirá de nuevo el selector con el nuevo nombre sugerido.
- Antes de escribir o descargar, la aplicación generará y validará completamente el JSON. Un error de serialización o validación no sustituirá el archivo anterior.
- Cancelar el selector no se considerará un error y no modificará el documento activo.
- Si el selector no está disponible, `Guardar` descargará el archivo JSON mediante el mecanismo normal del navegador.
- Si el selector falla por permisos u otro error, se conservará el trabajo activo y se ofrecerá la descarga del JSON como alternativa.
- El selector nativo, el navegador o el sistema operativo resolverán las confirmaciones de sobrescritura y los nombres repetidos.
- El autoguardado interno en IndexedDB será independiente del archivo visible y continuará funcionando aunque una exportación se cancele o falle.

### Protección y alcance de los datos

- La aplicación no se utilizará para almacenar datos clínicos ni datos de pacientes.
- La V1 no añadirá cifrado propio ni protección mediante contraseña.
- El archivo exportado será un JSON legible y recuperable con herramientas comunes.
- Cualquier persona con acceso al archivo podrá leer su contenido; la protección dependerá del dispositivo, su bloqueo y la ubicación elegida por el usuario para guardar el archivo.

## 5. Pizarra

- Será el espacio visual principal del dashboard.
- Permitirá elegir un color de fondo o cargar una imagen JPG o PNG.
- El color podrá recuperarse con el documento; la imagen cargada se mantendrá únicamente durante la sesión actual y deberá volver a elegirse cuando sea necesaria.
- La imagen se procesará localmente en el dispositivo y no se subirá a ningún servicio.
- Si su lado más largo supera `4096 px`, se creará en memoria una versión reducida de alta calidad que mantendrá la proporción original.
- El archivo JPG o PNG original no se modificará ni se sobrescribirá.
- Como protección frente a bloqueos por archivos excepcionales, la V1 rechazará imágenes superiores a `50 MiB` con un mensaje claro.
- Si la imagen no puede decodificarse o procesarse, la aplicación conservará el fondo anterior y mostrará el error sin cerrar la sesión.
- Dispondrá de una herramienta de lápiz con selector de color y grosor.
- Dispondrá de una goma de borrar que actuará exclusivamente sobre los trazos realizados con el lápiz.
- Se utilizará para anotaciones y trazos sencillos, no para dibujo avanzado.
- Sobre la pizarra se mostrarán y moverán los pines de los elementos.
- Permitirá añadir notas rápidas de texto breve que permanecerán visibles sobre la pizarra.
- Cada nota rápida podrá moverse como un pin, editarse y eliminarse.
- En la V1 tendrá un tamaño visual fijo y no incluirá formato avanzado ni colores configurables.
- La barra de herramientas de la pizarra tendrá cuatro modos explícitos: `Seleccionar/mover`, `Lápiz`, `Goma` y `Nota rápida`.
- `Seleccionar/mover` será el modo predeterminado. Permitirá seleccionar elementos, mover pines y notas rápidas mediante pulsación mantenida, y deseleccionar tocando un espacio vacío.
- En modo `Lápiz`, los gestos dibujarán sobre el canvas y no seleccionarán ni moverán pines o notas rápidas.
- En modo `Goma`, los gestos borrarán exclusivamente trazos del lápiz y no manipularán pines o notas rápidas.
- `Nota rápida` permitirá crear y colocar una nota; después de hacerlo, la pizarra volverá automáticamente a `Seleccionar/mover`.
- Los pines y las notas rápidas permanecerán visibles en todos los modos, aunque solo responderán a los gestos cuando corresponda.
- La posibilidad de generar una captura limpia desde la propia aplicación no está aprobada todavía.

## 6. Pines e interacción

- La aplicación incluirá nueve modelos visuales aprobados y proporcionados como archivos PNG: ambulancia, Pathfinder, quad, CP, EH, START, FINISH, advertencia y chincheta.
- Un elemento podrá utilizar uno de esos iconos PNG o un emote.
- El emote será libre: el usuario podrá escribir o pegar cualquier emoji, sin limitarse a una lista cerrada.
- Cada elemento se representará mediante su icono o emote y su nombre.
- Un clic o toque seleccionará el pin.
- El pin deberá poder moverse tanto con ratón como con interacción táctil.
- El movimiento se iniciará mediante un arrastre mantenido, con un margen de entre 200 y 300 milisegundos para diferenciarlo de la selección.
- Seleccionar un elemento actualizará los módulos relacionados con él.

### Catálogo técnico de iconos PNG

Los nueve archivos originales permanecerán en la carpeta `public/assets/elements` sin renombrarse, redimensionarse ni modificarse. La aplicación utilizará identificadores internos estables, independientes del nombre físico de cada archivo.

| ID interno | Nombre visible | Archivo | Clase visual | Tamaño inicial lógico |
| --- | --- | --- | --- | --- |
| `ambulance` | Ambulancia | `icon_medical.png` | Ancho | `150 × 100` |
| `pathfinder` | Pathfinder | `icon_vir.png` | Ancho | `150 × 100` |
| `quad` | Quad | `icon_quad.png` | Ancho | `150 × 100` |
| `checkpoint` | CP | `icon_cp.png` | Cuadrado | `110 × 110` |
| `hydration` | EH | `icon_eh.png` | Vertical | `80 × 120` |
| `start` | START | `icon_start.png` | Cuadrado | `110 × 110` |
| `finish` | FINISH | `icon_finish.png` | Ancho | `150 × 100` |
| `warning` | Advertencia | `icon_peligro.png` | Cuadrado | `110 × 110` |
| `pushpin` | Chincheta | `icon_chincheta.png` | Cuadrado | `110 × 110` |

- Los tamaños del catálogo se expresarán en las coordenadas lógicas del espacio de trabajo `1920 × 1080`; no describirán ni alterarán la resolución física de los archivos PNG.
- El tamaño inicial de cada icono corresponderá a una escala `1` o `100 %`.
- Cada pin que utilice un icono PNG podrá redimensionarse entre `0.5` y `3`, equivalentes al `50 %` y al `300 %` de su tamaño inicial.
- La redimensión utilizará un único valor de escala proporcional, por lo que la relación de aspecto original nunca podrá deformarse.
- El mismo valor de escala podrá modificarse mediante un tirador visible al seleccionar el pin y mediante un control deslizante en la configuración del elemento.
- Ambos controles permanecerán sincronizados y actualizarán el mismo valor.
- La escala elegida se guardará dentro de la representación visual del elemento en el JSON.
- El nombre visible del elemento conservará un tamaño de texto independiente y no aumentará ni disminuirá junto con el icono.

### Modelo visual aprobado: ambulancia

- Será una ambulancia tipo furgón representada de perfil lateral completo y orientada hacia la derecha.
- La carrocería será amarilla, con una franja negra para las luces de posición, puente de luces azul y cristales delanteros oscuros azulados. La puerta lateral trasera no mostrará cristal: esa superficie será un panel amarillo continuo. El patrón Battenburg verde y amarillo ocupará únicamente la zona inferior comprendida entre esa franja negra y el borde bajo de la carrocería; estará formado por dos filas de cuadrados pequeños alternos y no aparecerá por encima de la franja.
- No incluirá palabras, matrículas legibles, marcas, escudos ni logotipos.
- Tendrá un acabado inequívoco de dibujo o boceto recortado para utilizarlo como pin, con formas simplificadas y trazos visibles; no deberá parecer una fotografía, un render 3D ni una ilustración realista.
- La silueta seguirá un contorno recortado de cartulina y mostrará un pequeño grosor visible y una sombra suave y corta, como una pieza colocada sobre una pizarra.
- El archivo tendrá fondo transparente y no incluirá la superficie de la pizarra de corcho.
- La ambulancia aparecerá centrada, con un margen mínimo alrededor de toda la silueta.
- El diseño deberá continuar siendo reconocible cuando se reduzca al tamaño de un pin.

### Modelo visual aprobado: Pathfinder

- Será un todoterreno de cinco puertas tipo Pathfinder R51 representado de perfil lateral completo y orientado hacia la derecha.
- La carrocería será amarilla, con cristales tintados negros y un puente de luces azul centrado sobre el techo.
- Incluirá protecciones delanteras y estribos laterales cromados, además de un cabestrante delantero con el cable y el gancho visibles.
- El patrón Battenburg verde y amarillo estará formado por dos filas de cuadrados pequeños alternos y ocupará una franja central más alta que en la ambulancia, aproximadamente desde la altura donde comienzan los huecos de las ruedas y centrada entre las ventanillas y el bajo.
- Mantendrá el mismo acabado de dibujo o boceto recortado, contorno de cartulina, sombra suave, fondo transparente y ausencia de textos, números, marcas y logotipos definidos para la ambulancia.

### Modelo visual aprobado: quad

- Será un quad de asistencia azul, sin conductor, representado de perfil lateral completo y orientado hacia la derecha.
- Incluirá una maleta rígida negra cerrada sobre la parrilla trasera y una mochila de tela oscura sujeta sobre la parrilla delantera.
- Un mástil negro vertical se elevará desde la parte trasera y terminará en una luminosa azul claramente visible.
- Tendrá exactamente dos detalles reflectantes amarillos: uno en el guardabarros delantero y otro en el trasero.
- Mantendrá el mismo acabado de dibujo o boceto recortado, contorno de cartulina, sombra suave, fondo transparente y ausencia de textos, números, marcas y logotipos definidos para los modelos anteriores.

### Modelo visual aprobado: CP

- Representará un control de paso únicamente mediante un cronómetro deportivo grande, negro y metálico, centrado en la composición.
- La esfera del cronómetro mostrará únicamente las letras `CP` en rojo intenso, grandes y legibles.
- No incluirá carretera, números, marcas, paisaje, vehículos ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: EH

- Representará una estación de hidratación mediante una botella de agua transparente, vertical y centrada.
- La botella contendrá agua con un tono azul muy suave y tendrá un tapón azul.
- Una etiqueta blanca limpia rodeará el centro de la botella y mostrará únicamente las letras `EH` en azul intenso, grandes y centradas.
- No incluirá marcas, números ni otros textos o elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: START

- Representará el inicio mediante una bandera a cuadros negros y blancos ligeramente ondeando, con un asta metálica corta y suavemente inclinada.
- La bandera mostrará las letras `START` en rojo intenso, grandes y centradas directamente sobre los cuadros, sin franja ni placa detrás del texto.
- No incluirá otros símbolos, números o palabras.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: FINISH

- Representará la meta mediante un puente hinchable visto de frente, con dos pilares y un travesaño blancos de formas redondeadas.
- Los pilares y el travesaño mostrarán bandas negras diagonales distribuidas sobre la superficie blanca.
- Un panel negro rectangular estará suspendido dentro del arco y mostrará únicamente la palabra `FINISH` en blanco, grande y centrada.
- No incluirá marcas, números, patrocinadores ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: advertencia

- Representará una advertencia mediante un triángulo equilátero amarillo con las esquinas ligeramente redondeadas y un borde negro grueso.
- Mostrará únicamente el símbolo `!` en negro, grande y centrado.
- No incluirá soporte, texto ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno exterior de cartulina crema y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: chincheta

- Representará una chincheta de mapa roja, con un cuerpo plástico ancho y ergonómico que pueda cogerse fácilmente con dos dedos y una aguja metálica claramente visible.
- Estará inclinada aproximadamente 25 grados hacia la derecha, con la cabeza situada arriba a la izquierda y la punta dirigida abajo a la derecha.
- No incluirá manos, dedos, texto ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno exterior de cartulina crema y fondo transparente de los modelos anteriores.

## 7. Módulo de elementos

- Permitirá crear elementos antes de comenzar el servicio.
- Un elemento podrá representar una dotación o cualquier otro objeto, posición, aviso o referencia que deba aparecer en la pizarra.
- Mostrará todos los elementos creados y permitirá seleccionarlos directamente desde el propio módulo.
- Separará visualmente los elementos en `Dotaciones` y `Generales`.
- El nombre será libre.
- Permitirá elegir un icono PNG disponible o escribir o pegar cualquier emoji.
- Incluirá un checkbox `Dotación` para indicar si el elemento debe tratarse como una dotación y activar los módulos relacionados con ellas.
- Dispondrá de un campo de texto amplio para introducir información libre.
- Después de configurarse, el elemento aparecerá como pin movible en la pizarra.
- No están definidos campos estructurados adicionales aparte del nombre, el icono o emote, el checkbox `Dotación` y el texto libre.
- Incluirá un botón de configuración `⚙` desde el que se podrán añadir, quitar, duplicar y modificar elementos.
- Incluirá un filtro visual para mostrar u ocultar dotaciones según su estado y fase.
- El filtro representará la secuencia `🟢`, `🟡`, `🔵`, `🔴`, `💠`, `🟠`, `🟢` y `⚫`, sin letras añadidas.
- Los dos controles verdes comparten el significado operativo de que la unidad está lista para recibir un aviso: `Disponible` en su punto de cobertura u `Operativa` mientras regresa hacia él.
- Cada control del filtro mostrará su nombre completo como ayuda al mantener pulsado o pasar el cursor.

Ejemplo de contenido del módulo:

```text
Dotaciones:
🚑 Tango 1
🚑 Tango 2
🚑 Tango 3
🚁 Charlie 3
🚗 Papa 4
[filtro 🟢 🟡 🔵 🔴 💠 🟠 🟢 ⚫]

Generales:
🏥 H. Vithas
🚴🏽‍♂️ Cabeza de carrera
🏃🏽‍♂️ Cola carrera
📍 Avituallamiento
⚠ OJO CUIDAO
⚕ PSA

[⚙]
```

Ejemplo de una dotación:

```text
Nombre: Echo 1
Icono: 🚑
Dotación: [x]

TES: Pichu
DUE: Kiko Perez
Medico: Juan Antonio Holiqtal
```

## 8. Módulo de información

- Mostrará la información de cualquier elemento seleccionado, tanto si es una dotación como si no.
- La información procederá del texto introducido al configurar el elemento.
- Cuando se seleccione una dotación, mostrará también la fase asociada a su estado.
- Cuando no haya ningún elemento seleccionado, mostrará una vista global de la flota.
- La vista global solo mostrará contadores de los estados o fases que tengan al menos una dotación.
- Al hacer clic o tocar un espacio vacío se deseleccionará el elemento y el módulo volverá a mostrar la vista global.

Ejemplo de vista global:

```text
🟢 8 Libres
🔴 2 Interviniendo
💠 1 En traslado
⚫ 1 Inoperativa
```

## 9. Módulo operativo

- Solo incluirá los elementos que tengan marcado el checkbox `Dotación`.
- Permitirá seleccionar una dotación y cambiar su estado mediante un selector.
- El selector utilizará los valores de la columna `Estado` como código CCU; la fase asociada se mostrará en el módulo de información.
- Permitirá agregar anotaciones durante el servicio.
- Los ocho estados definidos serán fijos; no se crearán estados adicionales o circunstanciales.
- Las circunstancias que no formen parte de esos estados se registrarán mediante etiquetas o anotaciones independientes, sin modificar el estado operativo.

### Estados y fases

| Estado | Fase | UI | Información |
| --- | --- | --- | --- |
| Disponible | Espera | 🟢 | Unidad posicionada en su punto de cobertura. |
| Asignada | Activación | 🟡 | Se ha transmitido por radio un aviso prioritario. |
| En camino | Aproximación | 🔵 | Unidad movilizada. |
| En el lugar | Intervención | 🔴 | Unidad en asistencia sanitaria. |
| Traslado | Evacuación | 💠 | Traslado de paciente. |
| En destino | Transferencia | 🟠 | Transferencia en el destino objetivo. |
| Operativa | Retorno | 🟢 | Unidad regresando a su punto de cobertura asignado por el recorrido. |
| Inoperativa | Bloqueo | ⚫ | Unidad inmovilizada. |

## 10. Módulo de coordenadas

- Aceptará coordenadas introducidas por el usuario.
- Admitirá y convertirá entre `Grados Decimales (DD)`, `Grados, Minutos y Segundos (DMS)`, `Grados y Minutos Decimales (DMM)` y `UTM (Universal Transverse Mercator)`.
- Los formatos canónicos de entrada y salida serán:

| Formato | Ejemplo |
| --- | --- |
| Grados Decimales (`DD`) | `37.060234, -2.002295` |
| Grados, Minutos y Segundos (`DMS`) | `37°03'36.8"N 2°00'08.2"W` |
| Grados y Minutos Decimales (`DMM`) | `37°03.614'N 2°00.137'W` |
| Universal Transverse Mercator (`UTM`) | `30S 588700 4101800` |

- En UTM, el identificador inicial estará formado por el número de huso y la banda de latitud; en `30S`, `30` será el huso y `S` será la banda.
- La letra de banda UTM nunca se interpretará directamente como una abreviatura de hemisferio. En particular, la `S` de `30S` no significará hemisferio sur.
- Se admitirán los husos del `1` al `60` y las bandas UTM válidas desde `C` hasta `X`, excluyendo `I` y `O`.
- Las bandas de `N` a `X` se convertirán internamente como hemisferio norte y las bandas de `C` a `M` como hemisferio sur.
- Después del identificador UTM aparecerán siempre las coordenadas Este y Norte, en ese orden.
- Una zona, banda o estructura UTM inválida impedirá la conversión y conservará íntegramente el texto introducido.
- Generará un enlace de Google Maps.
- La acción principal sobre el enlace será copiarlo para enviarlo a otra persona.
- Abrir Google Maps desde la aplicación no es un requisito inicial.
- Solo se corregirán automáticamente los espacios y los errores de separación mediante puntos o comas.
- La corrección nunca modificará, añadirá ni eliminará números.
- Por ejemplo, `37.060234. -2.002295` se normalizará como `37.060234, -2.002295`.
- Si la entrada continúa siendo inválida después de corregir espacios y separadores, se conservará íntegramente el texto introducido.
- El campo se marcará visualmente como incorrecto y mostrará un mensaje breve indicando qué parte no se reconoce.
- Mientras la entrada sea inválida no se convertirán las coordenadas ni se generará el enlace de Google Maps.
- La aplicación no modificará números ni intentará adivinar coordenadas para resolver una entrada inválida.

## 11. Otros módulos definidos

### Módulo Reloj

Reunirá en un único módulo el reloj, los cronómetros, las cuentas regresivas y los avisos temporizados.

#### Reloj

- Mostrará un reloj digital de estética táctica con la hora local de España.
- La hora española se ajustará automáticamente al horario de verano (`UTC+2`) o al horario de invierno (`UTC+1`); el usuario no tendrá que cambiarlo manualmente.
- La interfaz mostrará las referencias `UTC+2 [ST]`, `UTC+1 [WT]` y `ESP` como parte de la estética táctica del reloj.
- Estas referencias no serán selectores ni modos de funcionamiento y no implicarán añadir temática, personajes o adornos ajenos al reloj.
- Mostrará también la hora Zulu, es decir, UTC, como referencia secundaria.

#### T-Zero

- El botón `[+] T-Zero` añadirá un cronómetro nuevo.
- Se podrán añadir varios cronómetros.
- Cada cronómetro mostrará el tiempo en formato `HH:MM:SS`.
- Cada cronómetro podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar a cero y cerrar.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏸] [⏹]    [❌]
[nota libre]
```

#### T-Minus

- El botón `[+] T-Minus` añadirá una cuenta regresiva nueva.
- Se podrán añadir varias cuentas regresivas.
- El usuario introducirá la duración inicial en formato `HH:MM:SS`.
- Cada cuenta regresiva podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar al tiempo inicial y cerrar.
- El contador comenzará en la duración elegida y avanzará regresivamente hasta `00:00:00`.
- Al llegar a cero completará su ciclo y activará las alertas visual y sonora comunes.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏸] [⏹]    [❌]
[nota libre]
```

#### Advisories

- El botón `[+] Advisories` añadirá un aviso temporizado nuevo.
- Se podrán añadir varios avisos.
- El usuario configurará la duración del aviso en formato `HH:MM:SS`; por ejemplo, `00:15:00` establecerá un ciclo de quince minutos.
- El contador comenzará en `00:00:00` y avanzará hacia delante hasta alcanzar la duración configurada.
- Cada aviso podrá tener una nota libre asociada.
- Controles definidos: iniciar, desactivar y cerrar.
- Al alcanzar la duración configurada completará su ciclo y activará las alertas visual y sonora comunes.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏹]         [❌]
[nota libre]
```

#### Finalización y alertas de T-Minus y Advisories

- Cuando un `T-Minus` o un `Advisory` complete su ciclo, activará simultáneamente una alerta visual y una alerta sonora.
- La alerta visual afectará al temporizador correspondiente mediante un destello rojo intenso con resplandor marcado y un borde exterior blanco claramente visible.
- El valor inicial será de dos destellos por segundo.
- La frecuencia se definirá como un parámetro configurable de la implementación, no como un límite rígido ni como una opción ajustable por el usuario en la V1, para que pueda modificarse posteriormente sin rediseñar la alerta.
- La alerta sonora utilizará el archivo local `public/assets/audio/alarm.mp3`.
- `alarm.mp3` tiene una duración aproximada de un segundo, ocupa aproximadamente `14 KB` y está preparado para reproducirse en bucle sin un corte perceptible.
- El archivo se reproducirá en bucle mientras la alerta permanezca activa.
- El timbre formará parte de los recursos locales de la aplicación instalada.
- Un clic o toque sobre el temporizador completado reconocerá la alerta y detendrá conjuntamente el timbre y el parpadeo.
- Después de reconocerla, el temporizador permanecerá visible como finalizado hasta que el usuario lo reinicie o lo cierre.

- El módulo se diseñará principalmente para utilizarse mientras Angie Dashboard permanezca abierto, que será su uso habitual.
- No es un requisito inicial imprescindible que un timbre despierte la aplicación cuando esté completamente cerrada.
- Los temporizadores se calcularán mediante marcas de tiempo y no dependerán de que el navegador ejecute una actualización exacta cada segundo.
- Si la aplicación queda en segundo plano, la pantalla se bloquea o Android la suspende, el tiempo continuará transcurriendo.
- Al volver a la aplicación, cada temporizador recalculará inmediatamente su valor correcto.
- Si un `T-Minus` o un `Advisory` completó su ciclo mientras la aplicación estaba suspendida, activará el borde y el timbre al regresar.
- No se garantiza que la alerta visual o sonora se ejecute mientras la aplicación permanezca completamente suspendida o cerrada.
- El guardado automático interno conservará los datos temporales necesarios para recuperar correctamente los temporizadores al abrir de nuevo la aplicación.
- Esta recuperación interna no exportará los temporizadores al JSON ni permitirá importarlos desde él.
- Cambiar de documento mediante `Guardar`, `Cargar` o `Nuevo` no alterará los temporizadores activos.

### Calculadora

- Incluirá una calculadora básica.
- Permitirá suma, resta, multiplicación, división, decimales, porcentajes y paréntesis.
- Incluirá acciones para borrar el último carácter y limpiar completamente la operación.
- La V1 no incluirá operaciones científicas ni conversiones adicionales.

### Cuaderno

- Será un módulo de trabajo para tomar y organizar apuntes durante el servicio.
- Su contenido se organizará como una lista desplazable de bloques independientes.
- Un botón `+` permitirá elegir el tipo de bloque que se quiere añadir.
- Permitirá añadir, como tipos diferenciados, una nota libre o un checklist.
- Cada nota o checklist constituirá un bloque independiente dentro de la lista.
- Los bloques no tendrán un campo de título independiente.
- Si el usuario necesita un título, lo escribirá como primera línea del propio contenido.
- Los elementos de un checklist se podrán marcar y desmarcar.
- Los bloques nuevos se añadirán al final de la lista.
- Los bloques podrán reordenarse manualmente mediante un tirador dedicado `⠿`.
- En interacción táctil, el movimiento solo se iniciará desde ese tirador para no interferir con el desplazamiento vertical de la lista.
- Las notas utilizarán texto sencillo multilínea, con saltos de línea, símbolos y emojis.
- La V1 no incluirá un editor de negritas, cursivas, tamaños ni otros formatos especiales.
- Cualquier otro tipo de entrada que pudiera añadirse al Cuaderno queda fuera de lo definido para la V1.

### Registro cronológico

- Registrará entradas ordenadas cronológicamente.
- Su funcionamiento será independiente de la visibilidad de su módulo.
- Aunque el módulo permanezca cerrado, seguirá creando las entradas automáticas que correspondan y conservando las entradas existentes.
- Abrir o cerrar el módulo solo afectará a su visualización, no al registro de acontecimientos.
- Funcionará de forma mixta, combinando entradas manuales y entradas automáticas.
- El usuario podrá añadir manualmente cualquier acontecimiento que considere relevante.
- Se generará automáticamente una entrada cuando una dotación cambie de estado.
- No se registrarán automáticamente otras acciones de la aplicación en la V1, para evitar ruido innecesario.
- Cada entrada incluirá automáticamente la hora local española.
- El usuario no tendrá que escribir la hora: la aplicación la inyectará al crear la entrada.
- La interfaz utilizará un formato compacto que diferenciará por su contenido las entradas automáticas y las manuales.
- Internamente se conservarán la fecha y la hora completas, aunque en la línea visible se muestre principalmente la hora.
- Las entradas manuales podrán editarse o eliminarse directamente desde la interfaz.
- Una entrada automática de cambio de estado ofrecerá una acción `Deshacer`.
- `Deshacer` restaurará el estado anterior de la dotación y eliminará la entrada automática creada por error.
- No será necesario editar el archivo JSON para corregir estos errores.
- Las entradas se presentarán en orden ascendente: las más antiguas arriba y las nuevas abajo.
- Si el usuario ya está observando el final del registro, una entrada nueva desplazará automáticamente la vista hasta ella.
- Si el usuario está revisando entradas anteriores, la llegada de una nueva entrada no moverá su posición de lectura.

Ejemplo:

```text
14:32:08 · 🚑 Tango 1 · Asignada 🟡 → En camino 🔵
14:35:11 · Acceso norte cerrado temporalmente
```

## 12. Sistema modular y docking

- Los módulos estarán contenidos dentro de la interfaz principal.
- Cada sesión comenzará con el dashboard vacío y todos los módulos cerrados.
- No existirá una distribución inicial obligatoria ni una clasificación entre módulos principales y auxiliares.
- El usuario abrirá o cerrará individualmente los módulos que necesite desde el menú `Ver`.
- La `Pizarra` será un módulo más y no tendrá una posición inicial reservada.
- Cada módulo podrá moverse y redimensionarse libremente dentro del dashboard.
- La organización se resolverá mediante una cuadrícula invisible sobre el espacio de trabajo virtual.
- Los módulos podrán moverse y redimensionarse sobre esa cuadrícula.
- Se permitirán huecos entre módulos.
- Los módulos no podrán solaparse entre sí durante su colocación normal; solo se permitirá la excepción temporal definida para abrir un módulo cuando no exista ningún hueco libre.
- El empaquetado y la recolocación automáticos permanecerán desactivados: mover o redimensionar un módulo no deberá reorganizar por sí solo los demás.
- No se utilizará un docking completo basado en grupos de pestañas, divisiones de pantalla o paneles propios de un IDE.
- La solución técnica seleccionada para esta función es `React Grid Layout`.
- El espacio de trabajo utilizará `1920 × 1080` como sistema lógico de coordenadas y se ajustará visualmente al espacio disponible en cada pantalla.
- La cabecera permanecerá fija, siempre visible y fuera del área afectada por el desplazamiento o el zoom.
- Los módulos ocuparán el espacio de trabajo situado bajo la cabecera.
- El dashboard no crecerá verticalmente ni obligará a utilizar scroll de página para acceder a módulos.
- Al abrir un módulo, recuperará su última posición y tamaño guardados cuando existan.
- Si un módulo todavía no tiene posición o tamaño guardados, aparecerá con un tamaño inicial válido dentro del dashboard.
- Abrir o cerrar módulos no moverá ni redimensionará automáticamente los demás.
- La visibilidad de los módulos será temporal para la sesión y no se restaurará desde el JSON.
- El dashboard será un único espacio de trabajo virtual con la misma distribución, posiciones y tamaños en Windows y Android.
- En Windows y Android se mostrará el mismo dashboard ajustado al espacio disponible, sin crear una composición distinta para cada dispositivo.
- Los módulos no se reorganizarán automáticamente en columnas, pestañas o una interfaz móvil diferente.
- La distribución de módulos guardada en el JSON será común para todos los dispositivos.
- La posición y el tamaño de cada módulo se serializarán para poder restaurar la distribución.

### Apertura, tamaño y colocación de módulos

Cada módulo tendrá un tamaño inicial y un tamaño mínimo expresados en las coordenadas lógicas del espacio `1920 × 1080`:

| Módulo | Tamaño inicial | Tamaño mínimo |
| --- | --- | --- |
| Pizarra | `720 × 480` | `320 × 220` |
| Elementos | `300 × 420` | `220 × 240` |
| Información | `320 × 240` | `220 × 140` |
| Operativo | `340 × 320` | `240 × 200` |
| Coordenadas | `360 × 280` | `260 × 180` |
| Reloj | `440 × 480` | `320 × 260` |
| Calculadora | `280 × 360` | `220 × 280` |
| Cuaderno | `360 × 420` | `260 × 220` |
| Registro cronológico | `420 × 320` | `280 × 180` |

- El usuario podrá ampliar cualquier módulo hasta ocupar como máximo el espacio lógico disponible, pero no podrá reducirlo por debajo de su tamaño mínimo.
- En el tamaño mínimo permanecerán visibles la cabecera y los controles esenciales; el contenido que no quepa utilizará desplazamiento interno sin provocar scroll de página.
- Si un módulo tiene una posición y un tamaño guardados que no colisionan con los módulos abiertos, recuperará exactamente esa distribución.
- Si su distribución guardada está ocupada, buscará el hueco libre más cercano manteniendo el tamaño guardado.
- Si el módulo nunca tuvo una distribución guardada, buscará un hueco para su tamaño inicial desde la esquina superior izquierda, avanzando de izquierda a derecha y después hacia abajo sobre la cuadrícula invisible.
- La búsqueda de espacio nunca moverá ni redimensionará los módulos que ya estén abiertos.
- Si no existe ningún hueco válido, el módulo se abrirá centrado con su tamaño mínimo, activo y por encima de los demás.
- La apertura sin espacio será la única situación en la que un módulo podrá solaparse temporalmente con otros.
- En ese caso se mostrará el aviso breve y no bloqueante `No hay espacio libre. Recoloca o cierra algún módulo.`
- El módulo dejará automáticamente la situación excepcional cuando el usuario lo coloque sin solapamientos o lo cierre.
- La posición final y el tamaño utilizado se conservarán en `moduleLayouts`.

### Navegación en pantallas móviles

- El espacio lógico `1920 × 1080` se recorrerá en pantallas móviles mediante gestos directos, sin utilizar barras de desplazamiento de página, una miniatura de navegación ni un modo de desplazamiento separado.
- Pellizcar con dos dedos ampliará o reducirá la vista y mantendrá como centro del zoom el punto situado entre ambos dedos.
- Arrastrar con dos dedos desplazará la vista del dashboard.
- Los gestos realizados con un solo dedo se reservarán para manejar los módulos, pines, controles y herramientas de la pizarra.
- Un dedo sobre la cabecera de un módulo permitirá moverlo.
- Un dedo sobre un borde o tirador permitirá redimensionar el módulo o el pin correspondiente.
- Un dedo sobre controles o listas permitirá accionarlos o desplazar su contenido normalmente.
- Un dedo sobre la pizarra seleccionará, moverá, dibujará, borrará o creará notas según la herramienta que esté activa.
- Mientras haya dos dedos interactuando con el dashboard, se suspenderán temporalmente las acciones de módulos, pines y dibujo para evitar movimientos o trazos accidentales.
- La cabecera principal permanecerá fija, fuera del área afectada por el desplazamiento y el zoom.
- El zoom mínimo será el valor dinámico necesario para encajar y centrar por completo el espacio `1920 × 1080` en el área disponible de la pantalla.
- El zoom máximo será `200 %`.
- El desplazamiento se limitará para impedir que el espacio de trabajo desaparezca completamente fuera de la pantalla; el margen elástico fuera de cada borde no superará el `10 %` de la dimensión visible correspondiente.
- La cabecera incluirá un botón `Encajar` que centrará el dashboard y aplicará el mayor nivel de zoom con el que pueda verse completo.
- Junto al botón `Encajar` se mostrará el porcentaje de zoom actual únicamente como información.
- Cada sesión nueva comenzará con la vista completa en modo `Encajar`.
- El zoom y la posición de la vista se conservarán mientras la aplicación permanezca abierta.
- Abrir, cerrar, mover o redimensionar módulos no modificará automáticamente el zoom ni la posición de la vista.
- Al cambiar la orientación del dispositivo se conservará el mismo punto lógico central y solo se reajustarán el zoom y los límites cuando resulte necesario para mantener una vista válida.
- El zoom y la posición serán estados locales y temporales: no se incluirán en el JSON ni se trasladarán entre dispositivos.

## 13. Stack tecnológico definitivo

La V1 utilizará:

- `React` como base de la interfaz.
- `TypeScript` para tipar los datos, estados, documentos y componentes.
- `Vite` como herramienta de desarrollo y compilación.
- Una PWA instalable en Windows y Android, sin crear aplicaciones independientes para cada sistema.
- `shadcn/ui` como base para los controles visuales.
- `React Grid Layout` para mover, redimensionar, serializar y restaurar la distribución de los módulos sobre la cuadrícula invisible.
- `Konva` mediante su integración con React para la pizarra y sus trazos.
- `IndexedDB`, mediante `Dexie`, para el autoguardado interno y la recuperación local.
- `Proj4` para las conversiones relacionadas con coordenadas UTM.
- `Netlify` para alojar y distribuir los archivos estáticos de la PWA.

Netlify no almacenará los documentos JSON ni el autoguardado del usuario. Esos datos permanecerán en el dispositivo, salvo cuando el usuario exporte o importe manualmente un archivo.

Los recursos estáticos aprobados se organizarán de la siguiente forma:

- `public/assets/elements`: nueve iconos PNG utilizados por los pines.
- `public/assets/audio/alarm.mp3`: timbre local de `T-Minus` y `Advisories`.
- La chincheta roja `public/assets/elements/icon_chincheta.png` será la fuente visual para generar los tamaños necesarios del icono instalable de la PWA, sin modificar el archivo original.

shadcn/ui se utilizará especialmente en:

- Botones, campos de texto y selectores.
- Menús y barra superior.
- Diálogos de confirmación.
- Pestañas, paneles, áreas desplazables y separadores redimensionables.
- Badges para estados.
- Tooltips, popovers, avisos y notificaciones dentro de la aplicación.
- Checkboxes y controles del checklist.

shadcn/ui no resolvería por sí solo:

- El canvas de dibujo.
- El sistema completo de docking.
- El movimiento de pines sobre la pizarra.
- El guardado y carga del JSON.
- La conversión de coordenadas.
- Los temporizadores y la lógica operativa.

Por tanto, shadcn/ui será la base de controles visuales, no la arquitectura completa. Todavía no se ha instalado ni se han elegido componentes o presets concretos.

## 14. Dirección visual

La interfaz seguirá una dirección industrial táctica inspirada en la estética Titan, con acabado elaborado y sin limitarse a superficies planas o controles sobredimensionados.

### Paleta base aproximada

| Uso | Color |
| --- | --- |
| Fondo general | `#0C0D0E` |
| Módulos | `#17191B` |
| Cabeceras de módulos | `#25282B` |
| Bordes normales | `#555B60` |
| Texto principal | `#F2F2F0` |
| Texto secundario | `#A7ADB1` |
| Acento rojo | `#D63A3A` |
| Acento amarillo | `#E3B52F` |

Estos valores son una base de diseño y podrán ajustarse durante la composición visual sin cambiar la dirección aprobada.

### Características aprobadas

- Fondo negro profundo con degradados suaves entre negro, grafito y gris acero.
- Textura técnica sutil, como metal satinado, grano fino o una trama geométrica discreta.
- Módulos con profundidad mediante sombras, reflejos superiores, bordes interiores y diferentes capas de gris.
- Cabeceras con degradado metálico oscuro y detalles de color.
- Esquinas rectas o ligeramente biseladas, con posibilidad de cortes angulares propios de un panel técnico.
- Bordes con brillo y relieve cuando el módulo esté activo.
- Botones compactos y detallados, con estados visuales diferenciados de reposo, foco, pulsado y activo.
- Los controles podrán utilizar volumen, bisel, iluminación interior o apariencia de interruptor físico cuando encaje con su función.
- El rojo será un acento de identidad para líneas, selecciones, indicadores activos, detalles de cabecera y acciones importantes.
- El amarillo se utilizará como segundo acento en marcadores, avisos o pequeños elementos técnicos.
- El blanco frío se utilizará para la información principal y los grises claros para la información secundaria.
- Los estados operativos conservarán sus colores y una forma visual reconocible para no confundirse con los acentos decorativos.
- Las cabeceras, menús y nombres de módulos utilizarán una tipografía firme y condensada.
- El reloj, los tiempos, las coordenadas, los contadores y otros datos técnicos utilizarán una tipografía monoespaciada.
- Las animaciones serán rápidas y precisas: cambios de brillo, encendido de líneas, pulsaciones mecánicas y transiciones cortas.
- Se permitirá un resplandor controlado en elementos activos; los destellos intensos quedarán reservados para alarmas.
- El área vacía del dashboard conservará presencia visual mediante degradado, viñeta o trama sutil.
- La interfaz será compacta y aprovechará el espacio disponible; no se impondrá una estética móvil simplificada ni controles deliberadamente sobredimensionados.

### Anatomía común de las ventanas

- Cada módulo utilizará una cabecera compacta como zona de arrastre.
- La cabecera incluirá un pequeño detalle de acento rojo o amarillo.
- El nombre del módulo aparecerá a la izquierda.
- Un botón `×` situado a la derecha permitirá cerrar el módulo.
- Los módulos podrán redimensionarse desde sus bordes y esquinas.
- La esquina inferior derecha mostrará un tirador de redimensionado discreto.
- El módulo activo se distinguirá mediante un borde iluminado y una profundidad ligeramente mayor.
- La V1 no incluirá controles comunes de minimizar o maximizar; el menú `Ver` y el botón `×` cubrirán la apertura y el cierre.

## 15. Alcance expresamente no decidido

- Mapas interactivos o mapas offline.
- Sincronización entre dispositivos.
- Exportación de informes o capturas desde la aplicación.
- Funciones de registro oficial, auditoría, firma o certificación de actuaciones.
- Publicación en tiendas, despliegue o distribución.

## 16. Estado de preparación para la construcción

- `ESQUEMA_CONCEPTUAL.md` es la especificación funcional y visual de referencia.
- `AGENTS.md` contiene las instrucciones de ejecución y los límites de alcance para Codex.
- `IMPLEMENTATION_PLAN.md` divide la construcción en entregas verificables.
- `ACCEPTANCE_CRITERIA.md` reúne las comprobaciones necesarias para considerar terminada la V1.
- Las notas históricas anteriores al esquema se conservan únicamente en `docs/archive` y no constituyen requisitos vigentes.
- No quedan decisiones imprescindibles pendientes para comenzar la construcción de la V1.
- El despliegue, la publicación y cualquier cambio en producción continúan fuera de alcance hasta recibir autorización expresa.
