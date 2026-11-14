# Arquitectura de Angie Dashboard

Este documento es propietario del mapa de implementación: responsabilidades, conexiones, contratos, persistencia y límites técnicos. Describe evidencia del código; no acredita funcionamiento en navegador ni decisiones visuales. El reparto documental se mantiene en [AGENTS.md](../AGENTS.md#responsabilidades-de-la-documentación).

- Para reglas de trabajo, consultar [AGENTS.md](../AGENTS.md).
- Para diseño objetivo, consultar [development.md](development.md); para integración en componentes y estilos, [design.md](design.md); para procedimientos de validación y operación, [OPERATIONS.md](OPERATIONS.md).

---

## Capas del sistema

La aplicación sigue una arquitectura modular separada en responsabilidades claras:

- **Dominio (`src/domain/`)**: Define la lógica de negocio pura, los esquemas de datos (como el formato `angie-uiboard`), la validación y los estados operativos.
- **Funcionalidades (`src/features/`)**: Contiene los módulos de negocio independientes (Mapa, Pizarra, Calendario, Calculadora, etc.). Cada módulo encapsula sus componentes, comandos y estilos.
- **Plataforma (`src/platform/`)**: Abstrae las capacidades nativas del navegador (sistema de archivos, portapapeles, permisos, zonas horarias).
- **Layout (`src/layout/`)**: Coordina el entorno de trabajo mediante un sistema de cuadrícula (Grid Layout). Gestiona el redimensionado, la navegación espacial, el zoom interno de los módulos y el comportamiento táctil.
- **Interfaz Común (`src/components/ui/` & `src/styles/`)**: Centraliza el sistema de diseño, tokens, fuentes y componentes base adaptados a la aplicación.

---

## Entorno de trabajo y ventanas

El dashboard opera como un lienzo interactivo con múltiples ventanas (módulos):

- **Sistema de Cuadrícula (Grid)**: Integra un sistema de arrastre y redimensionado que evita el solapamiento de ventanas evaluando los ejes X e Y de forma conjunta.
- **Ajuste Automático (Snap)**: Las ventanas se ajustan a las dimensiones de otros módulos (expandidos, contraídos a icono o colapsados a barra) conservando la alineación visual.
- **Navegación y Zoom**: El espacio lógico y el *viewport* están separados. El sistema soporta gestos multitáctiles (zoom y paneo del escritorio) independientes del scroll interno de cada módulo o la navegación nativa de los mapas.

---

## Datos y persistencia

La aplicación maneja diferentes ciclos de vida para sus datos:

### Documento principal (UIBoard)

- **Formato**: Utiliza un contrato único (`UIBoardData`) validado por esquemas estrictos sin versionado histórico.
- **Persistencia**: Se guarda como un archivo `*.uiboard.json` mediante la *File System Access API* cuando el navegador ofrece el selector. Sin esa capacidad se inicia una descarga; iniciarla no confirma que el usuario haya conservado el archivo.
- **Copia Local (Recuperación)**: Se mantiene una copia de seguridad automática (`active`) en IndexedDB que se actualiza tras periodos de inactividad o al ocultar la página.
- **Datos portables**: El archivo y la copia local comparten `UIBoardData`: identidad y fechas del documento, Elementos/Dotaciones y su información operativa, notas y checklists del Cuaderno, Registro con sus revisiones, texto de notas rápidas y lista de módulos abiertos.
- **Estado de sesión excluido**: El contrato portable no incluye binarios de recursos, posiciones y coordenadas, imágenes, dibujos, recorridos GPX, informes generados ni geometría y zoom de ventanas. Reabrir el UIBoard reconstruye el documento a partir de los datos portables; no restaura toda la sesión. Las referencias a iconos del catálogo o emoji sí forman parte de los elementos.
- **Propietarios**: [types.ts](../src/domain/document/types.ts) define el contrato, [uiBoardData.ts](../src/domain/document/uiBoardData.ts) controla la proyección y reapertura, [documentStore.ts](../src/features/document/documentStore.ts) coordina archivo y copia local, [fileAccess.ts](../src/platform/files/fileAccess.ts) adapta selector/descarga y [uiBoardRecovery.ts](../src/storage/uiBoardRecovery.ts) mantiene una única copia `active` transaccional. El archivo y la copia local tienen confirmaciones y fallos independientes.

### Almacenes independientes

Algunos módulos mantienen persistencia transversal, independiente del documento abierto:

- **Reloj/Temporizadores**: Usan una base de datos propia (`angie-dashboard-timers`). El motor maneja pausas, suspensiones del navegador y compensaciones de la hora civil vs. monotónica.
- **Calendario**: Los eventos se guardan en `angie-dashboard-calendar` y persisten entre diferentes documentos.
- **Configuración**: La zona horaria y ubicaciones predeterminadas se guardan a nivel de aplicación.

---

## Procesamiento en segundo plano (Web Workers)

Para no bloquear el hilo principal de la interfaz, las tareas pesadas se delegan a *Web Workers*:

- **Carga de Documentos**: La lectura, validación de límites y parseo estructural del archivo JSON ocurren en segundo plano.
- **Análisis Geográfico (GPX)**: El parseo XML, cálculo de perfiles de elevación, distancias y preparación de geometrías se delegan a workers dedicados. La información se transfiere al hilo principal mediante paso de memoria (`ArrayBuffers`) para optimizar el rendimiento.

---

## Resiliencia y recuperación (Error Boundaries)

El sistema está diseñado para sobrevivir a fallos de importación o renderizado:

- **Aislamiento por Módulo**: Cada ventana está protegida por su propio `ModuleErrorBoundary`. Si un módulo falla, se puede reintentar o cerrar sin afectar al resto del dashboard ni al documento principal.
- **Recuperación Global**: Un `GlobalErrorBoundary` protege la raíz de la aplicación. Permite forzar la descarga del documento en memoria (copia de emergencia) en caso de un cuelgue crítico, evitando la pérdida de datos no guardados.
- **Carga Diferida (Lazy Loading)**: Módulos pesados (Mapa, Pizarra, Informes) se cargan bajo demanda (`React.lazy` + `Suspense`), optimizando el arranque inicial.

## Conexión de los módulos

El recorrido parte de [App.tsx](../src/app/App.tsx), que coordina el documento, los módulos abiertos y la comunicación entre funcionalidades. Los contratos compartidos se mantienen en sus propietarios:

| Propietario | Responsabilidad observada |
| --- | --- |
| [DashboardGrid.tsx](../src/layout/DashboardGrid.tsx) | Integra colocación, arrastre y redimensionado de ventanas y comunica los cambios al ensamblaje. |
| [ModuleFrame.tsx](../src/layout/ModuleFrame.tsx) | Gestiona marco, cabecera, estados recogidos, controles, zoom interior y solicitudes de ajuste de tamaño. |
| [moduleRegistry.ts](../src/layout/moduleRegistry.ts) y [windowContentSize.ts](../src/layout/windowContentSize.ts) | Definen capacidades y tamaños básicos de implementación, y miden el contenido para el tamaño inicial y el autoajuste. Las especificaciones objetivo permanecen en development.md. |
| [ZoomControl.tsx](../src/layout/ZoomControl.tsx), [ModuleZoomContext.ts](../src/layout/ModuleZoomContext.ts) y [ModuleSizeContext.ts](../src/layout/ModuleSizeContext.ts) | Presentan el control común de escala y comunican escala, ajuste y necesidades de espacio con el contenido. |
| [documentStore.ts](../src/features/document/documentStore.ts) | Expone el documento y coordina edición, sustitución, guardado, recuperación y generación de informes. |
| [CalendarModule.tsx](../src/features/calendar/CalendarModule.tsx) | Consume su almacén independiente y los contextos de tamaño, zoom y navegación de la ventana. |

Estos propietarios se recuperan del mapa histórico y se contrastan con sus imports y consumidores actuales. Las capacidades técnicas no sustituyen las [reglas visuales de tamaño](development.md#tamaños-y-comportamiento-por-módulo). Los casos de prueba pertenecen a [Validación](OPERATIONS.md#validación).

## Cartografía, informes y funcionamiento sin conexión

- **Cartografía:** [mapBackgrounds.ts](../src/features/map/mapBackgrounds.ts) declara los servicios externos de teselas; [mapSearch.ts](../src/features/map/mapSearch.ts) mantiene el recorrido de búsqueda. Mapas y teselas requieren conexión y no deben precachearse ni forzarse para uso offline. El estado temporal de la cartografía no amplía el contrato portable del UIBoard.
- **Informes:** [ReportsModule.tsx](../src/features/document/ReportsModule.tsx) coordina selección de campos, opciones de página, generación y vista previa. Utiliza un panel de selección no modal, con separador propio en [ReportSelectionResize.tsx](../src/features/document/ReportSelectionResize.tsx). La vista previa presenta el HTML en un iframe y ofrece guardado e impresión.
- **Generación:** documentStore.generateReport toma una instantánea, carga [reportEngine.ts](../src/features/document/reportEngine.ts), prepara tipografía y pagina el resultado. Comprueba la generación del documento antes de publicar el informe. [documentReport.ts](../src/features/document/documentReport.ts) genera el HTML y [reportPagination.ts](../src/features/document/reportPagination.ts) resuelve su paginación; la vista no sustituye ese recorrido.
- **Fuentes del informe:** [reportTypography.ts](../src/features/document/reportTypography.ts) incrusta las fuentes locales Roboto Condensed en el HTML como datos WOFF2. Comparte la preparación concurrente; un fallo devuelve estilos de reserva y permite reintentar en una generación posterior. El informe conserva sus estilos propios en [documentReport.css](../src/features/document/documentReport.css).
- **App Shell sin conexión:** [vite.config.ts](../vite.config.ts) configura la PWA y la precaché del código y recursos locales seleccionados. El acceso sin red depende de una carga y caché previas; no demuestra disponibilidad de servicios externos. Los datos recuperables son los del contrato portable y los almacenes independientes descritos en [Datos y persistencia](#datos-y-persistencia).

La validación de informes, fuentes, cartografía y actualización PWA se registra manualmente según [OPERATIONS.md](OPERATIONS.md#comprobación-manual).

## Límites de entrada y procesamiento

Para garantizar la estabilidad de la aplicación y el rendimiento en el navegador, se aplican los siguientes límites antes de admitir contenido:

- **Gestos y Navegación:** El umbral para iniciar un arrastre (paneo) en el escritorio o mover pines es de 4px.
- **Archivos de Imagen:**
    - Límite de tamaño: 50 MiB [comprimidos].
    - Límite de dimensiones: Máximo 8192 píxeles por lado y un total de 16.777.216 píxeles. Las imágenes admitidas se reducen a 4096 píxeles en su lado mayor.

### Presupuestos GPX

Los límites se aplican conjuntamente; cumplir uno no garantiza la admisión del archivo o del conjunto. Los MiB representan 1.048.576 bytes.

| Presupuesto | Límite vigente | Propietario |
| --- | --- | --- |
| Tamaño de cada archivo | 10 MiB | `INPUT_BUDGETS.gpxBytes` |
| Originales retenidos en la sesión | 20 archivos y 50 MiB agregados | `gpxFiles`, `totalGpxBytes` y [gpxResources.ts](../src/storage/gpxResources.ts) |
| Puntos de cada GPX | 150.000, incluyendo recorridos y waypoints | `gpxPoints` y [gpxParser.ts](../src/features/map/gpxParser.ts) |
| Puntos de geometrías admitidas | 150.000 en total | `totalGpxPoints` y [gpxGeometryCache.ts](../src/features/map/gpxGeometryCache.ts) |
| Geometría admitida | 64 MiB estimados en conjunto | `GPX_GEOMETRY_BYTES` y [gpxBudget.ts](../src/features/map/gpxBudget.ts) |
| Longitud del nombre del archivo y de los puntos con nombre | 200 unidades UTF-16 | `gpxNameCharacters`, [gpx.worker.ts](../src/features/map/gpx.worker.ts) y gpxParser.ts |

Las constantes de admisión se definen en [inputBudgets.ts](../src/domain/input/inputBudgets.ts). El tamaño de los originales y la estimación de geometría son presupuestos distintos. La estimación incluye puntos, métricas, perfil, buffers de transferencia y capas para Mapa/Plano; no mide el uso real de memoria del navegador ni garantiza latencia en un dispositivo. La caché comparte geometrías por huella y serializa la admisión entre consumidores; cada importación recibe el presupuesto restante, sin un cupo independiente para cada vista.

### Fases de procesamiento GPX

| Fase | Unidad y recorrido de implementación |
| --- | --- |
| Lectura y análisis | [gpxWorkerClient.ts](../src/features/map/gpxWorkerClient.ts) crea un worker para cada análisis y envía el archivo completo. [gpx.worker.ts](../src/features/map/gpx.worker.ts) comprueba tamaño/nombre, calcula la huella, analiza el XML, prepara geometría y devuelve buffers transferibles. No existe un tamaño universal de lote de puntos para esta fase. Una huella ya admitida permite reutilizar su geometría. |
| Desempaquetado en el hilo principal | [gpxTransfer.ts](../src/features/map/gpxTransfer.ts) difiere el comienzo y cede el hilo cada 512 unidades de trabajo al reconstruir puntos y datos del perfil. Esa cifra no es el tamaño de mensaje enviado al worker. |
| Selección del punto más cercano | [gpxSelectionClient.ts](../src/features/map/gpxSelectionClient.ts) envía hasta 1.024 puntos por mensaje a un worker dedicado a la selección y espera la confirmación de cada mensaje. Los puntos de segmentos y waypoints se envían por separado; el worker conserva continuidad entre lotes del mismo segmento. |
| Dibujo progresivo | [gpxLayers.ts](../src/features/map/gpxLayers.ts) dibuja polilíneas de hasta 256 vértices, compartiendo el punto de unión entre tramos vecinos del mismo segmento; cede tras cada tramo o cada 16 puntos aislados/waypoints. No conecta segmentos GPX distintos. El barrido de marcas kilométricas en [gpxMetrics.ts](../src/features/map/gpxMetrics.ts) cede también cada 256 unidades de trabajo. |

La cancelación de lectura termina el worker y aborta el desempaquetado; la de selección termina su worker. Los mensajes se identifican por operación y generación del documento. Estos recorridos y tandas describen el código actual; no son garantías de tiempos, ni cambian precisión, interpolación, continuidad de segmentos o reglas de selección. La comprobación manual de límites y cancelación se mantiene en [Límites y diagnósticos](OPERATIONS.md#límites-y-diagnósticos) y [GPX y trazos en el antimeridiano](OPERATIONS.md#gpx-y-trazos-en-el-antimeridiano).

## Overrides temporales de herramientas

Esta es la única ubicación documental de la configuración y justificación de los overrides. La fuente ejecutable es [package.json](../package.json); [package-lock.json](../package-lock.json) conserva la resolución. La política de comunicación pertenece a [SECURITY.md](../SECURITY.md) y los resultados de seguridad, al [registro de auditorías](security-audits.md).

**Contraste local de configuración: 2026-11-13.** Se leyeron el manifiesto, el lock y los manifiestos de los paquetes instalados; no se reinstalaron dependencias ni se ejecutó un audit nuevo.

| Selector en package.json | Resolución forzada | Alcance y motivo documentado |
| --- | --- | --- |
| `minimatch@10 \|\| 11` | `11.0.4` | Unifica la resolución de las ramas 10 y 11 usadas por las herramientas para evitar los conflictos de deduplicación documentados. No fuerza otras ramas mayores. |
| `workbox-build → glob` | `14.0.3` | Mantiene para Workbox una versión de glob que declara compatibilidad con minimatch 11. Es una sustitución dirigida al consumidor workbox-build, no una actualización general de todo glob. |

El manifiesto instalado de workbox-build 7.4.1 declara glob `^11.0.1`; glob 14.0.3 declara minimatch `^11.0.2`. El override de glob fuerza por tanto una versión fuera del rango original de Workbox. El override de minimatch también puede sustituir la rama mayor solicitada por un consumidor, como ESLint. Estas sustituciones no acreditan por sí solas compatibilidad funcional ni ausencia de vulnerabilidades.

La decisión histórica mantiene ambos overrides coordinados. Revisarlos conjuntamente cuando los consumidores incorporen versiones corregidas en sus rangos oficiales y al cambiar la cadena ESLint/Workbox/PWA. Retirarlos solo como parte de una modificación de dependencias autorizada, comprobando:

1. Instalación reproducible, coherencia entre manifiesto, lock y árbol instalado, sin conflictos de resolución.
2. Lint, tipos y compilación según [Validación](OPERATIONS.md#validación); repetir y fechar las auditorías de dependencias completas y sin desarrollo.
3. Comparación de la selección y revisiones de precaché y validación manual de instalación, actualización y reapertura PWA sin red, conservando los mapas online.

El pendiente histórico de deepmerge tiene un [criterio de cierre independiente](security-audits.md#revisión-y-criterio-de-cierre); retirar un override o excluir un aviso del informe no lo resuelve automáticamente.
