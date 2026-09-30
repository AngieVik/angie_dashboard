# Angie Dashboard V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una PWA local-first para Windows y Android que implemente íntegramente la V1 aprobada de Angie Dashboard.

**Architecture:** Aplicación React organizada por funcionalidades, con un núcleo de dominio independiente de React, un almacén de documento versionado, persistencia local en Dexie y adaptadores de navegador para archivos. El shell modular coordina React Grid Layout y el viewport lógico; Konva gestiona únicamente la pizarra. Los temporizadores se mantienen en un almacén interno separado del documento exportable.

**Tech Stack:** React, TypeScript, Vite, shadcn/ui, React Grid Layout, React Konva, Dexie/IndexedDB, Proj4, JSON Schema 2020-12 con Ajv, Vitest, Testing Library, Playwright y Vite PWA.

**Spec:** `ESQUEMA_CONCEPTUAL.md`

## Global Constraints

- Leer `AGENTS.md`, `ESQUEMA_CONCEPTUAL.md` y `ACCEPTANCE_CRITERIA.md` completos antes de implementar.
- Espacio lógico general fijo `1600 × 1000`; ninguna vista puede producir scroll de página.
- Todos los módulos empiezan cerrados y su visibilidad no se persiste.
- El JSON visible usa `format: "angie-dashboard"` y `formatVersion: 1` y no incluye temporizadores ni estado transitorio.
- Los recursos originales de `public/assets` no se modifican.
- La PWA no envía documentos, imágenes, eventos ni telemetría a servicios externos.
- No desplegar, publicar ni hacer `push` sin autorización expresa.
- No ejecutar `git init`, `git add`, `git commit`, configurar Git ni modificar ramas. El usuario crea y actualiza el repositorio; cada tarea termina entregando sus cambios y verificaciones para que él decida cómo registrarlos.
- Implementar primero el comportamiento y las pruebas; aplicar el acabado Titan dentro de la misma tarea propietaria del componente.

## Review Focus

- Selector de archivos no disponible, cancelado o sin permisos: conservar estado y ofrecer descarga sin sobrescritura accidental; se prueba en la Tarea 3.
- JSON dañado, ajeno o futuro: no reemplazar el documento activo; se prueba en las Tareas 2 y 3.
- Gestos de uno y dos dedos compitiendo con módulos, pines o dibujo: dos dedos nunca deben provocar acciones de contenido; se prueba en la Tarea 4.
- Suspensión, recarga o cambio de documento durante temporizadores: recalcular por marcas de tiempo sin exportarlos al JSON; se prueba en la Tarea 8.
- UTM `30S`: tratar `S` como banda del hemisferio norte; se prueba en la Tarea 9.

---

### Task 1: Base del proyecto, calidad y recursos PWA

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/fonts.css`
- Create: `src/styles/global.css`
- Create: `src/test/setup.ts`
- Create: `playwright.config.ts`
- Existing — integrate and verify: `public/assets/pwa/*`
- Existing — integrate and verify: `public/assets/fonts/roboto-condensed/*`
- Test: `src/app/App.test.tsx`
- Test: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: scripts `dev`, `test`, `test:watch`, `lint`, `typecheck`, `build` y `e2e`.
- Produces: tokens CSS para la paleta Titan y un shell React vacío reutilizable.

- [x] **Step 1: Inicializar Vite React/TypeScript e instalar únicamente las dependencias aprobadas y las herramientas de prueba.**

- [x] **Step 2: Configurar Vitest, Testing Library, ESLint, TypeScript estricto y Playwright.**

- [x] **Step 3: Escribir las pruebas iniciales.**

`App.test.tsx` debe comprobar que aparece la cabecera, que el área principal no contiene módulos abiertos y que la interfaz general utiliza Roboto Condensed mientras los datos técnicos conservan una familia monoespaciada. `smoke.spec.ts` debe comprobar carga sin errores, disponibilidad local de las fuentes y ausencia de scroll de página en un viewport de escritorio y uno móvil. La verificación de recursos debe comprobar dimensiones, transparencia de los iconos normales, opacidad de los `maskable` y zona segura.

- [x] **Step 4: Ejecutar las pruebas y confirmar que fallan antes de crear el shell.**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: FAIL porque el shell aún no está implementado.

- [x] **Step 5: Implementar el shell mínimo, los tokens Titan y la configuración PWA.**

Integrar en el manifiesto los iconos PWA existentes, ya derivados de `public/assets/elements/icon_chincheta.png`: normales transparentes de `16 × 16`, `32 × 32`, `180 × 180`, `192 × 192` y `512 × 512`, y variantes `maskable` de `192 × 192` y `512 × 512` con fondo opaco `#0C0D0E` y la chincheta completa dentro de la zona segura circular del `80 %`. No regenerarlos ni sobrescribirlos cuando superen la verificación; si falla un recurso derivado, corregir únicamente ese archivo sin modificar el PNG original.

Importar la hoja local existente de Roboto Condensed variable normal y cursiva, pesos `100–900`, subconjuntos `latin` y `latin-ext`, junto con su licencia; aplicarla a la interfaz general y mantener una fuente monoespaciada para datos técnicos. El manifiesto usará `Angie Dashboard`, nombre corto `Angie` y color de tema `#0C0D0E`.

- [x] **Step 6: Verificar la base.**

Run: `npm run lint && npm run typecheck && npm test -- --run && npm run build && npm run e2e`

Expected: todos los comandos terminan con código `0`.

- [x] **Step 7: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 2: Modelo de documento, esquema y migraciones

**Files:**
- Create: `src/domain/document/types.ts`
- Create: `src/domain/document/defaultDocument.ts`
- Create: `src/domain/document/schema/angie-document-v1.schema.json`
- Create: `src/domain/document/validateDocument.ts`
- Create: `src/domain/document/migrateDocument.ts`
- Create: `src/domain/document/serializeDocument.ts`
- Test: `src/domain/document/document.test.ts`
- Test: `src/domain/document/fixtures/*`

**Interfaces:**
- Produces: `AngieDocumentV1`, `createEmptyDocument(title?: string): AngieDocumentV1`.
- Produces: `validateDocument(input: unknown): ValidationResult<AngieDocumentV1>`.
- Produces: `migrateDocument(input: unknown): MigrationResult<AngieDocumentV1>`.
- Produces: `serializeDocument(document: AngieDocumentV1): string`.

- [x] **Step 1: Escribir pruebas fallidas para el documento vacío, las nueve propiedades raíz, la estructura completa obligatoria, UUID, fechas UTC, colores, estados operativos y exclusiones.**

Incluir fixtures válido, completo, dañado, ajeno, versión antigua no reconocida y futuro. Cubrir propiedades desconocidas, uniones discriminadas, relaciones `isUnit`/`operational` y `tool`/`color`, etiquetas vacías o duplicadas sin distinguir mayúsculas, coordenadas `0–1000`, escala `0.25–3`, tamaños de módulos y orden cronológico. Verificar que cualquier error devuelve su ruta y no produce un documento sustituto.

- [x] **Step 2: Ejecutar las pruebas y confirmar el fallo.**

Run: `npm test -- --run src/domain/document/document.test.ts`

Expected: FAIL porque las interfaces y el esquema no existen.

- [x] **Step 3: Implementar tipos, documento vacío, JSON Schema 2020-12, validación, serialización y la infraestructura de migración.**

El tipo raíz debe contener exactamente `format`, `formatVersion`, `document`, `board`, `elements`, `notebook`, `timeline`, `moduleLayouts` y `filters`; los nombres, tipos, valores iniciales y relaciones serán exactamente los definidos en el contrato JSON V1 del esquema. La serialización utilizará dos espacios y salto de línea final.

- [x] **Step 4: Verificar dominio y esquema.**

Run: `npm test -- --run src/domain/document/document.test.ts && npm run typecheck`

Expected: PASS y cero errores de tipos.

- [x] **Step 5: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 3: Estado del documento, autoguardado y archivos

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/documentRepository.ts`
- Create: `src/storage/autosave.ts`
- Create: `src/platform/files/fileAccess.ts`
- Create: `src/features/document/documentStore.ts`
- Create: `src/features/document/FileMenu.tsx`
- Test: `src/storage/documentRepository.test.ts`
- Test: `src/platform/files/fileAccess.test.ts`
- Test: `src/features/document/FileMenu.test.tsx`

**Interfaces:**
- Consumes: `AngieDocumentV1`, `validateDocument`, `migrateDocument`, `serializeDocument` de la Tarea 2.
- Produces: `DocumentRepository.loadActive()`, `saveActive(document)` y `clearActive()`.
- Produces: `saveVisibleDocument(document, context): Promise<SaveOutcome>` y `loadVisibleDocument(file): Promise<LoadOutcome>`.
- Produces: `useDocumentStore` con acciones `newDocument`, `loadDocument`, `saveDocument` y mutaciones de dominio.

- [x] **Step 1: Escribir pruebas fallidas para autoguardado, recuperación, carga segura y flujo de selector/descarga.**

Cubrir selector compatible, reutilización del handle, cambio de título, cancelación, permiso denegado, fallback de descarga y JSON futuro/dañado que conserva el estado activo. Probar que el saneamiento del nombre no modifica el título, elimina caracteres de control, `<>:"/\|?*` y espacios o puntos finales, conserva acentos y separadores interiores y añade `.json` una sola vez. El nombre base se validará después de retirar una posible extensión `.json`; si queda vacío o reservado (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`), debe proponerse exactamente `drp_YYYY-MM-DD_HH-mm-ss.json` con fecha y hora local, formato de 24 horas y ceros iniciales.

Simular fallos al abrir, leer y escribir IndexedDB. Comprobar que el documento continúa operativo en memoria, que no se borra ni recrea la base local, que aparece `Autoguardado no disponible` con `Reintentar` y `Guardar JSON` y que la exportación visible permanece disponible. Un reintento correcto debe guardar el estado más reciente y retirar el aviso; una recuperación tardía no podrá sustituir un documento ya modificado sin confirmación.

- [x] **Step 2: Ejecutar las pruebas y confirmar el fallo.**

Run: `npm test -- --run src/storage src/platform/files src/features/document`

- [x] **Step 3: Implementar Dexie, repositorio, autoguardado, modo degradado en memoria y adaptador de archivos sin acceder directamente a APIs del navegador desde componentes.**

- [x] **Step 4: Implementar `Archivo > Nuevo/Cargar/Guardar`, el saneamiento exacto del nombre propuesto y el nombre alternativo local `drp_YYYY-MM-DD_HH-mm-ss.json`.**

- [x] **Step 5: Verificar persistencia y errores.**

Run: `npm test -- --run src/storage src/platform/files src/features/document && npm run typecheck`

Expected: PASS; cancelar o fallar nunca cambia el documento activo.

- [x] **Step 6: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 4: Shell modular, colocación y viewport táctil

**Files:**
- Create: `src/layout/moduleRegistry.ts`
- Create: `src/layout/layoutTypes.ts`
- Create: `src/layout/findModulePlacement.ts`
- Create: `src/layout/ModuleFrame.tsx`
- Create: `src/layout/DashboardGrid.tsx`
- Create: `src/layout/MobileViewport.tsx`
- Create: `src/layout/useViewportGestures.ts`
- Create: `src/features/view/ViewMenu.tsx`
- Test: `src/layout/findModulePlacement.test.ts`
- Test: `src/layout/MobileViewport.test.tsx`
- Test: `tests/e2e/layout-and-touch.spec.ts`

**Interfaces:**
- Produces: `ModuleId` con `board`, `elements`, `information`, `operations`, `coordinates`, `clock`, `calculator`, `notebook`, `timeline`.
- Produces: `MODULE_REGISTRY` con tamaños iniciales y mínimos exactos del esquema.
- Produces: `findModulePlacement(request, occupied, bounds): PlacementResult`.
- Produces: `ViewportState { scale, offsetX, offsetY }` y acciones `fit`, `pan`, `zoomAt`, `clamp`.

- [x] **Step 1: Escribir pruebas fallidas para tamaños, distribución guardada, búsqueda de huecos y apertura excepcional.**

Comprobar orden izquierda-derecha/arriba-abajo, preservación de módulos existentes, aviso exacto y solapamiento solo cuando no exista hueco.

- [x] **Step 2: Escribir pruebas fallidas para escala de encaje dinámica, zoom máximo `max(400 %, fit)`, margen elástico `10 %`, rotación y prioridad de dos dedos.**

Comprobar que `fit` utiliza el menor valor entre `ancho disponible / 1600` y `alto disponible / 1000`, sin incluir la cabecera, y que un viewport cuya escala de encaje supere el `400 %` utiliza esa escala como máximo efectivo en lugar de limitar o recortar el dashboard.

- [x] **Step 3: Ejecutar las pruebas y confirmar el fallo.**

Run: `npm test -- --run src/layout`

- [x] **Step 4: Implementar registro, algoritmo de colocación, marcos Titan, menú `Ver` y React Grid Layout sin packing.**

- [x] **Step 5: Implementar viewport y gestos; durante dos punteros se bloquean arrastres, resize y canvas.**

- [x] **Step 6: Verificar con pruebas unitarias y navegador.**

Run: `npm test -- --run src/layout && npm run e2e -- tests/e2e/layout-and-touch.spec.ts`

Expected: PASS en viewport de escritorio y emulación táctil móvil.

- [x] **Step 7: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 5: Pizarra, fondos, trazos y notas rápidas

**Files:**
- Create: `src/features/board/BoardModule.tsx`
- Create: `src/features/board/BoardToolbar.tsx`
- Create: `src/features/board/boardTypes.ts`
- Create: `src/features/board/boardReducer.ts`
- Create: `src/features/board/imageLoader.ts`
- Create: `src/features/board/QuickNote.tsx`
- Test: `src/features/board/boardReducer.test.ts`
- Test: `src/features/board/imageLoader.test.ts`
- Test: `src/features/board/BoardModule.test.tsx`

**Interfaces:**
- Consumes: `board` del documento y mutaciones de `useDocumentStore`.
- Produces: `loadBoardImage(file): Promise<BoardImageResult>`; la imagen resultante vive solo en memoria.
- Produces: eventos normalizados de trazo, borrado, pin y nota en coordenadas del lienzo lógico fijo `1000 × 1000`.

- [ ] **Step 1: Escribir pruebas fallidas para modos exclusivos, trazos, borrado, notas y transformación de coordenadas.**

- [ ] **Step 2: Escribir pruebas fallidas para imagen superior a `50 MiB`, reducción sobre `4096 px` y conservación del fondo anterior ante error.**

- [ ] **Step 3: Implementar reducer y carga local de imágenes.**

- [ ] **Step 4: Implementar el módulo Konva y sus cuatro herramientas sin persistir la imagen.**

- [ ] **Step 5: Verificar.**

Run: `npm test -- --run src/features/board && npm run typecheck`

- [ ] **Step 6: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 6: Catálogo, elementos y pines redimensionables

**Files:**
- Create: `src/features/elements/iconCatalog.ts`
- Create: `src/features/elements/elementTypes.ts`
- Create: `src/features/elements/elementCommands.ts`
- Create: `src/features/elements/ElementsModule.tsx`
- Create: `src/features/elements/ElementEditor.tsx`
- Create: `src/features/elements/BoardPin.tsx`
- Create: `src/features/elements/StateFilter.tsx`
- Test: `src/features/elements/iconCatalog.test.ts`
- Test: `src/features/elements/elementCommands.test.ts`
- Test: `src/features/elements/BoardPin.test.tsx`

**Interfaces:**
- Produces: `ICON_CATALOG` con los nueve IDs, rutas, clases y tamaños exactos del esquema.
- Produces: comandos `createElement`, `updateElement`, `duplicateElement`, `deleteElement`.
- Produces: `clampAssetScale(value): number` limitado a `0.25–3`.

- [ ] **Step 1: Escribir pruebas fallidas para las nueve entradas, la existencia de sus archivos y las tres clases de caja permitidas.**

Comprobar las cajas exactas `150 × 100` para `Horizontal`, `100 × 150` para `Vertical` y `100 × 100` para `Cuadrado`; cada entrada debe declarar una clase existente y no podrá definir dimensiones particulares.

- [ ] **Step 2: Escribir pruebas fallidas para CRUD, emoji, escala proporcional sincronizada e inmutabilidad de `Dotación`.**

Comprobar que cada PNG utiliza `contain`, queda centrado sin deformación ni recorte y que la escala común mantiene la caja completa dentro del lienzo. Comprobar también que el checkbox solo existe durante la creación; una dotación comienza como `Disponible`; editar nunca cambia `isUnit`; y eliminar una dotación conserva intactas sus entradas cronológicas. Duplicar genera UUID y nombre nuevos, conserva configuración y tipo y desplaza el pin `24` unidades sin sacarlo del lienzo; si es una dotación, reinicia `operational` y no copia entradas cronológicas.

- [ ] **Step 3: Implementar catálogo y comandos de dominio.**

- [ ] **Step 4: Implementar módulo, editor, pines Konva/HTML coordinados y control de escala por tirador y deslizador.**

- [ ] **Step 5: Verificar.**

Run: `npm test -- --run src/features/elements && npm run typecheck`

- [ ] **Step 6: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 7: Información, estados operativos y registro cronológico

**Files:**
- Create: `src/domain/operations/statuses.ts`
- Create: `src/domain/operations/changeStatus.ts`
- Create: `src/features/information/InformationModule.tsx`
- Create: `src/features/operations/OperationsModule.tsx`
- Create: `src/features/timeline/timelineCommands.ts`
- Create: `src/features/timeline/TimelineModule.tsx`
- Test: `src/domain/operations/changeStatus.test.ts`
- Test: `src/features/information/InformationModule.test.tsx`
- Test: `src/features/timeline/timelineCommands.test.ts`

**Interfaces:**
- Produces: `OPERATIONAL_STATUSES` con los ocho pares Estado/Fase exactos.
- Produces: `changeElementStatus(document, elementId, nextStatus, now): AngieDocumentV1`.
- Produces: `undoAutomaticTimelineEntry(document, entryId): UndoResult`.

- [ ] **Step 1: Escribir pruebas fallidas para ocho estados, anotaciones, etiquetas, vista global, entradas manuales/automáticas y deshacer.**

Cubrir la selección global compartida entre pizarra, Elementos, Información y Operativo. Sin selección, Información debe listar únicamente los nombres de las dotaciones o `Sin dotaciones`; tocar un nombre debe seleccionarla. Operativo debe mostrar, en el orden definido, solo los contadores no vacíos de estados exactos; tocar uno debe desplegar exclusivamente sus dotaciones, sustituir cualquier despliegue anterior y permitir seleccionarlas. Con una dotación seleccionada, Operativo debe mostrar los ocho estados y resaltar el actual; seleccionar un elemento general debe mantener la vista de contadores.

Cubrir la selección manual de cualquier estado sin transiciones obligatorias y el no-op al seleccionar el estado actual. Para `Deshacer`, comprobar que solo se admite la entrada más reciente de cada dotación cuando el estado actual coincide con su `nextStatus`; que restaura `previousStatus` y elimina la entrada sin crear otra; que permite retroceder en orden inverso; y que otras dotaciones no interfieren. Cubrir también el rechazo atómico de entradas antiguas o incoherentes y la conservación sin `Deshacer` del historial de una dotación eliminada.

Para anotaciones y etiquetas, cubrir alta con botón o Enter, edición en línea, eliminación sin confirmación, recorte de espacios, rechazo de vacíos y duplicados sin distinguir mayúsculas, autoguardado y visualización en Información sin representación sobre la pizarra.

- [ ] **Step 2: Implementar dominio de estados y timeline como operaciones atómicas sobre el documento, manteniendo separada la selección manual del estado de la creación automática de su entrada cronológica.**

- [ ] **Step 3: Implementar los tres módulos y su coordinación mediante una única selección estable por ID, incluyendo los dos modos de Información y Operativo.**

- [ ] **Step 4: Verificar.**

Run: `npm test -- --run src/domain/operations src/features/information src/features/operations src/features/timeline`

- [ ] **Step 5: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 8: Reloj, temporizadores y alarma

**Files:**
- Create: `src/features/clock/timerTypes.ts`
- Create: `src/features/clock/timerEngine.ts`
- Create: `src/features/clock/timerRepository.ts`
- Create: `src/features/clock/alarmController.ts`
- Create: `src/features/clock/ClockModule.tsx`
- Create: `src/features/clock/TimerRow.tsx`
- Test: `src/features/clock/timerEngine.test.ts`
- Test: `src/features/clock/timerRepository.test.ts`
- Test: `src/features/clock/alarmController.test.ts`
- Test: `src/features/clock/ClockModule.test.tsx`

**Interfaces:**
- Produces: `TimerRecord` discriminado para `tzero`, `tminus` y `advisory`.
- Produces: `calculateTimerValue(timer, now): TimerSnapshot` basado en marcas de tiempo.
- Produces: repositorio Dexie separado del documento exportable.
- Produces: `AlarmController.startAlarm(timerId)`, `acknowledge(timerId)`, `startPreview()`, `stopPreview()` y `stop()` sobre `public/assets/audio/alarm.mp3`, manteniendo el conjunto de alertas activas y resultados diferenciados para reproducción iniciada, bloqueo del navegador y error de reproducción.

- [ ] **Step 1: Escribir pruebas con reloj falso para iniciar, pausar, reiniciar, completar, suspender y recuperar.**

Cubrir los tres campos exclusivamente numéricos de `T-Minus` y `Advisory`, el teclado numérico, los separadores fijos y la normalización al abandonar el campo o iniciar. Verificar, como mínimo, `00:90:00 → 01:30:00`, `00:00:90 → 00:01:30`, `01:90:90 → 02:31:30`, cero a `00:00:01` y cualquier exceso sobre `23:59:59` limitado al máximo. Comprobar que un `T-Zero` que completa `23:59:59` se detiene, vuelve a cero y queda inactivo sin alerta ni nuevo ciclo.

Cubrir también `Desactivar` sobre un Advisory en ejecución y sobre otro que ya esté alertando: debe detener conteo, sonido y destello, volver a `00:00:00`, conservar duración y nota y quedar inactivo y reutilizable; no debe comportarse como pausa, finalización ni cierre.

Cubrir el único control común cuyo texto permanece como `Probar sonido` mientras su icono alterna entre `▶` y `⏸`: reproducción en bucle sin modificar temporizadores, parada al cerrar el módulo, prioridad de una alarma real y desactivación del control mientras haya una alerta activa. Simular también el rechazo de reproducción por bloqueo del navegador y por otro error; la alerta visual debe continuar, mostrando respectivamente `Sonido bloqueado` con `Activar sonido` o `No se pudo reproducir la alarma`.

Completar simultáneamente varios temporizadores y comprobar que mantienen alertas visuales independientes y una sola reproducción en bucle. Reconocer, reiniciar, desactivar o cerrar uno debe retirar únicamente su alerta y mantener el sonido mientras quede otra activa; resolver la última debe detenerlo.

- [ ] **Step 2: Comprobar que `Nuevo`, `Guardar` y `Cargar` no modifican temporizadores y que el JSON nunca los contiene.**

- [ ] **Step 3: Implementar motor, repositorio y controlador de audio en bucle.**

- [ ] **Step 4: Implementar UI con hora española, Zulu, notas, control común de prueba de sonido, recuperación manual del audio bloqueado y alerta visual de dos destellos por segundo.**

- [ ] **Step 5: Verificar.**

Run: `npm test -- --run src/features/clock && npm run typecheck`

- [ ] **Step 6: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 9: Conversión y validación de coordenadas

**Files:**
- Create: `src/features/coordinates/coordinateTypes.ts`
- Create: `src/features/coordinates/parseCoordinate.ts`
- Create: `src/features/coordinates/convertCoordinate.ts`
- Create: `src/features/coordinates/googleMapsLink.ts`
- Create: `src/features/coordinates/CoordinatesModule.tsx`
- Test: `src/features/coordinates/coordinates.test.ts`
- Test: `src/features/coordinates/CoordinatesModule.test.tsx`

**Interfaces:**
- Produces: `parseCoordinate(input: string): CoordinateParseResult`.
- Produces: `convertCoordinate(coordinate, targetFormat): FormattedCoordinate`.
- Produces: `createGoogleMapsLink(latitude, longitude): string`.

- [ ] **Step 1: Escribir pruebas exactas para los ejemplos DD, DMS, DMM y `30S 588700 4101800`.**

Verificar que banda `S` implica hemisferio norte; incluir bandas `M/N`, zonas `1/60`, `I/O` inválidas y texto con separadores corregibles sin alterar números.

- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo.**

Run: `npm test -- --run src/features/coordinates`

- [ ] **Step 3: Implementar parser, validación, conversión Proj4 y enlace.**

- [ ] **Step 4: Implementar UI que conserva la entrada inválida y bloquea conversión/enlace.**

- [ ] **Step 5: Verificar.**

Run: `npm test -- --run src/features/coordinates && npm run typecheck`

- [ ] **Step 6: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 10: Calculadora

**Files:**
- Create: `src/features/calculator/expression.ts`
- Create: `src/features/calculator/CalculatorModule.tsx`
- Test: `src/features/calculator/expression.test.ts`
- Test: `src/features/calculator/CalculatorModule.test.tsx`

**Interfaces:**
- Produces: `evaluateExpression(expression: string): CalculationResult` sin usar `eval`.

- [ ] **Step 1: Escribir pruebas para operaciones, precedencia, paréntesis, porcentajes, decimales, división por cero, retroceso y limpieza.**

Verificar el operador posfijo de porcentaje y su contexto comercial con `10 % = 0,1`, `200 + 10 % = 220`, `200 - 10 % = 180`, `200 × 10 % = 20`, `200 ÷ 10 % = 2000` y `80 + 12,5 % = 90`, incluidas las mismas reglas dentro de paréntesis. Dividir entre `0 %` debe devolver un error sin resultado numérico.

- [ ] **Step 2: Implementar evaluador seguro y UI compacta.**

- [ ] **Step 3: Verificar.**

Run: `npm test -- --run src/features/calculator`

- [ ] **Step 4: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 11: Cuaderno

**Files:**
- Create: `src/features/notebook/notebookCommands.ts`
- Create: `src/features/notebook/NotebookModule.tsx`
- Create: `src/features/notebook/NoteBlock.tsx`
- Create: `src/features/notebook/ChecklistBlock.tsx`
- Test: `src/features/notebook/notebookCommands.test.ts`
- Test: `src/features/notebook/NotebookModule.test.tsx`

**Interfaces:**
- Produces: comandos para añadir nota/checklist, editar, marcar, eliminar y reordenar bloques por ID.

- [ ] **Step 1: Escribir pruebas para CRUD, orden, checklist y persistencia sin título separado ni formato enriquecido.**

- [ ] **Step 2: Implementar comandos y componentes; el drag táctil solo comienza desde `⠿`.**

- [ ] **Step 3: Verificar.**

Run: `npm test -- --run src/features/notebook`

- [ ] **Step 4: Entregar la tarea para revisión.**

Presentar archivos modificados y resultados de verificación sin ejecutar operaciones de escritura en Git.

---

### Task 12: Integración, offline, accesibilidad y aceptación final

**Files:**
- Create: `tests/e2e/document-flow.spec.ts`
- Create: `tests/e2e/operational-flow.spec.ts`
- Create: `tests/e2e/timers.spec.ts`
- Create: `tests/e2e/mobile-board.spec.ts`
- Create: `tests/e2e/offline.spec.ts`
- Modify: `ACCEPTANCE_CRITERIA.md`
- Modify: files with defects found during verification only.

**Interfaces:**
- Consumes: todas las interfaces públicas de las Tareas 1–11.
- Produces: una V1 compilable y verificable localmente; no produce despliegue.

- [ ] **Step 1: Escribir flujos E2E para crear documento, elementos y dotaciones; mover pines; cambiar estado; guardar/cargar; deshacer; temporizadores; coordenadas; recarga y offline.**

- [ ] **Step 2: Añadir comprobaciones de teclado, nombres accesibles, foco visible y estados no dependientes solo del color.**

Verificar con teclado los menús `Archivo` y `Ver`, el título, la apertura y cierre de módulos, los controles de formularios y listas, filtros, estados, etiquetas, temporizadores, calculadora, Cuaderno y la selección de elementos y dotaciones desde sus módulos. Comprobar un orden de foco lógico limitado a la cabecera y los módulos abiertos, nombres accesibles en controles de solo icono y nombre o icono adicional para cada estado. No exigir movimiento o redimensión de módulos, pines o notas ni dibujo o borrado mediante teclado.

- [ ] **Step 3: Ejecutar toda la matriz y corregir únicamente defectos que incumplan el esquema o los criterios.**

Run: `npm run lint && npm run typecheck && npm test -- --run && npm run build && npm run e2e`

Expected: todos los comandos terminan con código `0`.

- [ ] **Step 4: Instalar el build localmente como PWA y verificar manualmente un dispositivo o emulación Android y un navegador de escritorio.**

Registrar qué entorno se verificó; no afirmar prueba en dispositivo real si solo se utilizó emulación.

- [ ] **Step 5: Revisar uno por uno `ACCEPTANCE_CRITERIA.md` y marcar únicamente criterios demostrados.**

- [ ] **Step 6: Revisar el diff completo y confirmar que no existen funciones fuera de alcance, secretos, endpoints ni despliegues.**

- [ ] **Step 7: Entregar la V1 para revisión final.**

Presentar el diff completo, los resultados de verificación y los criterios demostrados sin ejecutar operaciones de escritura en Git.
