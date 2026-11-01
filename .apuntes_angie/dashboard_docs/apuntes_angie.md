# apuntes_angie

- **Avisos**
    - **Aviso de carga**
        - No se pudo mostrar Angie
            - El documento disponible sigue en memoria. Descarga una copia antes de cerrar esta página.
            - La copia no incluye archivos GPX externos, agenda ni temporizadores.
                - Descargar copia recuperable
            - Descarga iniciada. Conserva este JSON de recuperación.
                - Reintentar interfaz
- **Crear y editar rutas**
    - Conservar intacto el archivo importado originalmente.
    - Trabajar sobre una copia editable perteneciente al UIBoard.
    - Guardar sus modificaciones en gpx/, protegiéndolas con las copias del UIBoard.
    - Permitir exportar expresamente el resultado como GPX.
    - Incorporar primero edición manual de puntos y tramos; definir aparte el cálculo automático siguiendo carreteras o caminos.
- **Posibles mejoras**
    - Preparar extracciones habituales sin marcar las mismas casillas cada vez.
    - Corregir errores de edición sin recurrir a una recuperación completa.
- **Módulo Meteorológico Básico**
    - Un widget que consuma una API gratuita (como OpenWeather) para mostrar temperatura, probabilidad de lluvia y velocidad del viento en tu ubicación.

- **General**
    - Revisión de comportamiento de redimensionado y iman en todos los modulos.
    - Unificar controles de mouse y tactil.
- **Header**
    - `RadarButton` queda a la izquierda del imán, con los avisos a la izquierda.
- **Registro**
    - Con la ventana en su minimo tamaño, al activar el dimensionado automatico, mueve la barra de desplazamiento al inicio.
- **Coordenadas**
    - Generador de Plus Codes (Open Location Code)
- **Calculadora**
    - Al realizar una operacion, mostrar la operación del input a la izquierda del resultado en sombreada. Al hacer otra operacion se moverá hacia la izquierda y queda en visual pero sombreado, despues desaparece.
    - Reorganizar para incluir botón para borrar ultima operación, y historial
    - Al activar el historial, la pantalla podrá tener varias filas (Hasta 10 operaciones)
- **Cuaderno**
    - Hacer mas fino el tirador.
    - ¿quitar checklists?.
    - Hacer algo, no me gusta.
- **Conversor**
    - libras a kilos
    - Fahrenheit a Celsius
    - PSI a bares para las botellas de oxígeno
    - Glucemia (mg/dL ↔ mmol/L)
    - Estimador de Peso Pediátrico
    - Minutos de o2 restantes, en una bala de 10 L multiplicas por los bares restando un valor residual (aprox 10%) el resultado lo divides por el flujo que vas o estas usando(LPM) el resultado es los minutos que tienes
    - Carga Eléctrica del Vehículo (W ↔ A)
- **Informes**
    - No funciona el iman, (revision en todos los modulos).
    - Genera la vista previa en una zona muerta del modulo, opciones para decidir donde se ve.
        - opciones: abrir la vista entera en la ventana y permitir desplazar, o abrir en una ventana diferente, una columna a la izquierda para los checkboxes en columna, colapsable, y a la derecha la previsualizacion.![alt text](image.png)
    - Los elementos dentro de cada modulo aparecen o desaparecen de la vista si el checkbox de su titulo esta activado/desactivado.
    - Definir los minimos de ventana.
    - los grupos de checkboxes de los modulos ocultan su contenido hasta marcar la cabezera, ademas estarán en columna.
    - crea iconos para:
        - Actualizar informe
        - Guardar informe
        - Imprimir / PDF
        - Descargar informe
- **Configuración**
    - Seleccion de punto de coordenadas en pines para por defecto
    - Estado del redimensionado automatico por defecto
    - Control del zoom de los modulos por defecto
- **Mapas**
    - Arreglos:
        - Para navegar por el mapa, muestra un puntero de mano abierta / puñito al arrastrar, la mano abierta de arrastre, no es lo mas intuitivo para un mapa y dificulta la selección con precisión. vamos a usar la mano con indice arriba / puñito al arrastrar.
        - El punto de marca en el mapa (el que queda cuando click/taap) es un circulo; tenemos que poner una cruceta o algo asi. Contempla la posibilidad de una chincheta en blanco y negro.
    - Overpass API (OpenStreetMap)
        - Pedir exclusivamente elementos con la etiqueta highway=track (pistas de tierra) o superficies sin asfaltar. La API te devuelve un archivo GeoJSON extremadamente ligero que Leaflet dibuja como líneas vectoriales sobre tu lienzo. Esto te permite apagar el mapa base normal y visualizar únicamente la red de caminos viables para un 4x4, eliminando todo el ruido visual de edificios, comercios o calles peatonales.
    - Hospitales, centros de salud y urgencias
        - La cartografía sanitaria de Andalucía anuncia hospitales públicos y privados, urgencias de atención primaria y farmacias, con WMS y descargas.
        - Localizar centros de referencia en Mapa y Plano operativo y consultar sus datos.
    - Pendientes y relieve
        - IGN / PNOA-LiDAR: pendientes calculadas sobre una malla de 5 m, terreno y superficies, mediante WMS/WMTS.
        - Valorar el terreno alrededor de un recorrido y complementar la altitud puntual existente.
    - Zonas inundables
        - MITECO / SNCZI: inundación fluvial y costera, riesgos y dominio público hidráulico. Superponer zonas de peligrosidad al planificar ubicaciones, accesos y recorridos.
        - Es cartografía de planificación; no representa por sí sola una inundación en curso.
        - Carreteras, hidrografía y límites
        - DERA — IECA: transportes, ríos, embalses, servicios y divisiones administrativas, con WMS y WFS.
    - Vías pecuarias y espacios protegidos REDIAM ofrece servicios ambientales WMS/WFS.
        - Su inventario de vías pecuarias incluye trazados y lugares asociados. Preparar dispositivos en entornos rurales.
        - Algunos trazados son aproximados; su presencia no acredita que sean transitables.
    - Avisos meteorológicos y radar AEMET OpenData documenta avisos CAP, radar nacional y regional y predicciones.
        - Requiere clave de API. Complementar la meteorología con avisos por zona y radar.
        - Habría que estudiar el formato del producto antes de superponerlo al mapa.
    - Incendios y peligro meteorológico
        - EFFIS / Copernicus: detecciones satelitales, áreas quemadas e índices de peligro; dispone de servicios WMS temporales.
        - Añadir contexto forestal mostrando la fecha del dato y distinguiendo detección satelital, perímetro e índice previsto.
    - Incidencias de tráfico
        - La DGT publica información mediante el Punto de Acceso Nacional.
        - Consultar incidencias que puedan afectar a accesos y desplazamientos. Falta confirmar el recurso de producción vigente.
    - Oleaje, nivel del mar y corrientes
        - Puertos del Estado ofrece observaciones y predicciones mediante Portus y sus servicios asociados.
        - Información para dispositivos en playas, puertos o pruebas acuáticas. El acceso automatizado y las condiciones de redistribución requieren estudio específico.
    - Activar información temática de Andalucía y, usando datos vectoriales, seleccionar elementos y consultar atributos.

- Revisar y alinear las versiones de los componentes superiores de Radix, empezando por DropdownMenu y Menubar. Después comprobaríamos cuántos duplicados desaparecen y cuánto baja realmente el build.

- En [FileMenu.tsx](D:/Proyectos/angie_dashboard/src/features/document/FileMenu.tsx) siguen entrando directamente RecoveryDialog y WorkDirectoryDialog. Recuperación arrastra el calendario compartido y, con él, DayPicker y date-fns, que aportan aproximadamente 69 kB al principal.

Diálogos bajo demandaCargar Recuperación y Carpeta de trabajo cuando se abran  
El cambio sería utilizar carga diferida para esos diálogos, igual que ya hacemos con Configuración. Después compararíamos el build para comprobar cuánto código sale realmente del arranque; no asumiría que desaparecen los 69 kB completos.

Generación de informes bajo demanda
aunque la ventana Informes ya sea diferida, [documentStore.ts](D:/Proyectos/angie_dashboard/src/features/document/documentStore.ts) sigue importando su lógica de generación desde el inicio. Separaríamos los títulos y constantes ligeros que usa Archivo, y cargaríamos el motor al generar. Habría que conservar las comprobaciones de generación y cancelación existentes.
