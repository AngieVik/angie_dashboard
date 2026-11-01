# Auditoría de estabilidad local de Angie Dashboard

Fecha: 1 de noviembre de 2026. Alcance: estado y persistencia, memoria/CPU, validación y excepciones, arquitectura y dependencias. No se ha modificado la aplicación.

**Dictamen:** la persistencia transaccional del documento funcionó en las pruebas de cierre forzado, pero todavía hay riesgos importantes de congelación, retención de recursos y caída completa de la interfaz. La prioridad debe ser acotar el trabajo y los recursos retenidos, proteger el renderizado y asegurar los GPX importados. No hace falta reescribir toda la arquitectura.

**P1 — refactorización crítica:** riesgo demostrado o mecanismo directo de pérdida de recursos, bloqueo prolongado, caída global o agotamiento de almacenamiento con uso acumulado. No significa que toda sesión vaya a fallar. **P2 — deuda asumible temporalmente:** coste o complejidad localizada sin colapso demostrado. No se ha demostrado un P0, corrupción generalizada ni una fuga creciente de listeners al navegar.

Evidencias estructuradas: [auditoria-estabilidad-local-2026-11-01-evidencias.json](auditoria-estabilidad-local-2026-11-01-evidencias.json).

## Qué se ejecutó y qué demuestra

Windows, Node 24.12.0, npm 11.6.2, Chromium aislado, viewport 1440 × 1000. Se usaron datos ficticios y perfiles de prueba. El build de producción se sirvió en `127.0.0.1:4197`; las pruebas directas de funciones y repositorios usaron Vite en `127.0.0.1:5197`. Se distinguen ambas mediciones porque el desarrollo añade sobrecoste. Las cifras finales de memoria y Cuaderno proceden de una repetición con `--disable-extensions`, para reducir la interferencia de extensiones administradas detectada en los primeros perfiles.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run build` | Correcto; incluye TypeScript y empaquetado PWA. Precaché: 71 entradas, 6631,94 KiB. |
| Cierre abrupto después de guardar | `taskkill /PID <Chromium de prueba> /T /F`. Al reabrir, el documento completo coincidió con el guardado y reapareció la nota. |
| Cierre abrupto durante una transacción | Se escribió un candidato inválido dentro de una transacción IndexedDB mantenida abierta con solicitudes encadenadas. Se terminó el proceso desde Windows antes del commit. Al reabrir quedó exactamente el documento previamente confirmado, sin el candidato parcial. Es una prueba de atomicidad de IndexedDB, no una caída de alimentación. |
| Temporizador independiente | T-Zero iniciado en la UI de producción siguió en marcha al reabrir tras el cierre abrupto. |
| Ciclo de vistas | Cuatro rondas por los 14 módulos: 56 pares de apertura/cierre, sin errores JavaScript inesperados ni fallos de interacción registrados. Las teselas externas se bloquearon para aislar el ciclo de vida local. |
| Cuaderno grande, producción | Pegado de 8.000.000 de caracteres y edición posterior. La app siguió visible y conservó 8.000.001 caracteres; el recorrido tardó unos 7,9 s, con tareas de 2.707, 1.912 y 948 ms. El tiempo total incluye automatización y esperas; las long tasks sí indican bloqueo del hilo principal. |
| Coordenadas adversas, producción | `1` + 16.000 espacios + `x2`: tarea de 541 ms. El parser se ejecuta en el renderizado. |
| Coordenadas, función aislada | 8.000 / 16.000 / 32.000 espacios: 126 / 441 / 1.724 ms aproximadamente. Con 64.000 se terminó el worker de prueba al superar 2 s. El worker fue solo un contenedor de medida; la app actual calcula en el hilo principal. |
| GPX | DTD, XML roto, coordenadas inválidas y archivo mayor de 10 MiB rechazados. GPX válido de 100.000 puntos y 3,29 MB: unos 582 ms de análisis síncrono en ejecución de código fuente. |
| Calculadora | División por cero, número no finito, 200 paréntesis anidados, operación de 6.001 caracteres y texto ajeno a la gramática rechazados sin congelación en las muestras. Las comprobaciones tardaron menos de 1 ms cada una. |
| Fallos de almacenamiento | Inyección de `QuotaExceededError`: se conserva la edición en memoria y se activa `autosaveUnavailable`. No se llenó físicamente el disco ni la cuota. |
| Conflicto y recuperación | Dos repositorios contra la misma base: el segundo escritor recibió `DocumentConflictError`. Registro activo inválido: se recuperó `previous`. Transacción abortada explícitamente: sin cambios parciales. |
| Fallo de renderizado, producción | Tras guardar, se inyectó una excepción en el formateador del reloj. React vació la raíz: cero hijos y pantalla sin texto, sin pantalla de recuperación. Es inyección de fallos, no un error espontáneo observado del reloj. |
| `npm run lint` | Falla con tres errores del proyecto: `select.tsx:15` (`set-state-in-effect`), `WindowResize.tsx:7` (`only-export-components`) y `workspaceFiles.ts:629` (`preserve-caught-error`). Comprobación final sin los scripts temporales de auditoría. |

## Dónde vive realmente el estado

| Medio | Contenido y propietarios | Qué sobrevive al proceso |
| --- | --- | --- |
| Memoria JavaScript | Stores singleton de documento, temporizadores, agenda y configuración; estado de selección, radar, fecha de trabajo, borradores de interacción, geometría GPX analizada y archivos de sesión. | Solo lo que haya terminado de persistirse. Los borradores y las selecciones temporales no constituyen un guardado. |
| IndexedDB `angie-dashboard` | `src/storage/db.ts:4`; tabla `documents`. `DocumentRepository` guarda `active`, `previous`, `board:<id>`, `previous:<id>`, `snapshot:<id>:<uuid>` y registros dañados en cuarentena. Contenido portable y sesión de módulos abiertos. | Transacciones completadas. Hay control de revisión entre escritores. |
| IndexedDB `angie-dashboard-timers` | `src/features/clock/timerRepository.ts:22`; lista y revisión independientes. Estado temporal representado con tiempos absolutos, no con un contador que deba escribirse cada tick. | Temporizadores confirmados, ajenos al JSON portable. |
| IndexedDB `angie-dashboard-calendar` | `src/features/calendar/calendarRepository.ts:14`; eventos por ID y revisión. BroadcastChannel para coordinar cambios. | Eventos confirmados, comunes a distintos UIBoards. |
| IndexedDB `angie-dashboard-settings` | `src/features/settings/settingsRepository.ts:15`; configuración y revisión. | Configuración confirmada del dispositivo. |
| IndexedDB de accesos | `angie-dashboard-gpx-access` y `angie-dashboard-work-directory-access`; handles autorizados y referencias de acceso. | Se recuerda el acceso, pero el permiso puede no estar disponible al volver a abrir. No contienen automáticamente los bytes GPX. |
| localStorage | Navegación por documento/superficie, encuadres de Mapa/Pizarra, columnas de Vista, caché y control de frecuencia de búsquedas. Propietarios: `navigationStorage.ts`, `mapNavigation.ts`, `boardViewport.ts`, `mapSearch.ts`, `ViewMenu.tsx`. | Preferencias y navegación que pudieron escribirse. No se usa sessionStorage en el código examinado. |
| Cache Storage PWA | Código, fuentes, iconos, audio y WASM local; Workbox generado. | Recursos offline. Se observó `cleanupOutdatedCaches()` en el service worker generado. No hay caché offline general de teselas configurada. |
| Carpeta autorizada | `workspaceAutosave.ts` → `workspaceFiles.ts`: `dashboard.json`, directorio `gpx/`, copias con manifiestos y verificación de recursos. | Escrituras de archivo completadas. Este canal no se sometió a cierre forzado sobre una carpeta física. |

El JSON incrusta la imagen original de Pizarra y guarda referencias GPX, no su geometría ni sus bytes. Agenda, configuración y temporizadores quedan fuera del documento portable. La recuperación automática además depende de la presencia de sesión: menos de un minuto se reabre directamente, entre uno y treinta minutos se ofrece la recuperación, y fuera de esa ventana el usuario debe usar la apertura reciente/recuperación. Una reapertura vacía no demuestra por sí sola que los registros hayan desaparecido (`documentStore.ts:151`).

## Refactorizaciones críticas

### P1-1. Separar recursos pesados del recorrido de cada edición y reducir copias completas

**Ubicación:** `documentStore.ts:170`, `autosave.ts:31`, `workspaceAutosave.ts:35`, `documentRepository.ts:73`, `serializeDocument.ts:4`, `useBoardImage.ts:62`.

Cada mutación clona el documento completo, valida/serializa candidato y original para compararlos, vuelve a validar/serializar, y encola nuevas copias. El guardado en carpeta también serializa y conserva texto capturado por las promesas. El repositorio realiza otra serialización y `JSON.parse`. Agrupar trabajos reduce escrituras, pero las copias y serializaciones previas ya han ocurrido.

La imagen se reduce a un bitmap de hasta 4096 px para dibujar, pero **se incrusta el archivo original** de hasta 50 MiB. Ese límite permite aproximadamente 66,7 MiB de base64 que vuelven a recorrerse al editar otra parte del documento. Las recuperaciones duplican el contenido en varios registros. El consumo físico depende de la implementación de almacenamiento; no se midió una cuota real ni se afirma una cifra exacta de disco/RAM para la imagen máxima.

**Evidencia:** con repositorio ligero simulado, diez ediciones síncronas costaron 1,6 ms con 1.000 caracteres, 58 ms con un millón y 465 ms con ocho millones. Con la UI real de producción, el pegado y la edición del Cuaderno produjeron bloqueos de varios segundos. Estas dos medidas separan parte del coste del store del coste total de React, layout y persistencia; no atribuyen todo el bloqueo a una sola función.

**Cambio propuesto:** compartir estructuralmente las partes no modificadas, identificar revisiones/cambios sin serializar dos documentos, serializar una vez por trabajo agrupado y separar los blobs internos por huella. Mantener el formato portable al exportar y conservar las recuperaciones y compatibilidad existentes. La separación de recursos requiere diseñar esa compatibilidad antes de implementarla.

### P1-2. Corregir el backtracking de coordenadas y poner límites al trabajo de entrada

**Ubicación:** `parseCoordinate.ts:6`, `parseCoordinate.ts:20`, `CoordinatesModule.tsx:38` y `CoordinatesModule.tsx:146`; `fileAccess.ts:32` y `fileAccess.ts:54`; esquema V4, campos de texto y colecciones.

El patrón DD superpone cuantificadores de espacios. Ante `1` + muchos espacios + `x2`, falla recorriendo repetidamente los separadores. Las medidas crecen aproximadamente de forma cuadrática. El campo no tiene límite de longitud y el parser corre en `useMemo` durante el renderizado, antes de pulsar validar.

Además, la apertura JSON lee el archivo entero y ejecuta `JSON.parse` y validaciones en el hilo principal sin comprobar primero su tamaño. Los textos del Cuaderno y muchas colecciones del documento tampoco tienen un presupuesto global. La validez de tipos no garantiza un coste de ejecución seguro.

**Cambio propuesto:** tokenización o patrón sin ambigüedad, cota breve de entrada antes de cualquier regex y análisis lineal de separadores; presupuesto explícito para archivos, textos, objetos y puntos. Para documentos grandes admitidos, mover análisis/validación pesada fuera del renderizado y usar un worker con cancelación cuando sea compatible. Al importar documentos existentes por encima del presupuesto, informar sin modificar ni sobrescribir el original.

**Aceptación mínima:** el caso de 64.000 espacios debe rechazarse de forma inmediata y la UI debe seguir respondiendo. Un pegado o JSON excesivo debe tener un resultado controlado antes de reservar y procesar todo su contenido.

### P1-3. Dar a los GPX una política de persistencia y liberación por propietario

**Ubicación:** `src/storage/gpxAccessRepository.ts:11`, `MapModule.tsx:247`, `App.tsx:105`, `App.tsx:475` y `workspaceFiles.ts:444`.

`sessionFiles` es un `Map<fingerprint, File>` global: solo incorpora archivos y no tiene límite ni recorrido de eliminación. Sobrevive al cierre de vistas y al cambio de documento mientras continúe el proceso. El estado `mapFiles` del UIBoard también mantiene geometría analizada para compartirla entre Mapa, Plano e Informes; conservarla entre vistas puede ser intencionado, pero no sustituye una política de presupuesto.

**Evidencia:** se incorporaron veinte archivos ficticios de 1 MiB al caché de sesión y continuaron accesibles los 20 MiB sin vinculación a un UIBoard. Es retención de referencias `File`; no se equipara directamente a 20 MiB de heap V8. Un archivo recordado solo en ese caché estuvo disponible antes de recargar y dejó de estarlo después.

**Riesgo de estado:** importar mediante `File` sin handle durable ni copia completada en carpeta deja el documento con la referencia pero sin una copia recuperable del GPX al morir el proceso. El original del usuario no se borra; se pierde la disponibilidad automática del recurso dentro de la app. Los handles recordados y las copias en carpeta sí pueden resolverlo cuando existen y siguen accesibles.

**Cambio propuesto:** persistir bytes GPX por huella cuando se acepta trabajar localmente y aplicar límites de caché a los archivos/geometría en memoria. Calcular referencias desde documentos actuales y recuperaciones antes de retirar recursos; liberar cachés de sesión sin borrar originales ni recursos necesarios para copias recuperables. Mostrar claramente cuándo el recurso todavía depende de la sesión.

### P1-4. Evitar cargar toda la biblioteca para guardar y controlar la capacidad global

**Ubicación:** `documentRepository.ts:97`, `documentRepository.ts:121`, `documentRepository.ts:181`; repositorios de accesos y claves de navegación.

Al guardar una revisión, se hace `table.toArray()` y después se filtran los snapshots del UIBoard. Se traen a memoria documentos, imágenes y versiones ajenas a esa edición. Al listar recuperaciones se vuelve a cargar todo, se valida/migra y se serializa para eliminar duplicados; `migrateDocument` también devuelve copias separadas. El coste de editar un documento pequeño depende del contenido histórico de la biblioteca.

**Evidencia:** cinco guardados de un documento pequeño tardaron 14,8 ms sin otros documentos, 38,5 ms con veinte y 64,5 ms con ochenta. Cada documento retenido de esa prueba llevaba 100.000 caracteres. La lista pasó de 10,1 a 37,1 ms. Es una muestra controlada, sin pretender extrapolar un tiempo exacto para miles de documentos.

Hay poda de snapshots a cinco por UIBoard y de copias de carpeta a cinco reconocidas. **No hay presupuesto global** ni retirada equivalente para `board:`, `previous:<id>`, cuarentenas `damaged:`, handles o claves de navegación. `clearActive()` cierra el activo y conserva su recuperación: no es una operación de purga. Los GPX retirados del documento tampoco se podan del directorio principal `gpx/` en el recorrido de guardado examinado. Cerrar vistas no limpia almacenamiento durable.

**Cambio propuesto:** consultar por rango de clave/índice del UIBoard en lugar de materializar toda la tabla, listar metadatos sin cargar imágenes y paginar en almacenamiento. Añadir medición de capacidad y gestión explícita de biblioteca/recuperaciones, con exportación antes de una limpieza solicitada. Para cachés y recursos huérfanos, usar referencias verificadas. Los documentos guardados por el usuario no deben tratarse como basura y borrarse automáticamente por antigüedad.

### P1-5. Contener errores de renderizado y ofrecer recuperación

**Ubicación:** `src/main.tsx:13`, ensamblaje de `App.tsx`, límites de `Suspense` de los módulos.

No hay un Error Boundary global ni por módulo. `Suspense` resuelve espera de cargas, no una excepción de renderizado. Las capturas de los repositorios no cubren ese recorrido.

**Evidencia de producción:** al hacer fallar deliberadamente el formateador usado por Reloj, React desmontó la raíz completa. La página quedó en blanco (`rootChildren: 0`) y no hubo opción visible de recuperación. Los datos ya guardados siguieron en IndexedDB. La prueba demuestra falta de contención, no un defecto natural del formateador.

**Cambio propuesto:** límite global y límites por módulo con mensaje breve, reintento/remontaje y salida que permita recuperar/exportar el último estado seguro. Capturar y comunicar rechazos de operaciones asíncronas en sus propietarios; un boundary por sí solo no captura errores de eventos, promesas o intervalos.

### P1-6. Sacar el análisis GPX pesado del hilo principal

**Ubicación:** `gpx.ts:13`, `gpxFileAccess.ts:27`, `MapModule.tsx:247`.

El límite de 10 MiB y 150.000 puntos evita algunos excesos, pero un archivo válido dentro del límite ya produjo 582 ms de análisis síncrono. `DOMParser` crea el XML completo antes de recorrer los puntos y alcanzar el límite; la continuación asíncrona después de leer/hash sigue ejecutándose en el hilo principal. Después quedan construcción de capas, métricas y representación, no incluidos en esos 582 ms.

**Cambio propuesto:** procesamiento cancelable en worker con un parser compatible con ese entorno, transferencia de resultados compactos, simplificación de geometría para representar y presupuesto agregado entre archivos. Conservar las coordenadas originales necesarias y comprobar huellas; reducir datos solo para dibujar no debe alterar el original.

## Deuda técnica asumible temporalmente

| Prioridad | Hallazgo y evidencia | Refactorización proporcionada |
| --- | --- | --- |
| P2 | Suscripciones amplias: `useDocumentStore` devuelve el snapshot completo. Cambios en indicadores de guardado notifican a App y a módulos que solo necesitan una parte. El store clona todas las ramas en una edición, por lo que las identidades tampoco ayudan. | Selectores estables por documento/rama y metadatos separados; medir renders antes/después. No se ha demostrado un bucle infinito de renderizado. |
| P2 | `timerStore.ts:90` conecta un intervalo de 250 ms durante toda la app, aunque Reloj esté cerrado y no haya temporizadores. El cleanup existe. | Adaptar frecuencia a temporizadores activos/visibilidad y a consumidores, manteniendo tiempos absolutos y precisión al reanudar. Es consumo evitable; no una fuga demostrada ni una medida de batería. |
| P2 | `timerStore.ts:24` encadena todas las instantáneas sin agrupar. Cincuenta cambios produjeron 51 escrituras y 574 ms de vaciado con 10 ms de latencia artificial por escritura. | Agrupar estados acumulativos conservando promesas de flush y control de revisión. Bajo almacenamiento lento crece la cola; no se midió ese retraso en disco físico. |
| P2 | `boardReducer.ts:24` copia todos los puntos del trazo en cada movimiento; el total de trabajo crece con el trazo. Los trazos de Pizarra no tienen la cota de puntos que sí tiene Plano. | Acumular puntos por frame, limitar/simplificar con cuidado y confirmar por lotes. Riesgo deducido del código, sin trazo extremo ejecutado. |
| P2 | Relaciones semánticas con búsquedas repetidas en elementos/timeline (`validateDocument.ts:98`, `:128`, `:157`) y `allErrors: true`. | Índices temporales por ID, validaciones incrementales y tope de errores a presentar para entradas grandes. Sin medir un caso operativo masivo no se fija un umbral de colapso. |
| P2 | App (~496 líneas), documentStore (~559), workspaceFiles (~655) y MapModule (~758) concentran muchas responsabilidades. | Extraer coordinadores de recursos, persistencia y tareas del mapa con contratos claros. El proyecto ya separa dominio, comandos, repositorios y plataforma; sería incorrecto afirmar que todo cálculo está mezclado con JSX. |
| P2 | Cachés de encuadres por documento sin presupuesto; escritura localStorage síncrona en navegación y scroll. Fallos de preferencias se silencian para mantener la interacción. | Agrupar escrituras de navegación y retirar claves solo cuando se confirme la eliminación de sus documentos. Su volumen es menor que imágenes/GPX. |
| P2 | Tres errores de lint en código del proyecto. | Resolverlos por separado. No acreditan por sí solos un colapso ni justifican mezclar cambios funcionales en esta auditoría. |

## Memoria: resultado y límites

Se forzó GC antes de cada captura para distinguir parte de la basura recogible de referencias retenidas. Todas las muestras se tomaron con los módulos cerrados.

| Momento | Heap JavaScript | Nodos DOM | Listeners JS | Working set agregado observado |
| --- | ---: | ---: | ---: | ---: |
| Antes de recorrer módulos | 8,76 MiB | 307 | 451 | 647,5 MiB |
| Primera ronda | 16,32 MiB | 2323 | 999 | 717,1 MiB |
| Segunda ronda | 16,63 MiB | 2323 | 999 | 722,9 MiB |
| Tercera ronda | 16,76 MiB | 2323 | 1003 | 726,1 MiB |
| Cuarta ronda | 16,87 MiB | 2323 | 999 | 727,8 MiB |

El salto de la primera ronda incluye carga de código, recursos y estructuras de funcionalidades. Las rondas posteriores muestran crecimiento decreciente del heap, nodos DOM constantes y listeners que vuelven al mismo valor final tras una variación de cuatro. **No hay evidencia suficiente para denunciar una fuga acumulativa de listeners o intervalos al entrar y salir de vistas.** Tampoco se demuestra ausencia total de fugas: la muestra es breve, usa datos pequeños y no incluye importaciones repetidas de imágenes/GPX en la UI.

El working set final se obtuvo sumando los procesos del navegador aislado enumerados por CDP y consultados por PID en Windows: incluye infraestructura del navegador y puede conservar páginas del asignador. No es la RAM exclusiva de Angie, ni debe compararse uno a uno con el heap. No se midieron batería, energía ni GPU. La medición exploratoria inicial, conservada aparte en la evidencia, sumaba solo navegador e hijos directos y tenía extensiones administradas; no se utiliza como cifra final de consumo.

Se revisaron cleanups de listeners, observadores, Leaflet, bitmaps, URLs temporales, intervalos y animaciones en los propietarios relevantes. Hay mecanismos de desconexión y liberación; la retención concreta de GPX descrita arriba es un problema distinto.

## Limpieza y límites que ya existen

- Snapshots locales: cinco por UIBoard; intervalo ordinario de cinco minutos, con capturas adicionales al reemplazar. Las versiones `previous` y documentos conservados quedan aparte.
- Copias de carpeta: cinco propias reconocidas, después de crear y verificar la nueva; se conservan las copias ajenas/no reconocidas. No se hizo una prueba física de esa poda.
- Búsquedas: hasta cuarenta entradas y caducidad de veinticuatro horas al leer. Un caché sin nuevas escrituras puede conservar bytes caducados, pero tiene cota normal de entradas.
- Workbox: limpieza de cachés antiguas configurada en el artefacto generado; no se probó una actualización entre dos versiones desplegadas.
- Descargas: URL de Blob revocada después de iniciar su consumo. Fondo de Pizarra: cierre del ImageBitmap al sustituirlo/desmontar su propietario. Mapa: `map.remove()` y desconexión de observadores/listeners al desmontar.
- Eventos de calendario se eliminan explícitamente; los eventos antiguos que el usuario conserva no son basura. Configuración mantiene un único registro activo. La lista de temporizadores se sustituye al guardar y permite cerrar temporizadores.

## Dependencias y peso

El grafo de imports desde `src/main.tsx` alcanza 187 archivos de código. La revisión incluye imports estáticos y dinámicos reconocidos por TypeScript; no pretende sustituir un informe de composición del bundle por símbolo.

| Dependencia/artefacto | Evaluación |
| --- | --- |
| `@radix-ui/react-context-menu`, `@radix-ui/react-radio-group`, `react-resizable-panels` | Sin consumidores alcanzables desde la app actual; tienen wrappers locales disponibles. Candidatas a retirar si se decide eliminar esos componentes de reserva. Es ahorro de instalación/mantenimiento; no se ha acreditado que todo ese código se descargue o ejecute en producción. |
| `@radix-ui/react-dialog` | Sin uso directo alcanzable del wrapper Sheet, pero AlertDialog depende de Dialog. No retirar concluyendo que todo Dialog es innecesario: hay dependencia transitiva, y el lock resuelve también otra versión bajo AlertDialog. |
| `konva` | Necesaria para react-konva aunque la app no importe el paquete directamente. No es una dependencia huérfana. Chunk canvas: 325,38 kB sin gzip / 99,19 kB gzip. |
| AJV + formatos | Validación del contrato y compatibilidad; chunk validation: 143,89 / 41,36 kB. Sustituirlo por comprobaciones ad hoc sería una refactorización amplia con riesgo para documentos. |
| Dexie, Leaflet, proj4 | Persistencia transaccional, cartografía y proyecciones, con responsabilidades claras. No equivalen a pequeñas operaciones que convenga reescribir con unas líneas de JavaScript. |
| date-fns + zona, SunCalc | Hay consumidores reales de calendario, recuperaciones y astronomía. Intl puede resolver presentación, pero no reemplaza por sí solo toda esa lógica. No se propone retirada general. |
| tzf-wasm | Binario de 4260,96 kB, 2720,77 kB gzip. Detecta zona por coordenadas sin red; carga lógica diferida y precaché para offline. Es un coste deliberado de funcionalidad, no una librería sin uso. No se perfiló su inicialización en esta auditoría. |

El chunk principal fue de 471,72 kB sin gzip; UI 215,12 kB y React 206,83 kB. Estos pesos no prueban un problema de memoria. Quitar librerías pequeñas no resuelve las copias de documentos, el backtracking ni los recursos retenidos. La revisión fue de necesidad y coste, no de vulnerabilidades ni de actualización de versiones.

## Orden recomendado y criterio de cierre

1. Corregir el parser de coordenadas y las entradas sin presupuesto; añadir contención global y por módulo para evitar la pantalla en blanco.
2. Reducir clonación/serialización por edición y dejar de cargar toda la biblioteca en cada guardado. Mantener las pruebas de conflictos, atomicidad y recuperación.
3. Asegurar recursos GPX locales y aplicar presupuestos de memoria y capacidad con gestión de referencias, preservando recuperaciones y originales.
4. Mover análisis GPX pesado a ejecución cancelable y comprobar interacción con archivos dentro del límite en dispositivos de recursos modestos.
5. Después, resolver suscripciones amplias, frecuencia del reloj, colas de temporizadores y dependencias de reserva.

Para considerar cerrados los riesgos críticos deben repetirse los casos adversos con UI receptiva, verificar recuperación completa de documento **y recursos** tras cierre abrupto, comprobar comportamiento ante cuota agotada y demostrar que múltiples ciclos de importación/eliminación dejan memoria y almacenamiento dentro del presupuesto acordado. Ese presupuesto y la gestión de documentos conservados son decisiones de producto aún pendientes, no autorizaciones de borrado.

## Pendientes y exclusiones

No se modificaron código, dependencias, formato portable ni reglas del proyecto. No se hicieron pushes, despliegues ni cambios en datos reales. El informe y su evidencia quedan en `docs/`, que el repositorio ignora en Git.

Quedan sin verificar: PWA instalada en Windows, Android físico, suspensión/terminación por Android, corte de alimentación, agotamiento real de cuota y revocación de permisos de una carpeta real, interrupción de escritura de archivos y copias sobre File System Access, crecimiento durante horas/días, imágenes con dimensiones extremas y rendimiento/consumo energético en dispositivos modestos. Los manejadores de carpeta se revisaron estáticamente; los cierres forzados acreditan el canal IndexedDB ensayado.
