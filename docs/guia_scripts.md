# Guía de scripts

Ejecuta desde la raíz. Cada revisión parte de las fuentes actuales y guarda el resultado en el mismo Markdown.
Las decisiones de revisión se contrastan con los datos de la ejecución actual.

## Comandos

| Comando | Alcance | Informe |
| --- | --- | --- |
| `npm run check` | Lint y build; build incluye tipos y catálogo de avisos. | Consola. |
| `npm run typecheck` | Solo tipos. | Consola. |
| `npm run check:server` | HTTP local: cabeceras, métodos, rutas, HEAD y MIME. | Consola. |
| `npm run diagnose` | Ejecuta las ocho áreas, incluido el build temporal del bundle. | Ocho informes de área y un resumen general. |
| `npm run test:audit` | Pruebas de los auditores con módulos y estilos de ejemplo en memoria. | Consola. |
| `node scripts/audit/inspect-app.mjs` | Fuentes, componentes y cruce de cada módulo con el icono, la carga y la rama que monta su vista. | `01_app_inventory/report.md` |
| `node scripts/audit/inspect-ui-styles.mjs` | Bases compartidas, geometría y especializaciones declaradas. | `02_ui_styles/report.md` |
| `node scripts/audit/audit-ui-consistency.mjs` | Grupos comparables, tokens y excepciones gráficas. | `03_ui_consistency/report.md` |
| `node scripts/audit/audit-unused-code.mjs` | Archivos, exports, locales y clases CSS candidatos a limpieza. | `04_unused_code/report.md` |
| `node scripts/audit/audit-architecture.mjs` | Imports, ciclos, áreas y consumidores. | `05_architecture/report.md` |
| `node scripts/audit/audit-dependencies.mjs` | Manifiesto, lock, instalación, peers y consumidores. | `06_dependencies/report.md` |
| `node scripts/audit/audit-public-assets.mjs` | Referencias, rutas, duplicados y configuración PWA. | `07_public_assets/report.md` |
| `node scripts/audit/analyze-bundle.mjs` | Bytes emitidos, propietarios, workers y precaché. | `08_bundle_analysis/report.md` |
| `node --experimental-transform-types scripts/measure-gpx.mjs` | CPU GPX sintético en Node 24; no acredita pintura ni interacción. | Consola. |
| `npm run notices:catalog` | Regenera el catálogo si cambia. | `src/features/notices/noticeMessages.ts` |
| `npm run notices:catalog -- --check` | Comprueba el catálogo sin escribir. | Salida 0 si coincide; 1 si falta, difiere o falla. |

Los ocho individuales están en `output/analize-app-scripts/`.
El general está en `output/analize-app-scripts/diagnostic workflow/report.md`.
Cada CLI de [scripts/audit](../scripts/audit/) actualiza el informe de su área. El coordinador utiliza los mismos recolectores y el mismo formato de área. Escribe el general al final. Los comandos admiten ayuda con `--help`.

## Formato y lectura

El general indica el estado de ejecución, el total de casos para revisión y las excepciones verificadas. Cada fila enlaza el área y agrupa sus casos por regla. Los fallos de ejecución y las limitaciones de cobertura aparecen identificados. Los totales corresponden a las áreas que pudieron publicar resultados.

El informe de área empieza con las medidas de cobertura. Los hallazgos recogen hechos observados y sus ubicaciones. Una entrada puede agrupar varias declaraciones del mismo archivo o varias apariciones del mismo literal. Las relaciones entre funcionalidades y las versiones que coexisten en la instalación son datos de cobertura. Las referencias estáticas sin consumidores y las coincidencias con tokens requieren comprobar la intención antes de cambiar la aplicación.

En coherencia visual, una declaración CSS reúne en la misma fila los motivos de repetición y de coincidencia con tokens. Las coincidencias de números y medidas, incluidos los espacios compuestos, se conservan como referencia al final del área y quedan fuera del contador general. Las discrepancias con una regla visual y los límites numéricos contradictorios siguen entrando en revisión. El inventario distingue una conexión ausente de un patrón de carga o renderizado que su lectura estática no consigue interpretar.

Las excepciones visuales proceden de [la política de coherencia](../scripts/config/ui-consistency.json). Solo se publican las que coinciden con declaraciones actuales, junto con la evidencia y el motivo. Cuando falta el valor esperado, la regla visual registra la discrepancia o la limitación correspondiente.

Para aceptar expresamente otro hallazgo revisado, añade una entrada a [audit-exceptions.json](../scripts/config/audit-exceptions.json) con `ref` (la referencia del caso) y `reason` (la justificación). El caso pasa a excepciones mientras coincida la evidencia. Al desaparecer la causa, desaparece del informe. Si cambia la evidencia, el caso vuelve a revisión. Cada export tiene su propia referencia junto al nombre y la línea. El informe reúne los símbolos del mismo archivo y regla para su lectura. La decisión de cada símbolo incluye sus reexportaciones reconocidas y sigue vigente al desplazarlo de línea.

Cada área y el coordinador reemplazan su propio `report.md`. El objetivo por archivo es de 250 líneas y 10.000 caracteres. Las continuaciones se numeran y enlazan en orden, sin límite de partes. Al acortarse un informe se retiran sus partes sobrantes. Se admite un margen del 2 % para evitar una cola de unas líneas. Se mantienen juntos al menos dos casos cuando caben y, si un solo caso supera una parte, se continúa su evidencia.

Si un área falla, su informe registra el error y el flujo continúa con las áreas independientes. Si falla la publicación, el general advierte de la posible antigüedad del informe. Un cambio en las entradas durante la ejecución deja la revisión parcial.

## Límites

Los candidatos sin uso, las coincidencias con tokens y los ciclos declarados requieren inspeccionar sus consumidores y contexto.
La revisión de estilos es estática: no calcula cascada, fuentes cargadas ni medidas efectivas del navegador.
Los estilos inline, Canvas y los originales SVG quedan fuera de la lectura CSS.
La atribución de bytes por source maps es aproximada; no mide RAM ni tiempos de arranque.
Dependencias contrasta el árbol local offline; no sustituye una consulta de vulnerabilidades.
Un paquete directo también tiene consumidor reconocido si satisface un peer obligatorio de otra dependencia directa utilizada y npm valida el árbol instalado.
La validación funcional sigue [Operaciones](OPERATIONS.md#comprobación-manual).

Las excepciones gráficas de `scripts/config/ui-consistency.json` se aplican solo a candidatos cromáticos,
conservando las comprobaciones de medidas y grupos comparables. Incluyen papel de informes,
muestras cartográficas y contraste sobre imágenes. Se informa de excepciones sin declaraciones coincidentes.
HEX, RGB/RGBA y nombres básicos reconocidos se normalizan para buscar tokens de color, superficie, sombra o filtro. El auditor propone tokens del dashboard en hojas con una importación CSS reconocida desde la aplicación y con la paleta cargada en su entrada. Las hojas importadas también como texto para otro documento conservan la evidencia de repetición sin recibir esas sugerencias.
No se extraen colores de variables, URLs o cadenas; las coincidencias no garantizan equivalencia en alto contraste.

`check:server` necesita `dist/` compilado. Arranca en loopback con `PORT=0`, usa el puerto anunciado por el servidor y cierra el proceso también ante fallos.
Comprueba estados 200/400/403/404/405, rutas fuera de dist, CSP/anti-enmarcado/nosniff, métodos, HEAD, PWA y MIME.
No comprueba el despliegue público ni el funcionamiento de la aplicación en navegador.

## Catálogo de avisos

`collect-notice-messages.mjs` resuelve variables por símbolo y ámbito, admite textos breves y conserva el texto original como clave.
Distingue errores y advertencias, reconoce setters set…Error y anotaciones @notice-level.
Reconoce el `toast` importado por su símbolo, aunque use un alias, y excluye etiquetas de `Record<…, string>` con tipo explícito o `satisfies`.
No evalúa funciones o importaciones ni reconstruye reasignaciones; los mensajes variables se incorporan al emitirse.
Los hooks predev/prebuild regeneran el catálogo. Con Vite abierto, usa `npm run notices:catalog` tras editar mensajes.
El bundle comprueba su vigencia antes de crear temporales o llamar a Vite; si falta o difiere, falla sin regenerarlo.
