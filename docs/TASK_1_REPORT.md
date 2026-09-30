# Entrega de la Tarea 1 — Angie Dashboard V1

Fecha: 30 de septiembre de 2026.

**Estado: completada dentro del alcance de la Tarea 1.** La V1 completa todavía no está terminada. No se ha iniciado ni preparado ninguna otra tarea.

## Resultado y límites

Base local React/TypeScript/Vite con cabecera, espacio principal vacío, tokens Titan, Roboto Condensed local y estilo monoespaciado reutilizable para datos técnicos. Manifiesto PWA con nombre `Angie Dashboard`, nombre corto `Angie`, tema `#0C0D0E` y siete iconos existentes. El service worker conserva el shell y los recursos aprobados para uso sin conexión después de una primera carga correcta.

No se han implementado controles, módulos ni lógica correspondientes a otras tareas. No se han realizado operaciones de escritura en Git, despliegues, publicaciones o conexiones de la aplicación a servicios externos. No se han modificado los documentos normativos ni marcado criterios de aceptación de la V1.

## Archivos creados

No había código de aplicación previo ni cambios ajenos pendientes en el estado inicial inspeccionado. Se han creado estos 16 archivos:

| Archivo                   | Propósito                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `package.json`            | Dependencias y scripts `dev`, `test`, `test:watch`, `lint`, `typecheck`, `build`, `e2e`. |
| `package-lock.json`       | Versiones resueltas para instalaciones reproducibles.                                    |
| `vite.config.ts`          | React, Vitest, manifiesto PWA y caché de recursos.                                       |
| `tsconfig.json`           | TypeScript estricto, comprobación sin emisión y límites adicionales.                     |
| `eslint.config.js`        | Reglas JavaScript, TypeScript y React.                                                   |
| `index.html`              | Entrada en español, viewport, color de tema y favicon/apple touch icon.                  |
| `src/main.tsx`            | Montaje de React e importación de estilos.                                               |
| `src/app/App.tsx`         | Shell mínimo con cabecera y área principal vacía.                                        |
| `src/styles/tokens.css`   | Paleta Titan y familias tipográficas.                                                    |
| `src/styles/fonts.css`    | Importación de la hoja de fuentes existente.                                             |
| `src/styles/global.css`   | Acabado del shell, altura del viewport, ausencia de scroll y estilos tipográficos.       |
| `src/test/setup.ts`       | Matchers DOM y limpieza de componentes.                                                  |
| `src/app/App.test.tsx`    | Tres comprobaciones del shell y sus estilos.                                             |
| `playwright.config.ts`    | Pruebas del build local en escritorio y móvil emulado.                                   |
| `tests/e2e/smoke.spec.ts` | Carga, fuentes, scroll, iconos, manifiesto y funcionamiento sin conexión.                |
| `docs/TASK_1_REPORT.md`   | Este informe de entrega.                                                                 |

`dist`, `node_modules`, `playwright-report` y `test-results` son salidas locales ignoradas por las reglas existentes. No se ha cambiado `.gitignore` ni `.gitattributes`.

## Dependencias instaladas

Solo dos dependencias de ejecución:

| Paquete     | Versión resuelta | Motivo                   |
| ----------- | ---------------- | ------------------------ |
| `react`     | 19.3.0           | Shell React aprobado.    |
| `react-dom` | 19.3.0           | Montaje en el navegador. |

Herramientas de desarrollo y pruebas:

| Grupo                  | Paquetes y versiones resueltas                                                                                                                               | Motivo                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Compilación y PWA      | `vite` 8.3.1, `@vitejs/plugin-react` 6.1.1, `typescript` 6.0.3, `vite-plugin-pwa` 1.3.0                                                                      | Desarrollo, compilación, tipado, manifiesto y service worker. |
| Tipos                  | `@types/node` 26.6.3, `@types/react` 19.3.0, `@types/react-dom` 19.3.0                                                                                       | Tipos del código y de la configuración.                       |
| Pruebas de componentes | `vitest` 5.0.2, `jsdom` 29.1.1, `@testing-library/react` 16.3.3, `@testing-library/jest-dom` 7.0.1                                                           | Entorno DOM, renderizado y aserciones accesibles.             |
| Navegador              | `@playwright/test` 1.63.0                                                                                                                                    | Pruebas de escritorio, móvil emulado y offline.               |
| Lint                   | `eslint` 10.11.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.0, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-react-refresh` 0.5.7, `globals` 17.12.0 | Análisis estático del stack instalado.                        |

Se instaló además Chromium de Playwright 153.0.8010.12, revisión 1243, y su variante headless en la caché local de Playwright para las pruebas. La instalación y las ejecuciones E2E necesitaron permiso del entorno para escribir esa caché y cerrar correctamente los procesos temporales de Windows.

Las otras bibliotecas del stack aprobado no son necesarias para este shell vacío y no se instalaron.

## Verificaciones ejecutadas

Entorno: Windows, Node.js 24.12.0, npm 11.6.2.

| Verificación             | Resultado y alcance                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lectura previa           | Leídos completos `AGENTS.md`, esquema, criterios y plan, en ese orden. Inspeccionados recursos y estado del proyecto. Sin contradicciones reales que afecten a la Tarea 1.                                                                                             |
| TDD inicial              | Escritas primero las pruebas y ejecutado `npm test -- --run src/app/App.test.tsx`: código 1 por ausencia de `App.tsx`, antes de implementar el shell. Después: 3 pruebas aprobadas.                                                                                    |
| `npm run lint`           | Código 0, sin errores ni advertencias de lint.                                                                                                                                                                                                                         |
| `npm run typecheck`      | Código 0. Código fuente, pruebas y configuraciones TypeScript incluidos.                                                                                                                                                                                               |
| `npm test -- --run`      | Código 0: 1 archivo, 3 pruebas aprobadas.                                                                                                                                                                                                                              |
| `npm run build`          | Código 0. Generados build de producción, manifiesto, registro y service worker; 32 entradas en la lista de precache.                                                                                                                                                   |
| `npm run e2e`            | Código 0: 6 pruebas aprobadas. Chromium, escritorio `1440 × 900` y perfil móvil Pixel 7 `412 × 839` con emulación táctil.                                                                                                                                              |
| Carga y layout           | Cabecera visible, nombre correcto, área principal vacía, ausencia de errores de consola y de carga, ausencia de peticiones externas y de scroll de página en ambos perfiles E2E.                                                                                       |
| Fuentes en navegador     | Cuatro WOFF2 locales, contenido del build idéntico a los originales. Carga normal y cursiva en pesos 100, 400 y 900, caracteres latin y latin-ext. Familia general y monoespaciada comprobadas.                                                                        |
| Metadatos de fuentes     | Inspección de las tablas WOFF2 en memoria con Brotli de Node: las cuatro fuentes declaran familia Roboto Condensed y eje variable `wght` de 100 a 900; los indicadores de cursiva corresponden a sus archivos.                                                         |
| Iconos PWA               | Siete PNG decodificados en navegador. Dimensiones exactas; cinco normales con píxeles transparentes; dos maskable completamente opacos. Todo píxel distinto de `#0C0D0E` queda dentro del círculo central de radio `0.4 × lado`. Enlazados en manifiesto y HTML.       |
| Inspección visual        | Shell revisado en navegador integrado a `1440 × 900` y `412 × 915`. Chincheta original y los siete derivados comparados visualmente: dibujo, colores y proporción conservados.                                                                                         |
| Offline                  | Service worker controla la página; las cuatro fuentes versionadas están en caché. Red desactivada, recarga correcta y acceso a los 23 recursos aprobados y al manifiesto. Carga adicional de cursiva y latin-ext sin conexión.                                         |
| Preservación de recursos | SHA-256 inicial y final idéntico para los 23 archivos bajo `public/assets`: nueve PNG originales, siete derivados PWA, cuatro WOFF2, hoja CSS, licencia y audio. No se regeneró ni sobrescribió ninguno.                                                               |
| Dependencias             | Instalación finalizada; npm informó de cero vulnerabilidades. `npm ls --depth=0` sin dependencias faltantes o inválidas.                                                                                                                                               |
| Revisión de cambios      | Revisados los archivos nuevos y el lockfile; `git diff --check` sin errores. Los archivos normativos y recursos existentes no presentan cambios. El diff normal no muestra archivos nuevos todavía no registrados, por lo que se entrega también un diff de adiciones. |
| Revisión independiente   | Un agente revisor inspeccionó código, configuraciones, dependencias y artefactos generados sin modificarlos. Sin incidencias críticas, importantes o menores dentro de la Tarea 1. No repitió las pruebas.                                                             |

La inspección WOFF2 se basó en la [especificación de W3C](https://www.w3.org/TR/WOFF2/). La configuración de recursos sigue las opciones documentadas de [Vite PWA](https://vite-pwa-org.netlify.app/guide/static-assets).

## Incidencias resueltas y pendientes

Se reprodujeron y corrigieron mediante las pruebas de navegador tres defectos de configuración: registro sin control inmediato de la página, fuentes emitidas por Vite ausentes del precache y duplicación de la hoja pública de fuentes con dos revisiones distintas. La matriz final completa pasa después de esas correcciones.

En el entorno restringido, las primeras ejecuciones E2E no cerraban los procesos temporales al terminar; se interrumpieron. Las ejecuciones autorizadas fuera de esa restricción terminaron normalmente y devolvieron su código final. Esto no fue un fallo de la aplicación.

Advertencias informativas observadas: obsolescencia de `glob` como dependencia transitiva durante la instalación y coexistencia de `NO_COLOR`/`FORCE_COLOR` en los procesos de pruebas. No produjeron fallos. Las consultas Git iniciales avisaron de falta de permiso para leer el archivo global de exclusiones del usuario; no se cambió su configuración.

**Comprobaciones pendientes:** instalación manual y apertura como aplicación instalada en Windows y Android real. Los perfiles E2E y la revisión visual móvil son emulación; no demuestran instalación nativa ni ejecución en un teléfono físico. Esa comprobación de aceptación de la V1 no se ha marcado como cumplida.

No quedan errores funcionales conocidos de la Tarea 1. La validación completa de la V1 continúa pendiente. La ejecución se detiene en esta entrega y requiere aprobación expresa del usuario antes de cualquier otra tarea.
