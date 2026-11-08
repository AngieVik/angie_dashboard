# Guía resumida de scripts

Los scripts analizan la app y generan informes. **No modifican ni eliminan código, estilos, dependencias, originales ni datos del usuario.** No aplican parches ni hacen limpiezas automáticas.

El análisis del bundle compila en una carpeta temporal y la retira al terminar; conserva `dist`. Los informes sí se crean o actualizan en las rutas indicadas.

## 1. Preparación

Requiere Node.js 24.12.0, npm 11.6.2 y las dependencias del proyecto ya instaladas. Los scripts no instalan paquetes.

Abre PowerShell en el proyecto:

```powershell
cd D:\Proyectos\angie_dashboard
```

Todos los comandos y rutas siguientes parten de esa carpeta. No es necesario arrancar la app.

## 2. Comando recomendado: todos los análisis juntos

| Comando                 | Qué hace                                                                                                                | Resultado                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run diagnose`      | Inventario, código sin uso, arquitectura, dependencias, recursos públicos, estilos y coherencia visual. Perfil `quick`. | Informe general y datos por análisis en `output/diagnostic workflow/<ID>/`. |
| `npm run diagnose:full` | Todo lo anterior y análisis del peso del bundle mediante compilación temporal.                                          | Mismo conjunto de informes, incluyendo la etapa `bundle`. Tarda más.        |

Cada ejecución conserva su carpeta. La consola muestra la ruta del informe principal:

```text
output/diagnostic workflow/<ID>/report.md
```

`<ID>` usa `AAAA-MM-DD_HH-mm_perfil`, con hora de **Europe/Madrid**; por ejemplo, `2026-11-02_06-30_full`. Si coincide el minuto y el perfil, se añade `_02`, `_03`, etc., para conservar ambas ejecuciones.

Para abrir el último informe generado desde PowerShell:

```powershell
$ultimo = Get-Content ".\output\diagnostic workflow\latest.json" -Raw | ConvertFrom-Json
Invoke-Item (Join-Path ".\output\diagnostic workflow" $ultimo.report)
```

El informe general reúne todos los hallazgos, una sola vez por identificador, agrupados por análisis de origen y naturaleza. El resumen inicial solo contiene recuentos y estado; no repite la lista de títulos. Los enlaces a cada etapa conducen a sus `report.md` y `report.json`. No se generan otros archivos de informe.

## 3. Scripts individuales

Úsalos cuando solo necesites revisar un área. **No necesitan ejecutar antes los demás scripts.**

Los resultados se agrupan en `D:\Proyectos\angie_dashboard\output\analize-app-scripts\`, por orden de interpretación:

```text
01_app_inventory/
02_ui_styles/
03_ui_consistency/
04_unused_code/
05_architecture/
06_dependencies/
07_public_assets/
08_bundle_analysis/
```

Los informes trasladados desde las ubicaciones anteriores conservan su fecha y su contenido de análisis; no representan una nueva ejecución oficial. El coordinador guarda cada ejecución directamente bajo `output/diagnostic workflow/`, con fecha, hora y perfil.

| Comando                                 | Qué analiza                                                                                                                                                   | Carpeta o archivo de resultado                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `node scripts/inspect-app.mjs`          | Stack declarado, componentes React, etiquetas JSX, módulos y catálogo de elementos.                                                                           | `output/analize-app-scripts/01_app_inventory/`   |
| `node scripts/inspect-ui-styles.mjs`    | Módulos, diálogos, modales y alertas: tamaños iniciales, mínimos declarados, fuentes, padding y tokens.                                                       | `output/analize-app-scripts/02_ui_styles/`       |
| `node scripts/audit-ui-consistency.mjs` | Diferencias dentro de grupos comparables, excepciones documentadas, literales repetidos y posibles tokens compartidos.                                        | `output/analize-app-scripts/03_ui_consistency/`  |
| `node scripts/audit-unused-code.mjs`    | Archivos desconectados, exports sin consumidores externos, declaraciones locales sin uso y clases CSS candidatas.                                             | `output/analize-app-scripts/04_unused_code/`     |
| `node scripts/audit-architecture.mjs`   | Ciclos de imports, relaciones entre funcionalidades y archivos con más consumidores o dependencias. Separa valores, tipos y cargas diferidas.                 | `output/analize-app-scripts/05_architecture/`    |
| `node scripts/audit-dependencies.mjs`   | Paquetes declarados, lock e instalación; consumidores, requisitos transitivos/peer y varias versiones instaladas. Comprueba el árbol con npm local y offline. | `output/analize-app-scripts/06_dependencies/`    |
| `node scripts/audit-public-assets.mjs`  | Recursos públicos, referencias sin archivo, diferencias de mayúsculas, copias idénticas y coincidencias PWA declaradas.                                       | `output/analize-app-scripts/07_public_assets/`   |
| `node scripts/analyze-bundle.mjs`       | Peso del empaquetado, JavaScript inicial/diferido, workers, precaché y atribución aproximada por paquete/fuente.                                              | `output/analize-app-scripts/08_bundle_analysis/` |

En las ocho carpetas de resultados se generan los mismos archivos: **`report.md` y `report.json`**. Todos los individuales actualizan ambos archivos en cada ejecución. La numeración indica el orden recomendado de interpretación; no introduce dependencias entre comandos.

- **`.md`:** informe legible para revisar hallazgos y ubicaciones.
- **`.json`:** datos estructurados para búsquedas y procesamiento.
- Los scripts individuales actualizan sus informes anteriores; el coordinador conserva el historial por ejecución.
- El coordinador guarda sus detalles dentro de cada ejecución y no actualiza las ocho carpetas individuales.

## 4. Comparar ejecuciones

El coordinador compara por defecto con la referencia anterior del mismo perfil. Estas opciones se pasan después de `--`:

```powershell
# No comparar con una ejecución anterior
npm run diagnose -- --baseline none

# Comparar con la referencia automática del perfil quick
npm run diagnose -- --baseline latest

# Comparar con una ejecución concreta: sustituye ID_DE_EJECUCION
npm run diagnose -- --baseline ID_DE_EJECUCION

# Las mismas opciones para el perfil full
npm run diagnose:full -- --baseline latest
```

La comparación muestra hallazgos nuevos, cambiados, sin cambios y que dejan de aparecer. Requiere perfil y motor compatibles y entradas estables; las etapas con fallos o cambios de cobertura se excluyen. **Que un aviso desaparezca no demuestra por sí solo una corrección.**

`latest.json` señala el último diagnóstico publicado. `latest-quick.json` y `latest-full.json` señalan las referencias automáticas por perfil: entradas estables y sin etapas fallidas; pueden conservar limitaciones explícitas.

Tras la limpieza inicial del historial solo se conserva `2026-11-02_06-30_full`. Existen `latest.json` y `latest-full.json`; `latest-quick.json` se creará cuando haya una ejecución quick válida. Esa primera ejecución quick partirá sin referencia automática. El informe conservado procede de una validación anterior; su traslado no lo convierte en un análisis nuevo.

La eliminación de las ejecuciones antiguas ha sido una operación puntual solicitada. Las próximas ejecuciones conservarán su historial; el coordinador no elimina informes automáticamente.

## 5. Cómo leer el resultado

| Indicador            | Significado                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `complete`           | Las etapas terminaron sin limitaciones explícitas detectadas. No acredita funcionamiento perfecto.                                                          |
| `partial`            | Hay límites de cobertura, alguna etapa fallida o entradas que cambiaron durante el análisis. Revisar el detalle antes de confiar en la conclusión afectada. |
| `failed`             | Fallaron todas las etapas. Un fallo de arranque/publicación también puede impedir generar el informe.                                                       |
| Riesgo comprobado    | La consecuencia descrita está acreditada por la evidencia, por ejemplo una etapa sin resultados.                                                            |
| Riesgo posible       | La consecuencia depende de las condiciones indicadas; no se afirma un fallo observado.                                                                      |
| Riesgo no acreditado | El dato no demuestra una consecuencia funcional, por ejemplo un componente reservado sin consumidores.                                                      |

En PowerShell, `$LASTEXITCODE` permite consultar la salida del comando:

- **`0`:** se generó el informe, aunque contenga candidatos o limitaciones conocidas.
- **`1`:** error de ejecución; en el coordinador también puede señalar una etapa fallida o entradas inestables.

Los hallazgos son **puntos de revisión**, no instrucciones para borrar. Un componente desconectado puede estar previsto para usos futuros; un paquete sin import propio puede ser un peer necesario; un ciclo de tipos no implica un fallo de ejecución.

Cada hallazgo muestra identificador estable, origen, elemento, naturaleza, dato detectado, todas sus evidencias, riesgo del hallazgo, confianza y alcance. Las decisiones de reparación quedan fuera del script: no genera acciones, beneficios, prioridades de intervención, riesgo de modificar ni validación posterior. Los encabezados quedan separados por líneas en blanco y los datos de cada registro permanecen juntos.

Inventario y Estilos conservan sus catálogos como datos de referencia. Los otros análisis presentan sus hallazgos con el mismo formato y conservan las tablas propias de su ámbito. Un uso CSS se distingue del uso JavaScript, de tipos y de herramientas; instalación, recursos declarados y artefactos emitidos pertenecen a análisis distintos. Los elementos cruzados se relacionan por identificador.

Los ocho JSON añaden `diagnosticSchemaVersion: 1` y una colección `findings` con el mismo significado que el Markdown. Conservan los datos técnicos del análisis. El workflow usa contrato V2 y admite referencias anteriores V1; la comparación conserva su funcionamiento y presentación anteriores, sin etiquetas nuevas por hallazgo.

Los scripts no abren el navegador ni ejecutan pruebas E2E. Estilos efectivos, interacción y funcionamiento en navegador/dispositivo requieren validación manual.

## 6. Ayuda y orden práctico

Todos los comandos directos admiten `--help` y `-h`. Ejemplos:

```powershell
node scripts/diagnose.mjs --help
node scripts/audit-unused-code.mjs --help
```

1. Ejecuta `npm run diagnose` y abre el informe general.
2. Lee primero el estado y las limitaciones de cobertura de las etapas.
3. Sigue los enlaces a los detalles del área que quieras investigar.
4. Ejecuta `npm run diagnose:full` cuando necesites revisar peso y empaquetado.
5. Usa los scripts individuales para repetir únicamente una consulta concreta.

Los archivos de `scripts/lib/` son piezas internas compartidas; no son comandos independientes. Para cobertura, configuración y limitaciones detalladas, consulta `D:\Proyectos\angie_dashboard\docs\info_scripts.md`.
