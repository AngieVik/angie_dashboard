# info scripts

## Organización de resultados individuales

Las ocho CLI individuales escriben exclusivamente sus informes en `output/analize-app-scripts/`, con este orden recomendado de lectura: `01_app_inventory`, `02_ui_styles`, `03_ui_consistency`, `04_unused_code`, `05_architecture`, `06_dependencies`, `07_public_assets` y `08_bundle_analysis`.

Cada carpeta contiene `report.md` y `report.json`, actualizados en cada ejecución individual. `scripts/lib/runtime.mjs` centraliza esas rutas mediante `individualReportPaths`; los comandos mantienen sus nombres. Architecture es una salida independiente de App Inventory. Bundle utiliza el mismo par de archivos y ya no genera informes en `docs/`.

Los informes existentes se han reubicado sin recalcularlos. Conservan sus fechas y su procedencia: validaciones de los scripts o el análisis previo de bundle. La reorganización no constituye un análisis nuevo. El coordinador utiliza `output/diagnostic workflow/AAAA-MM-DD_HH-mm_perfil/`, sin una carpeta intermedia `runs`. Las CLI individuales no modifican código de la app.

## Entrada recomendada: diagnóstico coordinado

Desde la raíz del proyecto:

```powershell
npm run diagnose
npm run diagnose:full
```

El perfil `quick`, predeterminado, ejecuta inventario, limpieza, arquitectura, dependencias, recursos públicos, estilos y coherencia. El perfil `full` añade el análisis del bundle en un directorio temporal, sin modificar `dist` ni los informes individuales. No abre el navegador ni realiza comprobaciones funcionales automáticas.

También puede ejecutarse desde otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\diagnose.mjs --profile quick
node D:\Proyectos\angie_dashboard\scripts\diagnose.mjs --profile full
node D:\Proyectos\angie_dashboard\scripts\diagnose.mjs --help
```

### Ejecuciones conservadas y referencia

Cada diagnóstico se publica completo como conjunto de archivos en `output/diagnostic workflow/<ID>/`. El `report.md` principal contiene una colección completa de hallazgos, agrupada por análisis y naturaleza, más un resumen numérico de cobertura y enlaces a los individuales. `report.json` conserva evidencias, huellas y comparación (`schemaVersion: 2`, `analysisVersion: 2`). Los ocho análisis, incluido bundle, añaden el contrato común `diagnosticSchemaVersion: 1` y `findings` sin sustituir sus datos de referencia. Cada subinforme incluye el mismo identificador de ejecución y huella de entrada en su JSON. Se conservan exclusivamente los `report.md` y `report.json` configurados; la comparación no se separa ni cambia su presentación.

El identificador sigue `AAAA-MM-DD_HH-mm_perfil`, con la hora de inicio en `Europe/Madrid`; por ejemplo, `2026-11-02_06-30_full`. `scripts/lib/workflow-paths.mjs` centraliza ruta, zona horaria y reserva del nombre. Una reserva temporal evita colisiones entre ejecuciones concurrentes: si coincide el minuto/perfil se añade `_02`, `_03`, etc. Cada carpeta queda directamente bajo `output/diagnostic workflow/`, sin `runs` intermedio.

`output/diagnostic workflow/latest.json` apunta al último diagnóstico publicado. `latest-quick.json` y `latest-full.json` señalan la última ejecución del perfil con entradas estables y sin etapas fallidas; una cobertura parcial explícita puede mantenerse como referencia. Los informes individuales anteriores no se sobrescriben al utilizar el coordinador.

En la reorganización inicial se eliminaron 28 ejecuciones y se conservó únicamente `2026-11-02_06-30_full`, manteniendo sus resultados, fechas e identificador original como procedencia. Su comparación se deja sin referencia porque la anterior se eliminó. Solo existen punteros al perfil conservado; la primera ejecución quick partirá sin referencia automática. No se ha recalculado el análisis ni se han convertido las validaciones previas en análisis nuevos. Esta limpieza es puntual: el coordinador conserva las futuras ejecuciones y no aplica una política de borrado automático.

Por defecto compara con la referencia anterior del mismo perfil. Se puede elegir otra o desactivar la comparación:

```powershell
npm run diagnose -- --baseline latest
npm run diagnose -- --baseline none
npm run diagnose -- --baseline ID_DE_EJECUCION
```

La comparación requiere el mismo perfil, versión de análisis y huella del motor, además de entradas estables durante ambas ejecuciones. Los identificadores de intervenciones no dependen de líneas de código. Se distinguen intervenciones nuevas, cambiadas, sin cambios y que dejan de aparecer. **Dejar de aparecer no demuestra que un problema esté corregido.** Las etapas con fallos o cambios en sus limitaciones explícitas se excluyen de la comparación. El perfil completo también compara bytes de JavaScript inicial/total y precaché.

### Fiabilidad y lectura del resultado

- `complete`: las etapas previstas terminaron y no detectaron limitaciones explícitas.
- `partial`: existe una limitación explícita, una etapa fallida o cambiaron entradas durante la ejecución. No significa que haya un fallo funcional de Angie.
- `failed`: fallaron todas las etapas. Un error de arranque o publicación puede impedir generar un informe.
- `impact.certainty: comprobado`: la consecuencia que se describe tiene evidencia directa.
- `impact.certainty: posible`: la consecuencia depende de las condiciones indicadas; no se afirma un fallo observado.
- `impact.certainty: no acreditado`: el hecho detectado no demuestra un daño funcional.

Cada hallazgo tiene ID estable, origen(s), regla y naturaleza, elemento reconocido, dato detectado, hechos estructurados, clasificación, confianza, riesgo del hallazgo (`impact`), alcance, todas las evidencias y relaciones con otros IDs. Los campos de acciones, beneficios, riesgo de reparación, prioridad de intervención y validación posterior dejan de generarse. Los archivos desconectados se agrupan por sus conexiones; los exports distinguen referencias locales, externas desconectadas y externas conectadas. Un componente UI se identifica por su nombre de carpeta y los demás archivos por área y nombre, con sus rutas en las evidencias.

`findingSchema` y `validateFindings` en `scripts/lib/findings.mjs` validan el mismo contrato para individuales y workflow. Los renderizadores comparten el bloque de hallazgo y las referencias al código; mantienen las tablas de inventario, medidas y métricas como datos de referencia propios. No se repite una tabla inicial con todos los títulos ni se limita la colección a una selección. Los encabezados tienen líneas en blanco antes y después y los campos de cada registro permanecen juntos. Las limitaciones con idéntica evidencia entre analizadores se reúnen con sus orígenes e IDs alternativos; datos distintos sobre un mismo elemento quedan relacionados, sin perder sus fichas.

Inventario no diagnostica el uso de paquetes ni estilos; Estilos no decide diferencias entre superficies. Coherencia compara la política visual; Código sin uso analiza consumidores; Arquitectura describe imports; Dependencias cruza declaración, instalación y usos JavaScript/CSS/tipos/herramientas; Recursos públicos lee referencias y configuración; Bundle mide los archivos realmente emitidos. La ausencia de JavaScript atribuible o una coincidencia numérica no se convierten por sí solas en errores. No se borra código ni se aplican cambios a la app.

Las huellas cubren `src`, `scripts`, `server`, `public`, manifiestos y configuraciones conocidas; se registran commit, cambios locales y versiones de Node/TypeScript/Vite/AJV. Incluyen los `package.json` instalados en directorios regulares de `node_modules`, también los anidados; no siguen enlaces simbólicos. Los archivos `.env` conocidos y las variables `VITE_*`, `NODE_ENV` y `TZ` se representan solo mediante hashes, nunca por sus valores. No se acredita la identidad íntegra de `node_modules` ni de todo el entorno. Si las entradas inventariadas cambian entre el inicio y el final, la comparación se desactiva y esa ejecución no pasa a ser referencia automática. La versión de npm forma parte de la compatibilidad de cobertura de la etapa de dependencias.

En el perfil completo, si `NODE_ENV` no está definido, se establece `production` antes de tomar la huella inicial, como haría Vite al compilar. Se conserva cualquier valor explícito ya definido.

El conjunto se prepara en una carpeta temporal dentro de `output/diagnostic workflow` y se publica mediante renombrado al terminar; las ejecuciones anteriores se conservan. El contrato principal se valida con AJV antes de publicar. Los punteros se actualizan mediante escritura temporal y renombrado. Todo `output/` sigue excluido de Git.

El comando devuelve `0` si publica el diagnóstico sin errores de ejecución, incluso si es parcial por límites conocidos; devuelve `1` si falla una etapa, cambian las entradas o falla el arranque/publicación. Hay que consultar tanto el código de salida como el estado y alcance del informe.

### Núcleo compartido y comandos individuales

`scripts/lib/` contiene el contexto del proyecto, el parser CSS, colectores, renderizadores, huellas, publicación y agrupación de intervenciones. Los colectores son importables sin ejecutar las CLI ni escribir informes. El coordinador comparte un único Program de TypeScript y la caché de CSS/textos entre etapas; coherencia reutiliza el inventario de estilos ya obtenido. Las etapas se ejecutan secuencialmente y el contexto se libera antes de empaquetar el bundle.

Los comandos individuales descritos a continuación admiten `--help` y escrituras temporales por archivo. Utilizan las rutas numeradas de `output/analize-app-scripts/`; estas salidas individuales no tienen el historial ni la publicación conjunta del coordinador. La detección sigue siendo estática y conserva sus límites: no resuelve todos los usos dinámicos ni la cascada CSS efectiva. Las comprobaciones en navegador o dispositivo continúan siendo manuales.

## bundle

Para repetir el análisis en otro entorno con las dependencias del proyecto instaladas:
node scripts/analyze-bundle.mjs
El [analizador](D:/Proyectos/angie_dashboard/scripts/analyze-bundle.mjs) genera el informe y un [JSON detallado](D:/Proyectos/angie_dashboard/output/analize-app-scripts/08_bundle_analysis/report.json), sin modificar dist ni instalar dependencias.

El informe JSON V2 incluye `modules` por chunk de interfaz y worker, con identidad, `renderedExports`, `renderedLength` y `attributedBytes`. La pertenencia al chunk procede del empaquetador; `renderedLength` es una medida de una fase anterior a la minificación final y no se suma a los bytes reales ni se presenta como ahorro.

La atribución por mapas de fuentes sigue siendo aproximada. Se corta al cruzar una sentencia o declaración superior sin un nuevo segmento. El resto se conserva en `unmappedBytes`; `unreliableBytes` identifica la parte descartada por ese límite. Así los esquemas JSON nativos sin mapa no engordan artificialmente `documentEdits.ts`, `fileAccess.ts` o el validador anterior. El Markdown enumera los módulos con código renderizado pero sin bytes atribuibles. No significa que estén sin uso; sus bytes permanecen incluidos en el total real del chunk.

## Inventario del stack, componentes y elementos

El script `scripts/inspect-app.mjs` lee el checkout actual y genera un inventario estático. Utiliza Node.js y TypeScript, que ya forma parte de las dependencias de desarrollo del proyecto. Requiere las dependencias instaladas; no instala paquetes, no inicia la app y no necesita conexión a Internet.

Desde PowerShell:

```powershell
cd D:\Proyectos\angie_dashboard
node scripts/inspect-app.mjs
```

También puede ejecutarse desde otra carpeta indicando su ruta absoluta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\inspect-app.mjs
```

Para consultar la ayuda:

```powershell
node scripts/inspect-app.mjs --help
```

### Informes generados

- `output/analize-app-scripts/01_app_inventory/report.md`: informe legible con tablas y ubicaciones de código.
- `output/analize-app-scripts/01_app_inventory/report.json`: inventario estructurado para búsquedas o procesamiento posterior, con `schemaVersion: 1`.

Cada ejecución actualiza ambos archivos. La ruta de salida se calcula desde la ubicación del script y permanece dentro del proyecto aunque se ejecute desde otra carpeta. `output/` está excluido de Git. El script muestra únicamente un resumen y las rutas; devuelve código de salida 1 si encuentra un error.

### Qué lee

- **Stack:** dependencias directas de producción y desarrollo, versión declarada en `package.json`, versión resuelta en `package-lock.json`, comandos npm y archivos de configuración. Incluye qué archivos importan cada paquete, también sus subrutas. Las versiones del lock no certifican qué está instalado en `node_modules`.
- **Módulos:** contenido de `MODULE_REGISTRY`, con identificadores, nombres, tamaños, modos y límites. Resuelve constantes locales literales sin ejecutar el registro.
- **Componentes React:** declaraciones PascalCase que contienen JSX, incluidas funciones, clases y variables con wrappers. Registra nombre, archivo, línea y si tienen un `export` directo.
- **Elementos de interfaz:** etiquetas JSX intrínsecas (HTML, SVG o personalizadas) y componentes utilizados, agrupados por archivo con número de apariciones. El JSON incluye la primera línea y el origen importado de cada etiqueta cuando puede identificarlo.
- **Elementos operativos:** `ICON_CATALOG` y las declaraciones de `AssetId`, `ElementVisual`, `DocumentElement` y `PinTransform`.
- **Fuentes:** lista todos los archivos de `src` con sus bytes; analiza sintaxis de JS/TS/JSX/TSX y las configuraciones/servidor indicados en el informe. El JSON incluye imports, reexportaciones e imports dinámicos con ruta literal.

### Alcance y límites

Es una lectura del código, no una inspección en navegador. Incluye declaraciones y ramas aunque no estén activas o no se usen. Los componentes se detectan mediante una heurística de nombre y JSX: puede omitir alias, componentes que devuelven solo `null`, factories sin JSX o exports anónimos; una función con JSX anidado puede ser un falso positivo. Las reexportaciones no crean una nueva declaración de componente.

Los recuentos JSX representan apariciones escritas, no instancias renderizadas, filas de listas ni interacciones. No genera un árbol de componentes en ejecución. No lee IndexedDB, carpetas de trabajo, recuperaciones ni elementos creados por el usuario en sus UIBoards. No inspecciona dependencias transitivas ni calcula peso del bundle; para ese análisis se mantiene el script de la sección anterior.

No evalúa código de la app ni expresiones arbitrarias: los valores de registro no reconocidos se guardan como `{ "expression": "…" }`. Si los archivos propietarios o los nombres de los registros cambian, habrá que adaptar sus rutas al final de `scripts/inspect-app.mjs`. Los errores de sintaxis o la ausencia de los registros requeridos detienen la generación.

## Tamaños, fuentes y padding de módulos y superficies

`scripts/inspect-ui-styles.mjs` genera otro inventario estático centrado en los módulos, modales, diálogos, paneles y alertas. Utiliza Node.js y TypeScript ya presentes en el proyecto; no instala dependencias ni abre el navegador.

Desde la raíz del proyecto:

```powershell
node scripts/inspect-ui-styles.mjs
```

Desde cualquier otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\inspect-ui-styles.mjs
```

La ayuda está disponible con `--help` o `-h`. Los informes se actualizan en:

- `output/analize-app-scripts/02_ui_styles/report.md`: tablas para consultar y comparar las superficies.
- `output/analize-app-scripts/02_ui_styles/report.json`: datos estructurados (`schemaVersion: 1`), declaraciones originales, expansiones de tokens, archivo y línea de cada medida.

### Información recogida

- **Módulos:** tamaños iniciales y mínimos de `MODULE_REGISTRY`, raíz visual del componente y delegación en otros componentes cuando se reconoce. Sigue funciones locales o importadas directamente, como `DotationsModule` → `ElementsModule` → `ElementsContent`.
- **Modales y diálogos:** cada uso JSX de `FileDialogContent`, `AlertDialogContent` y `SheetContent`, incluidos imports con alias; título o expresión, propietario, ancho/alto iniciales, `fitToContent`, props de estilo y mínimos numéricos del layout de `FileDialog`. Los valores omitidos se leen de los defaults del componente.
- **Alertas:** elementos con `role="alert"`, `role="alertdialog"` o `role="dialog"`, llamadas a `toast` y sus métodos de presentación, y llamadas reconocibles a `alert`, `confirm` o `prompt` del navegador. No cuenta `toast.dismiss` como aviso.
- **Estilos:** ancho, alto, mínimos y máximos, familia/tamaño/peso de letra, interlineado, padding y separaciones. Conserva selectores y condiciones de las hojas importadas por las superficies, además de las bases compartidas, tokens globales y declaraciones de fuentes.
- **Mínimos dinámicos:** incluye referencias a las expresiones propietarias de medición, límites y redimensionado para distinguir lo declarado en el código de lo calculado en ejecución.

### Interpretar los valores

El tamaño inicial no es el mínimo expandido. El suelo del registro permite estados colapsados; `constrainWindowContentSize` puede exigir más espacio según contenido, cabecera, controles y scrollbar. El informe separa ese suelo, los tamaños iniciales y los mínimos CSS, sin inventar un mínimo final en píxeles.

Las tablas resumen las declaraciones simples de las clases de raíz reconocidas; los estilos de hijos, estados, media queries y container queries aparecen en el detalle CSS. En `FileDialogContent`, el padding indicado pertenece al cuerpo `.body` y la tipografía declarada a la superficie `.surface`; el contenido también recibe las reglas de `ModuleFrame`. Las bases compartidas disponibles se incluyen aunque no tengan usos detectados.

En el resumen de módulos se expanden los tokens globales, del contenido escalado y de la raíz local, tomando `--module-zoom: 1` como referencia. En el detalle CSS solo se expanden tokens globales: los valores originales y el contexto permiten revisar los cambios locales. Las expresiones `calc()`, `clamp()`, `min()` y las unidades relativas se conservan; no se resuelven a píxeles ni se calcula la cascada completa. «Sin declarar» no significa `0`, y una referencia de fuente heredada del `body` no acredita la herencia intermedia de un elemento concreto.

El análisis detecta estructuras estáticas conocidas, no todas las composiciones posibles de React: wrappers personalizados, factories, clases de CSS generadas, nombres dinámicos, reexportaciones complejas o cambios de propietario pueden requerir adaptar el script. Las props inline se conservan como valores o expresiones en el JSON, sin mezclarlas como si fueran CSS calculado. No inspecciona DOM, datos guardados ni tamaños después de la interacción. Los avisos nativos dependen del navegador. La comprobación de tamaños efectivos, fuentes cargadas y padding renderizado queda para validación manual en navegador o dispositivo.

Solo escribe en `output/analize-app-scripts/02_ui_styles/`, excluido de Git, y muestra un resumen breve. Los errores de lectura o sintaxis devuelven código de salida `1`.

## Auditoría de coherencia visual

`scripts/audit-ui-consistency.mjs` compara las medidas y estilos recogidos por el lector anterior. Lee el código actual mediante `collectUiStyles`, exportado por `scripts/inspect-ui-styles.mjs`; no necesita ejecutar antes los otros scripts ni consume informes JSON que puedan estar desactualizados. Importar ese colector no ejecuta su CLI ni escribe el inventario de estilos.

Desde la raíz:

```powershell
node scripts/audit-ui-consistency.mjs
```

Desde cualquier otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\audit-ui-consistency.mjs
```

Admite `--help` y `-h`. Genera o actualiza:

- `output/analize-app-scripts/03_ui_consistency/report.md`: diferencias y puntos de revisión con archivos, líneas, selectores y contexto.
- `output/analize-app-scripts/03_ui_consistency/report.json`: resultados estructurados (`schemaVersion: 1`), cobertura y criterios aplicados.

### Qué compara

- **Diferencias entre superficies:** utiliza los grupos y propiedades explícitos de `scripts/config/ui-consistency.json`. Compara únicamente superficies seleccionadas por su base o tipografía compartida; el modo de tamaño y el rol accesible no definen equivalencia visual por sí solos. Distingue declaraciones propias de referencias heredadas; no interpreta una declaración ausente como `0` ni toma el valor más frecuente como norma.
- **Literales repetidos:** misma propiedad y valor sin `var()` en al menos tres declaraciones de dos hojas diferentes. Excluye fuentes `@font-face`, animaciones y valores triviales como `0`, `auto` o `100%`. Conserva las ubicaciones para decidir si tiene sentido compartir una responsabilidad.
- **Posibles usos de tokens existentes:** relaciona longitudes o familias literales con tokens globales de la misma familia: tipografía, espaciado o medidas de controles/iconos. Muestra el token y dónde está definido. Una coincidencia numérica no acredita que tenga el mismo significado ni comportamiento con zoom.
- **Relaciones numéricas:** señala tamaños iniciales inferiores al suelo del registro y mínimos superiores a máximos literales de la misma regla CSS y unidad. No calcula el mínimo expandido ni combina restricciones de capas diferentes.

### Cómo interpretar el informe

Todos los resultados son **puntos de revisión**, no errores confirmados. Compartir grupo no obliga a tener el mismo tamaño, fuente o padding. El script no cambia estilos, no crea tokens y no recomienda sustituciones automáticas. Los toast comparten una base: se revisan sus declaraciones y no se multiplican los resultados por cada llamada de aviso.

### Grupos y excepciones visuales

La política `scripts/config/ui-consistency.json` se valida con AJV, exige identificadores únicos, propiedades reconocidas, motivos y fuentes locales existentes. Los grupos actuales son:

- Tipografía del contenido de los módulos: familia y tamaño de referencia compartidos por la interfaz.
- Elementos/Dotaciones: bases y medidas iniciales de su composición reutilizada.
- FileDialog: tipografía y padding comunes; conserva tamaños iniciales y autoajuste propios de cada formulario sin exigir igualdad.
- AlertDialog: propiedades de la base compartida de las confirmaciones.
- Sheet: tipografía y padding compartidos; el ancho/alto depende del lado y permanece en el inventario.

Las alertas inline sin base equivalente quedan visibles en `ungroupedSurfaces`; no se comparan dimensiones de alertas distintas solo por compartir `role="alert"`. Los grupos sin usos detectados también se muestran. Las medidas específicas de Mapa, Plano, Informes y las demás áreas siguen disponibles en el inventario y las reglas CSS, sin introducir una norma universal de tamaños o padding.

La excepción inicial se limita a la familia de fuente del contenido del Reloj: `"Rajdhani", sans-serif`, según `DISEÑO.md` y su CSS propietario. No afecta a cabeceras, avisos, otros módulos, propiedades o reglas de tokens/repeticiones. Las excepciones incluyen grupo, módulo, propiedad, valor esperado, motivo y fuentes; no aceptan exclusiones globales ni identificadores/objetivos duplicados.

Una excepción solo retira esa entrada de la comparación cuando el valor coincide. Se conserva en `appliedExceptions`. Si el valor cambia, aparece en `exceptionViolations` y en los hallazgos de coherencia aunque el nuevo valor coincida con el resto de módulos. Si no se encuentra el módulo, la propiedad o un miembro explícito, aparece en `uncertainties` y el diagnóstico coordinado queda parcial. Una configuración inválida hace fallar la etapa; no se ignora silenciosamente.

El informe muestra los grupos efectivos, sus miembros, propiedades, motivos, excepciones verificadas, discrepancias y superficies sin grupo. La política y su huella se guardan en el JSON; forman parte de la huella del motor. Cambiarla invalida la comparación automática con ejecuciones del motor anterior, evitando interpretar los avisos filtrados como problemas corregidos. `DISEÑO.md` y `ARQUITECTURA.md` también se incluyen entre las entradas inventariadas.

Las comparaciones siguen siendo textuales sobre declaraciones y expansiones conocidas: no resuelven toda la semántica o cascada CSS, ni acreditan que el estilo renderizado sea correcto. Modificar la política ajusta el análisis, no la interfaz de Angie. Para cambiar una decisión visual, primero debe acordarse ese cambio y actualizarse su fuente propietaria.

El alcance es el inventario de superficies y hojas asociadas del colector compartido, incluidas bases globales y reglas de descendientes/estados; no es una auditoría de todo el CSS del repositorio. Se mantienen las limitaciones de detección del lector anterior. No calcula cascada, especificidad, layout ni estilos efectivos del navegador. No convierte shorthands en longhands ni considera equivalentes expresiones como `14px` y `calc(14px * 1)`. Los valores de referencia de módulos usan zoom `1`; las coincidencias de tokens usan sus definiciones globales.

Solo escribe sus dos informes en `output/analize-app-scripts/03_ui_consistency/`, excluido de Git. Devuelve `0` al generar el informe aunque haya puntos de revisión y `1` si falla la ejecución. No abre el navegador, instala dependencias ni modifica datos de UIBoards. La comprobación visual de fuentes cargadas, mínimos, padding, zoom y contenido largo queda pendiente de validación manual en navegador o dispositivo.

## Código sin uso y candidatos a limpieza

`scripts/audit-unused-code.mjs` localiza puntos del código que podrían sobrar y reúne evidencia para revisarlos. No elimina ni modifica archivos de la app. Usa TypeScript ya instalado y el lector CSS compartido de `inspect-ui-styles.mjs`.

```powershell
node scripts/audit-unused-code.mjs
```

Desde cualquier otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\audit-unused-code.mjs
```

Admite `--help` y `-h`. Genera `output/analize-app-scripts/04_unused_code/report.md` y `report.json`, excluidos de Git. Devuelve `0` al generar los candidatos y `1` ante un error de ejecución; la presencia de candidatos no hace fallar el comando.

### Qué busca

- **Archivos desconectados:** fuentes, hojas CSS y recursos de `src` sin recorrido desde HTML, configuraciones conocidas, scripts, servidor y declaraciones ambientales. Sigue imports, reexportaciones, imports de tipos, cargas diferidas literales, URL de workers, recursos CSS locales y referencias de esquemas. Distingue un archivo sin consumidores de otro consumido solo por un grupo desconectado; incluye los consumidores directos y el grafo completo en JSON.
- **Exports sin consumidores externos conectados:** utiliza símbolos de TypeScript y reconoce referencias de tipos, alias, JSX y destructuración directa. Separa los exports usados únicamente dentro de su archivo —donde puede bastar retirar `export`— de las declaraciones sin referencias detectadas. No duplica las declaraciones reenviadas por barrels ni los archivos ya listados como desconectados.
- **Declaraciones locales sin uso:** recoge los diagnósticos específicos de TypeScript sobre nombres, parámetros o imports no usados en fuentes conectadas, conservando código, mensaje, archivo y línea. No sustituye `npm run typecheck`.
- **Clases locales de CSS Modules:** busca clases sin accesos reconocidos mediante `styles.nombre`, `styles['nombre']` o índices computados acotados. Reconoce literales, ternarios (ambas ramas), `??` y uniones de cadenas literales de TypeScript en identificadores/propiedades. Conserva selector y contexto, excluye reglas globales y animaciones y suspende las candidaturas de una hoja cuando detecta accesos no acotados o escapes del objeto de clases. Comparte el parser CSS; el modo de todas las declaraciones permite incluir también reglas que solo contienen color, posición u otras propiedades.
- **Huecos de análisis:** imports/URL dinámicos no literales, globs no expandidos, referencias locales sin resolver y clases con accesos dinámicos. Estos casos se revisan antes de concluir que algo carece de consumidores.

### Orden recomendado de revisión

1. Resolver o entender los huecos del análisis.
2. Revisar los archivos desconectados junto con su grupo de consumidores.
3. Comprobar los exports: retirar solo la exposición si el código sigue usándose internamente.
4. Revisar las declaraciones locales y clases CSS candidatas.
5. Antes de retirar código, comprobar inicialización, efectos laterales y contratos; después revisar diff, lint, tipos, build y el flujo afectado mediante validación manual.

Los resultados son **candidatos a limpieza, no código muerto confirmado**. El grafo incluye conexiones de tipos y no representa el bundle. Un import/reexport mantiene conectividad del archivo aunque no haya una lectura del símbolo. Los consumidores dinámicos, reflexión, namespaces pasados como objetos, clases generadas y composición CSS pueden requerir inspección adicional. La ausencia de huecos detectados tampoco garantiza cobertura completa.

El JSON y el informe de limpieza incluyen `resolvedCssAccesses`: ubicación, hoja, expresión, alternativas y base de la resolución. Por ejemplo, `styles[variant ?? (text ? 'text' : 'icon')]` conserva `text` e `icon` como clases con uso posible. Esto permite revisar las demás clases de la hoja sin excluirla entera. No supone que las alternativas se apliquen a la vez ni que se hayan observado en navegador.

La resolución opera bajo el contrato de tipos de TypeScript. Los tipos amplios `string`, `any` y `unknown`, llamadas, interpolaciones, casts, operadores no reconocidos e índices que puedan seguir siendo nulos se mantienen como limitaciones; no se ejecuta código ni se validan entradas reales. Se limita la lectura a 32 alternativas y 12 niveles de expresión; superar esos límites conserva la exclusión prudente de la hoja.

El script no propone retirar originales de `public/assets`, dependencias, UIBoards, recuperaciones, migraciones ni compatibilidad con documentos antiguos. No atribuye automáticamente un archivo a una refactorización anterior: ese origen requiere revisar propietario, consumidores e historial. El funcionamiento real en navegador o dispositivo, incluidas cargas diferidas, workers y recuperación, queda para comprobación manual al preparar cualquier limpieza posterior.

## Auditoría de recursos públicos

`scripts/audit-public-assets.mjs` inventaría los archivos regulares de `public/`, busca referencias declaradas, rutas sin archivo local, diferencias de capitalización y copias idénticas por SHA-256. **Conserva todos los originales y las licencias.** Utiliza Node y TypeScript ya instalados; no incorpora dependencias nuevas.

```powershell
node scripts/audit-public-assets.mjs
node scripts/audit-public-assets.mjs --help
```

Desde otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\audit-public-assets.mjs
```

Genera `output/analize-app-scripts/07_public_assets/report.md` y `report.json` (`schemaVersion: 1`). El coordinador ejecuta la misma etapa como `assets` en los perfiles `quick` y `full`, la integra en las intervenciones y conserva sus detalles en cada ejecución. Reutiliza el contexto TypeScript/CSS y, cuando están disponibles, los tamaños y hashes de la huella inicial.

### Referencias y clasificación

- Lee literales de rutas en `src`, incluido el catálogo de iconos, imágenes JSX y el sonido de alarma. Los prefijos usados en guardas de cadenas no se consideran solicitudes de archivos.
- Lee URLs/imports CSS, atributos de HTML/SVG y referencias reconocidas de JSON público. Resuelve rutas relativas desde archivos públicos, consultas, fragmentos y codificación URL. No busca consumidores en los propios scripts ni presupone que una referencia declarada se ejecute.
- Distingue archivo local ausente de una diferencia de mayúsculas/minúsculas con un archivo existente. Un directorio, prefijo o URL externa no se trata como imagen ausente. Las rutas fuera de `public/` y los recursos no inventariados que existen se señalan como limitaciones antes de concluir ausencia.
- Lee las opciones estáticas de `VitePWA` en `vite.config.ts`, incluidos alias de import y constantes locales simples: `includeAssets`, `workbox.globPatterns`, `workbox.globIgnores` e iconos del manifiesto.
- Contrasta los globs con `path.posix.matchesGlob` de Node. `globIgnores` solo afecta al recorrido de `globPatterns`; no cancela la inclusión separada de `includeAssets`. Un patrón Workbox sin coincidencias públicas puede cubrir archivos del build y no se marca como roto por ese motivo.
- Cada recurso indica referencias, patrones coincidentes, tamaño, hash y si es una licencia por su nombre/ruta. Los estados son `referencia declarada`, `solo configuración declarada` o `sin coincidencia detectada`. Los archivos solo incluidos por PWA permanecen visibles y no se presentan como archivos sin consumidores confirmados.
- Las copias idénticas se agrupan por contenido, independientemente de su nombre. No se fusionan, recomprimen ni eliminan; las rutas distintas pueden seguir siendo necesarias.

Las rutas ausentes, capitalización, duplicados, patrones `includeAssets` sin coincidencias y recursos sin referencias reconocidas generan candidatos con evidencia. Las licencias no generan candidaturas por falta de referencia. Las limitaciones explícitas se priorizan antes de interpretar estas listas.

### Cobertura y comprobación pendiente

La lectura se centra en `/assets/`, URLs públicas existentes, rutas relativas de documentos públicos y declaraciones PWA reconocidas. No resuelve todos los endpoints, consumidores calculados ni formas de marcado. Las rutas interpoladas/concatenadas reconocidas, URLs CSS con variables, spreads y opciones no literales, patrones negados, configuraciones alternativas de estrategia/activación y `base`/`publicDir` personalizados limitan el diagnóstico. No se recorren enlaces simbólicos ni se ejecuta la configuración.

Una coincidencia PWA es una declaración de configuración, **no prueba de precaché, carga ni descarga**. Las opciones predeterminadas y toda la semántica del plugin no se reproducen. Los recursos generados por Vite o paquetes se revisan en el análisis del bundle; no se exige que existan como originales en `public/`.

El script no hace peticiones de red ni lee datos de UIBoards. No modifica `public/`, código, licencias, precaché ni comportamiento online de mapas y teselas. La existencia local tampoco acredita una respuesta HTTP correcta. Cuando se prepare una modificación, verificar manualmente imágenes, fuentes, audio, informes autónomos y actualización de la PWA en navegador o dispositivo.

## Auditoría de dependencias

`scripts/audit-dependencies.mjs` relaciona consumidores, versiones y requisitos de paquetes. Requiere las dependencias de desarrollo y npm disponibles localmente. No instala, actualiza, deduplica ni elimina paquetes, ni consulta versiones recientes o vulnerabilidades por red.

```powershell
node scripts/audit-dependencies.mjs
node scripts/audit-dependencies.mjs --help
```

Desde otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\audit-dependencies.mjs
```

Publica `output/analize-app-scripts/06_dependencies/report.md` y `report.json` (`schemaVersion: 1`). El coordinador ejecuta el mismo colector como `dependencies` en `quick` y `full`, después de obtener el grafo de limpieza, y conserva sus detalles por ejecución. El comando individual calcula ese grafo en memoria; no necesita informes anteriores ni los sobrescribe. Importar el colector o la CLI no ejecuta comandos ni escribe informes.

### Lectura y evidencia

- Cruza las secciones `dependencies`, `devDependencies`, `optionalDependencies` y `peerDependencies` del manifiesto con las declaraciones raíz y versiones de `package-lock.json` (tabla `packages`, versiones 2/3), y los manifiestos instalados.
- Reconoce imports/reexports, imports de tipos, imports dinámicos literales, `require`, `require.resolve` e `import.meta.resolve` literales en fuentes, scripts, servidor y configuraciones conocidas. Conserva archivo, línea, especificador y tipo de consumo. Los módulos integrados de Node y las rutas locales no son paquetes externos.
- Lee imports CSS entre comillas, incluidos `@import url('paquete/ruta.css')`. Un CSS importado desde una dependencia transitiva se considera consumo directo del proyecto: no queda oculto por no ser JavaScript.
- Considera tipos explícitos del compilador, referencias de tipos, runtime JSX automático y declaraciones `@types` cargadas por el Program de TypeScript. Las declaraciones alcanzadas indirectamente por otras librerías **no generan por sí solas** un aviso de import directo sin declarar.
- Reconoce ejecutables de paquetes directos al inicio de comandos de `package.json`, incluidos los separados por `&&`, `||`, `;` o tubería. No ejecuta esos scripts. Así `typescript` y `vite`, por ejemplo, no se consideran sin uso por carecer de un import de la app.
- Separa referencias de la app, herramientas y archivos sin recorrido desde las entradas, reutilizando el grafo de `unused-code.mjs`. Una referencia desconectada sigue siendo evidencia de consumo declarado, aunque no acredite su ejecución.
- Inventaría relaciones `dependencies`, opcionales y peers de los paquetes. Usa el manifiesto instalado cuando está presente y el lock cuando solo existe esa ubicación en el lock; conserva origen, rango, relación, opcionalidad y resolución por ubicación. Los paquetes opcionales de otras plataformas no se señalan como instalaciones defectuosas solo por no estar presentes.

La compatibilidad de rangos del árbol instalado se delega en npm, sin importar un comparador semver transitivo ni interpretar rangos mediante reglas caseras:

```powershell
npm ls --all --long --json --include=dev --include=optional --include=peer --global=false --package-lock-only=false --offline --ignore-scripts --no-audit --no-fund
```

El script localiza la CLI instalada de npm y la invoca con Node desde la raíz del proyecto, sin shell. Incluye explícitamente desarrollo, opcionales y peers, también cuando `NODE_ENV=production` o la configuración de npm los omite; lee la instalación local en lugar de limitarse al lock o al árbol global. Ambos perfiles revisan así la misma instalación. Captura el resultado, con límite de 60 segundos y 32 MiB, y publica únicamente los datos necesarios. Un `ELSPROBLEMS` válido se conserva como evidencia de paquetes ausentes, inválidos o extra; no se transforma en un fallo del lector. Si npm no está disponible, se interrumpe o no devuelve un resultado utilizable, queda una limitación explícita y el diagnóstico coordinado es parcial. La versión de npm se conserva en el informe y en la compatibilidad de cobertura para las comparaciones.

### Interpretación y orden de trabajo

1. Revisar limitaciones de lectura y problemas señalados por npm.
2. Contrastar divergencias entre manifiesto, lock e instalación. El lector no decide qué fuente debe cambiar ni reinstala el entorno.
3. Revisar imports directos sin declaración propia, incluidos CSS. Pueden estar funcionando gracias a una instalación transitiva; valorar una declaración explícita antes de modificar nada.
4. Revisar dependencias con referencias solo desconectadas, solo requisitos de otros paquetes o sin consumidor reconocido. Los requisitos transitivos/peer son una razón que debe comprobarse antes de retirar una declaración, no una prueba de que sobre.
5. Contrastar varias versiones instaladas con sus rangos y con el bundle del perfil completo. La coexistencia puede ser legítima; no se atribuyen bytes ni ahorro a la mera instalación.

Cada paquete directo muestra categoría/rango declarado, versión del lock, versión instalada, referencias y paquetes que lo requieren. El JSON incluye el inventario instalado, requisitos y candidatos con evidencia. `reviewCandidates` describe el consumo reconocido, no una lista de desinstalación. La etapa distingue inconsistencias de declaración/instalación, observaciones de consumidores, datos de coexistencia de versiones y limitaciones de cobertura, sin prioridades de reparación.

Un informe generado devuelve `0` aunque encuentre candidatos o problemas npm; los errores de ejecución devuelven `1`. Hay que leer también la disponibilidad del chequeo npm y las limitaciones. El coordinador conserva su política de salidas y de publicación de referencias. Los manifiestos instalados regulares forman parte de las huellas inicial/final para detectar cambios durante el diagnóstico; no se comprueba todo el contenido de los paquetes.

### Límites y comprobación pendiente

No consulta qué versión es la más reciente, licencias jurídicas o avisos de seguridad, ni ejecuta scripts/configuraciones. Alias de `require`, importadores personalizados, shells complejas, aliases/workspaces/enlaces y protocolos no ordinarios pueden requerir revisión adicional. Los protocolos directos reconocidos como especiales y enlaces del lock se señalan como limitaciones. La carga de tipos prueba que el compilador los leyó, no que cada declaración se use. La resolución por ubicaciones no sustituye la validación de npm ni reproduce toda la semántica de exports, bundlers o gestores alternativos.

No cambia `package.json`, lock, instalación ni comportamiento de Angie. Antes de una limpieza posterior autorizada: comprobar contratos, efectos laterales y rangos; revisar diff y pasar lint, tipos y build. Quedan para validación manual los flujos afectados en navegador/dispositivo, cargas diferidas, workers y herramientas. No se ejecutan pruebas E2E.

## Ciclos de imports y acoplamiento

`scripts/audit-architecture.mjs` detecta recorridos circulares declarados entre archivos y describe las conexiones entre áreas de Angie. Usa TypeScript ya instalado y el grafo compartido de limpieza. No modifica la app, no instala dependencias ni prescribe una refactorización automática.

```powershell
node scripts/audit-architecture.mjs
node scripts/audit-architecture.mjs --help
```

Desde otra carpeta:

```powershell
node D:\Proyectos\angie_dashboard\scripts\audit-architecture.mjs
```

Genera `output/analize-app-scripts/05_architecture/report.md` y `report.json` (`schemaVersion: 1`). La etapa `architecture` se ejecuta en `quick` y `full` después de limpieza, reutilizando su grafo en memoria. La CLI individual calcula el mismo grafo sin depender de informes guardados ni sobrescribir los de limpieza. Los colectores y CLI se pueden importar sin ejecutar comandos ni escribir informes.

### Qué distingue

- **Valores estáticos:** imports, reexports y `require` literales. Un import lateral también mantiene una relación. Un import con miembros de valores y tipos se considera relación de valores.
- **Tipos:** `import type`, `export type`, listas de import/export con todos sus miembros marcados `type`, import de tipo mediante `import()` y relaciones desde/hacia declaraciones `.d.ts`, `.d.mts` o `.d.cts`. No generan por sí mismas un ciclo de valores.
- **Cargas diferidas:** `import()` con cadena literal, analizado junto con las relaciones estáticas de valores en una categoría separada.
- **Workers:** construcción directa de `Worker` o `SharedWorker` con `new URL` literal respecto a `import.meta.url`. Conserva la relación, pero no mezcla contextos de ejecución para señalar ciclos del hilo principal.
- **URL y resolución:** otras URL locales y llamadas literales a `require.resolve`/`import.meta.resolve`. Se inventarían como referencias y acoplamiento declarado, sin inferir ejecución.

El grafo de limpieza conserva su formato y añade `dependencyType` a las aristas. Sigue incluyendo recursos y entradas de herramientas para sus propias conclusiones; arquitectura filtra los extremos a archivos de código de `src`. Las declaraciones e imports de paquetes externos, CSS, JSON y otros recursos no son nodos de los ciclos de arquitectura. `coverage` conserva archivos, conectividad, relaciones por tipo, áreas y aristas excluidas respecto al grafo completo.

### Ciclos entre archivos y proyecciones por áreas

El algoritmo obtiene componentes fuertemente conexos mediante Kosaraju iterativo, incluidos autoimports. Cada grupo contiene todos sus archivos y relaciones internas, ubicaciones, áreas y un ejemplo verificable de recorrido cerrado. **El número de grupos no es el número de todos los circuitos posibles.** El ejemplo puede mostrar solo una parte de un grupo con ciclos solapados; las demás relaciones quedan visibles.

`runtimeCycles` contiene grupos del grafo estático de valores. `typeRelatedCycles` muestra grupos adicionales al incorporar tipos, distinguiendo los íntegramente de tipos y los que amplían un ciclo de valores ya mostrado. `deferredCycles` muestra grupos adicionales al incorporar imports diferidos a los valores estáticos. No se repite un grupo cuyos miembros coincidan exactamente con uno de valores; una ampliación conserva su contexto y relaciones completas.

Una relación de tipo hacia un módulo que importa al primero puede formar un grupo mixto sin ciclo de valores. Un ciclo declarado tampoco acredita un fallo de inicialización: el análisis no evalúa símbolos, efectos laterales, orden de llamadas ni código emitido. Los ciclos con tipos o cargas diferidas se revisan según su naturaleza.

Las áreas se derivan de las carpetas actuales: `features/<carpeta>`, `domain/<carpeta>`, `components/ui`, otras carpetas principales y `raíz` para archivos directamente en `src`. No son una nueva norma de capas ni coinciden necesariamente con cada módulo de ventana. Por ejemplo, Elementos y Dotaciones comparten una funcionalidad en el árbol actual.

`areaCycles` es una proyección de relaciones estáticas de valores entre áreas distintas. Puede formar círculos con archivos independientes que no estén en ningún ciclo real entre archivos. Se muestra como contexto y **no genera avisos de ciclo de imports**. No se establecen direcciones prohibidas entre dominio, plataforma, almacenamiento e interfaz sin una política acordada.

### Acoplamiento y métricas de referencia

El JSON incluye todas las relaciones entre áreas, imports que las sostienen, archivos importadores/destino, clasificación y conectividad desde las entradas. Las relaciones `features/* → features/*` se agrupan como contratos que conviene revisar. Reutilizaciones intencionales, como Plano con Mapa, siguen visibles; la mera conexión no se considera un defecto.

La tabla de métricas conserva todos los archivos con consumidores o dependencias; el JSON mantiene `fileMetrics`. Fan-in y fan-out cuentan archivos distintos, excluido el propio, no símbolos, líneas, peso ni tiempo de ejecución. Incluyen tipos y otras referencias; las columnas de valores aíslan imports estáticos. `areaMetrics` cuenta áreas distintas y declaraciones por categoría. Son datos de referencia sin umbrales arbitrarios de mal diseño.

Orden de lectura recomendado:

1. Entender las limitaciones y referencias sin resolver.
2. Revisar ciclos estáticos de valores y el grupo completo, con sus efectos laterales y contratos.
3. Revisar grupos adicionales de tipos o imports diferidos sin atribuirles un fallo de ejecución.
4. Seguir las relaciones entre funcionalidades, sus consumidores y reutilizaciones documentadas.
5. Usar rankings y proyecciones por áreas para elegir puntos de investigación, sin convertirlos automáticamente en tareas de refactorización.

Los ciclos de valores, ciclos con tipos, cargas diferidas, relaciones entre funcionalidades y limitaciones se presentan por naturaleza. Sus fichas contienen todos los imports del grupo y un recorrido cerrado de ejemplo cuando existe; no emiten una reparación ni prioridad. Los IDs y firmas no dependen de líneas, y arquitectura conserva su participación en la comparación de ejecuciones compatibles.

### Límites y comprobación pendiente

El alcance es código local declarado de `src`, incluyendo archivos desconectados y declaraciones ambientales. La conectividad conserva el contrato del lector de limpieza: seguir una entrada o un import de tipos no demuestra ejecución ni presencia en el bundle. Las aristas sin clasificación se conservan como limitación y no se infiere su naturaleza.

El lector no expande imports calculados/globs, aliases de `require`, reflexión, inyección de dependencias o contratos por eventos, props y datos compartidos. Reconoce llamadas literales con los nombres indicados; un importador personalizado, alias o nombre sombreado puede requerir inspección. No reconstruye todo el código emitido, ni deduce imports eliminados a partir de uso de símbolos. No busca ciclos de CSS ni de datos, ni mide funcionamiento, RAM o tiempos. Las limitaciones de cargas y resoluciones reconocidas en `src` se trasladan del grafo compartido; las limitaciones de clases CSS permanecen en limpieza.

Devuelve `0` cuando publica candidatos y `1` ante un error de ejecución; encontrar ciclos no hace fallar el comando. El coordinador aplica sus estados de cobertura, historial y códigos de salida habituales. No altera imports, contratos, estilos, originales, UIBoards ni recuperaciones. Antes de refactorizar un grupo, acordar el cambio, revisar propietario/consumidores y ejecutar lint, tipos y build; después validar manualmente inicialización, cargas diferidas, workers y flujos afectados en navegador/dispositivo. No se ejecutan pruebas E2E.
