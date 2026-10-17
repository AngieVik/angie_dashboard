# Servicio de pronóstico

El backend descarga el widget oficial de AEMET sin clave y extrae sus valores. El catálogo local limita las consultas a municipios conocidos. No recibe documentos ni GPX.

- Desarrollo: `npm run dev` incluye el servicio en el mismo origen que Angie.
- Vista previa: Vite preview incluye el mismo servicio.
- Build servido por Node: después de un build aprobado, `npm start` sirve `dist` y `/api/forecast/<municipio>` en `http://127.0.0.1:4180`.
- `HOST` y `PORT` permiten configurar la escucha. Un despliegue debe publicar la aplicación y la API bajo el mismo origen HTTPS. Un alojamiento exclusivamente estático no ejecuta este backend.

La caché está en memoria: cinco minutos, hasta 64 municipios y dos descargas simultáneas. Si AEMET falla, puede devolver la última descarga durante un máximo de treinta minutos, identificada expresamente como anterior.

Se conservan los periodos UTC, los valores y títulos técnicos, la atribución © AEMET y los enlaces a los avisos. Los periodos sin avisos publicados se marcan sin datos; no se interpretan como ausencia de peligro. La fecha `Last-Modified` corresponde al recurso web y se distingue de la hora de consulta; no se presenta como fecha de elaboración del modelo.

Cada etiqueta de aviso incluye un desplegable con su título. Al abrir un fenómeno con peligro, `/api/forecast/<municipio>/warnings/<hoy|mna|pmna>?day=<día del mes>` consulta la página de su zona y el servicio público que usa AEMET para rellenar su tabla de detalle. El frontend filtra por el código del fenómeno, conserva valor, probabilidad, zona, nivel, comienzo, finalización, comentario y clasificación previsto/observado. Los horarios mantienen el desplazamiento UTC original. Si el día seleccionado ya no coincide, se pide actualizar el pronóstico.

El detalle tiene una caché independiente con los mismos límites de tiempo y tamaño, y dos consultas simultáneas. Los fallos de esa consulta se muestran dentro del desplegable; no sustituyen los datos del pronóstico. Se mantienen el enlace oficial, la hora de consulta y, cuando está disponible, `Last-Modified` del recurso de detalle. No se asignan comunicados generales a los fenómenos de la zona.

La extracción depende del HTML oficial. Si faltan campos o cambian sus columnas, el servicio devuelve un error en lugar de reinterpretar la información.

Fuente: https://www.aemet.es/es/eltiempo/widgets

Condiciones: https://www.aemet.es/es/nota_legal
