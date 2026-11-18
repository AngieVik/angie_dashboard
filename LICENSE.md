# Licencias y atribuciones de terceros

Angie Dashboard utiliza las bibliotecas, fuentes, datos y servicios indicados aquí. Cada componente conserva su licencia y sus avisos originales. Este documento identifica esos terceros; la licencia del código propio de Angie queda pendiente de decisión de su titular.

## Bibliotecas de la aplicación

Revisión del 18 de noviembre de 2026 sobre las dependencias directas de [package.json](package.json), sus versiones instaladas y sus textos de licencia. Todas las versiones indicadas coinciden con [package-lock.json](package-lock.json).

| Componente | Versión instalada | Licencia y texto original local |
| --- | --- | --- |
| React | 19.3.0 | [MIT](node_modules/react/LICENSE) |
| React DOM | 19.3.0 | [MIT](node_modules/react-dom/LICENSE) |
| Radix UI: alert-dialog, checkbox, context-menu, dialog, dropdown-menu, menubar, popover, radio-group, separator y slider | Según lock | MIT; cada paquete `@radix-ui/react-*` contiene su `LICENSE`, por ejemplo [Dialog](node_modules/@radix-ui/react-dialog/LICENSE). |
| @xmldom/xmldom | 0.9.12 | [MIT](node_modules/@xmldom/xmldom/LICENSE) |
| AJV | 8.20.0 | [MIT](node_modules/ajv/LICENSE) |
| ajv-formats | 3.0.1 | [MIT](node_modules/ajv-formats/LICENSE) |
| date-fns | 4.4.0 | [MIT](node_modules/date-fns/LICENSE.md) |
| @date-fns/tz | 1.5.0 | [MIT](node_modules/@date-fns/tz/LICENSE.md) |
| Dexie | 4.4.6 | [Apache-2.0](node_modules/dexie/LICENSE) y [NOTICE](node_modules/dexie/NOTICE). |
| Konva | 10.7.0 | [MIT](node_modules/konva/LICENSE) |
| react-konva | 19.3.0 | [MIT](node_modules/react-konva/LICENSE) |
| Leaflet | 1.9.4 | [BSD-2-Clause](node_modules/leaflet/LICENSE) |
| Lucide React | 1.49.0 | [ISC y avisos MIT de iconos derivados de Feather](node_modules/lucide-react/LICENSE). Incluye la referencia para el tirador adaptado en `src/layout/HandleBottomRight.tsx`. |
| Proj4js | 2.22.0 | [MIT](node_modules/proj4/LICENSE.md) |
| React DayPicker | 9.14.0 | [MIT](node_modules/react-day-picker/LICENSE) |
| react-grid-layout | 2.2.4 | [MIT](node_modules/react-grid-layout/LICENSE) |
| react-resizable | 3.2.0 | [MIT](node_modules/react-resizable/LICENSE) |
| react-resizable-panels | 4.15.3 | [MIT](node_modules/react-resizable-panels/LICENSE.md) |
| Sonner | 2.0.8 | [MIT](node_modules/sonner/LICENSE.md) |
| SunCalc | 2.1.1 | [BSD-2-Clause](node_modules/suncalc/LICENSE), identificada en el texto aunque el manifiesto omite el campo `license`. |
| tzf-wasm | 2.0.1 | [MIT, copia conservada en el proyecto](public/assets/licenses/tzf-wasm.LICENSE.txt). Los datos geográficos tienen licencia independiente, descrita debajo. |

## Herramientas de desarrollo

| Herramienta | Licencia y referencia local |
| --- | --- |
| TypeScript 6.0.3 | [Apache-2.0](node_modules/typescript/LICENSE.txt) |
| Vite 8.3.3 | [MIT del núcleo y avisos de componentes incluidos](node_modules/vite/LICENSE.md) |
| @vitejs/plugin-react 6.1.1 | [MIT](node_modules/@vitejs/plugin-react/LICENSE) |
| vite-plugin-pwa 1.3.0 | [MIT](node_modules/vite-plugin-pwa/LICENSE) |
| ESLint 10.11.0 y @eslint/js 10.0.1 | [MIT de ESLint](node_modules/eslint/LICENSE) y [MIT de @eslint/js](node_modules/@eslint/js/LICENSE). |
| eslint-plugin-react-hooks 7.1.1 | [MIT](node_modules/eslint-plugin-react-hooks/LICENSE) |
| eslint-plugin-react-refresh 0.5.7 | [MIT](node_modules/eslint-plugin-react-refresh/LICENSE) |
| typescript-eslint 8.71.0 | [MIT](node_modules/typescript-eslint/LICENSE) |
| globals 17.12.0 | [MIT](node_modules/globals/license) |
| @types/leaflet, @types/node, @types/react y @types/react-dom | MIT; cada paquete contiene su `LICENSE`, por ejemplo [@types/react](node_modules/@types/react/LICENSE). Versiones en el lock. |

Las tablas cubren las dependencias directas, con las familias indicadas agrupadas. Las dependencias transitivas y el código generado o incorporado por herramientas —incluidos Workbox y componentes del WASM— conservan sus propios textos; su inventario completo no forma parte de esta revisión. El lock identifica las versiones resueltas, pero no sustituye esos textos.

## Fuentes, datos y cartografía

| Recurso | Autoría, licencia y referencia |
| --- | --- |
| Roboto Condensed | The Roboto Project Authors. [SIL Open Font License 1.1](public/assets/fonts/roboto-condensed/OFL.txt). |
| Rajdhani | Indian Type Foundry. [SIL Open Font License 1.1](public/assets/fonts/rajdhani/OFL.txt). |
| Límites geográficos de zonas horarias incluidos con tzf-wasm | Datos derivados de tzf-dist, timezone-boundary-builder y OpenStreetMap. [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), distinta de la licencia MIT del motor. [Procedencia y descargas de referencia](public/assets/licenses/timezones.txt). |
| Datos de OpenStreetMap | © OpenStreetMap contributors, [ODbL y atribución](https://www.openstreetmap.org/copyright). |
| Teselas de OpenStreetMap | Servicio online sujeto también a su [política de uso de teselas](https://operations.osmfoundation.org/policies/tiles/). |
| Búsqueda Nominatim de OpenStreetMap | Datos OSM y [política del servicio público](https://operations.osmfoundation.org/policies/nominatim/); un proveedor alternativo tendrá sus propias condiciones. |
| PNOA, topografía IGN, IGNBaseOrto y elevación MDT05 | Productos/servicios IGN, CNIG y colaboradores del PNOA, según producto. [Política de datos y licencia de uso compatible con CC BY 4.0](https://www.ign.es/web/ign/portal/politica-datos). Atribuciones configuradas en [mapBackgrounds.ts](src/features/map/mapBackgrounds.ts) y [MapElevation.tsx](src/features/map/MapElevation.tsx). |

## Conservación de avisos

Conserva los textos completos de licencia, copyright y `NOTICE` aplicables al código y recursos que redistribuyas, incluidos sus componentes transitivos. Los enlaces a `node_modules/` permiten consultar la instalación de desarrollo; para una distribución, acompaña el artefacto con los avisos correspondientes. Esta tabla es un índice, no reemplaza los textos originales.

Mantén los archivos OFL junto a las fuentes y los avisos geográficos con los datos. Conserva las atribuciones de los proveedores en las vistas y salidas que utilicen su contenido, conforme a sus condiciones. Al cambiar una dependencia o recurso, actualiza su entrada y consulta el texto de la versión incorporada.

## Recursos con procedencia pendiente

En los archivos revisados no se ha encontrado un aviso de autoría o licencia para `public/assets/audio/alarm.mp3`, los dibujos de `public/assets/pins/`, las imágenes de `public/assets/pwa/` y `public/assets/elements/icon_chincheta.png`, ni las imágenes de leyendas cartográficas de `src/features/map/legends/`. Confirma su autoría y procedencia para documentar si son creaciones propias o qué autorización de terceros corresponde. Su presencia en el repositorio no permite asignarles automáticamente la licencia de una biblioteca.
