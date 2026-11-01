# resumen_habilidades

## angie-modulos

- Localizar las piezas implicadas: contenido, registro, ventana, estilos y conexión con el estado de la app.
- Elegir un módulo existente como referencia, según su comportamiento: formulario, listado, calculadora, mapa o lienzo.
- Resolver su integración: apertura, cierre, recogida a icono, tamaño, scroll y zoom, reutilizando los mecanismos actuales.
- Determinar dónde pertenece cada dato: documento portable, navegación local o estado temporal. Si requiere una decisión nueva de persistencia, presentarla antes de implementarla.
- Identificar las comprobaciones pertinentes, ejecutando únicamente las autorizadas.

[$angie-modulos](C://Users//devil//.codex//skills//angie-modulos//SKILL.md)

## angie-gestos-geometria

- Distinguir los espacios de coordenadas: pantalla, escritorio, módulo y lienzo o mapa. Identificar dónde se aplican desplazamientos y escalas para evitar saltos o aplicar el zoom dos veces.
- Analizar arrastres y redimensionados: origen del gesto, captura del puntero, límites, tamaño restaurado y finalización o cancelación.
- Resolver conflictos de interacción: diferenciar mover una ventana, desplazar su contenido, seleccionar un elemento y accionar un control.
- Tratar los gestos táctiles: seguir la cancelación al incorporar dedos y comprobar que no quedan manipulaciones activas después.
- Separar geometría y navegación: reconocer qué pertenece al documento y qué debe mantenerse localmente por documento.

[angie-gestos-geometria](C:/Users/devil/.codex/skills/angie-gestos-geometria/SKILL.md)

## angie-persistencia

- Contenido del documento: elementos, notas, trazos y geometría que deben acompañar al UIBoard.
- Estado local del dispositivo: navegación, zoom o preferencias que deben recordarse sin incorporarlas necesariamente al documento portable.
- Recursos externos: imágenes y archivos GPX, cuyas referencias deben seguir apuntando al recurso correcto.
- Temporizadores: conservan su almacenamiento independiente.
- Estado temporal: decisiones sobre qué selecciones, formularios o vistas previas deben desaparecer y cuándo.

[angie-persistencia](C:/Users/devil/.codex/skills/angie-persistencia/SKILL.md)

## angie-integraciones

Acceso desde la PWA: comprobar si el servicio puede consultarse directamente desde el navegador, incluidos CORS y el método de autenticación.
Claves y credenciales: distinguir una clave apta para uso público de un secreto que no debe incorporarse al código descargado por el navegador.
Contrato de datos: entender formatos, unidades, fechas, zonas horarias, cobertura y frecuencia de actualización.
Límites y condiciones: verificar documentación oficial, cuotas, costes, atribución y restricciones de uso.
Comportamiento ante fallos: resolver cancelación, tiempos de espera, respuestas incompletas, límites de consultas y ausencia de conexión.
Encaje en Angie: reutilizar sus mecanismos y decidir qué datos deben conservarse, durante cuánto tiempo y dónde.

[$angie-integraciones](C://Users//devil//.codex//skills//angie-integraciones//SKILL.md)

## angie-cartografia

Coordenadas y proyecciones: interpretar formatos, convertirlos correctamente y evitar errores de orden entre latitud/longitud, unidades o sistemas de referencia.
Pines y sincronización: seguir cómo una ubicación seleccionada se representa y actualiza entre módulos, evitando mantener posiciones contradictorias.
Recorridos GPX: trabajar con trazados, puntos kilométricos, distancias, perfiles y elevaciones, distinguiendo datos originales, cálculos y consultas externas.
Capas y fuentes cartográficas: comprobar proyección, cobertura, atribución, condiciones de uso y acceso desde la PWA antes de incorporar o cambiar un proveedor.
Vista del mapa: distinguir zoom geográfico, escala visual del módulo, centrado y encuadre para que cada acción produzca el resultado solicitado.

[$angie-cartografia](C://Users//devil//.codex//skills//angie-cartografia//SKILL.md)

## angie-interfaz-compacta

Densidad útil: reducir huecos, márgenes y alturas innecesarias conservando la legibilidad y el manejo táctil.
Controles coherentes: reutilizar botones, iconos, campos, colores y estados existentes. Evitar que cada módulo parezca una aplicación distinta.
Alineación y proporciones: ajustar filas, columnas, etiquetas y herramientas para que todo ocupe el espacio que necesita.
Textos directos: etiquetas breves y ausencia de explicaciones repetidas o ayudas añadidas sin pedirlas.
Adaptación al espacio disponible: decidir cómo distribuir el contenido, qué puede crecer y dónde corresponde el scroll, siguiendo el comportamiento acordado.

[$angie-interfaz-compacta](C://Users//devil//.codex//skills//angie-interfaz-compacta//SKILL.md)
