# Pizarra y Plano Operativo <!-- =============================================**Pizarra y Plano Operativo**========================================== -->

- Implementar esta actualización en `Pizarra` y `Plano Operativo`

## Primitivas vectoriales y capas nativas (`L.*`)

**`L.CircleMarker`:** Círculo cuyo radio se mide en **píxeles de pantalla** en lugar de metros (mantiene su tamaño visual al hacer zoom). Es la pieza estándar para representar nodos, vértices editables o puntos de control ligeros sin cargar iconos SVG.
**`L.Polygon` con anillos interiores (huecos):** Permite dibujar un perímetro exterior y recortar zonas internas dentro de la misma forma, útil para delimitar sectores con áreas de exclusión dentro.
**`L.Tooltip` permanente (`permanent: true`):** Ancla etiquetas de texto directamente sobre una línea, polígono o punto sin obligar a hacer clic en un popup, ideal para rotular sectores, tramos o indicativos sobre el terreno.
**`L.ImageOverlay` y `L.SVGOverlay`:** Superpone una imagen estática (un plano de instalaciones, un croquis o una ortofoto local) georreferenciada entre dos coordenadas (`LatLngBounds`) para que escale y se desplace solidaria con el mapa.
**`L.FeatureGroup`:** Agrupa múltiples formas y pines como una sola entidad lógica para mostrar u ocultar capas temáticas completas, compartir eventos o encuadrar automáticamente todo un operativo mediante `group.getBounds()`.
**`L.Control.Scale`:** Barra de escala métrica/imperial nativa que se recalcula dinámicamente según la latitud y el nivel de zoom.

## Cálculo espacial integrado en el núcleo de Leaflet

- **Distancias geodésicas (`latlngA.distanceTo(latlngB)`):**
    - Calcula los metros reales sobre la superficie terrestre entre dos puntos sin librerías externas.
    - Sumando los segmentos de una polilínea obtienes el kilometraje acumulado de una ruta al instante.

- **Cajas delimitadoras (`L.LatLngBounds`):**
    - Permite comprobar de forma nativa si una coordenada cae dentro de un rectángulo (`bounds.contains()`).
    - Si dos zonas se solapan (`bounds.intersects()`).
    - Obtener su centro geométrico (`bounds.getCenter()`).

**Proyección pantalla ↔ coordenadas (`latLngToContainerPoint` / `containerPointToLatLng`):** Convierte posiciones en píxeles a coordenadas geográficas y viceversa, facilitando compartir lógica de dibujo entre `Pizarra` y `Plano operativo`.

- **Motor de renderizado dual (`L.SVG` y `L.Canvas`):**
    - Leaflet permite renderizar vectores en SVG (ideal para seleccionar y editar formas individuales mediante eventos DOM).
    - Canvas `preferCanvas: true` cuando necesitas mover cientos de geometrías sin pérdida de fluidez.

## Estándares GIS nativos

- **`L.GeoJSON`:** Leaflet parsea y dibuja de forma nativa archivos **GeoJSON** (`Point`, `LineString`, `Polygon`, `MultiPolygon`, `FeatureCollection`).
    - GeoJSON es el estándar abierto de herramientas GIS (QGIS, ArcGIS, OsmAnd) para intercambiar polígonos, sectores y atributos personalizados (`properties`).

- **`L.CRS.Simple`:** Sistema de proyección cartesiana plana `[y, x]` en lugar de latitud/longitud integrado en Leaflet, diseñado para cartografiar planos técnicos, recintos cerrados o lienzos sin curvatura terrestre.

## Qué NO incluye Leaflet de serie

**Tiradores visuales de edición en vértices**
    - Leaflet no dibuja nodos arrastrables automáticamente sobre una polilínea. 
    - Para mantener el proyecto sin plugins externos, se implementa colocando un `L.Marker` arrastrable (`draggable: true`) en cada vértice de la línea para actualizar sus coordenadas al soltarlo.

**Análisis geométrico complejo**
    - Calcular el área exacta en m2 de un polígono irregular.
    - Generar áreas de influencia *buffers* de X metros alrededor de una ruta.
    - Detectar si un punto cae dentro de un polígono de muchos lados no está en el núcleo de Leaflet.
    - En GIS web se resuelve con funciones geométricas acotadas o módulos puntuales como `@turf/area` o `@turf/boolean-point-in-polygon`).

## Barras de herramientas

### Pizarra

- Obsoleta: `Seleccionar/mover` | `Lápiz` `Goma` `Borrar todos los trazos` `Deslizador: Grosor` `Elegir color del lápiz` | `Nota rápida` `Abrir Dotaciones` `Abrir Elementos` | `Elegir color de fondo` `Elegir imagen de fondo` `Mover y redimensionar imagen` `Borrar imagen de fondo`
- Nueva: `Seleccionar/mover` `Deshacer` `Rehacer` `Lápiz` `Polilinea` `Circunferencia` `Goma` `Deslizador: Grosor` `Selector de color: Herramientas / Fondo` `Nota rápida` `L.Tooltip` `Recursos` `Grupos` `SRC`

### Plano operativo

- Obsoleta: `Navegar` `Seleccionar` `Dibujar` `Borrar trazo` `deslizador: Grosor` `Deshacer último trazo` `Borrar todos los trazos del plano` `Recursos` `Colocar recurso en el plano` `Mostrar pin del plano` `Retirar pin del plano` `Centrar recursos del plano` `Modificar recurso` `Abrir Elementos` `Abrir Dotaciones`
- Nueva: `Seleccionar/mover` `Deshacer` `Rehacer` `Lápiz` `Polilinea` `Circunferencia` `Goma` `Deslizador: Grosor` `Selector de color: Herramientas` `Nota rápida` `L.Tooltip` `Recursos` `Grupos` `SRC` 

### Herramientas

### Seleccionar/mover (mano)

- **Seleccionar/mover .** Permite seleccionar objetos, moverlos y desplazarse por el lienzo.
    - Clic/toque sobre un objeto: lo selecciona y muestra sus tiradores de edición o vertices, si los tiene.
    - Arrastrar desde el interior de un objeto o desde su trazo: selecciona y mueve ese objeto en un solo gesto.
    - Arrastrar un tirador: modifica la parte de la figura que controla ese tirador.
    - Clic/toque sobre una zona vacía: quita la selección.
    - Arrastrar desde una zona vacía: desplaza la vista y conserva la selección.
Nota para el programador: El detalle que cuidaría al programar la mano es esperar a soltar para interpretar un toque en vacío.

### Deshacer y Rehacer

- **Deshacer y Rehacer.** Cada módulo conserva sus últimas 100 acciones de edición.
    - Deshacer revierte la última acción y la pasa a Rehacer. Rehacer vuelve a aplicarla y la devuelve a Deshacer.
    - Un punto, un trazo completo, un movimiento de objeto o una pasada continua de goma cuentan como una acción cada uno.
    - Una nueva edición confirmada después de deshacer vacía la pila de Rehacer. Al superar las 100 acciones, se descarta la más antigua.
    - Seleccionar, desplazar la vista, hacer zoom o centrar un pin son acciones de consulta y quedan fuera del historial.
    - Cada botón se desactiva cuando su pila está vacía.

### Lápiz

- **Lápiz.** Dibuja a mano alzada con el color y el grosor elegidos.
    - Clic/toque breve: dibuja un punto.
    - Pulsar y arrastrar: dibuja un trazo continuo que sigue al puntero o al dedo.
    - Soltar: confirma el trazo completo como una sola acción.
    - Pulsar Esc durante el dibujo: cancela el trazo en curso.

### Polilínea

Crea líneas abiertas y polígonos punto a punto. Mantén pulsado y arrastra para dibujar un rectángulo.

Primitivas en Plano operativo: L.polyline, L.polygon y L.rectangle.

#### 1. Dibujar una línea o un polígono

| Gesto                                                   | Resultado                                                                           |
|---------------------------------------------------------|-------------------------------------------------------------------------------------|
| Clic o toque en un espacio libre                        | Coloca el primer vértice. Cada nuevo toque añade otro vértice y lo une al anterior. |
| Tocar el único vértice                                  | Cancela el borrador.                                                                |
| Tocar el último vértice con dos o más puntos distintos  | Termina la línea abierta.                                                           |
| Tocar el primer vértice con tres o más puntos distintos | Cierra el contorno y termina el polígono.                                           |
| Pulsar Enter con dos o más puntos distintos             | Termina la línea abierta en el último vértice colocado.                             |
| Pulsar Esc o hacer clic derecho                         | Cancela el borrador completo.                                                       |
| Pulsar fuera del módulo                                 | Conserva el borrador para continuar al volver.                                      |

#### 2. Dibujar un rectángulo o un cuadrado

| Gesto                                                                 | Resultado                                                                                              |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Sin borrador activo, mantener pulsado en un espacio libre y arrastrar | Dibuja un rectángulo desde la esquina inicial hasta la esquina opuesta. Al soltar, confirma la figura. |
| Mantener Mayús (Shift) durante el arrastre                            | Iguala los cuatro lados. Si sueltas el puntero con Mayús pulsada, confirma el cuadrado.                |

#### 3. Editar los vértices

Con Seleccionar/mover, selecciona la figura para mostrar sus vértices.

| Gesto                                                                             | Resultado                                                                                                                                 |
|-----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Arrastrar una esquina de un rectángulo o cuadrado                                 | Ajusta el ancho y el alto por separado. La figura conserva sus cuatro vértices y sus cuatro ángulos rectos.                               |
| Mantener Mayús (Shift) mientras arrastras esa esquina                             | Iguala el ancho y el alto. Si sueltas el puntero con Mayús pulsada, queda un cuadrado. Si sueltas Mayús antes, continúas el ajuste libre. |
| Hacer doble clic o doble toque sobre un lado de un rectángulo o cuadrado          | Inserta un quinto vértice en el punto señalado y convierte la figura en un polígono libre.                                                |
| Arrastrar un vértice de una línea o un polígono libre                             | Mueve ese vértice y actualiza los segmentos unidos a él.                                                                                  |
| Hacer doble clic o doble toque sobre un segmento de una línea o un polígono libre | Añade un vértice en el punto señalado. Puedes repetir el gesto para añadir más vértices.                                                  |
| Arrastrar un vértice de una línea o un polígono libre sobre otro y soltar         | Elimina el vértice arrastrado si quedan al menos dos vértices distintos en la línea o tres en el polígono.                                |

#### 4. Vértices y punteros

| Cuándo aparece                                                               | Indicador visual                                                                                           |
|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Durante la creación o edición                                                | Cada vértice se marca con square-dashed.                                                                   |
| Al mover el puntero con un borrador abierto                                  | Una línea provisional une el último vértice con el puntero. El cursor muestra square-dashed-mouse-pointer. |
| Al pasar sobre el único vértice                                              | El cursor muestra square-dashed-x para indicar que puedes cancelar.                                        |
| Al pasar sobre un vértice que permite terminar la línea o cerrar el polígono | El cursor muestra square-dashed-plus para indicar que puedes confirmar.                                    |

#### 5. Grosor al hacer zoom

- **A escala con el dibujo** Modo inicial. El trazo se ve más grueso al acercar la vista y más fino al alejarla. Su anchura se expresa en metros.
- **Fijo en pantalla** — El trazo conserva el grosor elegido en píxeles al acercar o alejar la vista.
- Pulsa de nuevo el botón Polilínea mientras está seleccionado para alternar entre ambos modos. Los vértices permanecen anclados a los puntos donde los colocaste.

### Circunferencia

- **Modos de tamaño.** La herramienta se activa en metros. Volver a pulsar su icono mientras está seleccionada alterna entre metros y píxeles.
- **Metros · L.circle.** El radio representa una distancia sobre el mapa. Al cambiar el zoom, la figura conserva esa distancia.
- **Píxeles · L.circleMarker.** El radio se mide en píxeles de pantalla. Al cambiar el zoom, la figura conserva su tamaño visual.

#### Crear por radio · dos clics o toques

- El primer clic o toque marca el centro. El segundo marca un punto de la circunferencia y finaliza el dibujo. La distancia entre ambos puntos es el radio.
- **Puntero de dibujo** <radius> de Lucide    -> Se activa al primer click/tap y se desactiva al segundo click/tap.

#### Crear por diámetro · pulsar, mantener y arrastrar

- El punto de pulsación y la posición del puntero son los extremos del diámetro. La circunferencia se previsualiza con el centro a mitad de camino entre ambos. Al soltar, queda dibujada.
- **Puntero de dibujo** <diameter> de Lucide.       -> Se activa al mantener pulsado y se desactiva al soltar.

#### Crear un óvalo · mantener Shift durante el arrastre por diámetro

- Al pulsar Shift, se parte de la circunferencia visible. El diámetro conserva su longitud y se alinea con el eje horizontal o vertical de la pantalla según el ángulo que tenía en ese instante.
    - **Horizontal.** De 315° a 45° pasando por 0°, o de 135° a 225°, incluidos los extremos. El ancho queda fijo. Mover el puntero arriba o abajo ajusta la altura.
    - **Vertical.** Entre 45° y 135°, o entre 225° y 315°, excluidos los extremos. La altura queda fija. Mover el puntero a izquierda o derecha ajusta el ancho.
- **Soltar primero el botón del ratón** confirma el óvalo tal como se ve.
- **Soltar primero Shift** recupera la circunferencia y permite continuar el arrastre por diámetro.

#### Ajustar un óvalo en tablet · Seleccionar/mover

- Toca la circunferencia o el óvalo para mostrar sus cuatro tiradores.
- Arrastra el tirador izquierdo o derecho para ajustar solo el ancho, o el superior o inferior para ajustar solo la altura. Al levantar el dedo, se confirma la forma visible.

### Goma

 **Modos.** La goma se activa en «Borrar trazos». Pulsar de nuevo su icono mientras está seleccionada alterna entre «Borrar trazos» y «Borrar figuras y trazos».
 **Borrar trazos.** Un clic o toque borra la porción de trazo a mano alzada que queda dentro del anillo. Al mantener y arrastrar, la goma borra a lo largo del recorrido. El diámetro del anillo coincide con el grosor del deslizador.
 **Borrar figuras y trazos.** Un clic o toque sobre un trazo, una polilínea o el contorno de una figura elimina un único dibujo completo. Si se superponen varios, se borra el superior. Para borrar otro hace falta un nuevo clic o toque.
 **Deshacer.** Cada gesto de borrado cuenta como una acción. Un solo «Deshacer» recupera todo lo borrado en esa pasada.

### Deslizador: Grosor

- Pulsar el icono abre el deslizador y muestra el valor actual, de 1 a 40 en pasos de 1.
- Cada módulo mantiene un único valor compartido. Define el grosor del lápiz, de las polilíneas y del contorno de todas las figuras, incluidas circunferencias y óvalos. En «Borrar trazos», ese mismo valor define el diámetro de la goma.
- Si cambias el grosor con la goma y vuelves al lápiz, el lápiz utiliza el valor que acabas de elegir.

### Selector de color: Herramientas

- La paleta define la tinta común del lápiz, las polilíneas y los contornos de todas las figuras. Cambiar de herramienta conserva la tinta elegida.
- La muestra horizontal bajo el icono indica el color de esa tinta.

### Selector de color: Herramientas / Fondo

- La paleta abre siempre en «Herramientas». El interruptor elige cuál de los dos colores quieres editar, sea cual sea la herramienta activa.
    - **Herramientas.** Define la tinta común para los próximos trazos y contornos.
    - **Fondo.** Define el color base de la pizarra.
- La muestra horizontal bajo el icono indica siempre la tinta de dibujo.

### Nota rápida

- **Crear.** Pulsa el botón «Nota rápida». El módulo busca un hueco en la zona visible, coloca la nota y deja el cursor listo para escribir.
- **Editar.** Desde «Seleccionar/mover» puedes editar el texto, mover la nota o ajustar su tamaño.
- **En Plano operativo.** La nota permanece en el sitio de la pantalla donde la dejes. Puedes desplazar el mapa o cambiar el zoom y seguir teniendo el recordatorio a la vista.

### Etiqueta de texto

- **Visibilidad.** El texto permanece visible sobre el dibujo o el mapa. En Plano operativo corresponde a L.Tooltip con la opción «permanent» activada.
- **Sobre un objeto.** Activa la herramienta y toca o haz clic en el lugar exacto de la línea, figura o punto que quieras rotular. Escribe el texto de la etiqueta.
- **Varias etiquetas por objeto.** Puedes repetir el gesto en distintos lugares del mismo objeto. Cada etiqueta conserva su texto y su punto de anclaje. Así puedes rotular varios tramos de una misma ruta.
- **En un lugar vacío.** Toca o haz clic donde quieras escribir. La etiqueta queda anclada a ese punto de la pizarra o a esa ubicación del mapa.
- **Al mover la vista o el objeto.** La etiqueta acompaña a su punto de anclaje al desplazar la vista o cambiar el zoom. Si está vinculada a un objeto y lo mueves, se desplaza con él.

### Recursos · Pizarra y Plano operativo

El botón «Recursos» abre o cierra un panel lateral derecho con dos secciones, «Pines» e «Imágenes». El ancho se ajusta arrastrando el separador vertical, como en Informes. El lienzo sigue disponible mientras el panel está abierto.

#### Pines

La lista reúne los recursos creados en Elementos y Dotaciones. Cada fila corresponde a un recurso concreto, con su nombre e información, aunque varios compartan el mismo icono. Cada recurso puede tener un único pin colocado en cada módulo.

**Selección y gestos**

- **Clic o toque en una fila.** Selecciona un recurso.
- **Mantener la pulsación durante 2 segundos.** Activa la selección múltiple mediante casillas.
- **Deslizar en vertical.** Desplaza la lista.
- **Arrastrar una fila hacia el lienzo.** Coloca el pin donde lo sueltes. Puedes iniciar el arrastre desde cualquier parte de la fila, sin seleccionar antes el recurso. Al comenzar, se descarta la selección anterior y se arrastra únicamente ese pin.

**Acciones**

- **Colocar pin · selección única.** Disponible para un recurso pendiente de colocar en ese módulo. Al pulsar el botón, el puntero cambia a «crosshair» de Lucide. El siguiente clic o toque en el lienzo fija la posición del pin.
- **Mostrar/Ocultar pin · selección única o múltiple.** Actúa sobre los pines colocados de la selección. Si hay alguno visible, la primera pulsación oculta todos los seleccionados. Cuando todos están ocultos, la siguiente pulsación los muestra. Cada pin conserva su posición.
- **Centrar pin · selección única.** Centra la vista en el pin con el zoom actual. Para localizarlo, aparecen sobre él tres círculos amarillos sucesivos, a intervalos de un segundo, de mayor a menor.
- **Retirar pin · selección única o múltiple.** Retira del módulo los pines seleccionados. El recurso sigue disponible en la lista para volver a colocarlo.

Sin selección, los botones de acción están desactivados. El arrastre directo sigue disponible para los recursos pendientes de colocar.

#### Imágenes

**Insertar imagen.** Añade una imagen al lienzo. Puede haber varias imágenes en el mismo módulo y solo una seleccionada para editar en cada momento.
**Seleccionar/mover.** Toca o haz clic en una imagen para seleccionarla. Aparecen los tiradores de redimensionado en sus esquinas. Al pasar el puntero por el interior aparece el cursor de movimiento. Arrastra desde el interior para moverla o desde una esquina para cambiar su tamaño.
**Recortar.** Muestra únicamente los tiradores de recorte de la imagen seleccionada. Arrástralos para ajustar el área que quieres conservar.
**Girar y voltear imagen.** Muestra los tiradores de giro en los laterales y los controles de volteo en el centro. Arrastra un tirador lateral hasta alcanzar el ángulo deseado. Para voltear la imagen, pulsa «Voltear horizontal» o «Voltear vertical».
**Borrar imagen.** Elimina la imagen seleccionada.

Cada modo de edición muestra solo sus propios controles. «Recortar», «Girar y voltear imagen» y «Borrar imagen» requieren una imagen seleccionada.


### Grupos y SRC · Panel lateral compartido

- «Grupos» y «SRC» tienen botones independientes y comparten un panel lateral derecho. El separador vertical permite ajustar su ancho, igual que en Informes.
- Pulsar un botón muestra u oculta su sección. Si abres ambas, puedes consultar las dos a la vez. Al cerrar la última sección visible, se cierra el panel.

### Grupos · Pizarra y Plano operativo

- **Crear grupo.** Crea y nombra el grupo desde el panel. Después añade las formas y los pines que quieras incluir.
- **Pertenencia múltiple.** Una forma o un pin puede pertenecer a varios grupos del mismo módulo. Todos hacen referencia al mismo objeto.
- **Mostrar/ocultar grupo.** Un objeto agrupado se muestra si al menos uno de sus grupos está visible. Cuando todos sus grupos están ocultos, el objeto queda oculto. Mostrar u ocultar un grupo conserva el estado de los demás.
- **Encuadrar grupo.** Ajusta el centro y el zoom para que las formas y los pines del grupo quepan en la vista. En Plano operativo, L.FeatureGroup reúne sus capas y el mapa ajusta la vista a los límites del conjunto mediante fitBounds(group.getBounds()).

### SRC · Plano operativo

- **Superponer cartografía.** Al solicitar una capa a un servicio cartográfico, utiliza un código EPSG compatible con la capa y con el mapa. Así puedes mostrar cartografía de distintas fuentes en su ubicación correspondiente.
- **Transformar coordenadas.** Identifica el SRC de origen y el de destino por sus códigos EPSG y convierte las coordenadas de una misma ubicación entre ambos sistemas.

### SRC · Pizarra

- **Fijar el origen.** Señala el punto del croquis que representará la coordenada local (0, 0).
- **Calibrar la escala.** Marca dos puntos cuya separación conozcas e introduce la distancia real en metros.
- **Dibujar a escala.** A partir de esa calibración, la Pizarra puede interpretar las dimensiones en metros. Una circunferencia de 10 m de radio ocupa la distancia correspondiente sobre el croquis.

- Iconos de Lucide.dev
|                     |            |           |         |             |                    |        |                      |                                   |               |                |            |          |             |
|---------------------|------------|-----------|---------|-------------|--------------------|--------|----------------------|-----------------------------------|---------------|----------------|------------|----------|-------------|
| `Seleccionar/mover` | `Deshacer` | `Rehacer` | `Lápiz` | `Polilinea` | `Circunferencia`   | `Goma` | `Deslizador: Grosor` | `Selector de color: Herramientas` | `Nota rápida` | `L.Tooltip`    | `Recursos` | `Grupos` | `SRC`       |
| `Lucide-pointer`    | `undo`     | `redo`    | Actual  | `waypoints` | `drafting-compass` | Actual | Actual               | Actual                            | Actual        | `notebook-pen` | `pin`      | `layers` | `square-pi` |

---
