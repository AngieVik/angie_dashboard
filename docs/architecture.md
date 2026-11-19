# Arquitectura de Angie Dashboard

Consulta el apartado del área afectada. El [diseño](design.md) reúne medidas y composición; [Operaciones](OPERATIONS.md), los procedimientos.

## Capas y propietarios

| Área | Responsabilidad y entrada |
| --- | --- |
| `src/app/App.tsx` | Ensambla documento, ventanas, cámara y comunicación entre módulos. |
| `src/domain/` | Tipos, esquemas, comandos, validación y estados operativos. |
| `src/features/` | Componentes, comandos y estilos de cada funcionalidad; Dotaciones reutiliza Elementos y Plano reutiliza Mapa. |
| `src/layout/` | Registro de módulos, marcos, medición, colocación, gestos y zoom. |
| `src/platform/` | Archivos, portapapeles, permisos, formatos y capacidades del navegador. |
| `src/storage/` | Adaptadores de almacenamiento, recuperación y recursos de sesión. |
| `src/components/ui/`, `src/styles/` | Componentes base y sistema visual compartido, descritos en [Diseño](design.md#integración-compartida). |

## Datos y persistencia

### Documento portable y recuperación

`domain/document/types.ts` define `UIBoardData`; `uiBoardData.ts` proyecta y reabre el formato estricto `angie-uiboard`, sin versiones históricas. Conserva identidad y fechas, Elementos/Dotaciones con información operativa y referencia de catálogo o emoji, notas y checklists, Registro con revisiones, texto de notas rápidas y módulos abiertos.

La geometría y navegación de ventanas, posiciones y transformaciones de pines, imágenes y otros binarios, dibujos, GPX e informes generados pertenecen a la sesión. Reabrir un UIBoard reconstruye únicamente sus datos portables.

`features/document/documentStore.ts` coordina edición, sustitución y guardado. `platform/files/fileAccess.ts` guarda `*.uiboard.json` mediante File System Access API o inicia una descarga cuando falta el selector. Confirma por separado el resultado de archivo y copia local; una descarga iniciada requiere comprobar el archivo recibido.

`storage/uiBoardRecovery.ts` mantiene una sola copia `active` transaccional en IndexedDB, tras inactividad o al ocultar la página. Sus revisiones impiden sobrescribir desde una copia desactualizada de otra pestaña. Ante fallos, conserva las ediciones en memoria y ofrece recuperación o guardado en archivo.

La recuperación valida las fechas y los metadatos de archivo por separado del documento. Descarta los nombres y fechas de archivo inválidos; un handle inválido o sin huella SHA-256 válida se desvincula para exigir una nueva selección de archivo. Cualquier descarte deja el documento pendiente de guardar y conserva su contenido válido.

### Almacenes independientes

| Datos | Ciclo de vida |
| --- | --- |
| Temporizadores | Base `angie-dashboard-timers`, independiente del UIBoard. |
| Eventos de Calendario | Base `angie-dashboard-calendar`, compartida entre documentos. |
| Preferencias y disposiciones | Registro local `AppSettings`, validado por `features/settings/appSettings.ts` y escrito por `settingsStore.ts` con revisión. |
| Registro de avisos | Memoria de la sesión; véase [Avisos](#avisos). |
| Zoom de recarga | `layout/navigationStorage.ts`, en `sessionStorage` por documento; véase [Arranque](#arranque-y-disposiciones). |

Los campos de preferencias ausentes en registros anteriores reciben sus valores predeterminados; las adiciones actuales conservan la versión de IndexedDB y el contrato UIBoard.

Los temporizadores aceptan revisiones numéricas anteriores y usan tokens únicos en las nuevas escrituras, incluido el restablecimiento. Un registro corrupto bloquea las alarmas automáticas y ofrece en Mensajes → Reloj descargar el registro o confirmar «Rescatar y restablecer». Esta última acción archiva el registro íntegro bajo una clave `rescued:<uuid>` de la misma tabla y sustituye `active` por los temporizadores de la sesión en una sola transacción. Si el rescate falla o el registro ya es válido, no lo sustituye. Los fallos de acceso o coordinación conservan la opción de reintento; no habilitan el restablecimiento por sí solos. La descarga es JSON de diagnóstico, no un UIBoard importable, y requiere comprobar el archivo recibido.

### Estados operativos

Los comandos de dominio conservan la relación entre dotación, estado actual y Registro. `OperationalStatusIcon` consume los tokens semánticos de estado.

| Estado | Indicador y significado |
| --- | --- |
| Disponible | Verde: preparado en su punto de cobertura. |
| Activada | Amarillo: activación ante aviso prioritario. |
| Aproximándose | Azul: en ruta al aviso. |
| Interviniendo | Rojo: asistencia en el aviso. |
| Trasladando | Símbolo de traslado: paciente hacia destino. |
| Transfiriendo | Naranja: transferencia al receptor. |
| Operativa | Verde: reactivación y retorno a cobertura. |
| Inoperativa | Gris oscuro: fuera de servicio temporalmente. |
| Personalizado | Indicador personalizable, sin significado predefinido. |

## Ventanas y navegación

El umbral de inicio de paneo y arrastre de pines es 4px. `App` conserva geometría temporal en React; `AngieDocument` carece de `moduleLayouts`. Mover, redimensionar, ordenar o recoger actúa sobre ese estado. La lista de módulos abiertos sí participa en el guardado portable. Cerrar descarta geometría y conserva contenido; reabrir solicita una colocación nueva.

| Propietario en `src/layout/` | Contrato |
| --- | --- |
| `moduleRegistry.ts` | Capacidades y tamaños de implementación; objetivo visual en [Ventanas](design.md#ventanas). |
| `ModuleFrame.tsx`, `windowContentSize.ts` | Medición inicial, marco, estados compactos, zoom interior y autoajuste. |
| `DashboardGrid.tsx` | Arrastre y redimensionado manual; admite superposición y reserva extensión durante el gesto. |
| `findModulePlacement.ts` | Apila bajo columnas del mismo ancho dentro del viewport; busca otros huecos visibles antes de prolongar hacia abajo, sin separación ni solapamiento automático. Completa la colocación tras medir el contenido alrededor de ventanas ya medidas. |
| `repositionModules.ts` | Ordena por ancho actual descendente y por catálogo dentro del ancho; conserva tamaños. `collectModuleBars` usa la agrupación de [Diseño](design.md#ventanas) y cancela la medición inicial pendiente. Ambas acciones vuelven al origen conservando zoom. |
| `workspaceExtent.ts` | `measureWorkspaceExtent` toma el máximo entre área visible y bordes actuales; libera la reserva al terminar/cancelar y permite recuperar espacio. El paneo modifica solo la cámara. |
| `MobileViewport.tsx` | Desplaza el escritorio mediante cámara; raíz con `overflow: clip` y `overflow-anchor: none`. Las barras hermanas mantienen scroll nativo; ignora hasta un píxel lógico de redondeo escalado y los eventos causados por sincronización de la propia cámara. |
| `useViewportGestures.ts` | Separa navegación del escritorio, scroll interior y mapa. Registra liberación/cancelación también en documento; al soltar fuera finaliza el gesto de su propietario y la interacción nativa de arrastre/redimensionado. Conserva las rutas por pérdida de foco y ratón sin botones. |
| `ZoomControl.tsx`, `ModuleZoomContext.ts`, `ModuleSizeContext.ts` | Comunican escala, ajuste y necesidades de espacio del contenido. |

El mínimo expandido se calcula con `moduleExpandedMinimumSize` y `constrainWindowContentSize`, por encima del umbral compacto. La altura inicial según contenido es independiente del mínimo manual y del autoajuste. Los mínimos manuales reservan al menos una fila en listas y Operativo; Calendario identifica su primer bloque desplazable mediante `data-minimum-scroll-content`. Las superficies `baseHeight: 'fixed'` conservan su tamaño de apertura. El redimensionado manual usa sus mínimos y el autoajuste usa su límite propio.

`keyboardResize.ts` comparte órdenes, pasos e instrucciones de teclado entre los tiradores de `DashboardGrid` y `WindowResize`. El primero aplica `contentMinimum` y `minMaxSize` también a las flechas, confirma mediante `onLayout` y permite ampliar el escritorio cuando hay `onGrow`; omite el imán para conservar los ajustes pequeños. `ModuleFrame` desactiva el autoajuste al iniciar el ajuste manual con puntero o teclado. `WindowResize` comparte la aplicación de tamaño y el anclaje superior izquierdo entre ambos métodos; los mínimos y máximos CSS del diálogo siguen limitando su caja. Ambos rechazan el ajuste durante el bloqueo de interacción.

### Imán

`layout/magnetSettings.ts` centraliza distancia de 1–100 píxeles de pantalla (18 predeterminado) y alineación de bordes (`true`). `App` pasa `magnetOptions` a `DashboardGrid`; `snapModulePosition` y `snapModuleSize` convierten distancia a espacio lógico dividiendo una sola vez por el zoom. La opción de bordes incluye origen y barras; mantiene candidatos centrales, comprobación de solapamientos al mover y mínimos de tamaño. `magnetByDefault` empieza en `false` y solo se aplica al iniciar; el estado manual de sesión es independiente.

### Limpieza

`documentEdits.MODULE_CLEANUP` es el catálogo único de comandos, resúmenes, conservaciones condicionadas por selección, efectos compartidos y acciones de sesión. `clearDocumentModules` compone sus definiciones y retira del Plano los pines de recursos eliminados.

`features/view/cleanupPlan.ts` prepara una vista previa sin mutar el documento. `applyCleanupPlan` exige la misma referencia de documento; `App` comprueba también el número de temporizadores seleccionados. Un cambio pide revisar la vista previa. La confirmación aplica el resultado y las acciones de sesión del catálogo, incluidos módulos cerrados, manteniendo las ventanas abiertas. La selección se reinicia al abrir y vive solo en memoria. Los temporizadores conservan su guardado independiente: un fallo posterior informa de la limpieza ya aplicada al resto.

## Configuración

`SettingsDialog` recibe el acceso al escritorio desde `App` → `AppHeader.fileMenu` → `FileMenu`; conserva navegación y paneles montados. Los nombres de módulos pertenecen a `MODULE_REGISTRY` y su orden en Configuración a `settingsModuleOrder.ts`.

`createSettingsDraft` reutiliza validación y operaciones del store sobre memoria. El footer confirma todo el borrador y la ubicación normalizada en una escritura con la revisión original. `settingsEqual` compara valores; `getSavedSettings` avanza solo tras éxito persistente. `settingsNumberDrafts.ts` conserva textos numéricos transitorios y los confirma con Intro/blur o al guardar. Un fallo conserva el borrador. Restablecer prepara `emptySettings()` manteniendo disposiciones, contenido y permisos; requiere Guardar.

`LocationDraft` conserva la edición al navegar. Localidad es el nombre seleccionado; coordenadas introducidas sin localidad aportan su texto como `location.name`. Permisos y cargar disposición son acciones inmediatas; altas/bajas de vistas permanecen en el borrador.

### Arranque y disposiciones

- `initialModules: null` conserva la restauración previa; `[]` abre sin módulos. `initialArrangement` admite `ordered` (predeterminado) y `bars`; `initialZoom` empieza en 100 %. `App` espera carga o fallo de preferencias antes de colocar ventanas y aplica la selección una vez al arrancar, también con recuperación local. Completa la ordenación tras medir alturas; una acción posterior de ventana o Vista la cancela.
- En una recarga con UIBoard recuperado, prevalecen sus módulos abiertos y el zoom de sesión de `navigationStorage`; la recarga conserva este zoom sin restaurar geometría. Abrir otro archivo utiliza sus módulos. Un fallo de preferencias conserva la restauración del documento; un fallo de `sessionStorage` conserva la navegación disponible.
- El zoom del escritorio y módulos admite 25 %–200 %. `zoomStep` es entero de 1–175 puntos, predeterminado 1; `viewportMath.ts` es propietario de límites. Afecta a flechas y Slider, con origen en 100 % y extremos alcanzables; el paso predeterminado conserva la aproximación suave a decenas. Escritura directa, rueda y pellizco mantienen su recorrido continuo. Los cambios de arranque afectan al inicio siguiente; el paso guardado se consume en vivo.
- `savedDesktopViews.ts` valida hasta 50 vistas, nombres no vacíos de hasta 80 caracteres y únicos sin distinguir mayúsculas; rechaza duplicados. Guarda módulos únicos, posición, tamaño, capas por orden del array, estado representado por geometría, activo y cámara. Exige números finitos, coordenadas no negativas, mínimos del registro y activo perteneciente a la vista. Conserva contenido, zoom y navegación interiores fuera de la captura.
- `DesktopViewsController` captura tras la medición inicial y excluye reservas de gesto. Recuperar valida y clona, abre/cierra ventanas, recalcula extensión y limita cámara conservando medidas lógicas; admite otro UIBoard. Puede marcarlo modificado si cambia su lista de módulos abiertos. `restoreRevision` temporal evita medir otra vez el tamaño inicial en ventanas nuevas o montadas; posteriores ediciones conservan el autoajuste. Las vistas se recuperan explícitamente y son locales al dispositivo.

### Formatos y accesibilidad

`formatPreferences.ts` valida `formats.date`, `time` y `units`: DD/MM/AAAA (predeterminado), MM/DD/AAAA o AAAA-MM-DD; 24 horas (predeterminado) o 12 con AM/PM; métricas (predeterminado) o imperiales. `platform/formatting.ts` centraliza presentación y conversiones desde metros con caché de formateadores, conservando el segundo intercalar admitido. Mantiene unidades internas, claves ISO y horas HH:mm de Calendario; los campos nativos siguen el navegador. Zulu usa UTC/24 horas; temporizadores muestran duración y PK conserva km explícitos. Registro/guardado usan Europe/Madrid; Reloj y cálculo solar su zona; avisos y horas GPX la del dispositivo. Escala, altitudes, distancias y ejes convierten solo su presentación.

`accessibilityPreferences.ts` valida `textSize` (100, 125, 150 o 200 %; 100 por defecto), `highContrast` (false) y `motion` (sistema o reducido; sistema por defecto). Se aplican tras Guardar a sesión e inicios siguientes. `AccessibilityRuntime` se monta en `main.tsx` fuera de `GlobalErrorBoundary` y aplica `useAccessibilityPreferences`: establece atributos y escala en `document.documentElement`, incluidos portales y recuperación global. La limpieza solo se ejecuta al desmontar ese runtime o actualizar sus valores; sustituir `App` por la recuperación o reintentar no retira las preferencias. `useReducedMotion` sigue `matchMedia`, también durante la recuperación; Mapa/Plano detiene animación y desactiva inercia en modo reducido sin recrear el mapa. El acabado pertenece a [Diseño](design.md#accesibilidad).

### Avisos

`features/notices/noticePreferences.ts` define duración temporal de 1–120 segundos (5 predeterminado), niveles Aviso, Completado, Información, Advertencia, Error y En curso, y preferencias por texto original. Todos los niveles/mensajes empiezan habilitados; el menú aparece solo con incidencias salvo `noticesAlwaysVisible`. Los filtros regulan presentación y conservan estado y acciones de recuperación de las incidencias persistentes.

`noticeSelection.ts` une catálogo generado, historial y selecciones guardadas; deduplica, ordena alfabéticamente y conserva todos los niveles de cada frase. Las casillas de grupo seleccionan/desmarcan sus mensajes en una actualización; reflejan selección parcial. Reactivar un miembro abre su nivel manteniendo los demás desmarcados. Una frase de varios niveles comparte casilla y respeta el filtro de cada emisión. Los mensajes variables incorporan el original completo al producirse; las selecciones guardadas conservan texto y niveles conocidos.

El catálogo `NOTICE_MESSAGES` se genera desde literales y niveles del emisor; véase [la guía de scripts](guia_scripts.md#catálogo-de-avisos). Los persistentes compartidos de `documentNoticeMessages.ts` declaran Advertencia con `@notice-level`. La preferencia por texto prevalece sobre la anterior por origen. La lectura mantiene personalizaciones antiguas de hasta 500 caracteres y preferencias anteriores sin niveles opcionales. Sus presupuestos son los compartidos de texto y colección de [Límites](#límites-de-entrada-y-procesamiento); los niveles opcionales deben ser conocidos, únicos y no vacíos.

El wrapper `components/ui/sonner/toast.ts` filtra por original, conserva identificadores/opciones salvo duración global y registra incluso los suprimidos. `noticeHistoryStore` retiene las últimas 200 entradas en memoria, con texto mostrado/original, origen opcional, fecha y nivel. `DocumentNotices` registra cambios persistentes de archivo, recuperación, Reloj, Pizarra, mapas e Informes sin duplicar una fuente sin cambios. `dismiss` retira el aviso temporal y conserva historial e incidencias. Recargar inicia un registro vacío.

El cierre de Configuración con cambios usa `requiredAction`: conserva el texto literal y espera Guardar o Cerrar, incluso con avisos informativos filtrados. Guardar cierra solo tras éxito; Cerrar descarta. Las acciones se bloquean durante la escritura y el aviso se retira al resolver cambios o desmontar.

### Solicitud de almacenamiento persistente

`StoragePermissionsPanel` en `PermissionsDialog.tsx` llama a `requestPersistentStorage` desde la pulsación, sin esperas previas. `platform/pwaPermissions.ts` invoca `navigator.storage.persist()`; `persisted()` consulta al abrir. Presenta concesión, rechazo, API ausente o error según el resultado real. El navegador decide el permiso y cualquier diálogo; un rechazo mantiene datos y almacenamiento ordinario. La estimación de espacio se vuelve a consultar con Actualizar.

## Procesamiento y recuperación de fallos

Los workers de documento leen y validan JSON; los de GPX analizan XML, métricas y geometría y transfieren `ArrayBuffer`. Las operaciones se identifican por generación del documento para descartar resultados obsoletos.

Las cargas pesadas usan `React.lazy`/`Suspense`. Cada ventana tiene `ModuleErrorBoundary` con reintento/cierre; `GlobalErrorBoundary` protege la raíz y ofrece descarga recuperable del documento en memoria. Conserva el aislamiento y las rutas de recuperación al modificar una carga diferida.

El motor de temporizadores usa tiempo monotónico durante la ejecución y marcas civiles para presentación/persistencia. Ocultar la pestaña conserva la marcha; el retorno notificado reconcilia suspensión sin contar dos veces. Reabrir estima desde marcas civiles, por lo que un cambio de hora con la app cerrada limita su exactitud. La cola de órdenes y las revisiones conservan el orden; fallos de almacenamiento o conflictos mantienen órdenes en memoria y bloquean alarmas nuevas hasta validar estado. Web Locks y validación previa al audio evitan ejecuciones canceladas desde otra pestaña; BroadcastChannel comunica cambios. Sin Web Locks se informa de indisponibilidad y se conservan órdenes sin alarmas automáticas.

`timerStore` separa el estado de la lista del pulso temporal de 250 ms. La cabecera de Reloj selecciona el segundo civil; cada `TimerRow` en marcha conserva su instantánea mientras no cambien el segundo visible, el estado o la alerta. Las filas inactivas, pausadas y finalizadas no se suscriben al pulso. La reconciliación reutiliza registros sin cambios y `ClockModule` numera por tipo en una sola pasada, memorizada por lista.

## Cartografía, informes y funcionamiento sin conexión

`mapBackgrounds.ts` declara teselas externas y `mapSearch.ts` la búsqueda online. La PWA de `vite.config.ts` precachea App Shell y recursos locales seleccionados tras una carga previa, conservando mapas y servicios externos online. Mantiene actualizaciones en espera mientras existan clientes de la versión anterior.

`ReportsModule.tsx` coordina selección, página, iframe de vista previa, guardado HTML e impresión. `ReportSelectionResize.tsx` gestiona el separador. `documentStore.generateReport` captura una instantánea y carga `reportEngine.ts`; `documentReport.ts` genera HTML y `reportPagination.ts` pagina. Comprueba generación de documento antes de publicar resultados.

`reportTypography.ts` comparte preparación concurrente e incrusta Roboto Condensed WOFF2 local. La espera de preparación/fuentes tiene plazo de 5 segundos; el fallback queda fijado antes de paginar y permanece en el HTML aunque la fuente llegue tarde. Un intento posterior permite reintentar. El iframe tiene su plazo independiente de 30 segundos. `documentReport.css` conserva los estilos autónomos del informe.

### Políticas HTTP del servidor estático

`server/server.mjs` sirve `dist/` y aplica `Content-Security-Policy`, `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff` antes del enrutado, también en HEAD y errores. La CSP impide enmarcar la app (`frame-ancestors 'none'`), bases alternativas, objetos y envíos de formularios. Limita scripts, workers, manifiesto y audio al mismo origen; las imágenes admiten los proveedores cartográficos declarados, `data:` y `blob:`. Los iframes internos de informes siguen usando `srcdoc`, sandbox y su CSP propia; las fuentes admiten `data:` para el HTML autónomo.

La política conserva excepciones de compatibilidad: `script-src 'unsafe-eval'` porque `validateDocument.ts` compila el esquema con Ajv en ejecución (también permite WASM); `style-src 'unsafe-inline'` para estilos dinámicos e informes; `connect-src 'self' https:` para búsqueda/elevación y el proveedor HTTPS configurable de `mapSearch.ts`. Por ello, la CSP no bloquea evaluación dinámica ni restringe las conexiones HTTPS a una lista de dominios. Eliminar esas excepciones exigiría precompilar validadores y revisar esos contratos.

Referencia: [recomendaciones de cabeceras HTTP de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) y [CSP con Ajv](https://ajv.js.org/security.html#content-security-policy). Estas cabeceras corresponden al servidor Node incluido; Vite y un alojamiento que sirva `dist/` directamente tienen su propia configuración. HTTPS/HSTS corresponden al alojamiento público; no se fuerzan desde este servidor HTTP local. Validación funcional en navegador y cabeceras del despliegue público: pendientes.

## Límites de entrada y procesamiento

Consulta [inputBudgets.ts](../src/domain/input/inputBudgets.ts) antes de cambiar admisión, edición, recuperación o serialización. Aplica conjuntamente presupuestos individuales y agregados. Texto cuenta unidades UTF-16; MiB son 1.048.576 bytes. Son límites de capacidad, con rendimiento por comprobar en dispositivo.

| Entrada | Presupuesto |
| --- | --- |
| Coordenadas / texto / texto total | 1.024 / 100.000 / 1.000.000 caracteres. |
| Colección / total / revisiones | 2.000 / 10.000 entradas; 100 revisiones. |
| Temporizadores de Reloj | 10 en total para nuevas altas (`MAX_TIMER_COUNT` en `timerEngine.ts`), comprobado dentro de la cola y el bloqueo del repositorio. Listas anteriores que superen el límite se conservan completas; no admiten nuevas altas hasta quedar por debajo. |
| JSON | 80 MiB, 50.000 objetos, 100.000 propiedades, profundidad 32. |
| Trazo / trazos agregados | 50.000 / 150.000 puntos. |
| Imagen | 50 MiB, 8.192 px por lado y 16.777.216 píxeles totales; reducción a 4.096 px en el lado mayor. |
| GPX original / originales de sesión | 10 MiB por archivo; 20 archivos y 50 MiB en conjunto (`gpxResources.ts`). |
| Puntos GPX | 150.000 por archivo y agregados de geometrías admitidas, incluidos waypoints (`gpxParser.ts`, `gpxGeometryCache.ts`). |
| Geometría GPX | 64 MiB estimados (`gpxBudget.ts`): puntos, métricas, perfil, transferencias y capas de Mapa/Plano. |
| Nombre GPX o punto con nombre | 200 caracteres. |

`validateDocument.ts` limita diagnósticos a 20 incidencias, rutas de 160 caracteres y mensajes de 180, con elipsis. El rechazo conserva el contenido anterior. La caché GPX comparte por huella y serializa admisiones entre consumidores con el presupuesto restante; la estimación de geometría es distinta del tamaño de originales y de la RAM real.

### Fases GPX

| Fase | Propietario y unidad |
| --- | --- |
| Análisis | `gpxWorkerClient.ts` crea worker por análisis; `gpx.worker.ts` recibe archivo completo, comprueba, calcula huella y devuelve buffers. La geometría admitida puede reutilizarse por huella. |
| Desempaquetado | `gpxTransfer.ts` difiere el inicio y cede cada 512 unidades de trabajo en el hilo principal. |
| Selección | `gpxSelectionClient.ts` envía hasta 1.024 puntos por mensaje, esperando confirmación y conservando continuidad por segmento; waypoints por separado. |
| Dibujo | `gpxLayers.ts` usa tramos de hasta 256 vértices con punto de unión compartido y cede por tramo o cada 16 puntos aislados/waypoints. `gpxMetrics.ts` cede cada 256 unidades en el barrido PK. |

Cancelar termina el worker correspondiente y aborta desempaquetado. Conserva continuidad interior de segmentos, separación entre ellos y geometría corta en el antimeridiano. Las tandas describen tareas distintas; comprueba precisión, selección, cancelación y encuadre según [Operaciones](OPERATIONS.md#comprobación-manual).

## Overrides temporales de herramientas

[package.json](../package.json) configura y el lock resuelve estos overrides coordinados:

| Selector | Versión | Motivo y revisión |
| --- | --- | --- |
| `minimatch@10 \|\| 11` | `11.0.4` | Unifica resolución de ramas 10/11 de herramientas; puede sustituir el mayor solicitado. |
| `workbox-build → glob` | `14.0.3` | Coordina Glob con minimatch 11 fuera del rango original de Workbox. |

Revísalos juntos al cambiar ESLint/Workbox/PWA o cuando sus consumidores incorporen versiones compatibles oficiales. Una retirada autorizada debe comprobar instalación reproducible y árbol/lock coherentes, validación estática, auditorías completas y sin desarrollo, selección/revisiones de precaché y funcionamiento PWA. La política activa pertenece a [SECURITY.md](../SECURITY.md).
