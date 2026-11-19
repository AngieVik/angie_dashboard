# Guía de scripts

Ejecuta desde la raíz. Cada revisión analiza el estado actual, sin comparación, caché ni historial.
Los informes se sobrescriben; no se generan JSON ni resúmenes separados.

## Comandos

| Comando | Alcance | Informe |
| --- | --- | --- |
| `npm run check` | Lint y build; build incluye tipos y catálogo de avisos. | Consola. |
| `npm run typecheck` | Solo tipos. | Consola. |
| `npm run check:server` | HTTP local: cabeceras, métodos, rutas, HEAD y MIME. | Consola. |
| `npm run diagnose` | Quick: siete análisis; bundle queda marcado como no ejecutado. | General y ocho individuales. |
| `npm run diagnose:full` | Añade el build temporal del bundle. | Los mismos archivos, sobrescritos. |
| `node scripts/inspect-app.mjs` | Fuentes, componentes y registros. | `01_app_inventory/report.md` |
| `node scripts/inspect-ui-styles.mjs` | Bases compartidas, geometría y especializaciones declaradas. | `02_ui_styles/report.md` |
| `node scripts/audit-ui-consistency.mjs` | Grupos comparables, tokens y excepciones gráficas. | `03_ui_consistency/report.md` |
| `node scripts/audit-unused-code.mjs` | Archivos, exports, locales y clases CSS candidatos a limpieza. | `04_unused_code/report.md` |
| `node scripts/audit-architecture.mjs` | Imports, ciclos, áreas y consumidores. | `05_architecture/report.md` |
| `node scripts/audit-dependencies.mjs` | Manifiesto, lock, instalación, peers y consumidores. | `06_dependencies/report.md` |
| `node scripts/audit-public-assets.mjs` | Referencias, rutas, duplicados y configuración PWA. | `07_public_assets/report.md` |
| `node scripts/analyze-bundle.mjs` | Bytes emitidos, propietarios, workers y precaché. | `08_bundle_analysis/report.md` |
| `node --experimental-transform-types scripts/measure-gpx.mjs` | CPU GPX sintético en Node 24; no acredita pintura ni interacción. | Consola. |
| `npm run notices:catalog` | Regenera el catálogo si cambia. | `src/features/notices/noticeMessages.ts` |
| `npm run notices:catalog -- --check` | Comprueba el catálogo sin escribir. | Salida 0 si coincide; 1 si falta, difiere o falla. |

Los ocho individuales están en `output/analize-app-scripts/`.
El general está en `output/analize-app-scripts/diagnostic workflow/report.md`.
El coordinador actualiza los nueve; una CLI individual actualiza únicamente el suyo.
Las CLI de análisis, el catálogo y check:server admiten `--help` y `-h`.

## Formato y lectura

El general abre con el contador y enlaza cada análisis con su estado y sus recuentos por regla.
Los informes individuales indican el alcance. El inventario abre con sus recuentos de cobertura.
Los individuales reúnen ubicación, dato detectado y evidencia por elemento, sin repetir el detalle en el general.
La clasificación, confianza y riesgo se indican de forma breve; los IDs quedan como datos internos de deduplicación.
No se muestran ni se conservan referencias entre revisiones.

Para empezar sin contexto: abre el general, elige un análisis y sigue sus enlaces a las líneas de código.
El contador incluye observaciones, relaciones y datos; no equivale a errores confirmados ni autoriza cambios por sí solo.
Antes de corregir un candidato, comprueba sus consumidores y el contrato del área en
[arquitectura](architecture.md) o [diseño](design.md), según corresponda.

Si necesitas entender el criterio, el coordinador es [diagnose.mjs](../scripts/diagnose.mjs),
los recolectores están en [scripts/lib](../scripts/lib/) con el nombre del análisis
(`inventory` corresponde a `app-inventory.mjs`, `styles` a `ui-styles.mjs`,
`consistency` a `ui-consistency.mjs`, `unused` a `unused-code.mjs` y `assets` a `public-assets.mjs`).
[findings.mjs](../scripts/lib/findings.mjs) define y clasifica los hallazgos;
[ui-consistency.json](../scripts/config/ui-consistency.json) fija grupos y excepciones visuales.

Los individuales conservan la información de referencia por tema. Inventario agrupa archivos, declaraciones React y usos JSX.
Estilos incluye las declaraciones de las hojas vinculadas a las superficies que describe. Consistency utiliza la lectura amplia de CSS.
Arquitectura incluye las métricas de todos los archivos con relaciones. Bundle enumera los recursos emitidos y la atribución por fuente,
con sus límites. El cotejo del principal con `dist/` se refiere únicamente al archivo compilado local.

Una etapa fallida o no ejecutada muestra su estado en su propio archivo. Si ese archivo no se puede escribir, el general
advierte que puede corresponder a una ejecución anterior. Los demás análisis publican su resultado y el general queda parcial
si hay informes válidos. Un fallo al escribir el general se comunica en consola.
Una entrada que cambia durante la ejecución se comunica como limitación de la revisión.
Las escrituras reemplazan cada archivo de forma atómica; el general se escribe después de los individuales.

Para abrir el general en PowerShell:

```powershell
Invoke-Item './output/analize-app-scripts/diagnostic workflow/report.md'
```

## Límites

Los candidatos sin uso, las coincidencias con tokens y los ciclos declarados requieren inspeccionar sus consumidores y contexto.
La revisión de estilos es estática: no calcula cascada, fuentes cargadas ni medidas efectivas del navegador.
Los estilos inline, Canvas y los originales SVG quedan fuera de la lectura CSS.
La atribución de bytes por source maps es aproximada; no mide RAM ni tiempos de arranque.
Dependencias contrasta el árbol local offline; no sustituye una consulta de vulnerabilidades.
La validación funcional sigue [Operaciones](OPERATIONS.md#comprobación-manual).

Las excepciones gráficas de `scripts/config/ui-consistency.json` se aplican solo a candidatos cromáticos,
conservando las comprobaciones de medidas y grupos comparables. Incluyen papel de informes,
muestras cartográficas y contraste sobre imágenes. Se informa de excepciones sin declaraciones coincidentes.
HEX, RGB/RGBA y nombres básicos reconocidos se normalizan para buscar tokens de color, superficie, sombra o filtro.
No se extraen colores de variables, URLs o cadenas; las coincidencias no garantizan equivalencia en alto contraste.

`check:server` necesita `dist/` compilado. Usa loopback y un puerto temporal, y cierra el proceso también ante fallos.
Comprueba estados 200/400/403/404/405, rutas fuera de dist, CSP/anti-enmarcado/nosniff, métodos, HEAD, PWA y MIME.
No comprueba el despliegue público ni el funcionamiento de la aplicación en navegador.

## Catálogo de avisos

`collect-notice-messages.mjs` resuelve variables por símbolo y ámbito, admite textos breves y conserva el texto original como clave.
Distingue errores y advertencias, reconoce setters set…Error y anotaciones @notice-level; excluye etiquetas de diccionarios tipados.
No evalúa funciones o importaciones ni reconstruye reasignaciones; los mensajes variables se incorporan al emitirse.
Los hooks predev/prebuild regeneran el catálogo. Con Vite abierto, usa `npm run notices:catalog` tras editar mensajes.
El bundle comprueba su vigencia antes de crear temporales o llamar a Vite; si falta o difiere, falla sin regenerarlo.
