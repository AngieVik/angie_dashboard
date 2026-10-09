# Angie Dashboard — esquema vigente

## 1. Propósito y fuentes

PWA personal de apoyo operativo y organización para Windows y Android, con pizarra, recursos móviles y módulos de trabajo. Los ejemplos utilizan datos operativos ficticios.

Este esquema recoge las funciones generales. La [especificación funcional](docs/superpowers/specs/2026-10-05-revision-dashboard-design.md) define los contratos detallados; el [plan](docs/archive/plan.md) organiza entregas y estado, y los [criterios](ACCEPTANCE_CRITERIA.md) definen la comprobación. Las actualizaciones sustituyen el texto afectado en su sitio.

## 2. Documento y archivos

- La aplicación tendrá una barra de título siempre visible en la cabecera.
- La cabecera incluirá un menú `Archivo` para las acciones relacionadas con el documento.
- `Archivo` incluirá al menos `Nuevo`, `Cargar` y `Guardar`.
- La ventana o PWA se cierra mediante los controles del sistema.
- La cabecera incluirá un menú `Ver` desde el que se podrán abrir o cerrar todos los módulos.
- El estado visible u oculto de cada módulo se reflejará en el menú `Ver`.
- El título será editable.
- El título se utilizará como base para proponer el nombre del archivo JSON al guardarlo. El saneamiento del nombre de archivo no modificará el título visible ni el valor almacenado en el documento.
- Para obtener el nombre de archivo se eliminarán los caracteres de control y los caracteres `<>:"/\|?*`, además de los espacios y puntos situados al final. Se conservarán las letras acentuadas, los espacios interiores, los guiones y los guiones bajos.
- Si el título saneado ya termina en `.json`, sin distinguir mayúsculas y minúsculas, se retirará temporalmente esa extensión para validar el nombre base. Después se añadirá `.json` exactamente una vez.
- Si el nombre base queda vacío o coincide, sin distinguir mayúsculas y minúsculas, con `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9` o `LPT1`–`LPT9`, se utilizará `drp_YYYY-MM-DD_HH-mm-ss.json`, generado con la fecha y hora local del dispositivo en formato de 24 horas y con todos los bloques numéricos completados con cero a la izquierda; por ejemplo, `drp_2026-09-30_18-42-15.json`.
- La aplicación no intentará inspeccionar las carpetas del usuario para detectar nombres repetidos; la confirmación de sobrescritura o la creación de un nombre alternativo corresponderá al selector nativo, al navegador o al sistema operativo.

### Datos persistentes

JSON vigente `format: "angie-dashboard"` y `formatVersion: 3`. Ocho raíces: `format`, `formatVersion`, `document`, `board`, `elements`, `notebook`, `timeline` y `moduleLayouts`. Lectura compatible y validada de V1/V2; exportación V3. Contratos exactos y conversión en las secciones 2 y 6 de la especificación.

El documento conserva título, trazos, notas rápidas (título/texto/escala/geometría), elementos y dotaciones, visibilidad de pines, datos operativos, Cuaderno, Registro con revisiones y geometrías manuales. Las cámaras, zooms, selección, módulos abiertos y borradores son temporales. Los temporizadores tienen persistencia independiente; la imagen local de Pizarra es temporal.

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
- Si IndexedDB falla al leer, escribir o abrir su almacenamiento, la aplicación continuará funcionando con el documento activo en memoria y no se cerrará ni bloqueará el resto de funciones.
- El fallo mostrará un aviso persistente `Autoguardado no disponible` con las acciones `Reintentar` y `Guardar JSON`. El guardado JSON visible continuará disponible de manera independiente.
- La aplicación no borrará, reiniciará ni recreará automáticamente la base local como respuesta a un error, y nunca sustituirá el documento activo por datos recuperados sin confirmación del usuario.
- `Reintentar` repetirá la operación fallida utilizando el estado más reciente conservado en memoria. Si el error se produjo durante la recuperación inicial y aparecen datos locales mientras el documento activo ya contiene cambios, se solicitará confirmación antes de reemplazarlo.
- Cuando una lectura o escritura posterior finalice correctamente, se retirará el aviso. Mientras el error continúe, cada nuevo cambio permanecerá disponible en memoria y podrá exportarse mediante `Guardar JSON`.

### Protección y alcance de los datos

- La aplicación no se utilizará para almacenar datos clínicos ni datos de pacientes.
- La protección de los datos corresponde al dispositivo y la ubicación del archivo.
- El archivo exportado será un JSON legible y recuperable con herramientas comunes.
- Cualquier persona con acceso al archivo podrá leer su contenido; la protección dependerá del dispositivo, su bloqueo y la ubicación elegida por el usuario para guardar el archivo.

## 3. Módulos y geometría

Diez módulos: Pizarra, Elementos, Dotaciones, Información, Operativo, Coordenadas, Reloj, Calculadora, Cuaderno y Registro. Se abren individualmente desde Ver. Marco con título, cierre, zoom individual y tirador; contenido con scroll interior.

Dashboard y Pizarra tienen cámaras separadas. Geometrías guardadas independientes de la adaptación de presentación. Zoom general e individual 25–400 %. Puzzle recoloca abiertos según ancho visible, orden estable y separación 12 px, conservando tamaños manuales y zoom. Tirador confirma el tamaño manual. Detalles en especificación 3 y 8.

## 4. Pizarra, recursos y operación

Pizarra rectangular con coordenadas estables, trazos, goma, notas rápidas, pines y fondo. Las secciones 3, 5 y 9.1 de la especificación definen navegación, herramientas, selección y edición de notas.

Elementos y Dotaciones comparten datos y selección. Información y Operativo muestran el mismo objeto. Una dotación nueva comienza sin estado ni entrada; cada selección distinta asigna estado y entrada Actual conjuntamente. El Registro conserva acontecimientos y revisiones. Estados/fases exactos en el [catálogo](docs/archive/estados_fase.md); comportamiento en especificación 4, 6 y 9.2.

### Catálogo técnico de iconos PNG

Los nueve archivos originales permanecerán en la carpeta `public/assets/elements` sin renombrarse, redimensionarse ni modificarse. La aplicación utilizará identificadores internos estables, independientes del nombre físico de cada archivo.

| ID interno   | Nombre visible | Archivo              | Clase visual | Tamaño inicial lógico |
| ------------ | -------------- | -------------------- | ------------ | --------------------- |
| `ambulance`  | Ambulancia     | `icon_medical.png`   | Horizontal   | `150 × 100`           |
| `pathfinder` | Pathfinder     | `icon_vir.png`       | Horizontal   | `150 × 100`           |
| `quad`       | Quad           | `icon_quad.png`      | Horizontal   | `150 × 100`           |
| `checkpoint` | CP             | `icon_cp.png`        | Cuadrado     | `100 × 100`           |
| `hydration`  | EH             | `icon_eh.png`        | Vertical     | `100 × 150`           |
| `start`      | START          | `icon_start.png`     | Cuadrado     | `100 × 100`           |
| `finish`     | FINISH         | `icon_finish.png`    | Horizontal   | `150 × 100`           |
| `warning`    | Advertencia    | `icon_peligro.png`   | Cuadrado     | `100 × 100`           |
| `pushpin`    | Chincheta      | `icon_chincheta.png` | Cuadrado     | `100 × 100`           |

## 5. Coordenadas

Entrada y salida DD, DMS, DMM y UTM; quinta fila Maps copia su URL. Cada fila válida copia solo su valor. La interfaz y los avisos siguen especificación 9.3.

Formatos: `37.060234, -2.002295`; `37°03'36.8"N 2°00'08.2"W`; `37°03.614'N 2°00.137'W`; `30S 588700 4101800`. UTM expresa huso, banda, Este y Norte. Husos 1–60; bandas C–X salvo I/O, norte N–X y sur C–M. La S de 30S es banda de latitud.

Normaliza espacios y separadores conservando todos los números. Una entrada inválida conserva el texto, señala el error y deja resultados/copia vacíos. Mantén parser, precisión y portapapeles existentes.

## 6. Reloj y temporizadores

Hora española con cambio automático verano/invierno y Zulu en HH:MM:SS. Acciones T-Zero, T-Minus, Advisories y Sonido. Tamaño manual y scroll interior según especificación 7.

#### Formato y límites temporales

- Las duraciones editables de `T-Minus` y `Advisory` utilizarán tres campos numéricos separados visualmente como `[HH] : [MM] : [SS]`.
- Los campos solo admitirán dígitos y solicitarán teclado numérico en dispositivos móviles; los separadores `:` serán fijos y no editables.
- Al abandonar un campo o iniciar el temporizador, los tres valores se convertirán a segundos totales y se normalizarán de nuevo al formato canónico de dos dígitos por bloque.
- Los excesos de segundos y minutos se trasladarán a la unidad superior; por ejemplo, `00:90:00` se convertirá en `01:30:00`, `00:00:90` en `00:01:30` y `01:90:90` en `02:31:30`.
- La duración mínima será `00:00:01`. Un valor total de cero se corregirá automáticamente a ese mínimo.
- La duración máxima será `23:59:59`. Cualquier resultado superior se limitará automáticamente a ese máximo.

#### T-Zero

- El botón `T-Zero` añadirá un cronómetro nuevo.
- Se podrán añadir varios cronómetros.
- Cada cronómetro mostrará el tiempo en formato `HH:MM:SS`.
- Cada cronómetro podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar a cero y cerrar.
- El valor máximo será `23:59:59`. Al completar ese valor, el cronómetro se detendrá automáticamente, volverá a `00:00:00` y quedará inactivo, sin activar alertas ni comenzar otro ciclo.


#### T-Minus

- El botón `T-Minus` añadirá una cuenta regresiva nueva.
- Se podrán añadir varias cuentas regresivas.
- El usuario introducirá la duración inicial en formato `HH:MM:SS`.
- Cada cuenta regresiva podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar al tiempo inicial y cerrar.
- El contador comenzará en la duración elegida y avanzará regresivamente hasta `00:00:00`.
- Al llegar a cero completará su ciclo y activará las alertas visual y sonora comunes.


#### Advisories

- El botón `Advisories` añadirá un aviso temporizado nuevo.
- Se podrán añadir varios avisos.
- El usuario configurará la duración del aviso en formato `HH:MM:SS`; por ejemplo, `00:15:00` establecerá un ciclo de quince minutos.
- El contador comenzará en `00:00:00` y avanzará hacia delante hasta alcanzar la duración configurada.
- Cada aviso podrá tener una nota libre asociada.
- Controles definidos: iniciar, desactivar y cerrar.
- `Desactivar` finalizará el ciclo en curso tanto si el aviso está contando como si ya ha activado la alerta. Detendrá el conteo, el timbre y el destello, y devolverá el contador a `00:00:00`.
- La duración configurada y la nota se conservarán. El Advisory quedará inactivo y preparado para iniciar de nuevo un ciclo completo con esa misma configuración.
- `Desactivar` no pausará el aviso, no lo marcará como completado y no lo eliminará; `Cerrar` seguirá siendo la única acción que elimina ese Advisory.
- Al alcanzar la duración configurada completará su ciclo y activará las alertas visual y sonora comunes.


#### Finalización y alertas de T-Minus y Advisories

- El Módulo Reloj incluirá un único botón común `▶ Sonido`, compartido por todos los `T-Minus` y `Advisories`, en la fila de acciones y alineado a la derecha; no se añadirá un control de prueba dentro de cada temporizador.
- Al pulsarlo, reproducirá `public/assets/audio/alarm.mp3` en bucle. El texto permanecerá como `Sonido` y solo cambiará el icono de `▶` a `⏸`; una segunda pulsación detendrá únicamente esa reproducción de prueba y restaurará `▶`. Su nombre accesible distinguirá reproducir y detener la prueba.
- La prueba no modificará el estado, el tiempo, la nota ni la alerta de ningún temporizador y no se persistirá.
- Cerrar el Módulo Reloj detendrá la prueba de sonido. Si comienza una alarma real durante la prueba, esta finalizará inmediatamente y la alarma tendrá prioridad.
- Mientras exista una alarma real activa, el control `Sonido` permanecerá deshabilitado para evitar confundir la prueba con el timbre operativo.
- Cuando un `T-Minus` o un `Advisory` complete su ciclo, activará simultáneamente una alerta visual y una alerta sonora.
- La alerta visual afectará al temporizador correspondiente mediante un destello rojo intenso con resplandor marcado y un borde exterior blanco claramente visible.
- El valor inicial será de dos destellos por segundo.
- La frecuencia se definirá como un parámetro configurable de la implementación, no como un límite rígido ni como una opción ajustable por el usuario en la aplicación, para que pueda modificarse posteriormente sin rediseñar la alerta.
- La alerta sonora utilizará el archivo local `public/assets/audio/alarm.mp3`.
- `alarm.mp3` tiene una duración aproximada de un segundo, ocupa aproximadamente `14 KB` y está preparado para reproducirse en bucle sin un corte perceptible.
- El archivo se reproducirá en bucle mientras la alerta permanezca activa.
- El timbre formará parte de los recursos locales de la aplicación instalada.
- La aplicación comprobará el resultado de cada intento de reproducción. Si el navegador bloquea el audio por falta de interacción o permiso, la alerta visual continuará sin interrupción y el Módulo Reloj mostrará el aviso persistente `Sonido bloqueado` con la acción `Activar sonido`.
- Pulsar `Activar sonido` volverá a intentar la reproducción desde una interacción directa, iniciará el timbre de la alerta actual si el navegador lo permite e intentará dejar el audio habilitado para las alertas posteriores.
- Si la reproducción falla por una causa distinta del bloqueo del navegador, se mostrará `No se pudo reproducir la alarma`. En ambos casos, el fallo de audio nunca reconocerá, detendrá ni ocultará la alerta visual.
- Un clic o toque sobre el temporizador completado reconocerá su alerta y detendrá el parpadeo de ese temporizador; el timbre seguirá la regla común para alertas simultáneas definida a continuación.
- Después de reconocerla, el temporizador permanecerá visible como finalizado hasta que el usuario lo reinicie o lo cierre.
- Cada temporizador completado conservará su alerta visual de forma independiente. Si coinciden varias alertas, el audio utilizará un único bucle compartido y no superpondrá varias reproducciones de `alarm.mp3`.
- Reconocer, reiniciar, desactivar o cerrar un temporizador eliminará únicamente la alerta de ese temporizador. Mientras quede al menos otra alerta activa, el timbre compartido continuará y las demás alertas visuales no cambiarán.
- El timbre se detendrá cuando ya no quede ninguna alerta activa.

- El módulo se diseñará principalmente para utilizarse mientras Angie Dashboard permanezca abierto, que será su uso habitual.
- La aplicación no intentará despertar la aplicación ni reproducir el timbre mientras esté completamente cerrada.
- Los temporizadores se calcularán mediante marcas de tiempo y no dependerán de que el navegador ejecute una actualización exacta cada segundo.
- Si la aplicación queda en segundo plano, la pantalla se bloquea o Android la suspende, el tiempo continuará transcurriendo.
- Al volver a la aplicación, cada temporizador recalculará inmediatamente su valor correcto.
- Si un `T-Minus` o un `Advisory` completó su ciclo mientras la aplicación estaba suspendida, activará el borde y el timbre al regresar.
- No se garantiza que la alerta visual o sonora se ejecute mientras la aplicación permanezca completamente suspendida o cerrada.
- El guardado automático interno conservará los datos temporales necesarios para recuperar correctamente los temporizadores al abrir de nuevo la aplicación.
- La exclusión de los temporizadores del JSON visible y su independencia frente a `Nuevo`, `Guardar` y `Cargar` se regirán por las reglas normativas del apartado 4, `Guardado y recuperación`.

## 7. Calculadora y Cuaderno

### Calculadora

- Incluirá una calculadora básica.
- El campo conservará su nombre accesible, pero no mostrará la etiqueta redundante `Operación`. Botones y cifras responderán a la superficie disponible con la jerarquía tipográfica común.
- Permitirá suma, resta, multiplicación, división, decimales, porcentajes y paréntesis.
- `%` será un operador posfijo de prioridad alta. Aplicado de forma aislada, dividirá su operando entre cien; por ejemplo, `10 %` dará `0,1`.
- En una suma o resta, el porcentaje se calculará respecto al valor situado a su izquierda: `200 + 10 %` dará `220` y `200 - 10 %` dará `180`.
- En una multiplicación o división, el operando porcentual equivaldrá a su valor dividido entre cien: `200 × 10 %` dará `20` y `200 ÷ 10 %` dará `2000`.
- Las mismas reglas se aplicarán dentro de paréntesis y admitirán porcentajes decimales; por ejemplo, `80 + 12,5 %` dará `90`.
- Dividir entre `0 %` producirá un error de división por cero y no devolverá un resultado numérico.
- Incluirá acciones para borrar el último carácter y limpiar completamente la operación.
- La calculadora utiliza las operaciones básicas descritas.

### Cuaderno

- Será un módulo de trabajo para tomar y organizar apuntes durante el servicio.
- Su contenido se organizará como una lista desplazable de bloques independientes.
- Los botones directos `Nota` y `Checklist` añadirán el tipo correspondiente; no habrá un menú de añadir con `+`.
- Permitirá añadir, como tipos diferenciados, una nota libre o un checklist.
- Cada nota o checklist constituirá un bloque independiente dentro de la lista.
- Cada bloque tendrá un título editable en línea, inicialmente `Nota` o `Checklist`, que se guardará en `title` y podrá estar vacío durante edición.
- El contenido anterior se conservará íntegro; la conversión no extraerá su primera línea para generar el título.
- Los elementos de un checklist se podrán marcar y desmarcar.
- Los bloques nuevos se añadirán al final de la lista.
- Los bloques podrán reordenarse mediante una barra lateral dedicada con dos líneas finas, estilizada y con nombre accesible.
- En interacción táctil, el movimiento solo se iniciará desde ese tirador para no interferir con el desplazamiento vertical de la lista.
- Las notas utilizarán texto sencillo multilínea, con saltos de línea, símbolos y emojis.
- Notas e ítems de checklist comenzarán con una fila y ajustarán su altura al contenido, también al borrar, cargar o cambiar la anchura. La lista mantendrá el desplazamiento interno.
- Cada ítem tendrá checkbox, texto y `+` y `×` a la derecha. `+` insertará un ítem inmediatamente después; `×` eliminará solo ese ítem. Un checklist vacío conservará un `+` para crear el primero.
- El cierre de bloque eliminará únicamente ese bloque; sus acciones y las de ítems mantendrán recuperación de foco en un control válido.
- El Cuaderno utiliza texto sencillo.


## 8. Recursos y apariencia

React, TypeScript, Vite/PWA, Radix/shadcn con CSS propio, React Grid Layout, Konva, Dexie y Proj4. Fuentes Roboto Condensed locales y cifras monoespaciadas. Estilo y componentes en el plan; maqueta en `docs/archive/prueba-estilo.html`.

PNG originales en `public/assets/elements`, timbre en `public/assets/audio/alarm.mp3`, iconos derivados en `public/assets/pwa` y fuentes en `public/assets/fonts/roboto-condensed`. La chincheta es la fuente del icono instalable; derivados normales transparentes y maskable con fondo `#0C0D0E` y dibujo completo dentro del 80 % central. Conserva originales y proporciones.
