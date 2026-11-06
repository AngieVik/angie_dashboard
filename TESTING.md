# Validación

Ejecuta los comandos desde la raíz, con las dependencias instaladas según [SETUP.md](SETUP.md).

## Comprobaciones estáticas

```powershell
npm run lint
npm run build
```

Ambos comandos deben terminar sin errores. `build` comprueba los tipos y genera `dist/`; `npm run typecheck` permite comprobar solo los tipos.

No hay un script `npm test` ni una cobertura mínima configurada. Las pruebas E2E automatizadas están desactivadas; la validación funcional es manual, según [AGENTS.md](AGENTS.md#pruebas-y-depuración).

## Comprobación manual

Después de compilar:

```powershell
npm start
```

Abre la dirección que muestra la terminal, por defecto [http://127.0.0.1:4180](http://127.0.0.1:4180), y utiliza un UIBoard de prueba, sin datos reales. Comprueba el área modificada y sus consumidores; antes de publicar, recorre esta lista completa:

- **Datos:** crear un UIBoard, añadir una dotación, cambiar su estado y comprobar Información y Registro. Crear y editar una nota y un checklist.
- **Archivo:** guardar, confirmar el resultado y volver a abrirlo. Deben conservarse los datos portables y los módulos abiertos; el alcance exacto está en [Datos y persistencia](ARQUITECTURA.md#datos-y-persistencia).
- **Copia local:** esperar a que Archivo indique guardado en el dispositivo, recargar y comprobar la recuperación de los datos portables. Hacer esta prueba sin recursos ni geometría que solo estén en memoria.
- **Ventanas:** abrir, recoger, expandir, redimensionar y cambiar el zoom. Las herramientas y el contenido deben seguir accesibles. Comprobar también el foco y las acciones con teclado.
- **Informes:** seleccionar campos, generar la vista previa, guardar HTML y abrir Imprimir/PDF. Comprobar que la salida contiene los campos seleccionados.
- **Cartografía:** con conexión, abrir Mapa y Plano y comprobar las herramientas afectadas. Las teselas no se esperan disponibles sin red.
- **PWA:** comprobar carga tras una primera visita con conexión, reapertura sin red de las funciones locales y actualización según [DEPLOYMENT.md](DEPLOYMENT.md#actualizar-o-revertir).

Anota revisión de código, navegador, dispositivo, casos comprobados y fallos. Una compilación correcta no acredita funcionamiento en navegador ni en dispositivo físico.

### GPX y trazos en el antimeridiano

Validación manual pendiente en Mapa y en su integración en Plano, con GPX ficticios:

- Usa un segmento de latitud 0° y longitudes `179,9° → −179,9°`, y otro en sentido inverso. La importación y «Encuadrar» deben mostrar el cruce corto alrededor de ±180°, sin una línea que atraviese Greenwich. A latitud 0°, la distancia debe seguir siendo aproximadamente 22,24 km.
- Repite con varios segmentos desconectados, varios archivos, puntos aislados y waypoints a ambos lados de ±180°. Encuadra juntos y por separado; no deben aparecer uniones entre segmentos ni quedar puntos fuera del encuadre. Incluye un recorrido largo cuyos extremos estén próximos, para comprobar que los límites contienen también su interior.
- Usa más de 256 y más de 1.024 puntos, situando cruces en los límites de ambas tandas. Comprueba continuidad del dibujo, PK, selección, altitud y distancia, también con puntos de longitud exactamente +180° y −180°.
- Selecciona ambos lados del cruce y navega por el perfil. El indicador y las marcas PK deben coincidir con el trazado; se conserva el ajuste de 14 píxeles y el centrado desde el perfil conserva el zoom. Desplaza la vista a otra copia del mundo y vuelve a encuadrar.
- En Plano, dibuja sobre el cruce y comprueba el borrador, el trazo al soltar y su borrado a ambos lados. Un clic lejos del trazo no debe borrarlo. Repite tras desplazar la vista y cambiar zoom.
- Comprueba un GPX habitual que no cruce el antimeridiano, visibilidad/color/PK, cancelación de importación o selección y sustitución de documento. Repite las interacciones en el navegador y dispositivo de referencia.

### Temporizadores entre pestañas

Usa temporizadores ficticios en dos pestañas del mismo origen y permite el audio en ambas:

- Crea un T-Minus y un Advisory en A. Confirma que B recibe las altas y los cambios de duración. Mientras editas una duración en B, modifica otro temporizador en A: el borrador y el foco de B deben conservarse.
- Con B visible y después con B en segundo plano o suspendida, pausa, reinicia, desactiva o elimina desde A antes del vencimiento original. Espera a ese vencimiento y vuelve a B: no debe sonar la ejecución cancelada ni reaparecer un temporizador eliminado. Repite cerca del vencimiento, comprobando que la cancelación se haya guardado antes.
- Deja vencer un temporizador válido; reconoce la alerta o elimina el temporizador en A. El aviso y el sonido deben retirarse también en B. Repite sin `BroadcastChannel`, conservando Web Locks, para comprobar la validación previa al audio y la reconciliación posterior.
- Ejecuta rápidamente duración, iniciar, pausar y reiniciar; comprueba que se conserva el orden. Cierra y reabre Reloj, recarga la página y vuelve mediante Atrás/Adelante. No deben reaparecer alarmas antiguas. Verifica también T-Zero, la prueba de sonido y «Activar sonido» desde Mensajes y la recuperación global.
- Con una escritura pendiente, provoca un fallo de almacenamiento y realiza otras órdenes. Deben conservarse en memoria sin iniciar audio nuevo. Si A cambia después la revisión guardada, el reintento de B debe mostrar conflicto, conservar su trabajo y bloquear nuevas alarmas hasta la recarga explícita. Silenciar debe funcionar durante el conflicto.
- Provoca un fallo en la primera lectura, crea un temporizador en memoria y reintenta al recuperar acceso: debe conservarse junto a los registros guardados. Sin Web Locks, deben mostrarse los avisos de indisponibilidad y conservarse las órdenes en memoria sin iniciar alarmas automáticas.

Los diagnósticos son análisis opcionales; sus comandos y límites están en [la guía de scripts](docs/guia_scripts.md). No sustituyen estas comprobaciones.
