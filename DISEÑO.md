# Angie Dashboard

Las normas de este documento forman el estándar de la interfaz y se aplican por defecto. Los componentes con un comportamiento específico conservan las excepciones que necesiten.

- Se conserva la personalidad industrial de Angie.
- El borde rojo de resaltado, pierde su función si lo usamos para todo.

## Tokens y cascada

- `src/styles/tokens.css` contiene únicamente variables: paleta y medidas primitivas, seguidas de asignaciones semánticas. Los componentes consumen los tokens semánticos; los valores específicos de una composición permanecen locales.
- Las medidas efectivas de los módulos se derivan de sus medidas base y del zoom una sola vez. Una especialización local modifica solo los valores necesarios.
- `src/styles/layers.css` fija el orden único `reset, vendor, base, components, overrides, utilities` y se carga antes de los componentes. No se redefine el orden desde una funcionalidad.
- Las hojas externas de Leaflet, React Grid Layout y react-resizable se importan únicamente desde `src/styles/integrations/`, dentro de `vendor`. Las adaptaciones de Angie tienen su ámbito explícito.
- El reseteo pertenece a `reset`, los estilos generales a `base`, las bases de los componentes a `components` y sus especializaciones a `overrides`. `utilities` contiene solo utilidades transversales de estructura y accesibilidad.
- La clase base de un componente se conserva al añadir una variante. El orden de las clases en `className` no determina la prioridad CSS. Las excepciones funcionales de medición y movimiento no se sustituyen por cambios visuales.

## Tipografía

- Roboto Condensed es la fuente común de la interfaz, controles y datos técnicos.
- El contenido de Reloj y sus temporizadores utiliza Rajdhani; la cabecera común conserva Roboto Condensed. La excepción se aplica mediante el token local de fuente, manteniendo el estilo base de los controles.
- Las declaraciones activas de ambas familias se centralizan en `src/styles/fonts.css`, con archivos locales de `public/assets/fonts/` para el funcionamiento offline. Solo se declaran los pesos y estilos disponibles; el fallback es genérico.
- Las cifras tabulares se conservan donde corresponda. Tamaños, pesos y escalado se definen por su cometido, sin introducir otras familias para datos técnicos.
- Los informes comparten Roboto Condensed y deben incorporar sus fuentes para abrirse sin conexión.

## Botones de texto

- La altura base común de los botones de texto es de 25 px al 100 % de zoom, alineada con las herramientas de icono; el zoom interno escala esa altura.

## Campos

- Los campos multilínea compartidos utilizan `Textarea`, con base y estados en su CSS Module. Las particularidades de cada funcionalidad se declaran en `overrides`, conservando la clase base y modificando solo las propiedades necesarias.
- Los campos de una línea tienen una altura base de 25 px al 100 % de zoom. El zoom interno escala esa altura.
- Al aumentar la altura de una ventana, los campos de una línea conservan su altura; el espacio adicional se distribuye entre los contenedores flexibles.
- Los campos no muestran resaltado de foco ni borde rojo al pasar el puntero.

## Tamaño de las ventanas estándar

- Coordenadas es la referencia del comportamiento de tamaño: los contenedores flexibles crecen proporcionalmente y la reducción vertical se detiene cuando sus contenidos y márgenes llegan al mínimo.
- El mínimo vertical depende de la composición, del ancho disponible y del zoom interno; incluye la cabecera, los controles visibles, los bordes y los márgenes necesarios.
- El ancho mínimo de una ventana expandida depende de su contenido, sus controles, sus márgenes y el zoom interno.
- Tanto el mínimo horizontal como el vertical se calculan con los márgenes y las separaciones en su mínimo, sin incluir espacio flexible sobrante ni recortar el contenido o los controles.
- El tirador no permite reducir una ventana expandida por debajo de sus mínimos ni convertirla en barra o icono. Para recogerla se utilizan los controles de colapsar o contraer.
- Los módulos especiales, como Pizarra, conservan el tratamiento específico que requiera su contenido. La extensión del patrón estándar se concreta por componente.

## Contenido variable y desplazamiento

- Registro e Información se rellenan automáticamente: su crecimiento automático tiene un máximo de 600 px de altura total. Si el contenido supera ese límite o no cabe en la ventana, aparece la barra vertical a la derecha. El tamaño elegido con el tirador se recuerda y prevalece sobre el ajuste automático.
- Elementos, Dotaciones, Cuaderno y Reloj se rellenan manualmente: crecen y se reducen con el contenido, con un máximo automático de 600 px de altura total. Cuando el contenido supera ese límite o no cabe en la ventana, aparece la barra vertical a la derecha.
- En estos módulos, el mínimo vertical permite ver la cabecera, los controles y una fila de la lista, con márgenes y separaciones al mínimo. El resto del contenido puede desplazarse.
- Los 600 px limitan el ajuste automático; el redimensionado manual puede superar esa altura.
- Colapsar o contraer conserva el tamaño expandido. Restaurarlo no debe desencadenar otro ajuste automático.

## Estados de ventana y cabecera

- Las dimensiones de estos estados incluyen los bordes y se expresan al 100 % de zoom global: colapsada, 200 × 27 px; contraída a icono, 27 × 27 px.
- La ventana colapsada mantiene su tamaño fijo. El tirador de redimensionado solo aparece en la ventana expandida.
- En la cabecera expandida o colapsada, cerrar ocupa el extremo superior derecho y colapsar queda inmediatamente a su izquierda.
- En el estado contraído se muestra únicamente el icono del módulo, que permite restaurar la ventana.

## Control de zoom

- El control y el indicador de zoom interno se ocultan cuando no caben completos en su espacio, respetando el área del tirador de redimensionado.
- Vuelven a mostrarse cuando recuperan espacio suficiente, sin alterar el valor de zoom ni superponerse a otros controles.

## Herramientas de icono

- Los símbolos de 15 px se centran en controles de 25 × 25 px, con 5 px de espacio visual por lado al 100 % de zoom.
- Los iconos integrados en campos no muestran bordes ni resaltados rojos; Coordenadas es la referencia de este acabado.
- Quitar y eliminar comparten el acabado de las demás acciones, sin una diferenciación roja específica. Eliminar utiliza la papelera.

## Informes

- Los visores de encuadre utilizan las superficies oscuras de Angie, incluidas las atribuciones cartográficas.
- Conservan página blanca y estilos propios de impresión.
- Comparten tipografía, jerarquía e identidad con la interfaz de Angie.
