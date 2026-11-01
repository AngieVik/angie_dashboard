# Peso del build de Angie

Generado: 2026-11-01T09:57:19.702Z. Comando: `node scripts/analyze-bundle.mjs`.

## Cómo leer las cifras

Los tamaños de archivos y gzip son reales del build analizado (kB decimales, gzip con Node). La atribución a paquetes y fuentes es aproximada: reparte los bytes minificados por los segmentos del mapa de fuentes. El empaquetador y las partes sin mapa se indican aparte. No es consumo de RAM ni tiempo de ejecución. El gzip de paquetes individuales no es sumable, por eso solo se muestra para archivos completos.

Se reconstruye con la configuración actual y mapas ocultos en un directorio temporal, que se elimina al terminar. No se modifica `dist/` ni la configuración de producción. El JSON detallado está en `output/bundle-analysis/report.json`.

## Resumen

| Dato                                               | Valor                                               |
| -------------------------------------------------- | --------------------------------------------------- |
| Principal                                          | assets/index-DBeSKqJU.js: 460.34 kB; 128.76 kB gzip |
| JavaScript estático inicial                        | 11 archivos; 1323.21 kB; 394.67 kB gzip             |
| Todo el JavaScript emitido                         | 2338.24 kB, incluidos workers y módulos diferidos   |
| Precaché PWA: bytes reales de los archivos locales | 79 archivos; 23.94 MB sin compresión                |
| Contribución mapeada del principal                 | 98.3%                                               |
| Comparación con dist actual                        | Principal idéntico byte a byte                      |

## Recursos de la precaché por clase

Suma los tamaños de los archivos realmente nombrados en el service worker, incluidos los recursos públicos añadidos por includeAssets. La cifra resumida que imprime el plugin puede no incluir el tamaño de esos recursos públicos. No es tráfico de red medido ni tamaño físico garantizado de Cache Storage.

| Clase                   | Archivos | MB sin compresión |
| ----------------------- | -------- | ----------------- |
| Iconos de elementos PNG | 9        | 15.88             |
| WASM                    | 1        | 4.26              |
| JavaScript              | 35       | 2.34              |
| Otras imágenes          | 9        | 0.73              |
| Fuentes                 | 8        | 0.58              |
| CSS                     | 12       | 0.14              |
| Otros                   | 5        | 0.02              |

## Qué compone el chunk principal

| Paquete o propietario    | kB atribuidos | % del principal |
| ------------------------ | ------------- | --------------- |
| Código de Angie          | 356.64        | 77.5%           |
| react-day-picker@9.14.0  | 40.99         | 8.9%            |
| date-fns@4.4.0           | 28.07         | 6.1%            |
| lucide-react@1.49.0      | 22.22         | 4.8%            |
| @date-fns/tz@1.5.0       | 4.82          | 1.0%            |
| Sin atribución de fuente | 7.61          | 1.7%            |

## Fuentes de Angie más pesadas dentro del principal

| Fuente                                         | kB atribuidos |
| ---------------------------------------------- | ------------- |
| src/features/document/documentStore.ts         | 22.70         |
| src/platform/files/workspaceFiles.ts           | 21.89         |
| src/app/App.tsx                                | 16.98         |
| src/features/document/FileMenu.tsx             | 15.19         |
| src/features/document/documentEdits.ts         | 13.35         |
| src/layout/ModuleFrame.tsx                     | 13.16         |
| src/features/elements/ElementEditor.tsx        | 12.92         |
| src/domain/document/validateDocumentV2.ts      | 11.43         |
| src/domain/document/validateDocumentV1.ts      | 9.46          |
| src/storage/documentRepository.ts              | 9.33          |
| src/features/document/documentReport.ts        | 9.22          |
| src/features/elements/ElementsModule.tsx       | 8.11          |
| src/platform/files/fileAccess.ts               | 8.03          |
| src/features/document/RecoveryDialog.tsx       | 6.83          |
| src/layout/DashboardGrid.tsx                   | 6.52          |
| src/features/document/FileDialog.tsx           | 6.43          |
| src/features/document/reportPagination.ts      | 6.23          |
| src/domain/document/validateDocument.ts        | 6.13          |
| src/layout/useViewportGestures.ts              | 5.30          |
| src/features/elements/elementCommands.ts       | 5.04          |
| src/features/coordinates/CoordinatesModule.tsx | 4.90          |
| src/domain/document/validateDocumentV3.ts      | 4.18          |
| src/platform/pwaPermissions.ts                 | 4.16          |
| src/features/operations/OperationsModule.tsx   | 3.96          |
| src/features/document/PermissionsDialog.tsx    | 3.88          |

## Paquetes y propietarios: todo el JavaScript

Incluye copias emitidas dentro de workers; no confundir el total con el arranque.

| Paquete o propietario                    | Total kB | Inicial kB | Dentro de workers kB |
| ---------------------------------------- | -------- | ---------- | -------------------- |
| Código de Angie                          | 629.57   | 360.30     | 53.48                |
| ajv@8.20.0                               | 232.80   | 115.56     | 117.24               |
| react-dom@19.3.0                         | 206.94   | 206.94     | 0.00                 |
| konva@10.7.0                             | 185.92   | 0.00       | 0.00                 |
| leaflet@1.9.4                            | 148.67   | 0.00       | 0.00                 |
| react-reconciler@0.34.0                  | 128.46   | 0.00       | 0.00                 |
| proj4@2.22.0                             | 106.47   | 106.47     | 0.00                 |
| dexie@4.4.6                              | 95.11    | 95.11      | 0.00                 |
| @xmldom/xmldom@0.9.12                    | 84.86    | 0.00       | 84.86                |
| react-day-picker@9.14.0                  | 40.99    | 40.99      | 0.00                 |
| sonner@2.0.8                             | 33.52    | 33.52      | 0.00                 |
| lucide-react@1.49.0                      | 32.89    | 25.38      | 0.00                 |
| fast-uri@3.1.8                           | 32.75    | 16.35      | 16.40                |
| date-fns@4.4.0                           | 31.31    | 28.07      | 0.00                 |
| ajv-formats@3.0.1                        | 30.95    | 9.87       | 21.09                |
| react-draggable@4.7.2                    | 28.07    | 28.07      | 0.00                 |
| react-grid-layout@2.2.4                  | 19.64    | 19.64      | 0.00                 |
| wkt-parser@1.5.6                         | 17.92    | 17.92      | 0.00                 |
| react-resizable@3.2.0                    | 11.48    | 11.48      | 0.00                 |
| @radix-ui/react-menu@2.1.24              | 9.81     | 9.81       | 0.00                 |
| @radix-ui/react-slider@1.4.7             | 9.40     | 9.40       | 0.00                 |
| @radix-ui/react-menu@2.2.1               | 8.84     | 8.84       | 0.00                 |
| react-konva@19.3.0                       | 8.62     | 0.00       | 0.00                 |
| @radix-ui/react-collection@1.2.0         | 8.30     | 8.30       | 0.00                 |
| react@19.3.0                             | 8.18     | 8.18       | 0.00                 |
| @floating-ui/core@1.8.0                  | 7.70     | 7.70       | 0.00                 |
| @floating-ui/dom@1.8.0                   | 7.11     | 7.11       | 0.00                 |
| @radix-ui/react-collection@1.1.15        | 7.00     | 7.00       | 0.00                 |
| suncalc@2.1.1                            | 5.93     | 0.00       | 0.00                 |
| react-remove-scroll@2.7.2                | 5.69     | 5.69       | 0.00                 |
| @radix-ui/react-presence@1.1.11          | 5.31     | 5.31       | 0.00                 |
| @radix-ui/react-slot@1.5.0               | 5.25     | 5.25       | 0.00                 |
| @radix-ui/react-dismissable-layer@1.2.1  | 5.23     | 5.23       | 0.00                 |
| @radix-ui/react-dismissable-layer@1.1.19 | 5.23     | 5.23       | 0.00                 |
| mgrs@1.0.0                               | 5.06     | 5.06       | 0.00                 |

## Paquetes con varias versiones emitidas

| Paquete                                | Versiones      | Total kB atribuidos |
| -------------------------------------- | -------------- | ------------------- |
| @radix-ui/react-menu                   | 2.1.24, 2.2.1  | 18.65               |
| @radix-ui/react-collection             | 1.2.0, 1.1.15  | 15.30               |
| @radix-ui/react-dismissable-layer      | 1.2.1, 1.1.19  | 10.47               |
| @radix-ui/react-presence               | 1.1.11, 1.1.10 | 7.96                |
| @radix-ui/react-focus-scope            | 1.3.1, 1.1.16  | 7.91                |
| @radix-ui/react-popper                 | 1.4.0, 1.3.7   | 7.76                |
| @radix-ui/react-slot                   | 1.5.0, 1.3.3   | 7.62                |
| @radix-ui/react-roving-focus           | 1.2.1, 1.1.19  | 7.32                |
| @radix-ui/react-context                | 1.2.2, 1.3.0   | 5.05                |
| @radix-ui/react-use-controllable-state | 1.3.0, 1.2.6   | 3.71                |
| @radix-ui/primitive                    | 1.2.0, 1.1.7   | 2.84                |
| @radix-ui/react-use-size               | 1.1.5, 1.1.4   | 1.80                |
| @radix-ui/react-primitive              | 2.2.0, 2.1.10  | 1.56                |
| @radix-ui/react-focus-guards           | 1.2.0, 1.1.6   | 1.53                |
| @radix-ui/react-portal                 | 1.2.0, 1.1.17  | 0.56                |
| @radix-ui/react-use-callback-ref       | 1.1.5, 1.1.4   | 0.50                |
| @radix-ui/react-direction              | 1.2.0, 1.1.4   | 0.39                |

La coexistencia no demuestra que se pueda deduplicar sin revisar compatibilidad. Las copias de una misma versión en un worker y en la interfaz no aparecen aquí como versiones distintas.

## Archivos JavaScript, de mayor a menor

| Archivo                                 | Carga                     | kB     | gzip kB |
| --------------------------------------- | ------------------------- | ------ | ------- |
| assets/index-DBeSKqJU.js                | Inicial estático          | 460.34 | 128.76  |
| assets/canvas-Cz-Gd3th.js               | Bajo demanda / compartido | 325.39 | 98.33   |
| assets/ui-s-Tp7ttw.js                   | Inicial estático          | 215.13 | 65.93   |
| assets/react-DuPs4GPT.js                | Inicial estático          | 206.84 | 64.11   |
| assets/document.worker-Duse4WBv.js      | Worker                    | 204.39 | 50.68   |
| assets/useGpxFiles-DEyq5OSn.js          | Bajo demanda / compartido | 160.63 | 47.52   |
| assets/validation-BD9QU8EC.js           | Inicial estático          | 143.90 | 40.90   |
| assets/coordinates-DQycVhIU.js          | Inicial estático          | 129.58 | 42.77   |
| assets/storage-4zmm-ZKv.js              | Inicial estático          | 95.19  | 31.02   |
| assets/gpx.worker-BcdRVXwM.js           | Worker                    | 92.04  | 33.11   |
| assets/windows-yX-SuZWi.js              | Inicial estático          | 64.27  | 17.27   |
| assets/MapModule-DfFVgumh.js            | Bajo demanda / compartido | 60.30  | 19.05   |
| assets/ReportMap-DhF_J-eC.js            | Bajo demanda / compartido | 35.81  | 12.14   |
| assets/BoardModule-BeAvTRVe.js          | Bajo demanda / compartido | 34.19  | 10.99   |
| assets/PlanModule--6VEiIUh.js           | Bajo demanda / compartido | 24.70  | 8.24    |
| assets/CalendarModule-D2E6OmIa.js       | Bajo demanda / compartido | 11.21  | 4.17    |
| assets/boardReport-BwxFZ8fb.js          | Bajo demanda / compartido | 11.04  | 4.61    |
| assets/ReportsModule-Bq90nwRL.js        | Bajo demanda / compartido | 8.20   | 3.18    |
| assets/astronomy-Dd0KVb21.js            | Bajo demanda / compartido | 7.52   | 3.71    |
| assets/SettingsDialog-DSrkM1Kt.js       | Bajo demanda / compartido | 6.13   | 2.30    |
| assets/SolarCalculator-t1BcyMWe.js      | Bajo demanda / compartido | 5.96   | 2.73    |
| assets/ReportBoard-Bi4keYY2.js          | Bajo demanda / compartido | 5.36   | 2.36    |
| assets/useMapSearch-BMhWQ9yK.js         | Bajo demanda / compartido | 5.06   | 2.24    |
| assets/timeZoneLookup-CCWd7O9e.js       | Bajo demanda / compartido | 4.87   | 2.02    |
| assets/reportImages-CbefEa9k.js         | Bajo demanda / compartido | 3.97   | 1.87    |
| assets/button-BENDWqN_.js               | Inicial estático          | 3.74   | 1.79    |
| assets/reportFraming.module-Duk1Kng8.js | Bajo demanda / compartido | 3.56   | 1.48    |
| assets/inputBudgets-CqtvFuRB.js         | Inicial estático          | 3.18   | 1.49    |
| assets/boardViewport-jUjQenJF.js        | Bajo demanda / compartido | 2.20   | 0.93    |
| assets/mapNavigation-DruSt41s.js        | Bajo demanda / compartido | 1.30   | 0.61    |
| assets/rolldown-runtime-B0Z9INg1.js     | Inicial estático          | 0.90   | 0.51    |
| assets/palette-I1wkUuUU.js              | Bajo demanda / compartido | 0.54   | 0.30    |
| assets/refresh-cw-U0HzB9pX.js           | Bajo demanda / compartido | 0.35   | 0.25    |
| assets/eraser-Ca7wF1qw.js               | Bajo demanda / compartido | 0.31   | 0.24    |
| registerSW.js                           | Inicial estático          | 0.13   | 0.13    |

## Recursos no JavaScript más pesados

Las imágenes públicas pueden estar copiadas en dist sin estar precacheadas ni descargarse al arrancar. La columna PWA comprueba su presencia en el service worker generado. CSS y WASM también consumen almacenamiento/descarga, aunque no engorden un chunk JS.

| Archivo                                                                        | kB      | Precaché PWA |
| ------------------------------------------------------------------------------ | ------- | ------------ |
| assets/tzf_wasm_bg-0OKIvqvE.wasm                                               | 4260.97 | Sí           |
| assets/elements/icon_quad.png                                                  | 2349.53 | Sí           |
| assets/elements/icon_medical.png                                               | 2076.09 | Sí           |
| assets/elements/icon_vir.png                                                   | 2029.28 | Sí           |
| assets/elements/icon_cp.png                                                    | 1939.27 | Sí           |
| assets/elements/icon_finish.png                                                | 1884.46 | Sí           |
| assets/elements/icon_eh.png                                                    | 1782.51 | Sí           |
| assets/elements/icon_start.png                                                 | 1477.77 | Sí           |
| assets/elements/icon_peligro.png                                               | 1421.28 | Sí           |
| assets/elements/icon_chincheta.png                                             | 920.94  | Sí           |
| assets/fonts/rajdhani/Rajdhani-SemiBold.ttf                                    | 390.34  | Sí           |
| assets/mtn25-RcGqC2os.png                                                      | 387.04  | Sí           |
| assets/pwa/icon-512.png                                                        | 171.61  | Sí           |
| assets/index-wgfSEAX6.css                                                      | 101.31  | Sí           |
| assets/pwa/icon-maskable-512.png                                               | 92.15   | Sí           |
| assets/fonts/roboto-condensed/roboto-condensed-latin-italic-variable.woff2     | 56.96   | Sí           |
| assets/fonts/roboto-condensed/roboto-condensed-latin-variable.woff2            | 51.41   | Sí           |
| assets/fonts/roboto-condensed/roboto-condensed-latin-ext-italic-variable.woff2 | 37.06   | Sí           |
| assets/fonts/roboto-condensed/roboto-condensed-latin-ext-variable.woff2        | 33.96   | Sí           |
| assets/pwa/icon-192.png                                                        | 26.90   | Sí           |

## Dependencias declaradas sin JavaScript atribuible

- @radix-ui/react-context-menu
- @radix-ui/react-radio-group
- react-resizable-panels

Esta lista identifica candidatas a revisar, no autoriza a retirarlas: pueden ser requisitos transitivos, recursos sin JS o consumidores no alcanzados por el mapa.
