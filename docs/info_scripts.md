# info scripts

## bundle

Para repetir el análisis en otro entorno con las dependencias del proyecto instaladas:
node scripts/analyze-bundle.mjs
El [analizador](D:/Proyectos/angie_dashboard/scripts/analyze-bundle.mjs) genera el informe y un [JSON detallado](D:/Proyectos/angie_dashboard/output/bundle-analysis/report.json), sin modificar dist ni instalar dependencias.

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

- `output/app-inventory/report.md`: informe legible con tablas y ubicaciones de código.
- `output/app-inventory/report.json`: inventario estructurado para búsquedas o procesamiento posterior, con `schemaVersion: 1`.

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

- `output/ui-styles/report.md`: tablas para consultar y comparar las superficies.
- `output/ui-styles/report.json`: datos estructurados (`schemaVersion: 1`), declaraciones originales, expansiones de tokens, archivo y línea de cada medida.

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

Solo escribe en `output/ui-styles/`, excluido de Git, y muestra un resumen breve. Los errores de lectura o sintaxis devuelven código de salida `1`.

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

- `output/ui-consistency/report.md`: diferencias y puntos de revisión con archivos, líneas, selectores y contexto.
- `output/ui-consistency/report.json`: resultados estructurados (`schemaVersion: 1`), cobertura y criterios aplicados.

### Qué compara

- **Diferencias entre superficies:** agrupa módulos por su modo de tamaño y diálogos/paneles/alertas por base visual o rol. Compara familia, tamaño y peso de letra, interlineado, padding, dimensiones CSS de raíz, tamaños iniciales y mínimos del registro cuando existen. Distingue declaraciones propias de referencias heredadas; no interpreta una declaración ausente como `0` ni toma el valor más frecuente como norma.
- **Literales repetidos:** misma propiedad y valor sin `var()` en al menos tres declaraciones de dos hojas diferentes. Excluye fuentes `@font-face`, animaciones y valores triviales como `0`, `auto` o `100%`. Conserva las ubicaciones para decidir si tiene sentido compartir una responsabilidad.
- **Posibles usos de tokens existentes:** relaciona longitudes o familias literales con tokens globales de la misma familia: tipografía, espaciado o medidas de controles/iconos. Muestra el token y dónde está definido. Una coincidencia numérica no acredita que tenga el mismo significado ni comportamiento con zoom.
- **Relaciones numéricas:** señala tamaños iniciales inferiores al suelo del registro y mínimos superiores a máximos literales de la misma regla CSS y unidad. No calcula el mínimo expandido ni combina restricciones de capas diferentes.

### Cómo interpretar el informe

Todos los resultados son **puntos de revisión**, no errores confirmados. Compartir grupo no obliga a tener el mismo tamaño, fuente o padding. El script no cambia estilos, no crea tokens y no recomienda sustituciones automáticas. Los toast comparten una base: se revisan sus declaraciones y no se multiplican los resultados por cada llamada de aviso.

El alcance es el inventario de superficies y hojas asociadas del colector compartido, incluidas bases globales y reglas de descendientes/estados; no es una auditoría de todo el CSS del repositorio. Se mantienen las limitaciones de detección del lector anterior. No calcula cascada, especificidad, layout ni estilos efectivos del navegador. No convierte shorthands en longhands ni considera equivalentes expresiones como `14px` y `calc(14px * 1)`. Los valores de referencia de módulos usan zoom `1`; las coincidencias de tokens usan sus definiciones globales.

Solo escribe sus dos informes en `output/ui-consistency/`, excluido de Git. Devuelve `0` al generar el informe aunque haya puntos de revisión y `1` si falla la ejecución. No abre el navegador, instala dependencias ni modifica datos de UIBoards. La comprobación visual de fuentes cargadas, mínimos, padding, zoom y contenido largo queda pendiente de validación manual en navegador o dispositivo.
