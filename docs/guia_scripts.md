# Guía de scripts

Ejecuta desde la raíz con el entorno y las dependencias de [README.md](../README.md). Elige el análisis del área que necesitas; la app puede estar cerrada. Los informes quedan en `output/`, excluido de Git. Bundle compila temporalmente y conserva `dist/`.

## Comandos

| Comando | Uso | Resultado |
| --- | --- | --- |
| `npm run diagnose` | Perfil quick: inventario, código sin uso, arquitectura, dependencias, recursos, estilos y coherencia. | `output/diagnostic workflow/<ID>/report.md` y JSON, con subinformes por etapa. |
| `npm run diagnose:full` | Añade peso del bundle al perfil quick. | Misma estructura con etapa bundle. |
| `node scripts/inspect-app.mjs` | Stack, módulos, componentes React, JSX y catálogo de elementos. | `01_app_inventory/` |
| `node scripts/inspect-ui-styles.mjs` | Medidas iniciales/mínimas declaradas, fuentes, padding y tokens de módulos y superficies. | `02_ui_styles/` |
| `node scripts/audit-ui-consistency.mjs` | Diferencias en grupos comparables, excepciones y literales candidatos a token. | `03_ui_consistency/` |
| `node scripts/audit-unused-code.mjs` | Archivos desconectados, exports/locales sin uso y clases CSS candidatas. | `04_unused_code/` |
| `node scripts/audit-architecture.mjs` | Imports, ciclos de valores/tipos/diferidos y relaciones entre áreas. | `05_architecture/` |
| `node scripts/audit-dependencies.mjs` | Declaración, lock, instalación, consumidores, peers y coexistencia de versiones. | `06_dependencies/` |
| `node scripts/audit-public-assets.mjs` | Referencias públicas, rutas ausentes, capitalización, duplicados y configuración PWA declarada. | `07_public_assets/` |
| `node scripts/analyze-bundle.mjs` | Bytes emitidos, JS inicial/diferido, workers, precaché y atribución aproximada por fuente. | `08_bundle_analysis/` |
| `node --experimental-transform-types scripts/measure-gpx.mjs` | Benchmark manual de CPU GPX con casos sintéticos de 1.000, 50.000 y 150.000 puntos. | Medidas en consola; requiere Node 24. |
| `npm run notices:catalog` | Regenera el catálogo de textos de avisos. | `src/features/notices/noticeMessages.ts` |

Las ocho carpetas numeradas están en `output/analize-app-scripts/`; cada una contiene `report.md` legible y `report.json` estructurado. La numeración indica orden de lectura. Cada CLI individual actualiza su par de informes. El coordinador conserva cada ejecución por separado.

Las ocho CLI de análisis y `diagnose.mjs` admiten `--help` y `-h`. Para ampliar un análisis, consulta el script propietario y su ayuda; `scripts/lib/` contiene piezas compartidas.

## Comparar ejecuciones

`<ID>` sigue `AAAA-MM-DD_HH-mm_perfil`, en Europe/Madrid, con sufijo si coincide el minuto/perfil. `latest.json` apunta al último diagnóstico publicado; `latest-quick.json` y `latest-full.json` señalan la referencia automática compatible del perfil, con entradas estables y etapas sin fallos. Una limitación explícita puede conservar cobertura parcial.

| Comando | Referencia |
| --- | --- |
| `npm run diagnose -- --baseline latest` | Última referencia quick; comportamiento predeterminado. |
| `npm run diagnose -- --baseline none` | Ejecutar sin comparación. |
| `npm run diagnose -- --baseline ID_DE_EJECUCION` | Ejecución concreta. |
| `npm run diagnose:full -- --baseline latest` | Última referencia full. |

Compara con el mismo perfil y motor compatible, entradas estables y cobertura equivalente. Los informes distinguen hallazgos nuevos, cambiados, iguales y ausentes; verifica la causa de una desaparición antes de considerarla corregida. El perfil full también compara bytes de JS y precaché.

Para abrir el último informe en PowerShell:

```powershell
$diagnostico = Get-Content './output/diagnostic workflow/latest.json' -Raw | ConvertFrom-Json
Invoke-Item (Join-Path './output/diagnostic workflow' $diagnostico.report)
```

## Interpretar resultados

| Indicador | Lectura |
| --- | --- |
| `complete` | Etapas terminadas sin limitaciones explícitas detectadas. |
| `partial` | Hay límites de cobertura, una etapa fallida o entradas que cambiaron; revisa qué conclusión afecta. |
| `failed` | Fallaron todas las etapas; un fallo de arranque/publicación puede impedir el informe. |
| Salida `0` | Informe publicado; puede contener candidatos o limitaciones conocidas. |
| Salida `1` | Error de ejecución; el coordinador también la usa por etapas fallidas o entradas inestables. |
| Riesgo comprobado / posible / no acreditado | Distingue consecuencia con evidencia, consecuencia condicionada y dato sin daño funcional demostrado. |

Lee estado/cobertura antes de los hallazgos y sigue sus evidencias hasta el propietario. Los IDs relacionan resultados entre análisis; Markdown y JSON comparten los hallazgos, mientras las tablas conservan datos de referencia. Los contratos JSON están identificados por versión.

Las huellas registran entradas, motor, revisión y entorno reconocido; usan hashes para secretos. Cambiar entradas durante la ejecución impide comparación y referencia automática.

## Alcance de cada lectura

| Análisis | Límite que debes considerar |
| --- | --- |
| Inventario | Cuenta declaraciones/JSX escritos; los usos dinámicos y wrappers pueden requerir inspección. Las versiones del lock describen resolución, no instalación efectiva. |
| Estilos | Conserva expresiones y contexto CSS; distingue apertura, suelo del registro y mínimo expandido medido. «Sin declarar» conserva significado desconocido. Usa zoom 1 como referencia y consulta el navegador para cascada, fuentes y medidas efectivas. |
| Coherencia | Compara grupos y excepciones de `scripts/config/ui-consistency.json`, con fuentes en [Diseño](design.md). Una coincidencia numérica necesita significado compartido antes de convertirse en token. Revisa superficies sin grupo y excepciones incumplidas. |
| Código sin uso | Los resultados son candidatos: contrasta referencias dinámicas, efectos laterales y consumidores del grupo antes de retirar código. Revisa huecos del análisis primero. |
| Arquitectura | Separa valores, tipos, diferidos y workers. Un ciclo declarado exige revisar inicialización; una proyección circular entre áreas puede existir sin ciclo real entre archivos. Métricas de consumidores/dependencias sirven para investigar. |
| Dependencias | Contrasta manifiesto/lock/instalación y el chequeo npm local offline. Valora peers, tipos, CSS y herramientas antes de retirar una declaración. La coexistencia de versiones puede ser legítima; esta herramienta conserva su alcance local, separado de `npm audit`. |
| Recursos | Una referencia o patrón PWA es configuración declarada; contrasta carga y precaché emitida. Conserva originales/licencias; duplicados o ausencia de referencias reconocidas requieren revisión de consumidores. |
| Bundle | Totales emitidos son bytes reales; atribución por source maps es aproximada. `renderedLength` pertenece a una fase previa a minificación. Bytes sin atribuir permanecen en el total y requieren lectura contextual. |
| Benchmark GPX | Mide cálculo de CPU en Node; compara layout, pintura, interacción y tiempos del dispositivo manualmente. |

Los diagnósticos generan evidencia y candidatos. Las decisiones de cambio siguen el alcance de la petición y la política de [AGENTS.md](../AGENTS.md); la validación funcional sigue [Operaciones](OPERATIONS.md#comprobación-manual).

## Catálogo de avisos

`collect-notice-messages.mjs` lee el AST TypeScript de `src`, deduplica/ordena literales y conserva niveles del emisor y anotaciones `@notice-level`. Actualiza únicamente el catálogo cuando cambia; los textos variables se completan con sus originales al emitirse, según [Arquitectura](architecture.md#avisos).

Los hooks `predev` y `prebuild` lo ejecutan automáticamente. Con Vite ya abierto, usa `npm run notices:catalog` tras editar mensajes para refrescar la lista de Configuración.
