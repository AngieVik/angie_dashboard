# Angie Dashboard — esquema conceptual

> Este documento es la referencia del comportamiento funcional y visual aprobado de Angie Dashboard. Distingue el contrato base actual V1/V2, los cambios aprobados para la nueva revisión y las decisiones de implementación todavía pendientes.

> Antecedente de 2026-10-02: [diseño adaptativo](docs/superpowers/specs/2026-10-02-dashboard-adaptativo-design.md) y [plan histórico](docs/superpowers/plans/2026-10-02-dashboard-adaptativo.md). El producto actual utiliza JSON 2 y conserva V1 como importación reconocida. Sus entregas 1–8 tienen informes; la aceptación integrada de la entrega 9 conserva su pendiente histórico.


> Antecedente de 2026-10-03: [interfaz compacta y zoom](docs/superpowers/specs/2026-10-03-interfaz-compacta-design.md), [plan e informe histórico de 2026-10-04](docs/superpowers/plans/2026-10-03-interfaz-compacta.md). Sustituyó las reglas de cabecera fuera del zoom, escala mínima 100 %, margen elástico, mínimos particulares y composición del reloj. Sus resultados se conservan con su alcance original.

### Nueva revisión — 2026-10-05

La revisión activa se rige por el [plan de revisión](docs/archive/plan.md), el [catálogo definitivo de estados y fases](docs/archive/estados_fase.md) y la [maqueta de estilo](docs/archive/prueba-estilo.html). Estas tres referencias de `docs/archive` están expresamente autorizadas; el resto de la carpeta continúa siendo histórico. La petición actual define el alcance y puede sustituir acuerdos anteriores.

Los apartados 1–14 conservan el contrato base del producto actual. Las sustituciones expresas del nuevo plan describen cambios aprobados que todavía deben implementarse y verificarse; prevalecen sobre las reglas base afectadas y conservan las demás. La maqueta define el acabado visual: sus datos, formularios simplificados, temporizadores de ejemplo y rótulos no se incorporan al producto.

| Área | Base actual | Cambio aprobado pendiente |
| --- | --- | --- |
| Documento y módulos | JSON 2, lector V1 y nueve módulos; Elementos contiene dotaciones y generales. | JSON 3, cadena 1 → 2 → 3 y módulo Dotaciones independiente (fase 2). |
| Estados | Ocho valores V1/V2 del apartado 9. | Catálogo de `estados_fase.md`, incluida la grafía exacta `Aproximandose`; conversión de campos estructurados sin modificar texto libre (fases 2 y 8). |
| Apariencia y controles | Interfaz compacta de la primera etapa. | Estilo de la maqueta y ocho componentes aprobados el 2026-10-05, composición Radix con CSS/tokens propios, sin Tailwind ni presets (fases 3–11). |
| Superficies y Puzzle | Adaptación de geometrías; Puzzle restaura 100 % y origen. | Extensión hacia derecha/abajo y Puzzle recoloca solo abiertos al ancho lógico visible, manteniendo zoom y tamaños (5A). |
| Notas y pines | Notas sin título/escala de contenido; pines sin visibilidad persistente. | Creación/edición en sitio, título/escala de nota y visibilidad del pin persistentes (fases 2, 5C y 6). |
| Reloj | Base 440 × 480 y temporizadores independientes del JSON. | Base 440 × 260, crecimiento por contenido separado de preferencia manual persistente (fase 7). Los temporizadores siguen fuera del JSON. |
| Registro | Entradas manuales editables y cambios automáticos con Deshacer. | Edición, eliminación/corrección explícita, historial conservado y marca Actual por unidad; retirada de Deshacer (fase 9). |
| Coordenadas | Cuatro formatos copiables, enlace externo de Maps y Copiar enlace. | Cinco filas copiables, Maps copia URL sin navegación externa (fase 10). |

La fase 1 debe concretar y someter a revisión el contrato V3, geometrías/Puzzle, navegación y borradores, iconos antiguos, ocupación/fallback y edición/escala de notas, estado inicial/de origen e historial del registro, persistencia, integración shadcn y tamaño manual/presentación del Reloj. Esta fase 0 no elige campos, algoritmos ni ejemplos pendientes, ni convierte esos casos en obligaciones nuevas. Las rutas de especificación y plan definitivos se registrarán en el cierre de fase 1 una vez entregados.

El cierre de la primera etapa comunicado por el usuario se registra como antecedente de esta revisión, sin completar automáticamente la aceptación integrada adaptativa ni sus checks. La instalación PWA en el móvil fue comprobada por el usuario el **2026-10-04**, según el plan autorizado. Esta evidencia no demuestra apertura offline física, instalación Windows, selector nativo, suspensión Android, audición en altavoces ni los nuevos flujos; los informes técnicos anteriores conservan sus límites de emulación.

## 1. Propósito

Angie Dashboard será una herramienta operativa configurable para una sola persona. Permitirá preparar los recursos antes de un servicio y utilizar durante este una pizarra, elementos móviles y distintos módulos de apoyo.

Funcionará como una herramienta personal de apoyo y organización, equivalente en finalidad a una libreta de trabajo o un tablero físico. No sustituirá los registros, informes o documentos oficiales que correspondan.

La aplicación funcionará en Windows y Android, incluido el teléfono móvil, como una PWA instalable con una única base de código y una misma interfaz.

## 2. Principios definidos

- Uso individual, sin cuentas ni colaboración entre usuarios.
- No se diseñará como sistema oficial de registro, auditoría o certificación de actuaciones.
- El usuario conservará el control y la responsabilidad sobre la veracidad de los datos introducidos.
- Enfoque local-first: las funciones principales no dependerán de Internet.
- Se presupone que normalmente habrá conexión disponible, por lo que los módulos que lo necesiten podrán utilizar Internet.
- Una pérdida de conexión no deberá bloquear la pizarra, los elementos, estados, notas ni el documento activo; solo afectará a las funciones que dependan expresamente de la red.
- Sistema modular con paneles que puedan mostrarse u ocultarse y organizarse dentro del espacio disponible.
- Configuración previa al comienzo de cada servicio.
- Documento de trabajo guardable y recuperable en formato JSON.
- Acciones visibles de `Nuevo`, `Guardar` y `Cargar`.
- No se utilizará el concepto anterior de «nueva sesión que borra automáticamente lo anterior».

## 3. Cabecera y nombre del documento

- La aplicación tendrá una barra de título siempre visible en la cabecera.
- La cabecera incluirá un menú `Archivo` para las acciones relacionadas con el documento.
- `Archivo` incluirá al menos `Nuevo`, `Cargar` y `Guardar`.
- La V1 no incluirá una acción `Cerrar`; la ventana o la PWA se cerrará mediante los controles del sistema.
- La cabecera incluirá un menú `Ver` desde el que se podrán abrir o cerrar todos los módulos.
- El estado visible u oculto de cada módulo se reflejará en el menú `Ver`.
- El título será editable.
- El título se utilizará como base para proponer el nombre del archivo JSON al guardarlo. El saneamiento del nombre de archivo no modificará el título visible ni el valor almacenado en el documento.
- Para obtener el nombre de archivo se eliminarán los caracteres de control y los caracteres `<>:"/\|?*`, además de los espacios y puntos situados al final. Se conservarán las letras acentuadas, los espacios interiores, los guiones y los guiones bajos.
- Si el título saneado ya termina en `.json`, sin distinguir mayúsculas y minúsculas, se retirará temporalmente esa extensión para validar el nombre base. Después se añadirá `.json` exactamente una vez.
- Si el nombre base queda vacío o coincide, sin distinguir mayúsculas y minúsculas, con `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9` o `LPT1`–`LPT9`, se utilizará `drp_YYYY-MM-DD_HH-mm-ss.json`, generado con la fecha y hora local del dispositivo en formato de 24 horas y con todos los bloques numéricos completados con cero a la izquierda; por ejemplo, `drp_2026-09-30_18-42-15.json`.
- La aplicación no intentará inspeccionar las carpetas del usuario para detectar nombres repetidos; la confirmación de sobrescritura o la creación de un nombre alternativo corresponderá al selector nativo, al navegador o al sistema operativo.

## 4. Guardado y recuperación

### Requisito funcional definido

- El estado de trabajo se guardará en un documento JSON.
- El documento podrá guardarse, cargarse y reutilizarse otro día como configuración de partida o como continuación del trabajo.
- La posición de los pines deberá formar parte del estado guardado.
- El texto y la posición de las notas rápidas de pizarra deberán formar parte del estado guardado.
- El color de fondo seleccionado para la pizarra formará parte del estado guardado.
- La imagen JPG o PNG cargada como fondo será un recurso temporal de la sesión: no se guardará su ruta ni su contenido en el JSON o en el guardado automático interno.
- Después de cerrar o recargar la aplicación, o de cargar un documento, el usuario volverá a seleccionar manualmente la imagen local si desea utilizarla otra vez.
- Los trazos sencillos del canvas podrán incluirse en el estado guardado.
- Los datos de los módulos deberán conservarse dentro del documento cuando correspondan al trabajo activo.
- El Módulo Reloj queda excluido del archivo JSON importable y exportable.
- El JSON no incluirá el reloj, `T-Zero`, `T-Minus`, `Advisories`, sus notas ni sus estados de ejecución.
- Cargar un JSON no creará ni restaurará relojes o temporizadores procedentes del archivo.
- La recuperación automática interna de temporizadores tras una suspensión o cierre accidental será independiente del contenido del JSON visible.
- Las acciones `Guardar`, `Cargar` y `Nuevo` no detendrán, reiniciarán ni eliminarán los relojes o temporizadores que estén activos.
- Los relojes y temporizadores se gestionarán y cerrarán individualmente desde el Módulo Reloj.
- Existirá un único documento activo.
- El documento activo tendrá guardado automático interno.
- `Guardar` actualizará o exportará el JSON visible.
- `Cargar` abrirá otro JSON.
- `Nuevo` creará un documento vacío sin borrar archivos anteriores.

### Contenido definido del JSON

El JSON incluirá:

- Versión del formato y título del documento.
- Color de fondo de la pizarra.
- Trazos del lápiz.
- Texto y posición de las notas rápidas.
- Elementos: nombre, identificador del archivo de icono o emoji, información, posición y valor del checkbox `Dotación`.
- Estado operativo, anotaciones y etiquetas de las dotaciones.
- Cuaderno: notas, checklist, elementos marcados y orden de los bloques.
- Registro cronológico completo.
- Posición y tamaño de los módulos.

El JSON no incluirá:

- La imagen de fondo de la pizarra ni su ruta local.
- Los archivos PNG; solo se conservará el identificador del icono elegido.
- Ningún dato del Módulo Reloj.
- La operación actual de la calculadora.
- Las coordenadas introducidas, sus conversiones o el enlace generado.
- El elemento seleccionado en ese momento.
- El zoom o la posición actual de la vista, que dependerán del dispositivo.
- La visibilidad momentánea de los módulos; cada sesión comenzará con todos cerrados.
- Modales, menús, herramientas u otros estados momentáneos de la interfaz.

### Contrato JSON vigente: formato 2

El documento tendrá exactamente ocho propiedades raíz. El documento vacío utilizará esta estructura completa:

```json
{
  "format": "angie-dashboard",
  "formatVersion": 2,
  "document": {
    "id": "00000000-0000-4000-8000-000000000000",
    "title": "",
    "createdAt": "2026-09-30T18:42:15.000Z",
    "updatedAt": "2026-09-30T18:42:15.000Z"
  },
  "board": {
    "backgroundColor": "#25282B",
    "strokes": [],
    "quickNotes": []
  },
  "elements": [],
  "notebook": [],
  "timeline": [],
  "moduleLayouts": {}
}
```

- `format` tendrá siempre el valor literal `angie-dashboard`.
- `formatVersion` tendrá el valor entero `2` para este contrato.
- Todos los objetos utilizarán validación estricta y rechazarán propiedades desconocidas mediante `additionalProperties: false`.
- Todos los campos de cada objeto presente serán obligatorios, aunque su valor sea `""`, `[]` o `null`; la única excepción serán las nueve claves conocidas y opcionales de `moduleLayouts`, donde la ausencia de una clave significará que ese módulo aún no tiene distribución guardada.
- Los identificadores se generarán mediante `crypto.randomUUID()` y se validarán como UUID.
- Todos los objetos persistentes que puedan identificarse individualmente tendrán su propio `id`: documento, trazos, notas rápidas, elementos, bloques del Cuaderno, ítems de checklist y entradas cronológicas.
- Las fechas se guardarán como cadenas ISO 8601 en UTC terminadas en `Z`; `createdAt` no cambiará y `updatedAt` se actualizará con cada modificación persistente del documento.
- Los colores se normalizarán como cadenas hexadecimales opacas en formato `#RRGGBB`.
- Todos los números deberán ser finitos.

#### `document`

`document` contendrá exactamente `id`, `title`, `createdAt` y `updatedAt`.

- `title` será una cadena y podrá estar vacía.
- `updatedAt` nunca será anterior a `createdAt`.

#### `board`

La pizarra mostrará una región rectangular que ocupa todo el módulo bajo su barra de herramientas, sobre una escena de coordenadas estables. Redimensionar el módulo cambiará el área visible sin reescalar ni modificar trazos, posiciones o dimensiones de los objetos. El desplazamiento y el zoom propios permitirán recuperar el contenido fuera de vista; el color de fondo cubrirá toda el área útil. No habrá un cuadrado interior obligatorio ni un máximo de coordenadas de `1000` para contenido nuevo.

`board` contendrá exactamente `backgroundColor`, `strokes` y `quickNotes`. El color inicial será `#25282B`.

Un trazo de lápiz utilizará:

```json
{
  "id": "UUID",
  "tool": "pen",
  "color": "#D63A3A",
  "width": 4,
  "points": [
    { "x": 120.5, "y": 340.25 }
  ]
}
```

Un trazo de goma utilizará los mismos campos con `tool: "eraser"` y `color: null`.

- `tool` solo admitirá `pen` o `eraser`.
- `width` será un número positivo.
- `points` contendrá uno o más objetos con exactamente `x` e `y`.
- Las coordenadas de cada punto serán números finitos no negativos, sin el máximo cuadrado obligatorio de `1000`.

Una nota rápida utilizará:

```json
{
  "id": "UUID",
  "text": "Acceso norte",
  "position": { "x": 500, "y": 350 },
  "width": 220,
  "height": 96
}
```

- `position` representará el centro de la nota.
- Sus coordenadas serán números finitos no negativos.
- Cada nota contendrá exactamente `id`, `text`, `position`, `width` y `height`. Sus dimensiones serán números finitos, con mínimos `width: 120` y `height: 64`; las nuevas comenzarán en `220 × 96`.
- Las notas importadas del formato V1 recibirán `180 × 80`, sin alterar el texto ni el centro.

#### `elements`

Cada elemento utilizará exactamente:

```json
{
  "id": "UUID",
  "name": "Tango 1",
  "visual": {
    "type": "asset",
    "assetId": "ambulance",
    "scale": 1
  },
  "information": "TES: Pichu",
  "position": { "x": 420, "y": 610 },
  "isUnit": true,
  "operational": {
    "status": "Disponible",
    "notes": "",
    "tags": []
  }
}
```

- `name` contendrá al menos un carácter que no sea un espacio.
- `information` será una cadena libre y podrá estar vacía.
- `position` será `null` mientras el pin no tenga ubicación o un objeto con exactamente `x` e `y`, números finitos no negativos; representará el centro del pin. El contenido nuevo no tendrá el máximo cuadrado obligatorio de `1000`.
- `isUnit` corresponderá al checkbox visible `Dotación`.
- `isUnit` se decidirá al crear el elemento y será inmutable: una dotación no podrá convertirse en general y un elemento general no podrá convertirse en dotación.
- Si `isUnit` es `false`, `operational` será obligatoriamente `null`.
- Si `isUnit` es `true`, `operational` contendrá exactamente `status`, `notes` y `tags` y una dotación nueva comenzará como `Disponible`.
- `status` solo admitirá `Disponible`, `Asignada`, `En camino`, `En el lugar`, `En traslado`, `En destino`, `Operativa` o `Inoperativa`.
- La fase no se guardará: se obtendrá de manera inequívoca a partir de `status`.
- `notes` será una cadena libre y podrá estar vacía.
- `tags` será una lista de cadenas que contengan al menos un carácter que no sea un espacio. Se eliminarán los espacios iniciales y finales y no se admitirán duplicados aunque solo difieran en mayúsculas y minúsculas; se conservará la escritura original de la etiqueta aceptada.

La representación mediante un PNG utilizará exactamente:

```json
{
  "type": "asset",
  "assetId": "ambulance",
  "scale": 1
}
```

- `assetId` solo admitirá `ambulance`, `pathfinder`, `quad`, `checkpoint`, `hydration`, `start`, `finish`, `warning` o `pushpin`.
- `scale` será un número comprendido entre `0.25` y `3`, ambos inclusive.

La representación mediante emoji utilizará exactamente:

```json
{
  "type": "emoji",
  "value": "🚑",
  "scale": 1
}
```

- `value` será una cadena no vacía.
- `scale` estará entre `0.25` y `3`, igual que para los PNG. La caja base del emoji será `64 × 64`, con glifo base de `48`; el nombre base será de `16` y se escalará conjuntamente.
- Las variantes `asset` y `emoji` solo admitirán sus campos respectivos.

#### `notebook`

Un bloque de nota utilizará exactamente:

```json
{
  "id": "UUID",
  "type": "note",
  "title": "Nota",
  "text": "Acceso norte cerrado"
}
```

Un bloque de checklist utilizará exactamente:

```json
{
  "id": "UUID",
  "type": "checklist",
  "title": "Checklist",
  "items": [
    {
      "id": "UUID",
      "text": "Comprobar canal de radio",
      "checked": false
    }
  ]
}
```

- El orden de los bloques y de los ítems será el orden de sus arrays; no se añadirá un campo `order` redundante.
- Los textos podrán estar vacíos mientras se editan.
- Cada bloque tendrá un `title` editable que podrá estar vacío durante edición. Los valores iniciales serán `Nota` y `Checklist`; no se extraerá la primera línea del contenido para generarlos.
- Las variantes `note` y `checklist` solo admitirán sus campos respectivos.

#### `timeline`

Una entrada manual utilizará exactamente:

```json
{
  "id": "UUID",
  "type": "manual",
  "occurredAt": "2026-09-30T18:42:15.000Z",
  "text": "Acceso norte cerrado"
}
```

Una entrada automática utilizará exactamente:

```json
{
  "id": "UUID",
  "type": "status-change",
  "occurredAt": "2026-09-30T18:45:10.000Z",
  "unitId": "UUID",
  "unitName": "Tango 1",
  "previousStatus": "Asignada",
  "nextStatus": "En camino"
}
```

- Las entradas se conservarán en orden cronológico ascendente.
- Editar una entrada manual no cambiará `occurredAt`.
- Las entradas automáticas no serán editables.
- `unitName` será una copia del nombre visible en el momento del cambio para mantener la entrada legible si la dotación se renombra o elimina.
- `unitId` identificará la dotación que originó el cambio, pero podrá dejar de resolver a un elemento existente cuando esa dotación se elimine; esta situación no invalidará el historial conservado.
- `previousStatus` y `nextStatus` utilizarán los ocho valores exactos definidos para `status`.
- `Deshacer` restaurará `previousStatus` y eliminará la entrada automática; las condiciones operativas para permitirlo se definen en el apartado del Registro cronológico.

#### `moduleLayouts`

`moduleLayouts` podrá contener únicamente las claves `board`, `elements`, `information`, `operations`, `coordinates`, `clock`, `calculator`, `notebook` y `timeline`. Un módulo sin distribución guardada no aparecerá en el objeto.

Cada distribución contendrá exactamente:

```json
{
  "x": 40,
  "y": 30,
  "width": 720,
  "height": 480,
  "referenceSize": { "width": 1600, "height": 1000 }
}
```

- `x`, `y`, `width` y `height` serán enteros expresados en el área de trabajo en la que el usuario colocó o redimensionó la ventana. La geometría contendrá también `referenceSize`, con exactamente `width` y `height`, enteros positivos.
- La posición será no negativa y, junto con las dimensiones, mantendrá el módulo dentro de su `referenceSize`, respetando el tamaño mínimo correspondiente. La referencia incluye una extensión virtual mínima cuando el área física es menor que ese mínimo.
- En otra pantalla se presentará la geometría adaptada conforme al apartado 12, sin reescribirla por una medición o cambio de orientación. Un gesto explícito de colocación o redimensión sí guardará geometría y referencia actuales.
- En el ejemplo, `1600 × 1000` representa la referencia añadida a una geometría importada de V1, no un tamaño obligatorio del espacio principal vigente.
- No se guardarán la visibilidad, el orden de apilamiento ni el estado activo.

#### Compatibilidad con el formato V1 real

- El contrato de importación V1 conserva sus nueve propiedades raíz, incluido `filters`, notas sin dimensiones, emojis sin escala, bloques de Cuaderno sin título y geometrías sin referencia. Sus límites originales son `1000 × 1000` para pizarra y `1600 × 1000` para módulos.
- Se validará íntegramente con el esquema V1 existente y sus reglas semánticas antes de convertirlo. Un V1 dañado se rechazará, no se reparará durante la conversión.
- La conversión reconocida `1 → 2` trabajará sobre una copia, conservará UUID, fechas, textos, estados, etiquetas, trazos, posiciones y orden, y añadirá dimensiones de nota `180 × 80`, escala de emoji `1`, títulos `Nota`/`Checklist` y referencias de módulo `1600 × 1000`.
- Se eliminará únicamente `filters`, la configuración de una función retirada. Todas las dotaciones, incluidas las antes ocultas, se conservarán y mostrarán.
- El resultado se validará como formato 2 antes de reemplazar el documento activo. La carga JSON y la recuperación de IndexedDB usarán la misma conversión; no se borrará ni recreará la base local ni se modificará la de temporizadores.
- La conversión no modificará el archivo importado ni `updatedAt`. El autoguardado posterior podrá guardar el formato 2 validado y `Guardar` exportará únicamente ese formato.
- Una aplicación antigua que solo conozca V1 rechazará los JSON 2 como versión futura. No se añadirá exportación hacia V1 ni una conversión para V0 u otras versiones desconocidas.

#### Validación, migración y serialización

- Se mantendrá un esquema independiente basado en JSON Schema 2020-12.
- Los tipos discriminados `visual`, `notebook` y `timeline` se validarán como uniones estrictas; el formato vigente no admitirá `filters` ni otros campos desconocidos.
- También se validarán las relaciones `isUnit`/`operational` y `tool`/`color`, los límites de coordenadas y escala, los tamaños de módulos y el orden cronológico.
- La aplicación analizará y validará completamente un archivo antes de sustituir el documento activo.
- Un archivo dañado, ajeno a Angie Dashboard, con propiedades desconocidas o con relaciones incoherentes se rechazará completo y no se corregirá ni sobrescribirá automáticamente.
- Las versiones antiguas reconocidas se migrarán en memoria y se volverán a validar; el archivo original importado no se modificará.
- Si el archivo procede de una versión futura que la aplicación no reconoce, se mostrará un aviso y no se cargará.
- Después de una migración, el formato vigente solo se exportará cuando el usuario guarde el documento.
- Los errores indicarán la ruta problemática; por ejemplo, `elements[2].visual.scale debe estar entre 0.25 y 3`.
- El JSON se serializará con sangría de dos espacios y un salto de línea final.
- El orden de los arrays de Cuaderno, checklist y Registro cronológico se conservará.

### Decisión técnica de persistencia

Se combinarán ambas capas: guardado interno automático y archivo JSON importable y exportable.

En una PWA, la escritura sobre un archivo visible elegido por el usuario depende de los permisos y capacidades del navegador. `Guardar` seguirá este comportamiento:

- Cuando el navegador disponga de un selector de archivos compatible, el primer guardado abrirá ese selector con `<título_saneado>.json` como nombre sugerido.
- Si el documento ya está vinculado a un archivo, conserva el mismo título y el navegador mantiene el permiso, los guardados posteriores actualizarán directamente ese archivo.
- Si el título cambia, se abrirá de nuevo el selector con el nuevo nombre sugerido.
- Antes de escribir o descargar, la aplicación generará y validará completamente el JSON. Un error de serialización o validación no sustituirá el archivo anterior.
- Cancelar el selector no se considerará un error y no modificará el documento activo.
- Si el selector no está disponible, `Guardar` descargará el archivo JSON mediante el mecanismo normal del navegador.
- Si el selector falla por permisos u otro error, se conservará el trabajo activo y se ofrecerá la descarga del JSON como alternativa.
- El selector nativo, el navegador o el sistema operativo resolverán las confirmaciones de sobrescritura y los nombres repetidos.
- El autoguardado interno en IndexedDB será independiente del archivo visible y continuará funcionando aunque una exportación se cancele o falle.
- Si IndexedDB falla al leer, escribir o abrir su almacenamiento, la aplicación continuará funcionando con el documento activo en memoria y no se cerrará ni bloqueará el resto de funciones.
- El fallo mostrará un aviso persistente `Autoguardado no disponible` con las acciones `Reintentar` y `Guardar JSON`. El guardado JSON visible continuará disponible de manera independiente.
- La aplicación no borrará, reiniciará ni recreará automáticamente la base local como respuesta a un error, y nunca sustituirá el documento activo por datos recuperados sin confirmación del usuario.
- `Reintentar` repetirá la operación fallida utilizando el estado más reciente conservado en memoria. Si el error se produjo durante la recuperación inicial y aparecen datos locales mientras el documento activo ya contiene cambios, se solicitará confirmación antes de reemplazarlo.
- Cuando una lectura o escritura posterior finalice correctamente, se retirará el aviso. Mientras el error continúe, cada nuevo cambio permanecerá disponible en memoria y podrá exportarse mediante `Guardar JSON`.

### Protección y alcance de los datos

- La aplicación no se utilizará para almacenar datos clínicos ni datos de pacientes.
- La V1 no añadirá cifrado propio ni protección mediante contraseña.
- El archivo exportado será un JSON legible y recuperable con herramientas comunes.
- Cualquier persona con acceso al archivo podrá leer su contenido; la protección dependerá del dispositivo, su bloqueo y la ubicación elegida por el usuario para guardar el archivo.

## 5. Pizarra

- El área útil ocupará todo el rectángulo bajo la barra de herramientas. La escena conservará coordenadas y proporciones al cambiar el tamaño del módulo.
- La navegación propia tendrá escala inicial `1` y límites `0.25–4`. Al abrir con contenido se centrará en sus cajas a escala `1`; una pizarra vacía comenzará en el origen.
- Los límites de navegación tendrán en cuenta el contenido, sus cajas completas y el área visible, para recuperar objetos fuera de vista después de reducir el módulo.
- En escritorio, la rueda desplazará verticalmente, Mayús+rueda horizontalmente, Ctrl+rueda ampliará/reducirá alrededor del puntero y el botón central permitirá arrastrar la vista. En móvil, dos dedos dentro de la pizarra manejarán únicamente su navegación.
- Dos dedos fuera del área de dibujo manejarán únicamente la vista principal. Un gesto que cruce ambas superficies se cancelará hasta levantar los dedos; no se confirmará ningún trazo, movimiento o resize accidental.
- Su cámara será temporal y no se guardará en JSON ni en el autoguardado del documento.

- Será el espacio visual principal del dashboard.
- Permitirá elegir un color de fondo o cargar una imagen JPG o PNG.
- El color podrá recuperarse con el documento; la imagen cargada se mantendrá únicamente durante la sesión actual y deberá volver a elegirse cuando sea necesaria.
- La imagen se procesará localmente en el dispositivo y no se subirá a ningún servicio.
- La imagen se colocará proporcionalmente, centrada en un marco lógico de referencia `1000 × 1000`, estable al redimensionar y compatible con las anotaciones antiguas. Ese marco no limita el área de dibujo; el espacio libre utiliza el color de fondo. La navegación podrá dejar parte de la imagen fuera de vista, recuperable al desplazarse.
- Si su lado más largo supera `4096 px`, se creará en memoria una versión reducida de alta calidad que mantendrá la proporción original.
- El archivo JPG o PNG original no se modificará ni se sobrescribirá.
- Como protección frente a bloqueos por archivos excepcionales, la V1 rechazará imágenes superiores a `50 MiB` con un mensaje claro.
- Si la imagen no puede decodificarse o procesarse, la aplicación conservará el fondo anterior y mostrará el error sin cerrar la sesión.
- Dispondrá de una herramienta de lápiz con selector de color y grosor.
- Dispondrá de una goma de borrar que actuará exclusivamente sobre los trazos realizados con el lápiz.
- Se utilizará para anotaciones y trazos sencillos, no para dibujo avanzado.
- Sobre la pizarra se mostrarán y moverán los pines de los elementos.
- Permitirá añadir notas rápidas de texto breve que permanecerán visibles sobre la pizarra.
- Cada nota rápida podrá moverse como un pin, editarse y eliminarse. Confirmar y cancelar utilizarán ✔ y ✖ con nombres accesibles; editar y eliminar estarán juntos a la izquierda, separados del tirador inferior derecho.
- La nota rápida tendrá caja redimensionable por tirador: inicio `220 × 96`, mínimo `120 × 64`. Redimensionar mantendrá el centro y el tamaño base legible del texto; este se distribuirá en líneas y utilizará desplazamiento interno si supera la caja. No se añadirá formato avanzado ni colores configurables.
- La barra de herramientas de la pizarra tendrá cuatro modos explícitos: `Seleccionar/mover`, `Lápiz`, `Goma` y `Nota rápida`.
- La barra tendrá una sola fila compacta: iconos Lucide de selección, lápiz, goma y nota, seguidos de grosor sin esa palabra visible, color del lápiz y grupo `Fondo` con color y `JPG/PNG`. Mantendrá nombres accesibles, ayudas y navegación por teclado; en tamaño mínimo podrá desplazarse horizontalmente dentro del módulo.
- `Seleccionar/mover` será el modo predeterminado. Permitirá seleccionar elementos, mover pines y notas rápidas mediante pulsación mantenida, y deseleccionar tocando un espacio vacío.
- En modo `Lápiz`, los gestos dibujarán sobre el canvas y no seleccionarán ni moverán pines o notas rápidas.
- En modo `Goma`, los gestos borrarán exclusivamente trazos del lápiz y no manipularán pines o notas rápidas.
- `Nota rápida` permitirá crear y colocar una nota; después de hacerlo, la pizarra volverá automáticamente a `Seleccionar/mover`.
- Los pines y las notas rápidas permanecerán visibles en todos los modos, aunque solo responderán a los gestos cuando corresponda.

## 6. Pines e interacción

- La aplicación incluirá nueve modelos visuales aprobados y proporcionados como archivos PNG: ambulancia, Pathfinder, quad, CP, EH, START, FINISH, advertencia y chincheta.
- Un elemento podrá utilizar uno de esos iconos PNG o un emoji.
- El emoji será libre: el usuario podrá escribir o pegar cualquier emoji, sin limitarse a una lista cerrada.
- Cada elemento se representará mediante su icono o emoji y su nombre.
- Un clic o toque seleccionará el pin.
- El pin deberá poder moverse tanto con ratón como con interacción táctil.
- El movimiento se iniciará mediante un arrastre mantenido de `250 ms` para diferenciarlo de la selección.
- Seleccionar un elemento actualizará los módulos relacionados con él.

### Catálogo técnico de iconos PNG

Los nueve archivos originales permanecerán en la carpeta `public/assets/elements` sin renombrarse, redimensionarse ni modificarse. La aplicación utilizará identificadores internos estables, independientes del nombre físico de cada archivo.

| ID interno | Nombre visible | Archivo | Clase visual | Tamaño inicial lógico |
| --- | --- | --- | --- | --- |
| `ambulance` | Ambulancia | `icon_medical.png` | Horizontal | `150 × 100` |
| `pathfinder` | Pathfinder | `icon_vir.png` | Horizontal | `150 × 100` |
| `quad` | Quad | `icon_quad.png` | Horizontal | `150 × 100` |
| `checkpoint` | CP | `icon_cp.png` | Cuadrado | `100 × 100` |
| `hydration` | EH | `icon_eh.png` | Vertical | `100 × 150` |
| `start` | START | `icon_start.png` | Cuadrado | `100 × 100` |
| `finish` | FINISH | `icon_finish.png` | Horizontal | `150 × 100` |
| `warning` | Advertencia | `icon_peligro.png` | Cuadrado | `100 × 100` |
| `pushpin` | Chincheta | `icon_chincheta.png` | Cuadrado | `100 × 100` |

- Los tamaños del catálogo se expresarán en las unidades estables de la escena de pizarra; no describirán ni alterarán la resolución física de los archivos PNG.
- El catálogo utilizará exclusivamente tres clases visuales y sus cajas máximas: `Horizontal` con `150 × 100`, `Vertical` con `100 × 150` y `Cuadrado` con `100 × 100`.
- Cada entrada declarará explícitamente una de esas tres clases. Para añadir un icono nuevo se le asignará una clase existente y no se introducirán dimensiones iniciales particulares.
- El PNG se encajará mediante `contain`, centrado horizontal y verticalmente dentro de su caja máxima y conservando su proporción; nunca se deformará ni recortará, aunque no ocupe exactamente ambos lados.
- La posición del elemento representará siempre el centro de la caja lógica, con independencia del espacio transparente o de las dimensiones físicas del PNG.
- El tamaño inicial de cada icono corresponderá a una escala `1` o `100 %`.
- Cada pin PNG o emoji podrá redimensionarse entre `0.25` y `3`, equivalentes al `25 %` y al `300 %` de su tamaño inicial.
- La redimensión utilizará un único valor de escala proporcional aplicado conjuntamente a caja, PNG o emoji y nombre; la relación de aspecto de la representación no se deformará.
- La navegación considerará la caja escalada completa y el nombre para poder recuperarlos fuera de vista. Desaparece la colocación limitada al cuadrado `1000 × 1000`.
- El mismo valor de escala podrá modificarse mediante un tirador visible al seleccionar el pin y mediante un control deslizante en la configuración del elemento.
- Ambos controles permanecerán sincronizados y actualizarán el mismo valor.
- La escala elegida se guardará dentro de la representación visual del elemento en el JSON.
- El nombre visible tendrá tamaño base `16` multiplicado por la escala del elemento y crecerá o disminuirá junto con su representación.

### Modelo visual aprobado: ambulancia

- Será una ambulancia tipo furgón representada de perfil lateral completo y orientada hacia la derecha.
- La carrocería será amarilla, con una franja negra para las luces de posición, puente de luces azul y cristales delanteros oscuros azulados. La puerta lateral trasera no mostrará cristal: esa superficie será un panel amarillo continuo. El patrón Battenburg verde y amarillo ocupará únicamente la zona inferior comprendida entre esa franja negra y el borde bajo de la carrocería; estará formado por dos filas de cuadrados pequeños alternos y no aparecerá por encima de la franja.
- No incluirá palabras, matrículas legibles, marcas, escudos ni logotipos.
- Tendrá un acabado inequívoco de dibujo o boceto recortado para utilizarlo como pin, con formas simplificadas y trazos visibles; no deberá parecer una fotografía, un render 3D ni una ilustración realista.
- La silueta seguirá un contorno recortado de cartulina y mostrará un pequeño grosor visible y una sombra suave y corta, como una pieza colocada sobre una pizarra.
- El archivo tendrá fondo transparente y no incluirá la superficie de la pizarra de corcho.
- La ambulancia aparecerá centrada, con un margen mínimo alrededor de toda la silueta.
- El diseño deberá continuar siendo reconocible cuando se reduzca al tamaño de un pin.

### Modelo visual aprobado: Pathfinder

- Será un todoterreno de cinco puertas tipo Pathfinder R51 representado de perfil lateral completo y orientado hacia la derecha.
- La carrocería será amarilla, con cristales tintados negros y un puente de luces azul centrado sobre el techo.
- Incluirá protecciones delanteras y estribos laterales cromados, además de un cabestrante delantero con el cable y el gancho visibles.
- El patrón Battenburg verde y amarillo estará formado por dos filas de cuadrados pequeños alternos y ocupará una franja central más alta que en la ambulancia, aproximadamente desde la altura donde comienzan los huecos de las ruedas y centrada entre las ventanillas y el bajo.
- Mantendrá el mismo acabado de dibujo o boceto recortado, contorno de cartulina, sombra suave, fondo transparente y ausencia de textos, números, marcas y logotipos definidos para la ambulancia.

### Modelo visual aprobado: quad

- Será un quad de asistencia azul, sin conductor, representado de perfil lateral completo y orientado hacia la derecha.
- Incluirá una maleta rígida negra cerrada sobre la parrilla trasera y una mochila de tela oscura sujeta sobre la parrilla delantera.
- Un mástil negro vertical se elevará desde la parte trasera y terminará en una luminosa azul claramente visible.
- Tendrá exactamente dos detalles reflectantes amarillos: uno en el guardabarros delantero y otro en el trasero.
- Mantendrá el mismo acabado de dibujo o boceto recortado, contorno de cartulina, sombra suave, fondo transparente y ausencia de textos, números, marcas y logotipos definidos para los modelos anteriores.

### Modelo visual aprobado: CP

- Representará un control de paso únicamente mediante un cronómetro deportivo grande, negro y metálico, centrado en la composición.
- La esfera del cronómetro mostrará únicamente las letras `CP` en rojo intenso, grandes y legibles.
- No incluirá carretera, números, marcas, paisaje, vehículos ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: EH

- Representará una estación de hidratación mediante una botella de agua transparente, vertical y centrada.
- La botella contendrá agua con un tono azul muy suave y tendrá un tapón azul.
- Una etiqueta blanca limpia rodeará el centro de la botella y mostrará únicamente las letras `EH` en azul intenso, grandes y centradas.
- No incluirá marcas, números ni otros textos o elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: START

- Representará el inicio mediante una bandera a cuadros negros y blancos ligeramente ondeando, con un asta metálica corta y suavemente inclinada.
- La bandera mostrará las letras `START` en rojo intenso, grandes y centradas directamente sobre los cuadros, sin franja ni placa detrás del texto.
- No incluirá otros símbolos, números o palabras.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema, sombra suave y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: FINISH

- Representará la meta mediante un puente hinchable visto de frente, con dos pilares y un travesaño blancos de formas redondeadas.
- Los pilares y el travesaño mostrarán bandas negras diagonales distribuidas sobre la superficie blanca.
- Un panel negro rectangular estará suspendido dentro del arco y mostrará únicamente la palabra `FINISH` en blanco, grande y centrada.
- No incluirá marcas, números, patrocinadores ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno de cartulina crema y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: advertencia

- Representará una advertencia mediante un triángulo equilátero amarillo con las esquinas ligeramente redondeadas y un borde negro grueso.
- Mostrará únicamente el símbolo `!` en negro, grande y centrado.
- No incluirá soporte, texto ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno exterior de cartulina crema y fondo transparente de los modelos anteriores.

### Modelo visual aprobado: chincheta

- Representará una chincheta de mapa roja, con un cuerpo plástico ancho y ergonómico que pueda cogerse fácilmente con dos dedos y una aguja metálica claramente visible.
- Estará inclinada aproximadamente 25 grados hacia la derecha, con la cabeza situada arriba a la izquierda y la punta dirigida abajo a la derecha.
- No incluirá manos, dedos, texto ni otros elementos adicionales.
- Mantendrá el mismo acabado de dibujo o boceto recortado, trazos visibles, coloreado tipo rotulador, contorno exterior de cartulina crema y fondo transparente de los modelos anteriores.

## 7. Módulo de elementos

- El formulario no mostrará Añadir elemento como leyenda; Nombre y Dotación compartirán fila, con el campo de nombre debajo. Representación e Icono estarán junto a sus selectores. Información empezará con una fila y crecerá/se contraerá con el texto. La previsualización ajustará su caja al tamaño representado con margen pequeño y scroll solo por desbordamiento, sin reencajar automáticamente la representación.

- Permitirá crear elementos antes de comenzar el servicio.
- Un elemento podrá representar una dotación o cualquier otro objeto, posición, aviso o referencia que deba aparecer en la pizarra.
- Mostrará todos los elementos creados y permitirá seleccionarlos directamente desde el propio módulo.
- Separará visualmente los elementos en `Dotaciones` y `Generales`.
- El nombre será libre.
- Permitirá elegir un icono PNG disponible o escribir o pegar cualquier emoji.
- El formulario de creación incluirá un checkbox `Dotación` para indicar si el elemento debe tratarse como una dotación y activar los módulos relacionados con ellas.
- El valor de `Dotación` será inmutable después de crear el elemento. El editor posterior mostrará `Dotación` o `General` como dato de solo lectura y no incluirá ese checkbox.
- Dispondrá de un campo de texto amplio para introducir información libre.
- Después de configurarse, el elemento aparecerá como pin movible en la pizarra.
- La configuración común de cualquier elemento estará formada por nombre, representación visual, escala e información libre. Las dotaciones dispondrán además, dentro del Módulo operativo, de los campos estructurados `status`, `notes` y `tags` del contrato vigente.
- Las acciones `Añadir`, `Modificar`, `Duplicar` y `Quitar` estarán siempre visibles, sin botón de tuerca. Las tres últimas estarán deshabilitadas sin selección.
- El editor mostrará una previsualización conjunta de icono o emoji y nombre, que responderá inmediatamente al deslizador sin reencajar cada tamaño y ocultar el cambio visual.
- El editor trabajará con un borrador; `Cancelar` descartará todos sus cambios, incluida la escala, y `Guardar elemento` los aplicará conjuntamente. El tirador del pin modificará directamente el elemento y estará sincronizado con su escala guardada.
- Crear con la pizarra abierta colocará el pin en el centro lógico visible sin cambiar su vista ni mover otros objetos. Con la pizarra cerrada se conservará la posición inicial `{ x: 500, y: 500 }`; el centrado inicial al abrir permite encontrar el contenido. El centro de cámara usado para crear será temporal y se descartará al cambiar de documento.
- Eliminar una dotación conservará sus entradas cronológicas existentes, identificadas mediante el `unitName` guardado, pero ninguna de ellas podrá deshacerse una vez eliminado el elemento.
- `Duplicar` generará un elemento nuevo con otro UUID y el nombre `<nombre original> copia`.
- La copia conservará la representación visual, la escala, la información libre y el tipo inmutable `Dotación` o `General`.
- Una dotación duplicada comenzará como `Disponible`, con `notes: ""` y `tags: []`; no copiará el estado, las anotaciones, las etiquetas ni las entradas cronológicas del original.
- Si el original tiene posición, la copia se colocará `24` unidades a la derecha y `24` hacia abajo en la escena estable. Si el original tiene `position: null`, la copia también comenzará sin posición.
- Se elimina por completo la fila de colores y el filtro por estado, tanto en la lista como en la pizarra. Todas las dotaciones se mostrarán sin alterar sus estados ni los contadores de Operativo.

Ejemplo de contenido del módulo:

```text
Dotaciones:
🚑 Tango 1
🚑 Tango 2
🚑 Tango 3
🚁 Charlie 3
🚗 Papa 4

Generales:
🏥 H. Vithas
🚴🏽‍♂️ Cabeza de carrera
🏃🏽‍♂️ Cola carrera
📍 Avituallamiento
⚠ OJO CUIDAO
⚕ PSA

[Añadir] [Modificar] [Duplicar] [Quitar]
```

Ejemplo de una dotación:

```text
Nombre: Echo 1
Icono: 🚑
Tipo: Dotación (solo lectura)

TES: Pichu
DUE: Kiko Perez
Médico: Juan Antonio
```

## 8. Módulo de información

- Mostrará la información de cualquier elemento seleccionado, tanto si es una dotación como si no.
- La información procederá del texto introducido al configurar el elemento.
- Cuando se seleccione una dotación, mostrará el nombre exacto de su estado con su badge de color, además de la fase asociada.
- Cuando se seleccione una dotación, mostrará sus etiquetas como información asociada, pero no permitirá colocarlas ni moverlas sobre la pizarra.
- Cuando se seleccione un elemento general, mostrará únicamente su información libre.
- Cuando no haya ningún elemento seleccionado, mostrará únicamente una lista con los nombres de todas las dotaciones, sin estado, fase, contador, agrupación ni checkbox.
- Hacer clic o tocar el nombre de una dotación en esa lista la seleccionará globalmente y el módulo pasará a mostrar su información libre, estado con badge, fase y etiquetas.
- Si no existen dotaciones, la vista sin selección mostrará `Sin dotaciones`.
- Al hacer clic o tocar un espacio vacío de la pizarra se deseleccionará el elemento y el módulo volverá a mostrar la lista de dotaciones.

Ejemplo sin selección:

```text
TANGO-1
ALPHA-2
```

## 9. Módulo operativo

- Solo incluirá los elementos creados como `Dotación`, es decir, aquellos cuyo valor inmutable sea `isUnit: true`.
- Cuando no haya ninguna dotación seleccionada, mostrará los contadores de los estados exactos que tengan al menos una dotación. Seleccionar un elemento general equivaldrá, para este módulo, a no tener ninguna dotación seleccionada.
- Los contadores seguirán el orden `Disponible`, `Asignada`, `En camino`, `En el lugar`, `En traslado`, `En destino`, `Operativa` e `Inoperativa`; cada uno mostrará el icono, el número y el nombre exacto del estado, sin sustituirlo por su fase ni por una agrupación nueva.
- Hacer clic o tocar un contador desplegará los nombres de las dotaciones que estén exactamente en ese estado. Solo habrá un estado desplegado a la vez y abrir otro sustituirá la lista visible.
- Hacer clic o tocar una dotación de la lista desplegada la seleccionará globalmente. El módulo dejará los contadores y mostrará los ocho estados seleccionables para esa dotación.
- Cuando haya una dotación seleccionada, mostrará los ocho estados, resaltará el actual y permitirá cambiarlo mediante selección directa.
- Al deseleccionar la dotación, volverá a la vista de contadores.
- Los ocho estados estarán disponibles en todo momento: no formarán una secuencia ni existirán transiciones obligatorias entre ellos.
- Seleccionar el mismo estado que ya tiene la dotación no modificará el documento ni generará una entrada cronológica.
- El selector utilizará los valores de la columna `Estado` como código CCU; la fase asociada se mostrará en el módulo de información.
- Permitirá editar una anotación libre por dotación; los cambios se guardarán automáticamente en `operational.notes`.
- Permitirá crear etiquetas libres mediante el campo `Nueva etiqueta`, el botón `Añadir` o la tecla Enter.
- Las etiquetas se mostrarán como chips compactos en la ficha de la dotación. Un clic o toque permitirá editar el texto en línea y cada chip incluirá `×` para eliminarlo sin confirmación.
- Añadir, editar o eliminar una etiqueta actualizará automáticamente `operational.tags`.
- Las etiquetas pertenecerán siempre a su dotación, se mostrarán también en el Módulo de información y no serán objetos independientes ni aparecerán junto al pin. Para colocar texto libre sobre la pizarra se utilizarán notas rápidas.
- Los ocho estados definidos serán fijos; no se crearán estados adicionales o circunstanciales.
- Las circunstancias que no formen parte de esos estados se registrarán mediante etiquetas o anotaciones independientes, sin modificar el estado operativo.

La selección de un elemento será única y compartida entre la pizarra y los módulos de Elementos, Información y Operativo. Seleccionar una dotación desde cualquiera de ellos actualizará inmediatamente los demás.

Ejemplo sin selección y con `En el lugar` desplegado:

```text
🟢 3 Disponible
🟡 1 Asignada
🔴 2 En el lugar
  TANGO-1
  ALPHA-2
🟢 1 Operativa
```

### Estados y fases

| Estado | Fase | UI | Información |
| --- | --- | --- | --- |
| Disponible | Espera | 🟢 | Unidad posicionada en su punto de cobertura. |
| Asignada | Activación | 🟡 | Se ha transmitido por radio un aviso prioritario. |
| En camino | Aproximación | 🔵 | Unidad movilizada. |
| En el lugar | Intervención | 🔴 | Unidad en asistencia sanitaria. |
| En traslado | Evacuación | 💠 | Traslado de paciente. |
| En destino | Transferencia | 🟠 | Transferencia en el destino objetivo. |
| Operativa | Retorno | 🟢 | Unidad regresando a su punto de cobertura asignado por el recorrido. |
| Inoperativa | Bloqueo | ⚫ | Unidad inmovilizada. |

## 10. Módulo de coordenadas

- Aceptará coordenadas introducidas por el usuario.
- Admitirá y convertirá entre `Grados Decimales (DD)`, `Grados, Minutos y Segundos (DMS)`, `Grados y Minutos Decimales (DMM)` y `UTM (Universal Transverse Mercator)`.
- Los formatos canónicos de entrada y salida serán:

| Formato | Ejemplo |
| --- | --- |
| Grados Decimales (`DD`) | `37.060234, -2.002295` |
| Grados, Minutos y Segundos (`DMS`) | `37°03'36.8"N 2°00'08.2"W` |
| Grados y Minutos Decimales (`DMM`) | `37°03.614'N 2°00.137'W` |
| Universal Transverse Mercator (`UTM`) | `30S 588700 4101800` |

- En UTM, el identificador inicial estará formado por el número de huso y la banda de latitud; en `30S`, `30` será el huso y `S` será la banda.
- La letra de banda UTM nunca se interpretará directamente como una abreviatura de hemisferio. En particular, la `S` de `30S` no significará hemisferio sur.
- Se admitirán los husos del `1` al `60` y las bandas UTM válidas desde `C` hasta `X`, excluyendo `I` y `O`.
- Las bandas de `N` a `X` se convertirán internamente como hemisferio norte y las bandas de `C` a `M` como hemisferio sur.
- Después del identificador UTM aparecerán siempre las coordenadas Este y Norte, en ese orden.
- Una zona, banda o estructura UTM inválida impedirá la conversión y conservará íntegramente el texto introducido.
- Generará un enlace de Google Maps.
- Pulsar el enlace lo abrirá como un hipervínculo en otra pestaña. Se conservará `Copiar enlace` para enviarlo a otra persona.
- Se eliminarán la etiqueta visible repetida `Coordenadas` y la indicación redundante `DD · DMS · DMM · UTM`, conservando el nombre accesible del campo y los prefijos de cada resultado.
- DD, DMS, DMM y UTM permanecerán visibles siempre, con valores vacíos cuando no haya resultado.
- Pulsar o activar por teclado una fila válida copiará únicamente su valor canónico, sin el prefijo de formato y sin añadir botones ni textos visibles. Un resultado no disponible no se copiará; un fallo podrá anunciarse a tecnologías de asistencia sin ocupar espacio visible.
- Solo se corregirán automáticamente los espacios y los errores de separación mediante puntos o comas.
- La corrección nunca modificará, añadirá ni eliminará números.
- Por ejemplo, `37.060234. -2.002295` se normalizará como `37.060234, -2.002295`.
- Si la entrada continúa siendo inválida después de corregir espacios y separadores, se conservará íntegramente el texto introducido.
- El campo se marcará visualmente como incorrecto y mostrará un mensaje breve indicando qué parte no se reconoce.
- Mientras la entrada sea inválida no se convertirán las coordenadas ni se generará el enlace de Google Maps.
- La aplicación no modificará números ni intentará adivinar coordenadas para resolver una entrada inválida.

## 11. Otros módulos definidos

### Módulo Reloj

Reunirá en un único módulo el reloj, los cronómetros, las cuentas regresivas y los avisos temporizados.

#### Reloj

- Mostrará un reloj digital de estética táctica con la hora local de España.
- La hora española se ajustará automáticamente al horario de verano (`UTC+2`) o al horario de invierno (`UTC+1`); el usuario no tendrá que cambiarlo manualmente.
- La franja superior mostrará Digital Watch a izquierda, UTC+2 [ST] - UTC+1 [WT] centrado y ESP a derecha, sin barras verticales ni línea inferior; la estación vigente podrá destacarse.
- Estas referencias no serán selectores ni modos de funcionamiento y no implicarán añadir temática, personajes o adornos ajenos al reloj.
- La hora española utilizará HH:MM:SS con cifras mayores y peso ligero; debajo, Zulu Time HH:MM:SS compacto, con etiqueta y cifras del mismo tamaño, sin espaciado artificial ni alineación forzada con separadores de la hora principal.
- Una sola fila mostrará `T-Zero`, `T-Minus` y `Advisories`, sin prefijos `+`, y `▶ Sonido` alineado a la derecha. El acabado táctico respetará Titan, datos legibles, superficies y bordes, sin fuentes externas ni adornos que interfieran con las alertas.

#### Formato y límites temporales

- Las duraciones editables de `T-Minus` y `Advisory` utilizarán tres campos numéricos separados visualmente como `[HH] : [MM] : [SS]`.
- Los campos solo admitirán dígitos y solicitarán teclado numérico en dispositivos móviles; los separadores `:` serán fijos y no editables.
- Al abandonar un campo o iniciar el temporizador, los tres valores se convertirán a segundos totales y se normalizarán de nuevo al formato canónico de dos dígitos por bloque.
- Los excesos de segundos y minutos se trasladarán a la unidad superior; por ejemplo, `00:90:00` se convertirá en `01:30:00`, `00:00:90` en `00:01:30` y `01:90:90` en `02:31:30`.
- La duración mínima será `00:00:01`. Un valor total de cero se corregirá automáticamente a ese mínimo.
- La duración máxima será `23:59:59`. Cualquier resultado superior se limitará automáticamente a ese máximo.

#### T-Zero

- El botón `T-Zero` añadirá un cronómetro nuevo.
- Se podrán añadir varios cronómetros.
- Cada cronómetro mostrará el tiempo en formato `HH:MM:SS`.
- Cada cronómetro podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar a cero y cerrar.
- El valor máximo será `23:59:59`. Al completar ese valor, el cronómetro se detendrá automáticamente, volverá a `00:00:00` y quedará inactivo, sin activar alertas ni comenzar otro ciclo.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏸] [⏹]    [❌]
[nota libre]
```

#### T-Minus

- El botón `T-Minus` añadirá una cuenta regresiva nueva.
- Se podrán añadir varias cuentas regresivas.
- El usuario introducirá la duración inicial en formato `HH:MM:SS`.
- Cada cuenta regresiva podrá tener una nota libre asociada.
- Controles: iniciar, pausar, reiniciar al tiempo inicial y cerrar.
- El contador comenzará en la duración elegida y avanzará regresivamente hasta `00:00:00`.
- Al llegar a cero completará su ciclo y activará las alertas visual y sonora comunes.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏸] [⏹]    [❌]
[nota libre]
```

#### Advisories

- El botón `Advisories` añadirá un aviso temporizado nuevo.
- Se podrán añadir varios avisos.
- El usuario configurará la duración del aviso en formato `HH:MM:SS`; por ejemplo, `00:15:00` establecerá un ciclo de quince minutos.
- El contador comenzará en `00:00:00` y avanzará hacia delante hasta alcanzar la duración configurada.
- Cada aviso podrá tener una nota libre asociada.
- Controles definidos: iniciar, desactivar y cerrar.
- `Desactivar` finalizará el ciclo en curso tanto si el aviso está contando como si ya ha activado la alerta. Detendrá el conteo, el timbre y el destello, y devolverá el contador a `00:00:00`.
- La duración configurada y la nota se conservarán. El Advisory quedará inactivo y preparado para iniciar de nuevo un ciclo completo con esa misma configuración.
- `Desactivar` no pausará el aviso, no lo marcará como completado y no lo eliminará; `Cerrar` seguirá siendo la única acción que elimina ese Advisory.
- Al alcanzar la duración configurada completará su ciclo y activará las alertas visual y sonora comunes.

Representación conceptual:

```text
[HH:MM:SS] [▶] [⏹]         [❌]
[nota libre]
```

#### Finalización y alertas de T-Minus y Advisories

- El Módulo Reloj incluirá un único botón común `▶ Sonido`, compartido por todos los `T-Minus` y `Advisories`, en la fila de acciones y alineado a la derecha; no se añadirá un control de prueba dentro de cada temporizador.
- Al pulsarlo, reproducirá `public/assets/audio/alarm.mp3` en bucle. El texto permanecerá como `Sonido` y solo cambiará el icono de `▶` a `⏸`; una segunda pulsación detendrá únicamente esa reproducción de prueba y restaurará `▶`. Su nombre accesible distinguirá reproducir y detener la prueba.
- La prueba no modificará el estado, el tiempo, la nota ni la alerta de ningún temporizador y no se persistirá.
- Cerrar el Módulo Reloj detendrá la prueba de sonido. Si comienza una alarma real durante la prueba, esta finalizará inmediatamente y la alarma tendrá prioridad.
- Mientras exista una alarma real activa, el control `Sonido` permanecerá deshabilitado para evitar confundir la prueba con el timbre operativo.
- Cuando un `T-Minus` o un `Advisory` complete su ciclo, activará simultáneamente una alerta visual y una alerta sonora.
- La alerta visual afectará al temporizador correspondiente mediante un destello rojo intenso con resplandor marcado y un borde exterior blanco claramente visible.
- El valor inicial será de dos destellos por segundo.
- La frecuencia se definirá como un parámetro configurable de la implementación, no como un límite rígido ni como una opción ajustable por el usuario en la V1, para que pueda modificarse posteriormente sin rediseñar la alerta.
- La alerta sonora utilizará el archivo local `public/assets/audio/alarm.mp3`.
- `alarm.mp3` tiene una duración aproximada de un segundo, ocupa aproximadamente `14 KB` y está preparado para reproducirse en bucle sin un corte perceptible.
- El archivo se reproducirá en bucle mientras la alerta permanezca activa.
- El timbre formará parte de los recursos locales de la aplicación instalada.
- La aplicación comprobará el resultado de cada intento de reproducción. Si el navegador bloquea el audio por falta de interacción o permiso, la alerta visual continuará sin interrupción y el Módulo Reloj mostrará el aviso persistente `Sonido bloqueado` con la acción `Activar sonido`.
- Pulsar `Activar sonido` volverá a intentar la reproducción desde una interacción directa, iniciará el timbre de la alerta actual si el navegador lo permite e intentará dejar el audio habilitado para las alertas posteriores.
- Si la reproducción falla por una causa distinta del bloqueo del navegador, se mostrará `No se pudo reproducir la alarma`. En ambos casos, el fallo de audio nunca reconocerá, detendrá ni ocultará la alerta visual.
- Un clic o toque sobre el temporizador completado reconocerá su alerta y detendrá el parpadeo de ese temporizador; el timbre seguirá la regla común para alertas simultáneas definida a continuación.
- Después de reconocerla, el temporizador permanecerá visible como finalizado hasta que el usuario lo reinicie o lo cierre.
- Cada temporizador completado conservará su alerta visual de forma independiente. Si coinciden varias alertas, el audio utilizará un único bucle compartido y no superpondrá varias reproducciones de `alarm.mp3`.
- Reconocer, reiniciar, desactivar o cerrar un temporizador eliminará únicamente la alerta de ese temporizador. Mientras quede al menos otra alerta activa, el timbre compartido continuará y las demás alertas visuales no cambiarán.
- El timbre se detendrá cuando ya no quede ninguna alerta activa.

- El módulo se diseñará principalmente para utilizarse mientras Angie Dashboard permanezca abierto, que será su uso habitual.
- La V1 no intentará despertar la aplicación ni reproducir el timbre mientras esté completamente cerrada.
- Los temporizadores se calcularán mediante marcas de tiempo y no dependerán de que el navegador ejecute una actualización exacta cada segundo.
- Si la aplicación queda en segundo plano, la pantalla se bloquea o Android la suspende, el tiempo continuará transcurriendo.
- Al volver a la aplicación, cada temporizador recalculará inmediatamente su valor correcto.
- Si un `T-Minus` o un `Advisory` completó su ciclo mientras la aplicación estaba suspendida, activará el borde y el timbre al regresar.
- No se garantiza que la alerta visual o sonora se ejecute mientras la aplicación permanezca completamente suspendida o cerrada.
- El guardado automático interno conservará los datos temporales necesarios para recuperar correctamente los temporizadores al abrir de nuevo la aplicación.
- La exclusión de los temporizadores del JSON visible y su independencia frente a `Nuevo`, `Guardar` y `Cargar` se regirán por las reglas normativas del apartado 4, `Guardado y recuperación`.

### Calculadora

- Incluirá una calculadora básica.
- El campo conservará su nombre accesible, pero no mostrará la etiqueta redundante `Operación`. Botones y cifras responderán a la superficie disponible con la jerarquía tipográfica común.
- Permitirá suma, resta, multiplicación, división, decimales, porcentajes y paréntesis.
- `%` será un operador posfijo de prioridad alta. Aplicado de forma aislada, dividirá su operando entre cien; por ejemplo, `10 %` dará `0,1`.
- En una suma o resta, el porcentaje se calculará respecto al valor situado a su izquierda: `200 + 10 %` dará `220` y `200 - 10 %` dará `180`.
- En una multiplicación o división, el operando porcentual equivaldrá a su valor dividido entre cien: `200 × 10 %` dará `20` y `200 ÷ 10 %` dará `2000`.
- Las mismas reglas se aplicarán dentro de paréntesis y admitirán porcentajes decimales; por ejemplo, `80 + 12,5 %` dará `90`.
- Dividir entre `0 %` producirá un error de división por cero y no devolverá un resultado numérico.
- Incluirá acciones para borrar el último carácter y limpiar completamente la operación.
- La V1 no incluirá operaciones científicas ni conversiones adicionales.

### Cuaderno

- Será un módulo de trabajo para tomar y organizar apuntes durante el servicio.
- Su contenido se organizará como una lista desplazable de bloques independientes.
- Los botones directos `Nota` y `Checklist` añadirán el tipo correspondiente; no habrá un menú de añadir con `+`.
- Permitirá añadir, como tipos diferenciados, una nota libre o un checklist.
- Cada nota o checklist constituirá un bloque independiente dentro de la lista.
- Cada bloque tendrá un título editable en línea, inicialmente `Nota` o `Checklist`, que se guardará en `title` y podrá estar vacío durante edición.
- El contenido anterior se conservará íntegro; la conversión no extraerá su primera línea para generar el título.
- Los elementos de un checklist se podrán marcar y desmarcar.
- Los bloques nuevos se añadirán al final de la lista.
- Los bloques podrán reordenarse mediante una barra lateral dedicada con dos líneas finas, estilizada y con nombre accesible.
- En interacción táctil, el movimiento solo se iniciará desde ese tirador para no interferir con el desplazamiento vertical de la lista.
- Las notas utilizarán texto sencillo multilínea, con saltos de línea, símbolos y emojis.
- Notas e ítems de checklist comenzarán con una fila y ajustarán su altura al contenido, también al borrar, cargar o cambiar la anchura. La lista mantendrá el desplazamiento interno.
- Cada ítem tendrá checkbox, texto y `+` y `×` a la derecha. `+` insertará un ítem inmediatamente después; `×` eliminará solo ese ítem. Un checklist vacío conservará un `+` para crear el primero.
- El cierre de bloque eliminará únicamente ese bloque; sus acciones y las de ítems mantendrán recuperación de foco en un control válido.
- La V1 no incluirá un editor de negritas, cursivas, tamaños ni otros formatos especiales.
- Cualquier otro tipo de entrada que pudiera añadirse al Cuaderno queda fuera de lo definido para la V1.

### Registro cronológico

- Registrará entradas ordenadas cronológicamente.
- Su funcionamiento será independiente de la visibilidad de su módulo.
- Aunque el módulo permanezca cerrado, seguirá creando las entradas automáticas que correspondan y conservando las entradas existentes.
- Abrir o cerrar el módulo solo afectará a su visualización, no al registro de acontecimientos.
- Funcionará de forma mixta, combinando entradas manuales y entradas automáticas.
- El usuario podrá añadir manualmente cualquier acontecimiento que considere relevante.
- Se generará automáticamente una entrada cuando una dotación cambie de estado.
- No se registrarán automáticamente otras acciones de la aplicación en la V1, para evitar ruido innecesario.
- Cada entrada incluirá automáticamente la hora local española.
- El usuario no tendrá que escribir la hora: la aplicación la inyectará al crear la entrada.
- La interfaz utilizará un formato compacto que diferenciará por su contenido las entradas automáticas y las manuales.
- Internamente se conservarán la fecha y la hora completas, aunque en la línea visible se muestre principalmente la hora.
- Las entradas manuales podrán editarse o eliminarse directamente desde la interfaz.
- Cambiar manualmente una dotación a un estado distinto generará automáticamente una entrada con su estado anterior y su estado nuevo. La aplicación no cambiará estados por iniciativa propia.
- Solo la entrada automática más reciente de cada dotación existente ofrecerá la acción `Deshacer`; las entradas anteriores serán historial de solo lectura.
- Para ejecutar `Deshacer`, la dotación deberá seguir existiendo y su estado actual deberá coincidir con el `nextStatus` registrado en esa entrada.
- `Deshacer` restaurará `previousStatus` y eliminará atómicamente la entrada creada por error. La propia acción no generará otra entrada cronológica.
- Después de deshacer, la entrada inmediatamente anterior de esa dotación podrá convertirse en la más reciente y ofrecer `Deshacer` si su `nextStatus` coincide con el estado restaurado. De este modo se podrán corregir varios errores únicamente en orden inverso.
- Los cambios de otras dotaciones no afectarán a la disponibilidad de `Deshacer` para la dotación examinada.
- Si la dotación se ha eliminado, sus entradas se conservarán como historial legible mediante `unitName`, pero ninguna ofrecerá `Deshacer`.
- Si alguna condición no se cumple, la operación se rechazará sin modificar el estado ni el registro.
- No será necesario editar el archivo JSON para corregir estos errores.
- Las entradas se presentarán en orden ascendente: las más antiguas arriba y las nuevas abajo.
- Si el usuario ya está observando el final del registro, una entrada nueva desplazará automáticamente la vista hasta ella.
- Si el usuario está revisando entradas anteriores, la llegada de una nueva entrada no moverá su posición de lectura.

Ejemplo:

```text
14:32:08 · 🚑 Tango 1 · Asignada 🟡 → En camino 🔵
14:35:11 · Acceso norte cerrado temporalmente
```

## 12. Sistema modular y docking

- Los módulos estarán contenidos dentro de la interfaz principal.
- Cada sesión comenzará con el dashboard vacío y todos los módulos cerrados.
- No existirá una distribución inicial obligatoria ni una clasificación entre módulos principales y auxiliares.
- El usuario abrirá o cerrará individualmente los módulos que necesite desde el menú `Ver`.
- La `Pizarra` será un módulo más y no tendrá una posición inicial reservada.
- Cada módulo podrá moverse y redimensionarse libremente dentro del dashboard.
- La organización se resolverá mediante una cuadrícula invisible sobre el espacio de trabajo virtual.
- Los módulos podrán moverse y redimensionarse sobre esa cuadrícula.
- Se permitirán huecos entre módulos.
- Los módulos podrán superponerse al abrirse, moverse y redimensionarse. Pulsar o enfocar uno lo colocará delante, conservando el orden relativo de los demás; el apilamiento y el módulo activo serán temporales.
- El empaquetado y la recolocación automáticos permanecerán desactivados: mover o redimensionar un módulo no deberá reorganizar por sí solo los demás.
- No se utilizará un docking completo basado en grupos de pestañas, divisiones de pantalla o paneles propios de un IDE.
- La solución técnica seleccionada para esta función es `React Grid Layout`.
- El espacio principal ocupará todo el ancho y alto disponibles bajo la cabecera, sin proporción fija ni encaje automático de un tablero `1600 × 1000`. Esa medida solo será referencia de geometrías importadas de V1.
- La cabecera permanecerá visible y compartirá el zoom general; no se desplazará junto al dashboard. Una sola fila mostrará chincheta original, Archivo, Ver, campo Título flexible, Puzzle y porcentaje editable.
- Los módulos ocuparán el espacio de trabajo situado bajo la cabecera.
- La página no tendrá scroll. Si el área física es menor que un tamaño mínimo, la superficie de navegación se extenderá solo lo necesario para satisfacerlo, sin reducir toda la interfaz.
- Al abrir un módulo, recuperará su última posición y tamaño guardados cuando existan.
- Si un módulo todavía no tiene posición o tamaño guardados, aparecerá con un tamaño inicial válido dentro del dashboard.
- Abrir o cerrar módulos no moverá ni redimensionará automáticamente los demás.
- La visibilidad de los módulos será temporal para la sesión y no se restaurará desde el JSON.
- El dashboard conservará una única distribución guardada para Windows y Android; adaptará la posición y el tamaño presentado de cada ventana al área disponible, sin crear una composición móvil independiente ni reducir en bloque los textos y controles.
- Los módulos no se reorganizarán automáticamente en columnas, pestañas o una interfaz móvil diferente.
- La distribución de módulos guardada en el JSON será común para todos los dispositivos.
- La posición, el tamaño y el área de referencia de cada módulo se serializarán para restaurar su distribución adaptada.

### Apertura, tamaño y colocación de módulos

Cada módulo conserva su tamaño inicial. Se retiran los mínimos particulares de las ventanas: dimensiones enteras positivas (mínimo técnico 1). La superficie de contenido conserva espacio utilizable y scroll interno:

| Módulo | Tamaño inicial | Mínimo técnico |
| --- | --- | --- |
| Pizarra | `720 × 480` | `1 × 1` |
| Elementos | `300 × 420` | `1 × 1` |
| Información | `320 × 240` | `1 × 1` |
| Operativo | `340 × 320` | `1 × 1` |
| Coordenadas | `360 × 280` | `1 × 1` |
| Reloj | `440 × 480` | `1 × 1` |
| Calculadora | `280 × 360` | `1 × 1` |
| Cuaderno | `360 × 420` | `1 × 1` |
| Registro cronológico | `420 × 320` | `1 × 1` |

- El usuario podrá ampliar hasta el espacio lógico disponible y reducir sin los antiguos mínimos particulares; las dimensiones no serán cero.
- Cuando el contenido no quepa habrá barras internas; las barras de herramientas no se amontonarán ni saltarán de fila. Ver permite recuperar o cerrar ventanas extremadamente pequeñas.
- Una geometría guardada se abrirá en su posición adaptada aunque esté ocupada. Dentro de su área de referencia original se recuperarán los valores guardados.
- Si el módulo nunca tuvo una distribución guardada, buscará un hueco para su tamaño inicial adaptado desde la esquina superior izquierda, avanzando de izquierda a derecha y después hacia abajo sobre la cuadrícula invisible.
- La búsqueda de espacio nunca moverá ni redimensionará los módulos que ya estén abiertos.
- Si no existe hueco válido, el módulo se abrirá con su tamaño inicial adaptado en una posición accesible, activo y por encima de los demás. No se reducirá por una colisión ni existirá un estado excepcional o un aviso de falta de hueco.
- La posición final, el tamaño y `referenceSize` se conservarán en `moduleLayouts` después de un gesto explícito del usuario.

### Adaptación de geometrías entre pantallas

- Cada geometría guardará `referenceSize: { width, height }`, el área de trabajo en la que se colocó, incluida la extensión mínima si resulta necesaria.
- Se conservarán las dimensiones guardadas cuando quepan; cuando no quepan se limitarán al área disponible respetando los mínimos. Si el área física es menor que el mínimo, se utilizará la extensión de navegación definida, no una escala automática reductora.
- El anclaje horizontal se calculará como `p = x / (referenceWidth - savedWidth)` cuando el denominador sea positivo, o `p = 0` en caso contrario. La posición presentada será `round(clamp(p, 0, 1) * (availableWidth - displayedWidth))`. La regla vertical será equivalente.
- Adaptar por una medición, cambio de pantalla u orientación no reescribirá la distribución persistente ni reorganizará otras ventanas. Un arrastre o resize explícito guardará los valores nuevos y la referencia actual.
- Al regresar al área de referencia sin gestos de colocación intermedios se recuperará la geometría original. El apilamiento, la visibilidad y las cámaras seguirán siendo temporales.

### Navegación en pantallas móviles

- El espacio principal adaptativo se recorrerá mediante gestos directos, sin barras de desplazamiento de página, miniatura de navegación ni modo de desplazamiento separado.
- Pellizcar con dos dedos fuera del área de dibujo ampliará o reducirá la vista principal y mantendrá como centro del zoom el punto situado entre ambos dedos.
- Arrastrar con dos dedos fuera del área de dibujo desplazará la vista del dashboard. Dos dedos dentro de la pizarra pertenecerán únicamente a su navegación; un gesto entre ambas superficies se cancelará hasta levantar los dedos.
- Los gestos realizados con un solo dedo se reservarán para manejar los módulos, pines, controles y herramientas de la pizarra.
- Un dedo sobre la cabecera de un módulo permitirá moverlo.
- Un dedo sobre un borde o tirador permitirá redimensionar el módulo o el pin correspondiente.
- Un dedo sobre controles o listas permitirá accionarlos o desplazar su contenido normalmente.
- Un dedo sobre la pizarra seleccionará, moverá, dibujará, borrará o creará notas según la herramienta que esté activa.
- Mientras haya dos dedos interactuando con el dashboard, se suspenderán temporalmente las acciones de módulos, pines y dibujo para evitar movimientos o trazos accidentales.
- La cabecera principal compartirá el zoom general y permanecerá fuera del desplazamiento del dashboard.
- La escala inicial será 1 (100 %); el zoom general editable admitirá 0.25–4 (25–400 %), aplicado también a la cabecera. Vacío o inválido conserva el zoom anterior; Enter o salir del campo confirma y Escape descarta.
- El origen quedará anclado arriba a la izquierda, sin desplazamientos positivos ni margen elástico. Reducir el zoom ampliará la región lógica disponible, sin recentrar ni modificar distribuciones guardadas.
- La cabecera incluirá Puzzle, con nombre accesible Encajar, que restablece 100 % y el origen sin cambiar geometrías guardadas.
- El porcentaje junto a Puzzle será editable mediante teclado numérico.
- Cada sesión nueva comenzará con la vista adaptada al `100 %`.
- El zoom y la posición de la vista se conservarán mientras la aplicación permanezca abierta.
- Abrir, cerrar, mover o redimensionar módulos no modificará automáticamente el zoom ni la posición de la vista.
- Al cambiar orientación o área visible se conservarán escala y desplazamiento válido, limitándolo sin recentrar.
- El zoom y la posición serán estados locales y temporales: no se incluirán en el JSON ni se trasladarán entre dispositivos.

## 13. Stack tecnológico definitivo

La V1 utilizará:

- `React` como base de la interfaz.
- `TypeScript` para tipar los datos, estados, documentos y componentes.
- `Vite` como herramienta de desarrollo y compilación.
- Una PWA instalable en Windows y Android, sin crear aplicaciones independientes para cada sistema.
- `shadcn/ui` como base para los controles visuales.
- `React Grid Layout` para mover, redimensionar, serializar y restaurar la distribución de los módulos sobre la cuadrícula invisible.
- `Konva` mediante su integración con React para la pizarra y sus trazos.
- `IndexedDB`, mediante `Dexie`, para el autoguardado interno y la recuperación local.
- `Proj4` para las conversiones relacionadas con coordenadas UTM.
- `Netlify` para alojar y distribuir los archivos estáticos de la PWA.

`lucide-react` ya figura en `package.json` y su paquete local está presente; su instalación fue autorizada y registrada en la entrega 4 del plan adaptativo histórico. Conservar importaciones concretas. Las dependencias nuevas de los componentes aprobados se concretan en fase 1 y se añaden únicamente con su consumidor en la entrega de producto autorizada; la fase 0 no instala paquetes.

Netlify no almacenará los documentos JSON ni el autoguardado del usuario. Esos datos permanecerán en el dispositivo, salvo cuando el usuario exporte o importe manualmente un archivo.

Los recursos estáticos aprobados se organizarán de la siguiente forma:

- `public/assets/elements`: nueve iconos PNG utilizados por los pines.
- `public/assets/audio/alarm.mp3`: timbre local de `T-Minus` y `Advisories`.
- `public/assets/pwa`: iconos derivados para la instalación, el acceso directo y el favicon de la PWA.
- `public/assets/fonts/roboto-condensed`: archivos locales de Roboto Condensed y su licencia.
- La chincheta roja `public/assets/elements/icon_chincheta.png` será la fuente visual para generar los tamaños necesarios del icono instalable de la PWA, sin modificar el archivo original.
- Los iconos normales de `16 × 16`, `32 × 32`, `180 × 180`, `192 × 192` y `512 × 512` conservarán fondo transparente.
- Las variantes `maskable` de `192 × 192` y `512 × 512` tendrán fondo opaco Titan `#0C0D0E` y mantendrán completa la chincheta dentro de la zona segura circular central del `80 %`.
- Todos los iconos derivados conservarán exactamente el dibujo, los colores y la proporción de la chincheta original; solo cambiarán el encuadre, el fondo exigido para `maskable` y la resolución.
- Roboto Condensed se alojará localmente para no depender de Google Fonts durante el uso. Se incluirán las variantes variables normal y cursiva, con pesos continuos de `100` a `900`, y los subconjuntos `latin` y `latin-ext`.

shadcn/ui se utilizará especialmente en:

- Botones, campos de texto y selectores.
- Menús y barra superior.
- Diálogos de confirmación.
- Pestañas, paneles, áreas desplazables y separadores redimensionables.
- Badges para estados.
- Tooltips, popovers, avisos y notificaciones dentro de la aplicación.
- Checkboxes y controles del checklist.

shadcn/ui no resolvería por sí solo:

- El canvas de dibujo.
- El sistema completo de docking.
- El movimiento de pines sobre la pizarra.
- El guardado y carga del JSON.
- La conversión de coordenadas.
- Los temporizadores y la lógica operativa.

Por tanto, shadcn/ui será la base de controles visuales, no la arquitectura completa.

## 14. Dirección visual

La interfaz seguirá una dirección industrial táctica inspirada en la estética Titan, con acabado elaborado y sin limitarse a superficies planas o controles sobredimensionados.

### Paleta base aproximada

| Uso | Color |
| --- | --- |
| Fondo general | `#0C0D0E` |
| Módulos | `#17191B` |
| Cabeceras de módulos | `#25282B` |
| Bordes normales | `#555B60` |
| Texto principal | `#F2F2F0` |
| Texto secundario | `#A7ADB1` |
| Acento rojo | `#D63A3A` |
| Acento amarillo | `#E3B52F` |

Estos valores son una base de diseño y podrán ajustarse durante la composición visual sin cambiar la dirección aprobada.

### Características aprobadas

- Fondo negro profundo con degradados suaves entre negro, grafito y gris acero.
- Textura técnica sutil, como metal satinado, grano fino o una trama geométrica discreta.
- Módulos con profundidad mediante sombras, reflejos superiores, bordes interiores y diferentes capas de gris.
- Cabeceras con degradado metálico oscuro y detalles de color.
- Esquinas rectas o ligeramente biseladas, con posibilidad de cortes angulares propios de un panel técnico.
- Bordes con brillo y relieve cuando el módulo esté activo.
- Botones compactos y detallados, con estados visuales diferenciados de reposo, foco, pulsado y activo.
- Los controles podrán utilizar volumen, bisel, iluminación interior o apariencia de interruptor físico cuando encaje con su función.
- El rojo será un acento de identidad para líneas, selecciones, indicadores activos, detalles de cabecera y acciones importantes.
- El amarillo se utilizará como segundo acento en marcadores, avisos o pequeños elementos técnicos.
- El blanco frío se utilizará para la información principal y los grises claros para la información secundaria.
- Los estados operativos conservarán sus colores y una forma visual reconocible para no confundirse con los acentos decorativos.
- Roboto Condensed será la tipografía principal de la interfaz general, incluidas cabeceras, menús, botones, etiquetas y nombres de módulos, utilizando según la jerarquía los pesos variables disponibles entre `100` y `900` y la cursiva cuando corresponda.
- El reloj, los tiempos, las coordenadas, los contadores y otros datos técnicos utilizarán una tipografía monoespaciada.
- La tipografía usará tokens comunes por función según el espacio disponible: cuerpo y controles `13–16 px`, títulos `15–18 px`, datos técnicos compactos `12–16 px`; la cabecera seguirá la misma jerarquía según ancho de pantalla. El display del reloj y las cifras de calculadora conservarán una jerarquía mayor adaptable a su superficie.
- La misma función tendrá el mismo criterio de tamaño en todos los módulos. El texto de objetos de pizarra pertenecerá a su escena: el nombre escalará con el pin y el texto de nota mantendrá su base al cambiar la caja; redimensionar un módulo no alterará esos datos.
- Las animaciones serán rápidas y precisas: cambios de brillo, encendido de líneas, pulsaciones mecánicas y transiciones cortas.
- Se permitirá un resplandor controlado en elementos activos; los destellos intensos quedarán reservados para alarmas.
- El área vacía del dashboard conservará presencia visual mediante degradado, viñeta o trama sutil.
- La interfaz será compacta y aprovechará el espacio disponible; no se impondrá una estética móvil simplificada ni controles deliberadamente sobredimensionados.

### Anatomía común de las ventanas

- Cada módulo utilizará una cabecera compacta como zona de arrastre.
- La cabecera incluirá un pequeño detalle de acento rojo o amarillo.
- El nombre del módulo aparecerá a la izquierda.
- Cierre y zoom individual 25–400 % estarán fuera de la barra de título, que será fina y exclusiva para arrastrar. La escala individual es temporal y afecta contenido y herramientas, no geometría exterior ni datos persistentes.
- Los módulos se redimensionarán mediante el tirador diagonal común abajo a la derecha, igual al de notas y ventanas de diálogo.
- La esquina inferior derecha mostrará un tirador de redimensionado discreto.
- El módulo activo se distinguirá mediante un borde iluminado y una profundidad ligeramente mayor.
- La V1 no incluirá controles comunes de minimizar o maximizar; el menú `Ver` y el botón `×` cubrirán la apertura y el cierre.

### Accesibilidad e interacción por teclado

- Todos los controles interactivos tendrán un nombre accesible. Los controles representados únicamente mediante un icono proporcionarán un nombre que describa su acción sin depender de la interpretación visual del símbolo.
- El foco de teclado será siempre visible y seguirá un orden lógico por la cabecera y los módulos abiertos, sin detenerse en módulos cerrados ni en elementos meramente decorativos.
- En Windows podrán utilizarse mediante teclado los menús `Archivo` y `Ver`, la edición del título, la apertura y el cierre de módulos y todos los botones, formularios, listas, selectores de estado, etiquetas, controles de temporizadores, calculadora, filas copiables de coordenadas y títulos del Cuaderno.
- Los elementos y las dotaciones podrán seleccionarse mediante teclado desde sus módulos correspondientes, de modo que sus acciones e información no dependan de acertar sobre un pin en la pizarra.
- Los estados operativos se identificarán mediante su nombre o icono además del color; ningún significado operativo dependerá exclusivamente de una diferencia cromática.
- Mover o redimensionar módulos, pines y notas rápidas, así como dibujar o borrar sobre la pizarra, seguirán siendo interacciones espaciales de ratón o tacto y no requerirán una alternativa equivalente mediante teclado en la V1.

## 15. Estado de preparación para la construcción

- `ESQUEMA_CONCEPTUAL.md` es la especificación funcional y visual de referencia.
- `AGENTS.md` contiene las instrucciones de ejecución y los límites de alcance para Codex.
- `IMPLEMENTATION_PLAN.md` enlaza el nuevo plan de revisión y conserva la construcción original, la revisión adaptativa y la corrección compacta como historia, sin alterar checks ni informes.
- `ACCEPTANCE_CRITERIA.md` separa evidencia histórica, pendientes conservados y verificación de la nueva revisión.
- `docs/archive/plan.md`, `estados_fase.md` y `prueba-estilo.html` son referencias vigentes autorizadas para esta revisión; las demás notas archivadas no constituyen requisitos actuales.
- El estilo y los ocho componentes están aprobados desde el 2026-10-05. Las entregas de producto siguen pendientes; el contrato definitivo se entrega en fase 1. Ejecutar solo la entrega solicitada, comprobar dependencias, registrar su cierre y detenerse para revisión antes de iniciar o preparar la siguiente.
- El despliegue, la publicación y cualquier cambio en producción continúan fuera de alcance hasta recibir autorización expresa.
