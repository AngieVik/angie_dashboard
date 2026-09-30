# Criterios de aceptación — Angie Dashboard V1

Este documento resume las comprobaciones de entrega. `ESQUEMA_CONCEPTUAL.md` conserva el detalle normativo y prevalece ante cualquier duda.

## 1. Arranque, cabecera y documentos

- [ ] La aplicación se instala como PWA en Windows y Android y puede abrirse sin conexión después de la primera carga.
- [ ] Cada sesión comienza con todos los módulos cerrados y sin una distribución impuesta.
- [ ] La cabecera permanece visible e incluye `Archivo`, `Ver`, título editable, `Encajar` y porcentaje de zoom.
- [ ] `Nuevo` crea un documento vacío sin eliminar archivos exportados ni detener temporizadores.
- [ ] `Guardar` valida el JSON antes de escribirlo y utiliza selector nativo o descarga según la capacidad del navegador.
- [ ] Cancelar o fallar un guardado no sustituye el archivo anterior ni pierde el documento activo.
- [ ] `Cargar` rechaza archivos dañados, ajenos a Angie Dashboard o de versiones futuras sin reemplazar el documento activo.
- [ ] Un JSON compatible antiguo se migra en memoria y su original no se modifica.
- [ ] El archivo exportado cumple el JSON Schema 2020-12 y contiene únicamente los bloques aprobados.
- [ ] El JSON contiene exactamente las nueve propiedades raíz aprobadas, rechaza propiedades desconocidas y conserva la estructura obligatoria completa aunque existan textos, listas o posiciones vacíos.
- [ ] UUID, fechas UTC, colores, uniones discriminadas, relaciones condicionales, coordenadas, escalas, tamaños y orden cronológico se validan conforme al contrato V1.

## 2. Autoguardado y recuperación

- [ ] El documento activo se guarda automáticamente en IndexedDB y se recupera después de recargar o reabrir la PWA.
- [ ] El autoguardado y el archivo JSON visible funcionan de manera independiente.
- [ ] El JSON no incluye imagen de fondo, archivos PNG, temporizadores, operación de calculadora, coordenadas temporales, selección, viewport ni visibilidad de módulos.
- [ ] Los errores de IndexedDB se comunican sin cerrar la aplicación ni destruir el estado en memoria.

## 3. Sistema modular y móvil

- [ ] Todos los módulos se abren y cierran desde `Ver`; el botón `×` cierra solo su módulo.
- [ ] Los módulos se mueven y redimensionan sin recolocar automáticamente los demás.
- [ ] Se respetan los tamaños iniciales y mínimos definidos para los nueve módulos.
- [ ] La distribución normal impide solapamientos.
- [ ] La apertura busca primero la distribución guardada y después un hueco libre conforme al orden definido.
- [ ] Sin espacio disponible, el módulo se abre centrado al tamaño mínimo, por encima de los demás, con el aviso aprobado y solapamiento temporal.
- [ ] `moduleLayouts` conserva posiciones y tamaños, pero no visibilidad.
- [ ] En móvil, un dedo manipula contenido y dos dedos desplazan o amplían el dashboard sin provocar acciones accidentales.
- [ ] `Encajar` muestra completo y centrado el espacio general `1600 × 1000`; el zoom no baja de ese valor ni supera `200 %`.
- [ ] Girar el dispositivo conserva el punto lógico central y mantiene una vista válida.
- [ ] No aparece scroll de página en Windows ni Android.

## 4. Pizarra

- [ ] Permite seleccionar color o cargar temporalmente una imagen JPG/PNG local.
- [ ] Rechaza imágenes superiores a `50 MiB` y reduce en memoria las que superen `4096 px` en su lado mayor.
- [ ] Un fallo de imagen conserva el fondo anterior y no sube datos a servicios externos.
- [ ] Los modos `Seleccionar/mover`, `Lápiz`, `Goma` y `Nota rápida` respetan las prioridades definidas.
- [ ] La goma elimina únicamente trazos del lápiz.
- [ ] Pines, notas rápidas y trazos se persisten en el lienzo lógico fijo `1000 × 1000`; el módulo lo muestra completo, centrado, proporcional y sin recortarlo.
- [ ] Las notas rápidas se pueden crear, editar y eliminar y mantienen tamaño visual fijo.

## 5. Elementos y pines

- [ ] Se pueden crear, editar, duplicar y eliminar elementos con nombre, información, representación visual y clasificación inmutable como `Dotación` o `General`.
- [ ] `Dotación` solo puede elegirse durante la creación; después se muestra como dato de solo lectura y no puede cambiarse en ningún sentido.
- [ ] Una dotación nueva comienza como `Disponible`, con anotaciones vacías y sin etiquetas.
- [ ] Las etiquetas de una dotación se pueden crear, editar y eliminar como chips, rechazan vacíos y duplicados sin distinguir mayúsculas y se muestran en Información sin convertirse en objetos de la pizarra.
- [ ] Duplicar crea otro UUID y el nombre `<nombre> copia`, conserva configuración, tipo e información y desplaza el pin `24` unidades dentro del lienzo; si es una dotación, reinicia sus datos operativos y no copia entradas cronológicas.
- [ ] Se pueden usar los nueve PNG del catálogo o cualquier emoji escrito o pegado.
- [ ] Cada ID del catálogo carga el archivo, nombre y tamaño inicial correctos.
- [ ] Los tamaños iniciales de los PNG actúan como cajas máximas y los iconos se encajan centrados sin deformarse.
- [ ] Los PNG conservan su proporción y pueden escalarse entre `25 %` y `300 %` mediante tirador y deslizador sincronizados.
- [ ] La escala se guarda en el JSON y el nombre del elemento mantiene un tamaño de texto independiente.
- [ ] Los elementos se separan visualmente en `Dotaciones` y `Generales`.
- [ ] El filtro de ocho estados muestra u oculta dotaciones sin alterar sus datos.

## 6. Información, operativo y registro

- [ ] Información muestra el elemento seleccionado y la fase cuando sea una dotación.
- [ ] Sin selección, Información muestra únicamente los nombres de las dotaciones, o `Sin dotaciones` cuando no exista ninguna; tocar un nombre selecciona globalmente esa dotación.
- [ ] Con una dotación seleccionada, Información muestra su información libre, fase y etiquetas; con un elemento general, muestra únicamente su información libre.
- [ ] Operativo incluye solo dotaciones y permite los ocho estados fijos definidos.
- [ ] Sin una dotación seleccionada, Operativo muestra únicamente contadores no vacíos de los ocho estados exactos, en el orden definido y sin fases ni agrupaciones nuevas.
- [ ] Tocar un contador despliega las dotaciones que están exactamente en ese estado, con un único estado desplegado; tocar un nombre selecciona globalmente esa dotación.
- [ ] Con una dotación seleccionada, Operativo muestra los ocho estados, resalta el actual y permite elegir cualquiera; al deseleccionarla vuelve a los contadores.
- [ ] La selección es única y se sincroniza entre pizarra, Elementos, Información y Operativo.
- [ ] Los ocho estados pueden elegirse manualmente en cualquier momento, sin secuencia obligatoria; seleccionar el estado actual no modifica datos ni crea una entrada.
- [ ] Operativo permite editar una anotación libre y gestionar las etiquetas asociadas a cada dotación con autoguardado.
- [ ] Un cambio de estado actualiza Información y crea una entrada cronológica automática con hora española.
- [ ] Solo el cambio más reciente de cada dotación existente permite `Deshacer`, y únicamente cuando el estado actual coincide con el estado nuevo registrado.
- [ ] `Deshacer` restaura el estado anterior y elimina atómicamente la entrada correspondiente sin crear otra; permite continuar retrocediendo en orden inverso y no afecta a otras dotaciones.
- [ ] Eliminar una dotación conserva intactas sus entradas cronológicas mediante el nombre guardado, pero ninguna de ellas permite `Deshacer`.
- [ ] Un intento de deshacer no válido se rechaza sin modificar el estado ni el registro.
- [ ] Las entradas manuales se pueden crear, editar y eliminar.
- [ ] El registro sigue funcionando con su módulo cerrado y respeta el comportamiento de desplazamiento automático aprobado.

## 7. Reloj y alertas

- [ ] Se muestran hora española con cambio estacional automático y hora Zulu.
- [ ] Se pueden crear varios `T-Zero`, `T-Minus` y `Advisories` con notas y controles correctos.
- [ ] Los temporizadores se calculan mediante marcas de tiempo y recuperan el valor correcto después de suspensión o recarga.
- [ ] Los temporizadores internos no se exportan ni importan mediante JSON y no cambian al usar `Nuevo`, `Guardar` o `Cargar`.
- [ ] Al completar un ciclo, el temporizador muestra rojo intenso, borde blanco y dos destellos por segundo.
- [ ] `public/assets/audio/alarm.mp3` se reproduce en bucle y se detiene junto al destello al reconocer la alerta.
- [ ] Después de reconocerla, la entrada permanece finalizada hasta reiniciarla o cerrarla.

## 8. Coordenadas, calculadora y cuaderno

- [ ] Coordenadas convierte correctamente entre DD, DMS, DMM y UTM utilizando los cuatro formatos canónicos.
- [ ] `30S` se interpreta como huso 30 y banda S del hemisferio norte, no como hemisferio sur.
- [ ] Se validan husos `1–60` y bandas `C–X`, excluyendo `I` y `O`.
- [ ] Una entrada inválida conserva exactamente sus números, muestra el error y no genera conversión ni enlace.
- [ ] Una entrada válida genera un enlace de Google Maps copiable.
- [ ] Calculadora admite operaciones básicas, decimales, porcentajes, paréntesis, retroceso y limpieza.
- [ ] Cuaderno crea notas y checklist, permite marcar elementos y reordena bloques solo desde el tirador.
- [ ] Las notas admiten texto multilínea, símbolos y emojis sin formato enriquecido.

## 9. Diseño, accesibilidad y calidad

- [ ] Los iconos PWA normales existen en `16`, `32`, `180`, `192` y `512` píxeles, conservan transparencia y reproducen la chincheta aprobada sin deformarla ni redibujarla.
- [ ] Los iconos `maskable` existen en `192` y `512` píxeles, tienen fondo opaco `#0C0D0E` y mantienen completa la chincheta dentro de la zona segura circular del `80 %`.
- [ ] Roboto Condensed normal y cursiva, con pesos variables `100–900`, se carga desde recursos locales y continúa disponible sin conexión; los datos técnicos conservan una tipografía monoespaciada.
- [ ] La interfaz respeta la paleta y dirección Titan industrial aprobadas sin convertirse en un diseño plano o móvil simplificado.
- [ ] Controles, foco, estado activo, errores y selección son distinguibles con teclado, ratón y tacto.
- [ ] Los controles interactivos tienen nombre accesible y las acciones esenciales pueden realizarse con teclado en Windows.
- [ ] Los estados operativos no dependen únicamente del color.
- [ ] No se introducen datos clínicos, cuentas, telemetría ni transferencias de documentos a servidores.
- [ ] Las pruebas unitarias, de componentes y de navegador están aprobadas.
- [ ] Lint, comprobación de tipos y compilación de producción finalizan sin errores.
- [ ] La aplicación se verifica visual y funcionalmente en un viewport de escritorio y uno móvil.
- [ ] No se realiza ningún despliegue ni publicación sin autorización expresa.
