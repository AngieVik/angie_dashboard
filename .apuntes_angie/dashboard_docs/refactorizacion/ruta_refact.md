📌Tarea 1 — Punto 2A: corregir las coordenadas que bloquean la aplicación. ✅
Sustituye el análisis de separadores que provoca retrocesos por un recorrido lineal. Comprueba la longitud antes de analizar entradas manuales, pegadas o recibidas automáticamente. Rechaza las entradas excesivas sin recortarlas silenciosamente.
Entrega: parser corregido, conservando los formatos admitidos.
Comprobación: repetir el caso de los 64.000 espacios y los formatos válidos; la interfaz debe seguir respondiendo.

- Corregido el Punto 2A.
    - [Parser](D:/Proyectos/angie_dashboard/src/features/coordinates/parseCoordinate.ts): recorrido lineal de separadores y límite de 1.024 caracteres antes de analizar.
    - [Coordenadas](D:/Proyectos/angie_dashboard/src/features/coordinates/CoordinatesModule.tsx): rechaza entradas excesivas con aviso, sin recortarlas y conservando el valor anterior.
    - [Pruebas de regresión](D:/Proyectos/angie_dashboard/tests/coordinates.test.mjs): 4 pruebas superadas.
Comprobado en navegador: 64.000 espacios por escritura, botón de pegar, Ctrl+V y recepción automática. La interfaz sigue respondiendo y después admite coordenadas válidas en DD, DMS, DMM y UTM.
Comparados también 10.128 casos con el parser anterior: ninguna diferencia de aceptación o resultado. Diff revisado. Sin ejecutar compilación, lint, tipos ni pruebas en dispositivo físico.

---

📌Tarea 2 — Punto 5: contener los fallos de interfaz. ✅
Añade un Error Boundary global y otro por módulo. Un módulo que falle debe mostrar un mensaje y permitir reintentar sin reiniciar el store. Prepara una salida global mínima que permita obtener una copia recuperable del estado disponible. Revisa también la comunicación de errores asíncronos.
Entrega: recuperación visible ante fallos, conservando el documento.
Comprobación: provocar una excepción con cambios pendientes y verificar que los demás módulos y el estado siguen disponibles.

Implementado: protección global y por módulo, reintento sin reiniciar el store y descarga de una copia recuperable. Los errores asíncronos no capturados muestran un aviso persistente.

- Comprobado en Chrome con cambios pendientes y guardado bloqueado:
    - Cuaderno falló; Calculadora siguió funcionando.
    - Los reintentos conservaron el documento y los temporizadores.
    - El JSON descargado pudo reabrirse completo.
    - Las 3 pruebas unitarias pasaron.
Cambios en [recuperación](D:/Proyectos/angie_dashboard/src/app/recovery/), [main.tsx](D:/Proyectos/angie_dashboard/src/main.tsx), [DashboardGrid.tsx](D:/Proyectos/angie_dashboard/src/layout/DashboardGrid.tsx), arquitectura y pruebas. Conservé los cambios previos de Coordenadas.

---

📌Tarea 3 — Punto 2B: establecer presupuestos de entrada. ✅
Centraliza los límites de coordenadas, textos, archivos y colecciones. Determina sus valores considerando los documentos existentes y las mediciones de rendimiento. Comprueba el tamaño del JSON antes de leerlo completo y aplica las mismas reglas en todos los canales de entrada.
Entrega: límites definidos y mensajes de rechazo consistentes.
Comprobación: probar entradas situadas por debajo, justo en el límite y por encima. Ningún rechazo debe sustituir el documento abierto ni modificar el original.

- Implementado en [inputBudgets.ts](D:/Proyectos/angie_dashboard/src/domain/input/inputBudgets.ts), con reglas compartidas para edición, importación y recuperación.
| Entrada             |                               Límite |
| ------------------- | -----------------------------------: |
| Coordenadas         |                     1.024 caracteres |
| Texto               |   100.000 por campo; 1.000.000 total |
| JSON / imagen / GPX |                     80 / 50 / 10 MiB |
| Colecciones         |         2.000 entradas; 10.000 total |
| Trazos              |         50.000 puntos; 150.000 total |
| GPX agregados       | 20 archivos, 50 MiB y 150.000 puntos |
| Revisiones          |                      100 por entrada |

El JSON comprueba su tamaño antes de leerlo. Los rechazos usan mensajes comunes y conservan el contenido anterior.
Verificación: 19 pruebas dirigidas aprobadas y fronteras comprobadas en Chromium. Se verificó conservación del documento activo y ausencia de escrituras sobre originales simulados. Actualizada [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).
GPX sigue siendo síncrono: unos 620 ms al límite

---

📌Tarea 4 — Punto 1A: hacer que las ediciones copien únicamente lo modificado. ✅
Convierte progresivamente las mutaciones en comandos que produzcan estados nuevos copiando solo las ramas afectadas. Cada comando debe comunicar si realmente cambió algo. Conserva las identidades de las ramas que no hayan cambiado y las relaciones entre Elementos, Dotaciones y Registro.
Entrega: comandos de edición que mantienen intactas las instantáneas anteriores.
Comprobación: editar cada área y verificar que no cambia ningún estado anterior ni contenido ajeno a la operación.

Implementado el punto 1A: las ediciones copian únicamente las ramas afectadas, comunican changed y conservan las instantáneas anteriores y las relaciones Dotación–Registro.
Actualizados los comandos y consumidores de cada área, App y store. La base está en [documentCommand.ts](D:/Proyectos/angie_dashboard/src/domain/document/documentCommand.ts) y [documentEdits.ts](D:/Proyectos/angie_dashboard/src/features/document/documentEdits.ts), con el recorrido documentado en [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).

- Comprobado:
    - 19 pruebas con instantáneas congeladas y referencias conservadas.
    - Regresión de límites de entrada superada.
    - Tipos y revisión del diff correctos.

---

📌Tarea 5 — Punto 1B: eliminar el procesamiento repetido anterior al guardado. ✅
Utiliza el resultado de los comandos y sus revisiones para detectar cambios. Elimina las comparaciones mediante serialización completa donde ya exista esa información. Aprovecha las colas actuales para preparar una única instantánea por trabajo agrupado, manteniendo inicialmente sus tiempos de autoguardado.
Entrega: guardado con menos copias y serializaciones, conservando conflictos, generaciones y resultados de cada canal.
Comprobación: medir ediciones rápidas y repetir cambio de documento, fallo de almacenamiento y cierre forzado. Una revisión pendiente no puede presentarse como guardada.

- Aplicado el punto 1B: el guardado usa revisiones y comparte una instantánea preparada entre canales, conservando los tiempos de autoguardado, conflictos y generaciones.
    - Medición del store: 30 ediciones rápidas pasan de 120 a 30 serializaciones y de 60 a 1 copia completa; aproximadamente 101 → 32 ms en Node.
    - Verificación: 44 pruebas focalizadas aprobadas y comprobación en Chrome con IndexedDB y OPFS: cambio de documento, errores, conflictos y cierre forzado. Una revisión pendiente no se presenta como guardada.
Modificados el store, ambas colas, los repositorios local y de carpeta y [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md). Añadidos [documentSave.ts](D:/Proyectos/angie_dashboard/src/storage/documentSave.ts), [pruebas Node](D:/Proyectos/angie_dashboard/tests/save-pipeline.test.mjs) y [prueba de navegador](D:/Proyectos/angie_dashboard/tests/save-pipeline.browser.js).

---

📌Tarea 6 — Punto 1C: separar las imágenes del documento de trabajo. ✅
Crea un repositorio interno de recursos por huella. Guarda las imágenes originales como blobs y utiliza referencias ligeras en el estado y las nuevas recuperaciones. Mantén la lectura de registros anteriores y reconstruye el formato portable actual al exportar. Confirma conjuntamente recursos y referencias mediante transacciones.
Entrega: imágenes compartidas entre versiones sin duplicar sus bytes en cada nueva instantánea.
Comprobación: abrir documentos antiguos, exportar y reabrir el resultado, recuperar versiones y terminar el proceso durante una escritura. Los originales deben conservarse.

Implementado el punto 1C: originales como blobs por SHA-256, referencias ligeras en estado y nuevas recuperaciones, y confirmación conjunta mediante transacciones. La exportación reconstruye el portable V4.

- Comprobado en Chromium aislado:
    - Apertura V1–V4 y registros IndexedDB anteriores.
    - Exportación y reapertura conservando los bytes PNG/JPEG.
    - Siete versiones compartiendo un único blob.
    - Recuperación, aborto y caída del renderizador durante una escritura, conservando los originales.
Cambios en [recursos](D:/Proyectos/angie_dashboard/src/storage/imageResources.ts), repositorio/base de datos, validación, guardado, documento, Pizarra, informes, exportación y copia de emergencia. [Arquitectura actualizada](D:/Proyectos/angie_dashboard/ARQUITECTURA.md) y [prueba reproducible](D:/Proyectos/angie_dashboard/tests/image-resources.browser.js).

También pasan las diez pruebas focalizadas de guardado y la revisión del diff.

---

📌Tarea 7 — Punto 3A: asegurar la persistencia local de los GPX. ✅
Integra los GPX en el repositorio de recursos. Conserva los bytes originales por huella y vincúlalos al documento mediante una escritura consistente. Mantén los recorridos existentes de handles y carpeta. Comunica cuándo un recurso todavía no está protegido localmente.
Entrega: un GPX importado puede recuperarse sin depender exclusivamente de la memoria de la sesión.
Comprobación: importar, terminar el proceso y reabrir sin conexión. Compartir un archivo entre documentos y comprobar su disponibilidad en ambos.

Implementado el punto 3A: los GPX conservan sus bytes originales por SHA-256 y se guardan junto a las referencias del documento en una transacción. Se mantienen carpeta y handles, y la interfaz identifica los GPX sin protección local confirmada.

- Comprobado en Chromium aislado:
    - Importación, cierre forzado del navegador y reapertura sin conexión, con el servidor detenido.
    - Dos documentos comparten un único original y ambos pueden recuperarlo.
    - Fallos de escritura, reintentos, integridad y transacciones interrumpidas.
    - Compilación correcta.
Archivos modificados: gpxResources.ts, db.ts, documentRepository.ts, autosave.ts, gpxAccessRepository.ts, gpxFileAccess.ts, MapModule.tsx, documentStore.ts, ReportMap.tsx, FileMenu.tsx y [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md). Añadidas [pruebas de recursos](D:/Proyectos/angie_dashboard/tests/gpx-resources.browser.js) y [reapertura PWA](D:/Proyectos/angie_dashboard/tests/gpx-pwa.browser.js).

---

📌Tarea 8 — Punto 3B: limitar y liberar la memoria de GPX. ✅
Sustituye el caché global ilimitado por una caché con presupuesto. Registra qué consumidores necesitan cada geometría, libera las que dejen de utilizarse y permite reconstruirlas desde los bytes persistidos. Conserva el uso compartido entre Mapa, Plano e Informes.
Entrega: consumo acotado de archivos y geometrías en memoria.
Comprobación: repetir importaciones, retiradas y cambios de documento. La memoria debe estabilizarse y los recursos expulsados deben poder cargarse de nuevo.

- Implementado el punto 3B.
    - Originales: presupuesto de 20 archivos / 50 MiB, con expulsión LRU y protección de bytes pendientes de guardar.
    - Geometrías: 150.000 puntos / 64 MiB estimados, compartidas entre Mapa, Plano e Informes y liberadas al desaparecer su último consumidor.
    - Los recursos expulsados se reconstruyen desde los bytes persistidos.
Cambios en las cachés GPX, sus consumidores, store y repositorios; referencias actualizadas en [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).

Verificación: 22 pruebas pasadas, 35 ciclos en Chrome y recorrido de las tres interfaces. El heap tras GC se mantuvo entre 38,44 y 38,79 MB; las cachés quedaron vacías al liberar los consumidores. También pasaron los reintentos gráficos y de tablas de Informes.

---

📌Tarea 9 — Punto 4A: acotar las consultas de guardado. ✅
Sustituye la lectura completa de la tabla por consultas a las versiones del UIBoard que se está guardando. Para decidir la poda, consulta únicamente los registros y metadatos necesarios. Conserva las transacciones y los controles de revisión.
Entrega: guardar un documento no carga el contenido de documentos ajenos.
Comprobación: repetir el guardado de un documento pequeño con una biblioteca creciente y verificar las lecturas realizadas.

Implementado en [documentRepository.ts (line 175)](/D:/Proyectos/angie_dashboard/src/storage/documentRepository.ts:175): la poda consulta solo las instantáneas del UIBoard y conserva claves y fechas en memoria. Mantiene transacciones, revisiones y retención.

- La [prueba añadida](D:/Proyectos/angie_dashboard/tests/save-queries.browser.js) pasó en Chromium con bibliotecas de 0, 10, 100 y 500 documentos ajenos:
- Cero lecturas de contenido ajeno.
- Lecturas constantes: 8 registros con cambios; 3 sin cambios.
- Poda, intervalo de captura, conflictos y reversión de transacciones verificados.
Actualizada [ARQUITECTURA.md (line 73)](/D:/Proyectos/angie_dashboard/ARQUITECTURA.md:73) y revisado el diff. [Registro de lecturas](D:/Proyectos/angie_dashboard/output/playwright/save-queries-result.json).

---

📌Tarea 10 — Punto 4B: crear el catálogo y medir la capacidad. ✅
Crea un catálogo ligero de documentos y recuperaciones con sus identificadores, títulos, fechas, revisiones y referencias. Haz que la lista de recuperación consulte ese catálogo con paginación y cargue el contenido al abrir una versión. Añade medición de almacenamiento y gestión explícita de los documentos conservados.
Entrega: biblioteca consultable sin cargar todas sus imágenes y documentos.
Comprobación: navegar por una biblioteca grande, abrir sus versiones y simular errores de cuota sin perder recuperaciones.

Implementado el catálogo ligero con identificadores, títulos, fechas, revisiones y referencias. La recuperación ahora tiene búsqueda y paginación, medición de uso/cuota y eliminación local confirmada, protegiendo el documento activo y los recursos compartidos.

Tras la indexación inicial, navegar consulta solo metadatos; el contenido se carga al abrir una versión.

- Las cinco comprobaciones focalizadas pasan en Chromium:
    - 1.203 entradas locales, recorridas en 71 páginas sin leer contenidos.
    - 180 entradas de carpeta, paginadas sin releer documentos.
    - Apertura de versiones, cancelación y confirmación de eliminación verificadas.
    - Errores de cuota durante actualización, guardado e indexación conservan las recuperaciones y permiten reintentar.
Cambios en almacenamiento, carpeta, recuperación, permisos/capacidad y avisos, documentados en [ARQUITECTURA.md (line 73)](/D:/Proyectos/angie_dashboard/ARQUITECTURA.md:73). [Resultados completos](D:/Proyectos/angie_dashboard/output/playwright/catalog-checks.json).

---

📌Tarea 11 — Punto 4C: limpiar únicamente los recursos demostrablemente huérfanos. ✅
Calcula las referencias utilizadas por documentos y recuperaciones. Retira recursos propios solo cuando puedas demostrar que ninguno los necesita. Protege los registros antiguos, dañados o desconocidos que impidan determinarlo. La eliminación de documentos conservados debe ser una acción explícita del usuario.
Entrega: limpieza segura y verificable del almacenamiento propio.
Comprobación: compartir recursos entre varios documentos y versiones; retirar referencias progresivamente y comprobar que el recurso permanece mientras exista una referencia protegida.

- Implementado: la eliminación explícita recalcula las referencias desde todos los documentos y recuperaciones conservados, incluidos los ausentes del catálogo.
    - Conserva imágenes y GPX mientras exista una referencia.
    - Bloquea la limpieza ante registros indeterminados.
    - Retira únicamente huérfanos reconocidos y revierte toda la operación si falla.
    - Mantiene la eliminación de documentos como acción explícita del usuario.
Verificado en Chromium con IndexedDB real y datos ficticios: 11 escenarios aprobados, incluida la retirada progresiva de referencias compartidas. También pasó la comprobación del catálogo con 1.203 entradas.

Archivos modificados: [resourceCleanup.ts](D:/Proyectos/angie_dashboard/src/storage/resourceCleanup.ts), [documentRepository.ts](D:/Proyectos/angie_dashboard/src/storage/documentRepository.ts), [prueba de limpieza](D:/Proyectos/angie_dashboard/tests/resource-cleanup.browser.js), [prueba del catálogo](D:/Proyectos/angie_dashboard/tests/document-catalog.browser.js) y [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).

---

📌Tarea 12 — Punto 6A: trasladar el análisis GPX a un worker. ✅
Lleva el análisis, la validación y la preparación de geometría a un worker con un parser compatible. Identifica cada petición por operación y generación del documento. Implementa cancelación y descarta respuestas antiguas.
Entrega: análisis GPX que permite seguir utilizando la interfaz.
Comprobación: importar archivos grandes, cancelar y cambiar de documento durante el procesamiento. Ningún resultado puede incorporarse al documento equivocado.

Implementado el punto 6A: análisis, validación, huella y preparación de geometría GPX en un worker. Cada petición lleva operación y generación; cancelar o cambiar de documento termina el worker y descarta respuestas antiguas.  
Cambios en el flujo de src/features/map, dependencia XML, pruebas y [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).

- Comprobado:
    - 27 pruebas focalizadas aprobadas.
    - Chromium: GPX de 8,1 MB y 150.000 puntos, interacción durante el análisis, cancelación y cambios de documento sin incorporar resultados al documento equivocado.
    - Mapa, Plano e Informes siguen compartiendo y recuperando geometrías.
[Resultados](D:/Proyectos/angie_dashboard/output/playwright/gpx-worker-result.json). 
Representación progresiva reservada al 6B.

---

📌Tarea 13 — Punto 6B: evitar bloqueos al representar los resultados GPX. ✅
Transfiere geometría mediante buffers compactos y construye las capas visuales por lotes cancelables. Aplica el presupuesto agregado entre archivos. Conserva el original y limita las simplificaciones a la representación visual.
Entrega: carga y representación progresivas dentro del presupuesto de memoria.
Comprobación: utilizar otros módulos mientras aparecen las capas y repetir importaciones sin crecimiento continuo de memoria.

Implementado el 6B: buffers transferibles, carga progresiva por archivo y capas por lotes cancelables, con presupuesto agregado. Los originales y los datos de cálculo permanecen íntegros; reimportar una huella cargada reutiliza su geometría.

Comprobado:

- Compilación y 17 pruebas específicas: correctas.
- Chromium de producción: 150.000 puntos y uso de Cuaderno mientras aparecían las capas.
- Diez ciclos de importación y retirada: heap estable, aproximadamente 24–25,4 MiB.
- Cierre durante el dibujo: cero geometrías y tareas visuales retenidas.
Con CPU ×4, la pausa global máxima fue de 0,37 s. Los 64 MiB son un presupuesto estimado, no un límite del heap total.

---

📌Tarea 14 — Punto 2C: procesar los JSON grandes admitidos fuera del hilo principal. ✅
Traslada a un worker el análisis y la validación pesada de los documentos cuyo tamaño esté permitido. Mantén los contratos y migraciones existentes. Comprueba la generación antes de activar el resultado y conserva el documento actual si hay cancelación, error o exceso de presupuesto.
Entrega: apertura de documentos grandes con interfaz receptiva y sustitución controlada.
Comprobación: abrir versiones compatibles, cancelar, introducir JSON inválido y cambiar de documento durante la lectura.

Implementado el procesamiento en worker, conservando contratos y migraciones V1–V4. La apertura permite cancelar, descarta resultados de otra operación o generación y mantiene el documento actual ante errores o excesos de presupuesto.

Archivos modificados:

- Worker: [document.worker.ts](D:/Proyectos/angie_dashboard/src/platform/files/document.worker.ts), [documentWorkerClient.ts](D:/Proyectos/angie_dashboard/src/platform/files/documentWorkerClient.ts), [documentWorkerProtocol.ts](D:/Proyectos/angie_dashboard/src/platform/files/documentWorkerProtocol.ts).
- Apertura: [fileAccess.ts](D:/Proyectos/angie_dashboard/src/platform/files/fileAccess.ts), [workspaceFiles.ts](D:/Proyectos/angie_dashboard/src/platform/files/workspaceFiles.ts), [documentStore.ts](D:/Proyectos/angie_dashboard/src/features/document/documentStore.ts), [FileMenu.tsx](D:/Proyectos/angie_dashboard/src/features/document/FileMenu.tsx).
- Persistencia y documentación: [documentSave.ts](D:/Proyectos/angie_dashboard/src/storage/documentSave.ts), [documentRepository.ts](D:/Proyectos/angie_dashboard/src/storage/documentRepository.ts), [ARQUITECTURA.md](D:/Proyectos/angie_dashboard/ARQUITECTURA.md).
Tipos y compilación correctos; worker incluido en la PWA. El lint específico pasa salvo la incidencia previa de workspaceFiles.ts. El lint global mantiene cuatro errores preexistentes. Continúa el aviso de chunks superiores a 500 kB.

---

📌Tarea 15 — Comprobación conjunta de los seis puntos. ✅
Repite los escenarios de la auditoría sobre el resultado integrado: entradas adversas, documentos grandes, ciclos de vistas, importaciones repetidas, conflictos, cuota agotada y cierre forzado antes y durante escrituras. Comprueba documento, recursos y recuperaciones. Actualiza las secciones de arquitectura afectadas.
Entrega: informe de resultados con mediciones comparables y pendientes explícitos, distinguiendo navegador, PWA instalada y dispositivo físico.

He completado la revisión del punto 15. El [informe completo](D:/Proyectos/angie_dashboard/docs/cierre-fase-15-2026-11-01.md) contiene los hallazgos, sus ubicaciones y el orden de resolución.
He localizado implementación de las 14 fases. El trabajo está aprovechado, pero la estabilidad integrada aún necesita cierre. El worker JSON de la fase 14 existe, compila y figura en la precaché PWA.

---

- ❌Recuperación bloqueada por originales defectuosos. Si falta una imagen o falla su huella, algunos recorridos abortan antes de conservar el registro defectuoso y continuar. También hay un rechazo por presupuesto que evita intentar la versión anterior.
- ❌Imágenes retenidas indefinidamente. Sus originales están separados del documento, pero permanecen en un Map global sin presupuesto ni liberación. Cambiar fondos y UIBoards puede acumularlos durante la sesión.
- ❌Guardados que reprocesan recursos intactos. Se siguen leyendo originales y calculando huellas repetidamente al guardar. La reducción de copias del documento no ha eliminado ese coste.

Además, quedan tres remates:

- ❌Extender la protección contra respuestas antiguas a las recuperaciones de carpeta.
- ❌Eliminar el recorrido duplicado de presupuestos y revisar el trabajo global por edición.
- ❌Comunicar cuándo una limpieza conserva recursos porque existen registros pendientes de identificar.

- Aligerar la carga inicial.  
He comprobado que Pizarra e Informes se importan desde el arranque. El navegador precarga también el paquete de canvas, aunque Pizarra esté cerrada. Pasarlos a carga bajo demanda puede reducir el trabajo inicial conservando el funcionamiento offline.  
El chunk principal mide 501 kB, unos 141 kB comprimido. Superar 500 kB no demuestra que la app se bloquee: debemos reducir lo que necesita arrancar y ejecutar.  
- Evitar que las imágenes se acumulen en memoria.  
Los fondos originales entran en un caché que nunca libera entradas. Este sí es un problema actual al cambiar repetidamente de imágenes o documentos. Necesita una política acotada de conservación y liberación.  
- Quitar trabajo repetido al guardar.  
Editar texto sigue provocando lecturas y comprobaciones de imágenes y GPX que no han cambiado. Hay que evitar esas repeticiones conservando las comprobaciones necesarias. Su impacto actual todavía necesita medición manual.  
- Dejar lint limpio.  
Hay cuatro errores concretos. Son arreglos localizados; ninguno demuestra por sí solo un bloqueo grave. Conviene cerrarlos para que los errores nuevos destaquen durante el desarrollo.

## Deuda asumible

La deuda asumible incluye suscripciones demasiado amplias, frecuencia del reloj, colas de temporizadores y componentes/dependencias sin consumidores actuales. Tiene menor prioridad.
