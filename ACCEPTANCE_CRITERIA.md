# Criterios de aceptación — Angie Dashboard V1

Este documento resume las comprobaciones de entrega. `ESQUEMA_CONCEPTUAL.md` conserva el detalle normativo y prevalece ante cualquier duda.

La revisión adaptativa aprobada el 2026-10-02 se verifica con los criterios de la **sección 11**, inicialmente sin marcar. Su orden de implementación está en el plan activo enlazado desde `IMPLEMENTATION_PLAN.md`.

Las **secciones 1–10 son evidencia histórica de la V1 original**: sus checks se refieren al alcance demostrado en la sección 10, con navegador de escritorio, emulación Pixel 7, simulaciones y límites indicados. Se conservan íntegros; sus reglas sustituidas, como espacio fijo, ausencia normal de solapamiento, filtro, notas fijas o nombre independiente, no son requisitos de la revisión vigente. Ningún check histórico acredita por sí solo el nuevo comportamiento. La instalación nativa continúa pendiente en esa evidencia y la actualización documental no la demuestra.

## 1. Arranque, cabecera y documentos

- [ ] La aplicación se instala como PWA en Windows y Android y puede abrirse sin conexión después de la primera carga.
- [x] Cada sesión comienza con todos los módulos cerrados y sin una distribución impuesta.
- [x] La cabecera permanece visible e incluye `Archivo`, `Ver`, título editable, `Encajar` y porcentaje de zoom.
- [x] `Nuevo` crea un documento vacío sin eliminar archivos exportados ni detener temporizadores.
- [x] `Guardar` valida el JSON antes de escribirlo y utiliza selector nativo o descarga según la capacidad del navegador.
- [x] `Guardar` sanea únicamente el nombre propuesto sin modificar el título: elimina caracteres de control, `<>:"/\|?*` y espacios o puntos finales, conserva acentos y separadores interiores y añade `.json` una sola vez.
- [x] Si el nombre base saneado —retirando antes una posible extensión `.json`— queda vacío o es un nombre reservado de Windows, `Guardar` propone `drp_YYYY-MM-DD_HH-mm-ss.json` con la fecha y hora local del dispositivo, formato de 24 horas y ceros iniciales.
- [x] Cancelar o fallar un guardado no sustituye el archivo anterior ni pierde el documento activo.
- [x] `Cargar` rechaza archivos dañados, ajenos a Angie Dashboard o de versiones futuras sin reemplazar el documento activo.
- [x] Una versión antigua solo se migra en memoria cuando existe una migración expresamente reconocida; las versiones antiguas no reconocidas se rechazan sin modificar el archivo original.
- [x] El archivo exportado cumple el JSON Schema 2020-12 y contiene únicamente los bloques aprobados.
- [x] El JSON contiene exactamente las nueve propiedades raíz aprobadas, rechaza propiedades desconocidas y conserva la estructura obligatoria completa aunque existan textos, listas o posiciones vacíos.
- [x] UUID, fechas UTC, colores, uniones discriminadas, relaciones condicionales, coordenadas, escalas, tamaños y orden cronológico se validan conforme al contrato V1.

## 2. Autoguardado y recuperación

- [x] El documento activo se guarda automáticamente en IndexedDB y se recupera después de recargar o reabrir la PWA.
- [x] El autoguardado y el archivo JSON visible funcionan de manera independiente.
- [x] El JSON no incluye imagen de fondo, archivos PNG, temporizadores, operación de calculadora, coordenadas temporales, selección, viewport ni visibilidad de módulos.
- [x] Un error de lectura, escritura o apertura de IndexedDB mantiene la aplicación y el documento activo funcionando en memoria, sin borrar ni recrear automáticamente la base local.
- [x] El error muestra `Autoguardado no disponible` con `Reintentar` y `Guardar JSON`; el guardado visible continúa funcionando y un reintento correcto retira el aviso.
- [x] Una recuperación posterior nunca reemplaza un documento activo modificado sin confirmación del usuario.

## 3. Sistema modular y móvil

- [x] Todos los módulos se abren y cierran desde `Ver`; el botón `×` cierra solo su módulo.
- [x] Los módulos se mueven y redimensionan sin recolocar automáticamente los demás.
- [x] Se respetan los tamaños iniciales y mínimos definidos para los nueve módulos.
- [x] La distribución normal impide solapamientos.
- [x] La apertura busca primero la distribución guardada y después un hueco libre conforme al orden definido.
- [x] Sin espacio disponible, el módulo se abre centrado al tamaño mínimo, por encima de los demás, con el aviso aprobado y solapamiento temporal.
- [x] `moduleLayouts` conserva posiciones y tamaños, pero no visibilidad.
- [x] En móvil, un dedo manipula contenido y dos dedos desplazan o amplían el dashboard sin provocar acciones accidentales.
- [x] `Encajar` muestra completo y centrado el espacio general `1600 × 1000`, ocupa la mayor superficie disponible bajo la cabecera y establece el zoom mínimo; el máximo efectivo es el mayor valor entre `400 %` y la escala de encaje.
- [x] Girar el dispositivo conserva el punto lógico central y mantiene una vista válida.
- [x] No aparece scroll de página en Windows ni Android.

## 4. Pizarra

- [x] Permite seleccionar color o cargar temporalmente una imagen JPG/PNG local.
- [x] Rechaza imágenes superiores a `50 MiB` y reduce en memoria las que superen `4096 px` en su lado mayor.
- [x] Un fallo de imagen conserva el fondo anterior y no sube datos a servicios externos.
- [x] Los modos `Seleccionar/mover`, `Lápiz`, `Goma` y `Nota rápida` respetan las prioridades definidas.
- [x] La goma elimina únicamente trazos del lápiz.
- [x] Pines, notas rápidas y trazos se persisten en el lienzo lógico fijo `1000 × 1000`; el módulo lo muestra completo, centrado, proporcional y sin recortarlo.
- [x] Las notas rápidas se pueden crear, editar y eliminar y mantienen tamaño visual fijo.

## 5. Elementos y pines

- [x] Se pueden crear, editar, duplicar y eliminar elementos con nombre, información, representación visual y clasificación inmutable como `Dotación` o `General`.
- [x] `Dotación` solo puede elegirse durante la creación; después se muestra como dato de solo lectura y no puede cambiarse en ningún sentido.
- [x] Una dotación nueva comienza como `Disponible`, con anotaciones vacías y sin etiquetas.
- [x] Las etiquetas de una dotación se pueden crear, editar y eliminar como chips, rechazan vacíos y duplicados sin distinguir mayúsculas y se muestran en Información sin convertirse en objetos de la pizarra.
- [x] Duplicar crea otro UUID y el nombre `<nombre> copia`, conserva configuración, tipo e información y desplaza el pin `24` unidades dentro del lienzo; si es una dotación, reinicia sus datos operativos y no copia entradas cronológicas.
- [x] Se pueden usar los nueve PNG del catálogo o cualquier emoji escrito o pegado.
- [x] Cada ID del catálogo carga el archivo, nombre, clase y caja inicial correctos.
- [x] El catálogo solo admite las cajas `150 × 100` para `Horizontal`, `100 × 150` para `Vertical` y `100 × 100` para `Cuadrado`; un icono nuevo reutiliza una de esas clases.
- [x] Cada PNG utiliza `contain`, queda centrado en su caja máxima y conserva su proporción sin deformarse ni recortarse.
- [x] Los PNG conservan su proporción y pueden escalarse entre `25 %` y `300 %` mediante tirador y deslizador sincronizados.
- [x] La escala afecta conjuntamente a la caja y al PNG, y la caja escalada completa permanece dentro del lienzo.
- [x] La escala se guarda en el JSON y el nombre del elemento mantiene un tamaño de texto independiente.
- [x] Los elementos se separan visualmente en `Dotaciones` y `Generales`.
- [x] El filtro de ocho estados muestra u oculta dotaciones sin alterar sus datos.

## 6. Información, operativo y registro

- [x] Información muestra el elemento seleccionado y la fase cuando sea una dotación.
- [x] Sin selección, Información muestra únicamente los nombres de las dotaciones, o `Sin dotaciones` cuando no exista ninguna; tocar un nombre selecciona globalmente esa dotación.
- [x] Con una dotación seleccionada, Información muestra su información libre, fase y etiquetas; con un elemento general, muestra únicamente su información libre.
- [x] Operativo incluye solo dotaciones y permite los ocho estados fijos definidos.
- [x] Sin una dotación seleccionada, Operativo muestra únicamente contadores no vacíos de los ocho estados exactos, en el orden definido y sin fases ni agrupaciones nuevas.
- [x] Tocar un contador despliega las dotaciones que están exactamente en ese estado, con un único estado desplegado; tocar un nombre selecciona globalmente esa dotación.
- [x] Con una dotación seleccionada, Operativo muestra los ocho estados, resalta el actual y permite elegir cualquiera; al deseleccionarla vuelve a los contadores.
- [x] La selección es única y se sincroniza entre pizarra, Elementos, Información y Operativo.
- [x] Los ocho estados pueden elegirse manualmente en cualquier momento, sin secuencia obligatoria; seleccionar el estado actual no modifica datos ni crea una entrada.
- [x] Operativo permite editar una anotación libre y gestionar las etiquetas asociadas a cada dotación con autoguardado.
- [x] Un cambio de estado actualiza Información y crea una entrada cronológica automática con hora española.
- [x] Solo el cambio más reciente de cada dotación existente permite `Deshacer`, y únicamente cuando el estado actual coincide con el estado nuevo registrado.
- [x] `Deshacer` restaura el estado anterior y elimina atómicamente la entrada correspondiente sin crear otra; permite continuar retrocediendo en orden inverso y no afecta a otras dotaciones.
- [x] Eliminar una dotación conserva intactas sus entradas cronológicas mediante el nombre guardado, pero ninguna de ellas permite `Deshacer`.
- [x] Un intento de deshacer no válido se rechaza sin modificar el estado ni el registro.
- [x] Las entradas manuales se pueden crear, editar y eliminar.
- [x] El registro sigue funcionando con su módulo cerrado y respeta el comportamiento de desplazamiento automático aprobado.

## 7. Reloj y alertas

- [x] Se muestran hora española con cambio estacional automático y hora Zulu.
- [x] Se pueden crear varios `T-Zero`, `T-Minus` y `Advisories` con notas y controles correctos.
- [x] Las duraciones de `T-Minus` y `Advisory` utilizan tres campos exclusivamente numéricos, normalizan excesos entre segundos, minutos y horas y quedan siempre entre `00:00:01` y `23:59:59`.
- [x] Al completar `23:59:59`, un `T-Zero` se detiene, vuelve a `00:00:00` y queda inactivo sin alerta ni nuevo ciclo.
- [x] `Desactivar` un Advisory en ejecución o alertando detiene conteo, sonido y destello, vuelve a `00:00:00`, conserva duración y nota y lo deja preparado para reiniciarse sin pausarlo, completarlo ni cerrarlo.
- [x] Los temporizadores se calculan mediante marcas de tiempo y recuperan el valor correcto después de suspensión o recarga.
- [x] Los temporizadores internos no se exportan ni importan mediante JSON y no cambian al usar `Nuevo`, `Guardar` o `Cargar`.
- [x] Al completar un ciclo, el temporizador muestra rojo intenso, borde blanco y dos destellos por segundo.
- [x] `public/assets/audio/alarm.mp3` se reproduce en un único bucle compartido y se detiene cuando ya no queda ninguna alerta activa.
- [x] El Módulo Reloj ofrece un único control común cuyo texto permanece como `Probar sonido` y cuyo icono alterna entre `▶` y `⏸`: reproduce el timbre en bucle sin modificar temporizadores, se detiene al cerrar el módulo o comenzar una alarma real y permanece deshabilitado mientras exista una alerta real activa.
- [x] Si el navegador bloquea el timbre, la alerta visual continúa y aparece `Sonido bloqueado` con `Activar sonido`; otros fallos muestran `No se pudo reproducir la alarma` sin reconocer ni ocultar la alerta.
- [x] Varias alertas simultáneas mantienen indicadores visuales independientes y comparten un único timbre en bucle; resolver una afecta solo a ese temporizador y el sonido continúa hasta que no quede ninguna alerta activa.
- [x] Después de reconocerla, la entrada permanece finalizada hasta reiniciarla o cerrarla.

## 8. Coordenadas, calculadora y cuaderno

- [x] Coordenadas convierte correctamente entre DD, DMS, DMM y UTM utilizando los cuatro formatos canónicos.
- [x] `30S` se interpreta como huso 30 y banda S del hemisferio norte, no como hemisferio sur.
- [x] Se validan husos `1–60` y bandas `C–X`, excluyendo `I` y `O`.
- [x] Una entrada inválida conserva exactamente sus números, muestra el error y no genera conversión ni enlace.
- [x] Una entrada válida genera un enlace de Google Maps copiable.
- [x] Calculadora admite operaciones básicas, decimales, porcentajes, paréntesis, retroceso y limpieza.
- [x] Los porcentajes cumplen `10 % = 0,1`, `200 + 10 % = 220`, `200 - 10 % = 180`, `200 × 10 % = 20`, `200 ÷ 10 % = 2000` y `80 + 12,5 % = 90`; dividir entre `0 %` muestra error.
- [x] Cuaderno crea notas y checklist, permite marcar elementos y reordena bloques solo desde el tirador.
- [x] Las notas admiten texto multilínea, símbolos y emojis sin formato enriquecido.

## 9. Diseño, accesibilidad y calidad

- [x] Los iconos PWA normales existen en `16`, `32`, `180`, `192` y `512` píxeles, conservan transparencia y reproducen la chincheta aprobada sin deformarla ni redibujarla.
- [x] Los iconos `maskable` existen en `192` y `512` píxeles, tienen fondo opaco `#0C0D0E` y mantienen completa la chincheta dentro de la zona segura circular del `80 %`.
- [x] Roboto Condensed normal y cursiva, con pesos variables `100–900`, se carga desde recursos locales y continúa disponible sin conexión; los datos técnicos conservan una tipografía monoespaciada.
- [x] La interfaz respeta la paleta y dirección Titan industrial aprobadas sin convertirse en un diseño plano o móvil simplificado.
- [x] Todos los controles interactivos tienen nombre accesible; los controles formados únicamente por iconos describen su acción y el foco de teclado es siempre visible y sigue un orden lógico por la cabecera y los módulos abiertos.
- [x] En Windows pueden utilizarse con teclado `Archivo`, `Ver`, el título, la apertura y cierre de módulos y los botones, formularios, listas, filtros, estados, etiquetas, temporizadores, calculadora y Cuaderno; los elementos y dotaciones pueden seleccionarse desde sus módulos.
- [x] Mover o redimensionar módulos, pines y notas rápidas y dibujar o borrar en la pizarra no requieren alternativa de teclado en la V1, sin impedir el acceso mediante teclado a sus funciones no espaciales.
- [x] Los estados operativos no dependen únicamente del color.
- [x] No se introducen datos clínicos, cuentas, telemetría ni transferencias de documentos a servidores.
- [x] Las pruebas unitarias, de componentes y de navegador están aprobadas.
- [x] Lint, comprobación de tipos y compilación de producción finalizan sin errores.
- [x] La aplicación se verifica visual y funcionalmente en un viewport de escritorio y uno móvil.
- [x] No se realiza ningún despliegue ni publicación sin autorización expresa.

## 10. Evidencia de Task 12 — 2026-10-01

**Estado: parcialmente completada.** Se demostraron 102 de los 103 criterios dentro del alcance descrito. El criterio de instalación PWA permanece sin marcar y el Step 4 de Task 12 no está completo. La aprobación final corresponde al usuario.

### Entornos y límites

- Build de producción servido exclusivamente en loopback local. Playwright Chromium: escritorio de `1440 × 900` y Pixel 7 con emulación Android y eventos táctiles Chromium.
- Revisión interactiva y visual en el navegador integrado de Codex a `1440 × 900` y `412 × 915`: cabecera, marcos, pizarra completa, PNG proporcional, selección, fase y estados con texto, Cuaderno, cierre y continuidad del foco. Se comprobó que el script cargado era el build final `index-Bb8K_1k7.js`, después de renovar la caché del service worker.
- Instalación nativa Windows/Android y apertura desde una PWA instalada: **pendientes**. La herramienta Computer Use se detuvo porque no pudo determinar con suficiente confianza la URL del navegador de Windows; no se continuó mediante esa herramienta. La emulación no demuestra instalación ni prueba en Android físico.
- Selector nativo de archivos: API simulada para permisos, cancelación y errores; descarga JSON, carga mediante input y lectura del archivo descargado comprobadas en navegador. El diálogo nativo del sistema no se verificó manualmente.
- Suspensión de temporizadores: marcas de tiempo y reloj simulado; no se verificó una suspensión física Android. Audio: MP3 real, reproducción, bucle y pausa comprobados por la API multimedia; no se comprobó audición en altavoces de un dispositivo físico.
- Offline: navegador sin red tras primera carga, control real del service worker, recarga y acceso a recursos locales, edición, autoguardado, descarga/carga JSON y recuperación. No se abrió el enlace externo de Maps ni se transfirieron documentos.

### Matriz final

Comando ejecutado:

```text
npm run lint && npm run typecheck && npm test -- --run && npm run build && npm run e2e -- --workers=2 --output=.vite/task12-verified-results
```

| Comprobación | Resultado y alcance |
| --- | --- |
| Lint | Código 0, sin errores ni advertencias de ESLint. |
| Tipos | Código 0, TypeScript sin errores. |
| Unitarias y componentes | 31 archivos, 503 pruebas aprobadas. Incluye las pruebas existentes de las tareas 1–11. |
| Producción | Código 0; manifiesto, service worker y 32 entradas de precaché generados. |
| Navegador | Código 0; 109 casos aprobados, 7 omitidos exclusivamente por ser táctiles en el proyecto escritorio; sus casos móviles pasan. Sin reintentos automáticos. |
| Diff y alcance | Diff de código y siete archivos nuevos de pruebas revisados; `git diff --check` correcto. Sin dependencias nuevas, funcionalidades adicionales, secretos ni endpoints de transferencia. |
| Recursos originales | Los 23 archivos existentes de `public/assets` conservan los SHA-256 iniciales. |
| Revisión visual | Capturas y controles de escritorio y viewport móvil inspeccionados; además, capturas de las suites de pizarra, elementos, reloj y coordenadas. |

La compilación mantiene la advertencia de Vite por el bundle JavaScript de aproximadamente `1,16 MB` minificado, superior a `500 kB`. No impide compilar y no se realizó una refactorización para resolverla.

### Correspondencia de criterios con evidencia

| Sección | Evidencia ejecutada |
| --- | --- |
| 1. Arranque, cabecera y documentos | `smoke.spec.ts`, `files-and-autosave.spec.ts`, `document-flow.spec.ts`, `accessibility.spec.ts`; pruebas de documento/Schema, store y adaptador de archivos. Instalación nativa pendiente. |
| 2. Autoguardado y recuperación | `files-and-autosave.spec.ts`, `document-flow.spec.ts`, `offline.spec.ts`, `timers.spec.ts`; pruebas de repositorio IndexedDB y store con errores y recuperación tardía. |
| 3. Sistema modular y móvil | `layout-and-touch.spec.ts`, `mobile-board.spec.ts`, `accessibility.spec.ts`; pruebas de colocación, grid y viewport. Orientación y tacto comprobados mediante emulación. |
| 4. Pizarra | `board.spec.ts`, `mobile-board.spec.ts`; pruebas de imagen, reducer y componente, incluidos límites de 50 MiB/4096 px y conservación ante fallos. |
| 5. Elementos y pines | `elements.spec.ts`, `document-flow.spec.ts`, `accessibility.spec.ts`; pruebas de comandos, catálogo y pin. |
| 6. Información, operativo y registro | `task7-operations.spec.ts`, `operational-flow.spec.ts`, `accessibility.spec.ts`; pruebas de estados, anotaciones, registro y componentes. |
| 7. Reloj y alertas | `task8-clock.spec.ts`, `timers.spec.ts`, `accessibility.spec.ts`; pruebas de motor, repositorio, controlador de alarma y componente. Límites de suspensión/audio indicados arriba. |
| 8. Coordenadas, calculadora y cuaderno | `task9-coordinates.spec.ts`, `task10-calculator.spec.ts`, `task11-notebook.spec.ts`, `offline.spec.ts`, `accessibility.spec.ts`; pruebas de conversiones, expresiones y comandos de Cuaderno. |
| 9. Diseño, accesibilidad y calidad | `smoke.spec.ts`, `accessibility.spec.ts`, matriz final, revisión visual y comparación SHA-256. Inspección de accesos de red: solo enlace de Maps definido por V1 y referencia declarativa al JSON Schema. |

### Defectos corregidos y TDD

La prueba inicial de cierre de módulos mostró pérdida de foco al desmontar el botón activo. Una revisión independiente detectó el mismo incumplimiento en editores y borrados. Se escribieron seis regresiones adicionales antes de corregir esos flujos: los 12 casos escritorio/móvil fallaron por falta de foco en el destino esperado. Tras los cambios, los 18 casos de accesibilidad y la matriz completa pasan.

Las correcciones recuperan foco en `Ver`, `Configurar elementos`, `Nueva etiqueta`, los botones de añadir de Cuaderno, `Acontecimiento`, la herramienta activa de pizarra, el cierre de Información o el estado operativo actual. Solo las acciones del propio módulo transfieren foco al seleccionar desde sus listas.

Durante una ejecución completa apareció una carrera de la prueba entre Escape y Tab del menú Archivo. Se corrigió esperando que el menú restaurara realmente el foco antes de enviar Tab; no se fuerza foco ni se oculta la aserción. La repetición completa terminó correctamente.

### Archivos de esta entrega

- Creados: `tests/e2e/document-flow.spec.ts`, `operational-flow.spec.ts`, `timers.spec.ts`, `mobile-board.spec.ts`, `offline.spec.ts`, `accessibility.spec.ts` y `acceptance-helpers.ts`.
- Modificados por defectos de foco: `src/app/App.tsx`; `src/features/view/ViewMenu.tsx`; `src/features/elements/ElementsModule.tsx`; `src/features/information/InformationModule.tsx`; `src/features/operations/OperationsModule.tsx` y `UnitTags.tsx`; `src/features/timeline/TimelineModule.tsx`; `src/features/board/BoardModule.tsx` y `BoardToolbar.tsx`; `src/features/notebook/NotebookModule.tsx` y `ChecklistBlock.tsx`.
- Documentación: `ACCEPTANCE_CRITERIA.md`, con checks y evidencia de alcance. `IMPLEMENTATION_PLAN.md` permanece intacto.
- Evidencia local ignorada por Git: `.vite/task12-verification`, resultados Playwright en `.vite/task12-verified-results` e informe HTML en `playwright-report/index.html`.
- Dependencias instaladas: ninguna.
- Sin escrituras sobre Git, despliegues ni publicaciones. La siguiente actuación requiere aprobación expresa.

## 11. Criterios vigentes de la revisión adaptativa — 2026-10-02

Estos criterios corresponden al esquema actualizado y al diseño aprobado. Su implementación y sus pruebas se realizan en las entregas 2–9 del plan activo. La entrega 1 es documental: no marca ninguno como verificado. La aceptación de la revisión también exige comprobar de nuevo los comportamientos conservados de la V1 que dependan del producto integrado.

### 11.1. Contrato y continuidad del trabajo

- [ ] El formato vigente es `angie-dashboard`, versión `2`, con las ocho propiedades raíz aprobadas y sin `filters`, validación estricta y serialización de dos espacios con salto final.
- [ ] Notas rápidas guardan dimensiones, emojis guardan escala, bloques de Cuaderno guardan título y geometrías de módulos guardan `referenceSize`, con tipos, valores y límites exactos del esquema.
- [ ] Las coordenadas nuevas de pizarra admiten valores finitos no negativos superiores a `1000`; se rechazan negativos, no finitos y propiedades desconocidas.
- [ ] Un V1 real se valida íntegramente antes de convertirlo a V2 y el resultado se valida antes de sustituir el documento activo.
- [ ] La conversión conserva UUID, fechas, textos, estados, etiquetas, trazos, posiciones y orden; añade notas `180 × 80`, emojis a escala `1`, títulos predeterminados y referencias de módulo `1600 × 1000`.
- [ ] La retirada del filtro conserva y muestra todas las dotaciones, incluidas las ocultas en el documento V1.
- [ ] Carga JSON y recuperación IndexedDB reconocen V1; el archivo original no se modifica, la base local no se borra/recrea y los temporizadores conservan su repositorio independiente.
- [ ] Un documento dañado, ajeno, desconocido o futuro conserva intacto el documento activo al rechazarse; no existe una conversión ficticia para V0.
- [ ] Guardar exporta V2 validado y se documenta que una app antigua que solo conozca V1 lo rechaza como versión futura; no existe exportación hacia V1.
- [ ] El JSON y el autoguardado del documento mantienen sus exclusiones: imagen temporal, temporizadores, selección, visibilidad, apilamiento, cámaras y otros estados transitorios.

### 11.2. Dashboard y adaptación entre dispositivos

- [ ] El espacio principal llena el área bajo la cabecera sin proporción fija, bandas reservadas ni reducción automática de toda la interfaz; no aparece scroll de página.
- [ ] Los nueve módulos comienzan cerrados, se abren desde Ver, respetan sus nombres/mínimos y conservan desplazamiento interno cuando sea necesario.
- [ ] Abrir, mover y redimensionar permite superposición sin empujar, mover ni redimensionar otros módulos.
- [ ] Pulsar o enfocar una ventana la lleva al frente y conserva el orden relativo de las restantes; el apilamiento no se persiste.
- [ ] Una posición guardada ocupada se restaura adaptada; una ventana nueva sin hueco abre con tamaño inicial adaptado y accesible, sin estado excepcional ni aviso de falta de espacio.
- [ ] La adaptación conserva tamaño cuando cabe y el anclaje proporcional definido; limita dimensiones cuando no caben, respetando mínimos y usando extensión virtual únicamente si el área física es menor que ellos.
- [ ] Medir, girar o cambiar pantalla no reescribe geometrías persistentes; volver al área de referencia recupera los valores guardados si no hubo gestos explícitos intermedios.
- [ ] Un arrastre o resize explícito guarda geometría y referencia actuales, sin guardar distribución móvil independiente.
- [ ] La vista principal empieza a `100 %`, permite `100–400 %` y Encajar restaura esa vista adaptada sin cambiar geometrías ni aplicar el antiguo encaje de `1600 × 1000`.
- [ ] La cabecera queda fuera de zoom/desplazamiento y los gestos principales mantienen una vista válida sin acciones accidentales ni scroll de página.

### 11.3. Pizarra, notas y gestos

- [ ] El viewport de pizarra llena el rectángulo bajo la barra de herramientas; dibujar, colocar pines o notas puede utilizar toda la región visible sin cuadrado interior obligatorio.
- [ ] Redimensionar el módulo conserva trazos, posiciones, tamaños y proporciones del contenido; los límites permiten recuperar las cajas completas fuera de vista.
- [ ] La pizarra empieza a escala `1`, centrada en las cajas del contenido existente o en el origen si está vacía; su vista temporal admite zoom `0.25–4` y transformaciones uniformes para Konva y objetos HTML.
- [ ] Rueda, Mayús+rueda, Ctrl+rueda y botón central manejan desplazamiento/zoom de pizarra conforme al esquema, sin modificar datos persistentes por navegar.
- [ ] Dos dedos dentro de pizarra afectan solo su navegación y fuera afectan solo el dashboard; un gesto entre superficies se cancela y nunca confirma trazos, movimientos o resize residuales.
- [ ] Los cuatro modos conservan selección y pulsación mantenida `250 ms`, la goma afecta solo trazos y crear una nota retorna a Seleccionar/mover.
- [ ] La barra usa una fila de iconos y controles en el orden aprobado, sin las etiquetas visibles redundantes, con ayudas/nombres accesibles y desplazamiento horizontal interno en tamaño mínimo.
- [ ] Las notas nuevas comienzan `220 × 96`, se redimensionan hasta un mínimo `120 × 64` y guardan dimensiones, texto y centro; el resize conserva el centro y no escala el texto.
- [ ] Las notas permiten mover, editar y eliminar; su texto es legible, se distribuye en líneas y puede desplazarse internamente si supera la caja.
- [ ] La imagen de fondo mantiene proporción y marco lógico de referencia estable `1000 × 1000` sin limitar el dibujo, y sigue siendo temporal/local; límites de `50 MiB`/`4096 px` y conservación ante fallo siguen funcionando.

### 11.4. Elementos e Información

- [ ] No existe la tuerca; Añadir, Modificar, Duplicar y Quitar son siempre visibles y las tres últimas están deshabilitadas sin selección.
- [ ] La previsualización conjunta de icono/emoji y nombre cambia visualmente al mover el deslizador antes de crear o guardar, sin reencajar cada tamaño y ocultar su efecto.
- [ ] Cancelar descarta todo el borrador, incluida escala, sin mutar ni autoguardar el elemento; Guardar elemento aplica conjuntamente su configuración.
- [ ] PNG y emoji usan escala común `0.25–3`, con tirador/deslizador sincronizados; el nombre base `16` escala con su representación y los tamaños se conservan al duplicar y recargar.
- [ ] Los PNG conservan catálogo, cajas, proporción, transparencia y contain; los emojis utilizan caja base `64 × 64` y glifo base `48`.
- [ ] Crear con pizarra abierta coloca en su centro visible sin mover objetos ni cambiar zoom; cerrada conserva posición inicial `500,500`, y cambiar documento descarta la cámara temporal anterior.
- [ ] Lista y pizarra muestran todas las dotaciones sin filtro de estados; Dotación sigue siendo inmutable y duplicar/eliminar conservan las reglas operativas y cronológicas aprobadas.
- [ ] Información muestra el estado exacto con badge de color, información libre, fase y etiquetas de la dotación seleccionada; sin selección/general mantiene el comportamiento correspondiente.

### 11.5. Coordenadas y Calculadora

- [ ] Coordenadas elimina las dos indicaciones redundantes, conservando nombre accesible del campo, prefijos de resultados, entrada, validación y conversiones DD/DMS/DMM/UTM.
- [ ] Pulsar o activar por teclado una fila válida copia solo el valor canónico, sin prefijo, nuevos botones ni texto visible; una fila no disponible no copia.
- [ ] Maps es un hipervínculo real que abre en otra pestaña y Copiar enlace sigue copiando su URL; comprobar la acción con navegación interceptada no se presenta como acceso real a Google Maps.
- [ ] Calculadora elimina la etiqueta visible Operación, conserva el nombre accesible y todas sus operaciones, precedencias, porcentajes y errores; cifras y botones se adaptan con los roles tipográficos comunes.

### 11.6. Reloj

- [ ] La franja superior muestra exactamente `Digital Watch | UTC+2 [ST] | UTC+1 [WT] ESP`, con referencias informativas y cambio estacional automático de la hora española.
- [ ] La hora principal usa `HH:MM:SS` y debajo aparece `Zulu Time HH:MM` con cifras menores; sus separadores HH/MM difieren horizontalmente como máximo `1 px` en los tamaños mínimo, inicial y ampliado.
- [ ] T-Zero, T-Minus y Advisories aparecen sin prefijos `+`, en una fila con `▶ Sonido` a la derecha; durante la prueba se muestra `⏸ Sonido` y su nombre accesible expresa la acción.
- [ ] El único control de prueba mantiene bucle, parada al cerrar, prioridad de alarma real, deshabilitación durante alertas y tratamiento de bloqueo/error; temporizadores, normalización y alertas conservan sus reglas.
- [ ] El acabado táctico y su tipografía adaptable mantienen legibles cifras y alarmas, sin nuevas fuentes externas.

### 11.7. Cuaderno

- [ ] Nota y Checklist son botones directos; cada bloque tiene título editable y persistente con su valor inicial correspondiente, sin extraer o perder contenido anterior.
- [ ] Notas e ítems vacíos comienzan con una fila; su altura crece y se contrae según contenido y se recalcula al cargar o cambiar anchura.
- [ ] El tirador es una barra lateral de dos líneas finas, con nombre accesible; reordenar por tacto solo empieza allí y no interfiere con edición o desplazamiento de la lista.
- [ ] Cada ítem tiene `+` y `×` junto al texto: añadir inserta inmediatamente después, eliminar retira solo ese ítem y el checklist vacío permite crear el primero.
- [ ] El cierre de bloque elimina solo ese bloque, conserva foco válido y no se confunde con eliminar ítem; títulos vacíos/largos, checklist y orden se conservan en autoguardado/recarga.

### 11.8. Integración, tipografía y evidencia final

- [ ] Todos los módulos aplican tokens comunes por función y espacio: cuerpo/controles `13–16 px`, títulos `15–18 px`, datos compactos `12–16 px`, con jerarquía mayor adaptable para reloj/calculadora y reglas propias de la escena.
- [ ] Roboto Condensed sigue cargando localmente, los datos técnicos mantienen monoespaciada y los controles de icono tienen nombres accesibles, foco visible y manejo por teclado.
- [ ] Los flujos conservados de documento, selección compartida, Operativo, anotaciones, etiquetas, registro y Deshacer siguen funcionando después de los cambios integrados.
- [ ] Nuevo/Cargar/Guardar conservan temporizadores; recarga, autoguardado y offline funcionan con V1 convertido y V2, sin transferencias de datos a servidores.
- [ ] Los SHA-256 de PNG, MP3 y fuentes originales coinciden con el registro previo a cambios de producto; la única dependencia nueva es la autorizada para Lucide.
- [ ] Pruebas unitarias/de componentes, lint, tipos, build y E2E del producto revisado terminan correctamente con evidencia fresca; se informa el número real de casos y skips.
- [ ] Se inspeccionan visualmente build/caché vigentes, escritorio, móvil vertical/horizontal y ventanas mínimas/iniciales/ampliadas, sin confundir capturas o emulación con prueba física.
- [ ] Instalación PWA, dispositivo real, selector nativo, suspensión Android y audición en altavoces se registran solo si se comprueban; la revisión no hereda una aceptación manual no demostrada.
- [ ] El diff final corresponde únicamente al alcance aprobado, sin escrituras Git, modificaciones de originales, despliegues ni publicaciones no autorizadas.

### 11.9. Evidencia de la revisión

Pendiente de las entregas de producto y de aceptación integrada. La sincronización documental de la entrega 1 no aporta resultados de ejecución de la aplicación ni habilita checks de esta sección.

## 12. Corrección de interfaz compacta — 2026-10-03

Los criterios 11 afectados por mínimos particulares, escala 100–400 %, cabecera fuera del zoom, composición HH:MM de Zulu y copia solo tras mostrar resultados quedan sustituidos por estos; no se modifica evidencia histórica.

- [x] Cabecera de una fila con chincheta, Título flexible, Puzzle y zoom editable 25–400 % aplicado a cabecera/dashboard.
- [x] Dashboard sin huecos superiores/izquierdos, zoom y cambios de tamaño sin recentrado ni mutación de geometrías guardadas.
- [x] Marcos con título fino exclusivo de arrastre, zoom propio de contenido/herramientas y cierre separado.
- [x] Tirador diagonal común, ventanas menores que antiguos mínimos, scroll y controles sin saltos; guardar/cargar preserva dimensiones.
- [x] Notas rápidas con ✔/✖, editar/eliminar a izquierda y resize separado.
- [x] Elementos compacto, información autoajustable desde una fila y preview sin altura vacía forzada.
- [x] Reloj con tres grupos alineados, hora principal mayor/ligera y Zulu Time HH:MM:SS compacto.
- [x] DD/DMS/DMM/UTM siempre visibles sin copiar valores ausentes.
- [x] Cuaderno estilizado conserva edición, autoaltura, reordenación y foco.
- [x] Unitarias, lint, tipos, build, navegador y revisión visual verificados con evidencia fresca; originales intactos.

Evidencia del 2026-10-04: [informe de cierre](docs/superpowers/plans/2026-10-03-interfaz-compacta.md). 595 unitarias; E2E 159 aprobados y 9 skips de tacto en escritorio; lint, tipos y build con salida 0. Móvil emulado, sin aceptación de dispositivo físico ni instalación PWA. La revisión expresa del usuario permanece pendiente.
