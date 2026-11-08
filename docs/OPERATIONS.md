# Manuales operativos

## Resolución de problemas

Antes de recargar o cerrar por un fallo, guarda el UIBoard si la interfaz responde. El archivo no incluye todos los datos de sesión; consulta [Datos y persistencia](docs/ARQUITECTURA.md#datos-y-persistencia).

| Problema                                       | Qué comprobar o hacer                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falla la instalación                           | Comprueba las versiones de Node.js y npm de [README.md](README.md), el acceso al registro y el primer error de `npm ci`. Si manifiesto y lock no coinciden, corrige esa discrepancia; no sustituyas la instalación por una actualización de paquetes. |
| Falla lint, tipos o compilación                | Conserva el comando y el primer error con su archivo y línea. Corrige o identifica la causa antes de considerar válida la comprobación.                                                                                                               |
| `npm start` indica que no existe el build      | Ejecuta `npm run build` desde la raíz y vuelve a iniciar el servidor cuando termine correctamente.                                                                                                                                                    |
| El puerto está ocupado                         | Detén el servidor anterior si es tuyo o utiliza otro puerto. Para el servidor de la compilación, configura `PORT` según [OPERATIONS.md](OPERATIONS.md#servidor-node-incluido); en desarrollo, usa `npm run dev -- --port 5174`.                       |
| Guardar inicia una descarga                    | El navegador no ofrece el selector de guardado. Comprueba que el archivo se haya descargado; «Descarga iniciada» no confirma un archivo guardado. Conserva el archivo antes de cerrar.                                                                |
| La copia local no está disponible              | Abre el centro de mensajes. Usa Guardar como para conservar el documento en un archivo y Reintentar recuperación local si aparece esa acción. Ante cambios de otra pestaña, conserva primero la copia de esta sesión.                                 |
| No carga un módulo                             | Usa Reintentar módulo. Antes de Recargar página, guarda lo recuperable y ten en cuenta la pérdida de datos que solo estén en memoria. Ante un fallo global, utiliza Descargar copia recuperable si está disponible.                                   |
| Faltan mapas, teselas o resultados de búsqueda | Comprueba la conexión y los mensajes de Mapa o Plano. Las fuentes cartográficas son externas y online; disponer de la PWA sin red no incluye las teselas.                                                                                             |
| Sigue apareciendo la versión anterior          | Sigue [Actualizar o revertir](OPERATIONS.md#actualizar-o-revertir): tras conservar los datos necesarios, cierra todas las ventanas y pestañas de Angie y vuelve a abrirla. No borres el almacenamiento como primer intento.                           |

Si el problema continúa, anota revisión de código, versiones de Node.js/npm o navegador, dispositivo, pasos para reproducirlo y el mensaje de error mínimo. Evita incluir datos operativos reales.

## Compilación y despliegue

La app se publica como archivos estáticos. El repositorio incluye un servidor Node para servirlos; no define un proveedor de alojamiento ni un pipeline CI/CD. El destino y el procedimiento de publicación de producción están pendientes de concretar.

### Preparar la versión

1. Instala las dependencias según [README.md](README.md).
2. Completa las comprobaciones de [OPERATIONS.md](OPERATIONS.md), incluida la compilación con `npm run build`.
3. Conserva la revisión de código y una copia completa de `dist/` como artefacto de esa versión.

### Servidor Node incluido

Con `dist/` ya generado, desde la raíz:

```powershell
npm start
```

Por defecto, sirve la app en [http://127.0.0.1:4180](http://127.0.0.1:4180). Ctrl+C detiene el proceso. Requiere Node.js, `package.json`, `server/` y `dist/`; no es el servidor de desarrollo.

| Variable de entorno | Valor por defecto | Uso                                     |
| ------------------- | ----------------- | --------------------------------------- |
| `HOST`              | `127.0.0.1`       | Interfaz en la que escucha el servidor. |
| `PORT`              | `4180`            | Puerto entero entre 1 y 65535.          |

Para utilizar otro puerto en PowerShell:

```powershell
$env:PORT = '4181'
npm start
```

Estas variables se leen del entorno del proceso; el servidor no carga archivos `.env`. El servidor incluido sirve HTTP; la publicación pública requiere configurar HTTPS en el alojamiento o proxy.

### Publicar los archivos

### Actualizar o revertir

Publica cada versión como un conjunto completo y conserva el artefacto anterior para poder restaurarlo en el mismo origen. La reversión del código no revierte los datos guardados por el usuario.

El service worker mantiene la versión nueva en espera mientras existan ventanas o pestañas controladas por la anterior. Guarda el UIBoard y conserva por separado los datos de sesión necesarios antes de cerrar todas las ventanas de Angie y volver a abrirla. El alcance del guardado está en [Arquitectura](docs/ARQUITECTURA.md#datos-y-persistencia).

Tras publicar o restaurar una versión, comprueba su carga y el comportamiento PWA. Este procedimiento no requiere borrar el almacenamiento del navegador.

## Validación

Ejecuta los comandos desde la raíz, con las dependencias instaladas según [README.md](README.md).

### Comprobaciones estáticas

```powershell
npm run lint
npm run build
```

Ambos comandos deben terminar sin errores. `build` comprueba los tipos y genera `dist/`; `npm run typecheck` permite comprobar solo los tipos.

No hay un script `npm test` ni una cobertura mínima configurada. Las pruebas E2E automatizadas están desactivadas; la validación funcional es manual, según [AGENTS.md](docs/AGENTS.md#pruebas-y-depuración).

### Comprobación manual

Después de compilar:

```powershell
npm start
```

Abre la dirección que muestra la terminal, por defecto [http://127.0.0.1:4180](http://127.0.0.1:4180), y utiliza un UIBoard de prueba, sin datos reales. Comprueba el área modificada y sus consumidores; antes de publicar, recorre esta lista completa:

- **Datos:** crear un UIBoard, añadir una dotación, cambiar su estado y comprobar Información y Registro. Crear y editar una nota y un checklist.
- **Archivo:** guardar, confirmar el resultado y volver a abrirlo. Deben conservarse los datos portables y los módulos abiertos; el alcance exacto está en [Datos y persistencia](docs/ARQUITECTURA.md#datos-y-persistencia).
- **Copia local:** esperar a que Archivo indique guardado en el dispositivo, recargar y comprobar la recuperación de los datos portables. Hacer esta prueba sin recursos ni geometría que solo estén en memoria.
- **Ventanas:** abrir, recoger, expandir, redimensionar y cambiar el zoom. Las herramientas y el contenido deben seguir accesibles. Comprobar también el foco y las acciones con teclado.
- **Informes:** seleccionar campos, generar la vista previa, guardar HTML y abrir Imprimir/PDF. Comprobar que la salida contiene los campos seleccionados.
- **Cartografía:** con conexión, abrir Mapa y Plano y comprobar las herramientas afectadas. Las teselas no se esperan disponibles sin red.
- **PWA:** comprobar carga tras una primera visita con conexión, reapertura sin red de las funciones locales y actualización según [OPERATIONS.md](OPERATIONS.md#actualizar-o-revertir).

Anota revisión de código, navegador, dispositivo, casos comprobados y fallos. Una compilación correcta no acredita funcionamiento en navegador ni en dispositivo físico.

#### Registro de regresión

Los casos siguientes complementan la lista general y los recorridos detallados de GPX y temporizadores. En cada cambio ejecuta los del área afectada y sus consumidores; antes de publicar, recorre el conjunto completo. Todos quedan pendientes hasta que el desarrollador registre su ejecución. Una comprobación anterior no acredita una revisión nueva.

Registra cada caso con este formato, incluyendo versión del navegador, sistema operativo y si se trata de navegador o PWA instalada:

| Caso                                                   | Revisión                             | Entorno                          | Resultado                                              | Evidencia o incidencia                                                     |
| ------------------------------------------------------ | ------------------------------------ | -------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Identificador de caso o punto de las listas existentes | Commit y cambios locales, si los hay | Navegador, sistema y dispositivo | Pendiente / Correcto / Fallo / No aplicable con motivo | Pasos, resultado observado y referencia a captura o incidencia, si procede |

Usa un perfil de navegador y archivos de prueba independientes para provocar fallos de almacenamiento o cambiar la hora del sistema. Anota cómo se simula cada fallo y retira los bloqueos al terminar; restaura también la fecha, hora y sincronización originales. No borres datos reales ni sustituyas estas pruebas por una limpieza general del almacenamiento.

#### Límites y diagnósticos

Toma los límites vigentes de `src/domain/input/inputBudgets.ts`, `src/features/map/gpxBudget.ts` y `src/domain/document/validateDocument.ts`. Comprueba el valor inmediatamente inferior, el límite exacto y el inmediatamente superior, manteniendo válidos los demás campos y presupuestos. Respetar un límite individual no garantiza que el conjunto se admita.

| Caso                       | Acción manual                                                                                                                                                                                                                                                     | Resultado esperado                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 · Texto y colecciones | Usar textos de 99.999 / 100.000 / 100.001 caracteres; repetir en el total de texto alrededor de 1.000.000 y en una colección ordinaria alrededor de 2.000 entradas, con UUID distintos.                                                                           | Se admite el contenido válido dentro de todos sus presupuestos. Se rechaza el exceso con un diagnóstico; el contenido anterior permanece disponible.                                                                                                                                                                        |
| L-02 · JSON                | Abrir UIBoards ficticios alrededor de 80 MiB, JSON mal formado, propiedades no permitidas con nombres largos y documentos con muchos fallos de esquema. Probar además uno estructuralmente válido con más de 20 incoherencias de relaciones, como UUID repetidos. | Los inválidos se rechazan sin sustituir el UIBoard activo. La validación devuelve como máximo 20 incidencias, rutas de hasta 160 caracteres y mensajes de hasta 180, con elipsis al truncar. Los casos de esquema pueden detenerse antes; no se espera un recuento exhaustivo. Guardar y reabrir también un UIBoard válido. |
| L-03 · GPX                 | Importar archivos alrededor de 10 MiB y recorridos alrededor de 150.000 puntos, tanto en un archivo como repartidos; repetir alrededor de 20 archivos y con geometría cercana al presupuesto estimado de 64 MiB.                                                  | Se respetan los presupuestos individuales y agregados. Un rechazo conserva los recorridos ya admitidos; cancelar o cambiar de documento impide publicar una importación anterior. El presupuesto estimado no se interpreta como medición de memoria real.                                                                   |
| L-04 · Imagen              | Importar PNG/JPEG alrededor de 50 MiB, imágenes alrededor de 8.192 px por lado y 16.777.216 píxeles totales; incluir cabecera truncada o corrupta.                                                                                                                | Se rechaza el exceso o archivo inválido conservando el fondo anterior. Para la dimensión máxima usar una imagen estrecha que respete también el total de píxeles.                                                                                                                                                           |
| L-05 · Trazos              | Probar trazos alrededor de 50.000 puntos y geometría agregada alrededor de 150.000.                                                                                                                                                                               | El exceso se comunica y no deja un borrador activo ni sustituye geometría anterior por un resultado incompleto.                                                                                                                                                                                                             |

Los caracteres se cuentan según el contrato UTF-16 de la app y los tamaños en MiB son bytes divididos entre 1.048.576. No confundir tamaño del archivo con dimensiones de imagen o estimación de geometría.

#### Fallos de carga diferida

En las herramientas de desarrollo, bloquear la petición del paquete concreto antes de abrir por primera vez el módulo o superficie. Usar una sesión donde no esté ya cargado; si el navegador o la PWA lo sirven desde caché, registrar que no se ha reproducido el fallo. No bloquear toda la red cuando se quiera aislar un paquete local de las teselas online.

| Caso                     | Acción manual                                                                                                                                                           | Resultado esperado                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 · Módulo            | Provocar el fallo de un módulo, retirar el bloqueo y pulsar «Reintentar módulo». Repetir cerrando y reabriendo el módulo tras el fallo.                                 | El fallo queda contenido en su ventana y el documento sigue disponible. Cada recuperación permite un nuevo intento; si el paquete se carga, vuelve el módulo, y si falla de nuevo, permanece una recuperación accesible.                                   |
| C-02 · Superficie        | Repetir en Archivo, Configuración, Mensajes y vista solar. En Archivo dejar una acción/formulario pendiente; en Calculadora conservar una operación y su historial.     | Reintentar conserva el estado previsto. Cerrar Archivo no ejecuta su acción pendiente. El fallo solar no borra la aritmética ni el historial. Se recupera el foco de teclado.                                                                              |
| C-03 · Recarga explícita | Con datos de sesión ficticios, pulsar «Recargar página» desde el fallo de módulo y cancelar la confirmación. Después guardar los datos portables y repetir confirmando. | El aviso explica la pérdida de datos que solo están en memoria. Cancelar mantiene la sesión. Tras confirmar se comprueba únicamente la recuperación de los datos que realmente se guardaron; recursos y geometrías de sesión no se presuponen persistidos. |

#### Almacenamiento y archivos

| Caso                               | Acción manual                                                                                                                                                                | Resultado esperado                                                                                                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 · Lectura local no disponible | En el perfil de prueba, simular un fallo al abrir o leer IndexedDB; abrir o crear un UIBoard ficticio cuando la interfaz lo permita.                                         | Se comunica que la recuperación local no está disponible. No se presenta un documento vacío como recuperación correcta ni se confunde el contenido en memoria con una copia guardada.                                                                                   |
| A-02 · Escritura local fallida     | Partir de una copia local confirmada, provocar un fallo de escritura/cuota y editar. Guardar en archivo; recuperar acceso y reintentar la copia local.                       | Las ediciones permanecen en memoria, la copia anterior se conserva y el aviso permite distinguir el fallo local del resultado del archivo. La recuperación del acceso no provoca una falsa confirmación ni pierde cambios pendientes.                                   |
| A-03 · Dos pestañas y copia local  | Abrir el mismo origen en A y B; confirmar una escritura de A y después intentar actualizar la copia local desde la revisión anterior en B.                                   | Se comunica el conflicto y B no sobrescribe silenciosamente la copia confirmada de A. B conserva su trabajo en memoria y permite protegerlo en archivo. Este caso complementa la sección de temporizadores entre pestañas; no implica edición colaborativa del UIBoard. |
| A-04 · Archivo externo             | Guardar un UIBoard, modificar su archivo desde otra aplicación o pestaña y volver a guardar desde Angie. Repetir cancelando el selector y denegando el permiso de escritura. | El cambio externo exige abrir de nuevo o elegir otro destino. Una cancelación o fallo no se anuncia como guardado correcto ni destruye el documento en memoria.                                                                                                         |
| A-05 · Caché de búsqueda           | Con conexión, bloquear lectura/escritura de `localStorage` y repetir una búsqueda cartográfica.                                                                              | El fallo de caché no inutiliza la búsqueda; se mantiene la alternativa en memoria y la limitación local de solicitudes. No se espera disponibilidad del proveedor sin red.                                                                                              |

#### Informes y recorridos grandes

| Caso                             | Acción manual                                                                                                                                                                                                                               | Resultado esperado                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-01 · Fuentes                   | En una preparación nueva, bloquear o dejar pendiente la descarga de Roboto; repetir con la carga nativa de fuentes pendiente, tanto en paginación como en vista previa. Retirar el fallo y volver a generar.                                | Cada preparación/espera tipográfica continúa con alternativa al vencer su plazo de 5 segundos, o antes si falla. El fallback se fija antes de paginar y permanece en el HTML resultante; una fuente que termina tarde no cambia esa elección. El intento posterior puede volver a usar Roboto. El plazo no limita toda la generación ni sustituye los 30 segundos de carga del iframe. |
| I-02 · Cambios durante la espera | Generar y cambiar de UIBoard o cerrar Informes mientras se preparan fuentes o páginas; repetir con dos solicitudes de preparación concurrentes.                                                                                             | No se publica el resultado en otro documento ni se actualiza una vista desmontada. Los consumidores concurrentes comparten la preparación; una generación no repite la preparación desde la vista y el store.                                                                                                                                                                          |
| I-03 · Salida                    | Con Roboto y con fallback, generar campos variados y tablas largas, revisar vista previa, guardar HTML, abrirlo e imprimir/PDF.                                                                                                             | Los campos, cortes y páginas se conservan según la fuente elegida; no aparece una sustitución tardía que altere la paginación del HTML guardado.                                                                                                                                                                                                                                       |
| I-04 · Perfil y encuadre GPX     | Con datos de 1.000, 50.000 y hasta 150.000 puntos admitidos, comparar primera apertura/reapertura del perfil, redimensionado, zoom del módulo, selección y encuadre individual/conjunto en Mapa y Plano. Incluir huecos y muchos segmentos. | Registrar duración y tareas largas en Performance, además de corrección visual y selección. En `npm run dev`, revisar `angie.gpx.profile-*` y `angie.gpx.fit-*`; en producción, layout y paint. No atribuir pintura SVG a una medida de cálculo ni trasladar los tiempos del benchmark de Node al dispositivo.                                                                         |

#### Arrastres fuera del módulo e interrupciones

Repetir con ratón y con un dispositivo táctil real, tanto con zoom básico como con otro zoom del escritorio/módulo. No se espera que emular el tacto en escritorio acredite el dispositivo físico.

| Caso                | Acción manual                                                                                                                                                              | Resultado esperado                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 · Soltar fuera | Arrastrar una ventana, un elemento o nota de Pizarra y un pin/etiqueta de Plano; salir del módulo y soltar. Volver y comenzar otro arrastre.                               | El gesto termina al soltar, sin seguir al puntero ni dejar bloqueadas otras herramientas. La posición, etiqueta o escala afectada se aplica una sola vez según la herramienta. Mover la etiqueta no cambia la coordenada del pin. |
| G-02 · Interrumpir  | Durante un gesto, provocar pérdida de foco, cancelación del puntero o pérdida de captura. En Plano, repetir un arrastre con un segundo dedo y un dibujo que se interrumpe. | Se limpian captura, borrador y bloqueo del gesto según su propietario. No aparecen un trazo fantasma, un clic de selección accidental ni una operación nueva tras la cancelación. El siguiente gesto funciona.                    |
| G-03 · Navegación   | Repetir paneo con botón central y navegación con dos dedos; soltar fuera de la superficie. Cerrar o cambiar el módulo durante el gesto cuando la interfaz lo permita.      | El movimiento/zoom termina correctamente y no queda el escritorio bloqueado. Las interacciones posteriores conservan sus coordenadas, foco y comportamiento propio.                                                               |

#### Cambios de hora y recuperación de temporizadores

La política separa hora civil para presentación/recuperación y duración monotónica durante la sesión. Ocultar la pestaña no pausa los contadores. Al volver de una suspensión notificada se conserva el progreso conocido y se estima el tiempo faltante con marcas civiles. Tras cerrar/recargar se usa también una estimación civil; no se garantiza exactitud si la hora cambió mientras no había observación. Ejecutar estos casos en Windows y Android físico y distinguir suspensión del sistema, pestaña oculta, pestaña congelada y cierre/recarga. Todos están pendientes de validación manual.

| Caso                                        | Acción manual                                                                                                                                                                                                                                                               | Resultado esperado                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 · Zona horaria                         | Con T-Zero, T-Minus y Advisory activos, cambiar la zona de Configuración y, por separado, la zona del sistema sin cambiar el instante del sistema.                                                                                                                          | Cambia la presentación civil que corresponda; el cambio de zona por sí solo no añade ni resta duración a los contadores. La hora Zulu sigue siendo UTC.                                                                                                                                                                                                                                                  |
| H-02 · Adelanto y retraso durante ejecución | Con T-Zero, T-Minus y Advisory activos, adelantar y después retrasar diez minutos la hora del sistema mientras la app continúa ejecutándose. Probar también al editar una nota, pausar y reanudar, y después de recuperar foco o recibir una actualización de otra pestaña. | Hora local y Zulu reflejan la corrección civil. Las duraciones siguen el tiempo monotónico: no vencen por adelantar el sistema ni retroceden por retrasarlo. Pausar conserva la duración real acumulada y reanudar no cuenta el intervalo pausado. Releer el mismo registro o cambiar su nota no reintroduce el salto civil.                                                                             |
| H-03 · Segundo plano y suspensión           | Ocultar y volver a la pestaña; repetir suspendiendo realmente el equipo durante parte de una cuenta y superando su vencimiento. No cambiar la hora en esta prueba. En navegadores compatibles, repetir con `freeze`/`resume` y con Atrás/Adelante.                          | Ocultar no pausa. El retorno reconcilia el tiempo faltante cuando existe una señal de ciclo de vida, sin sumar dos veces el tiempo que ya contó el reloj monotónico. Un vencimiento requiere confirmar el estado vigente antes del audio. Registrar si el navegador notificó el retorno y si su reloj monotónico avanzó durante la suspensión; documentar un fallo si no se pudo compensar el intervalo. |
| H-04 · Órdenes desde otra pestaña           | Mientras B está oculta o congelada, pausar, reiniciar, cancelar, eliminar o iniciar otra ejecución desde A; volver a B. Repetir cerca del vencimiento y con una corrección de hora observada por ambas pestañas.                                                            | B adopta las órdenes confirmadas y las referencias de la ejecución vigente. La reconciliación de tiempo no recupera una ejecución cancelada ni aplica el inicio de una ejecución anterior. Se mantienen los casos de la sección de temporizadores entre pestañas.                                                                                                                                        |
| H-05 · Persistencia y reapertura            | Abrir temporizadores guardados antes de este cambio. Durante una sesión nueva, corregir la hora, esperar una escritura confirmada y recargar; repetir tras cerrar y reabrir. En otra prueba, cambiar la hora con la app cerrada.                                            | Los registros anteriores siguen siendo legibles sin migración. Al guardar solo se escriben marcas civiles compatibles; la reapertura estima desde esas referencias corregidas. Con la app cerrada no se promete independencia del cambio de hora: registrar la estimación recuperada y no confundirla con una medición monotónica continua.                                                              |
| H-06 · Informes                             | Tras adelantar/retrasar el sistema durante la sesión, generar un informe con temporizadores activos, pausados y completados. Comparar con Reloj al solicitarlo.                                                                                                             | Los valores corresponden a la captura de generación, con su fecha civil correcta; no aparecen duraciones desproporcionadas por mezclar marcas monotónicas y UTC. La espera de fuentes/paginación no convierte la captura en un contador en directo.                                                                                                                                                      |
| H-07 · Fallo de guardado y conflicto        | Provocar un fallo de almacenamiento tras corregir la hora; pausar/reanudar y reintentar. Repetir con conflicto entre pestañas y con cancelación guardada desde la otra.                                                                                                     | Se conservan órdenes y duraciones en memoria y no se inicia audio nuevo sin validar. El reintento respeta la revisión; la recarga explícita por conflicto adopta la lista guardada y no guarda valores monotónicos en IndexedDB.                                                                                                                                                                         |

#### GPX y trazos en el antimeridiano

Validación manual pendiente en Mapa y en su integración en Plano, con GPX ficticios:

- Usa un segmento de latitud 0° y longitudes `179,9° → −179,9°`, y otro en sentido inverso. La importación y «Encuadrar» deben mostrar el cruce corto alrededor de ±180°, sin una línea que atraviese Greenwich. A latitud 0°, la distancia debe seguir siendo aproximadamente 22,24 km.
- Repite con varios segmentos desconectados, varios archivos, puntos aislados y waypoints a ambos lados de ±180°. Encuadra juntos y por separado; no deben aparecer uniones entre segmentos ni quedar puntos fuera del encuadre. Incluye un recorrido largo cuyos extremos estén próximos, para comprobar que los límites contienen también su interior.
- Usa más de 256 y más de 1.024 puntos, situando cruces en los límites de ambas tandas. Comprueba continuidad del dibujo, PK, selección, altitud y distancia, también con puntos de longitud exactamente +180° y −180°.
- Selecciona ambos lados del cruce y navega por el perfil. El indicador y las marcas PK deben coincidir con el trazado; se conserva el ajuste de 14 píxeles y el centrado desde el perfil conserva el zoom. Desplaza la vista a otra copia del mundo y vuelve a encuadrar.
- En Plano, dibuja sobre el cruce y comprueba el borrador, el trazo al soltar y su borrado a ambos lados. Un clic lejos del trazo no debe borrarlo. Repite tras desplazar la vista y cambiar zoom.
- Comprueba un GPX habitual que no cruce el antimeridiano, visibilidad/color/PK, cancelación de importación o selección y sustitución de documento. Repite las interacciones en el navegador y dispositivo de referencia.

#### Temporizadores entre pestañas

Usa temporizadores ficticios en dos pestañas del mismo origen y permite el audio en ambas:

- Crea un T-Minus y un Advisory en A. Confirma que B recibe las altas y los cambios de duración. Mientras editas una duración en B, modifica otro temporizador en A: el borrador y el foco de B deben conservarse.
- Con B visible y después con B en segundo plano o suspendida, pausa, reinicia, desactiva o elimina desde A antes del vencimiento original. Espera a ese vencimiento y vuelve a B: no debe sonar la ejecución cancelada ni reaparecer un temporizador eliminado. Repite cerca del vencimiento, comprobando que la cancelación se haya guardado antes.
- Deja vencer un temporizador válido; reconoce la alerta o elimina el temporizador en A. El aviso y el sonido deben retirarse también en B. Repite sin `BroadcastChannel`, conservando Web Locks, para comprobar la validación previa al audio y la reconciliación posterior.
- Ejecuta rápidamente duración, iniciar, pausar y reiniciar; comprueba que se conserva el orden. Cierra y reabre Reloj, recarga la página y vuelve mediante Atrás/Adelante. No deben reaparecer alarmas antiguas. Verifica también T-Zero, la prueba de sonido y «Activar sonido» desde Mensajes y la recuperación global.
- Con una escritura pendiente, provoca un fallo de almacenamiento y realiza otras órdenes. Deben conservarse en memoria sin iniciar audio nuevo. Si A cambia después la revisión guardada, el reintento de B debe mostrar conflicto, conservar su trabajo y bloquear nuevas alarmas hasta la recarga explícita. Silenciar debe funcionar durante el conflicto.
- Provoca un fallo en la primera lectura, crea un temporizador en memoria y reintenta al recuperar acceso: debe conservarse junto a los registros guardados. Sin Web Locks, deben mostrarse los avisos de indisponibilidad y conservarse las órdenes en memoria sin iniciar alarmas automáticas.

Los diagnósticos son análisis opcionales; sus comandos y límites están en [la guía de scripts](docs/guia_scripts.md). No sustituyen estas comprobaciones.
