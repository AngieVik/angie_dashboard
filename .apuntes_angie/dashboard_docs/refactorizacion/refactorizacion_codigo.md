1. Reducir las copias del documento en cada edición
   El punto de partida es [documentStore.ts (line 170)](D:/Proyectos/angie_dashboard/src/features/document/documentStore.ts:170).
   - Convertir progresivamente las mutaciones en comandos que produzcan un estado nuevo copiando únicamente las ramas modificadas. Editar una nota copiaría esa nota y su colección; el resto conservaría sus referencias.
   - Cada comando indicaría si hubo cambios. Así se elimina la comparación entre dos documentos completos serializados.
   - Encolar la revisión pendiente y preparar una única instantánea cuando vaya a escribirse. Las colas actuales ya agrupan trabajos; hay que evitar el procesamiento pesado anterior a esa agrupación.
   - Separar las imágenes del estado cotidiano: guardar el original como Blob por huella y mantener una referencia interna. Al exportar, reconstruir el JSON portable actual.
   Precaución: sustituir structuredClone por una copia superficial manteniendo los mutadores actuales corrompería las instantáneas anteriores. Primero deben cambiar los comandos.
   Comprobación: editar Cuaderno con una imagen grande presente, medir latencia y memoria, y repetir recuperación, cambio de documento y conflictos. Mantendría inicialmente los tiempos actuales de autoguardado.
2. Acotar las entradas y corregir el parser de coordenadas
   Actuaría sobre [parseCoordinate.ts (line 6)](D:/Proyectos/angie_dashboard/src/features/coordinates/parseCoordinate.ts:6) y los puntos de entrada de texto, archivos y portapapeles.
   - Sustituir los separadores ambiguos del patrón DD por un análisis lineal que reconozca números y separadores sin volver repetidamente sobre los espacios.
   - Comprobar la longitud antes de ejecutar cualquier expresión regular. Aplicar esa comprobación también al portapapeles y a la recepción automática.
   - Rechazar entradas excesivas con un mensaje; no recortarlas silenciosamente, porque el recorte podría convertirlas en otras coordenadas.
   - Comprobar el tamaño del JSON antes de leerlo completo.
   - Definir presupuestos de texto, objetos y puntos, además del tamaño del archivo. Para documentos grandes admitidos, realizar el análisis fuera del hilo principal.
   Los presupuestos concretos deben considerar documentos existentes y Android: no convertiría las cifras de la auditoría en límites arbitrarios.
   Comprobación: repetir el caso de los 64.000 espacios, formatos válidos DD/DMS/DMM/UTM y archivos excesivos. La interfaz debe permanecer operativa y conservar el documento abierto.
3. Persistir los GPX y liberar sus cachés con seguridad
   Reemplazaría el papel actual de sessionFiles en [gpxAccessRepository.ts (line 11)](D:/Proyectos/angie_dashboard/src/storage/gpxAccessRepository.ts:11) por un repositorio de recursos compartido con las imágenes.
   - Guardar los bytes originales por huella, evitando duplicarlos cuando varios documentos utilicen el mismo archivo.
   - Confirmar conjuntamente la referencia del documento y la disponibilidad durable del recurso. Calcular huellas y preparar datos antes de abrir la transacción.
   - Mantener la geometría analizada en una caché de memoria con presupuesto, cargada cuando un consumidor la necesite.
   - Liberar geometría sin consumidores y expulsar recursos de la caché según su uso y tamaño.
   - Para borrar bytes persistentes, comprobar las referencias de documentos y recuperaciones. Cerrar Mapa no significa que su GPX pueda eliminarse.
   Comprobación: importar, cerrar el proceso y reabrir sin red; compartir un GPX entre documentos; retirarlo de uno y verificar que el otro y sus recuperaciones siguen funcionando.
4. Hacer que guardar dependa del documento actual y gestionar la capacidad
   En [documentRepository.ts (line 97)](D:/Proyectos/angie_dashboard/src/storage/documentRepository.ts:97) separaría dos trabajos:
   - Corrección inmediata: consultar únicamente las claves de snapshots del UIBoard actual, evitando toArray() sobre toda la biblioteca.
   - Cambio estructural: mantener un catálogo ligero con título, fechas, revisión, tamaño y referencias de recursos. Recuperación consultaría ese catálogo con paginación y cargaría el contenido al abrir una versión.
   Después incorporaría medición de espacio y una gestión explícita de documentos y recuperaciones. La limpieza automática se limitaría a cachés y recursos cuya ausencia de referencias esté demostrada. Los documentos conservados por el usuario requieren una decisión de eliminación.
   Mantendría las comprobaciones de revisiones entre pestañas y de cambios externos en carpeta; una revisión local no sustituye esos controles.
   Comprobación: guardar un documento pequeño con una biblioteca creciente y comprobar que no se cargan documentos ajenos. Simular cuota agotada y verificar que no desaparecen recuperaciones.
5. Contener los fallos de interfaz
   Añadiría un límite global alrededor de App en [main.tsx (line 13)](D:/Proyectos/angie_dashboard/src/main.tsx:13) y otro alrededor de cada módulo.
   - Un fallo de Reloj mostraría un error dentro de Reloj y permitiría seguir utilizando los demás módulos.
   - El módulo ofrecería reintento mediante remontaje, conservando el store y el documento.
   - El límite global tendría una presentación mínima que no dependiera de los componentes que han fallado y permitiera obtener una copia recuperable del estado disponible.
   - Las operaciones asíncronas comunicarían sus errores desde su propietario: los boundaries no capturan por sí solos promesas, eventos e intervalos.
   Comprobación: repetir la excepción inyectada con cambios pendientes. Deben conservarse tanto el estado en memoria como la posibilidad de recuperación.
6. Procesar GPX fuera del hilo principal
   Extraería la lectura y preparación iniciada en [gpxFileAccess.ts](D:/Proyectos/angie_dashboard/src/features/map/gpxFileAccess.ts) a un worker dedicado.
   - El worker realizaría análisis, validación y preparación de geometría.
   - El parser debe ser compatible con workers; no basta trasladar sin cambios la implementación basada en DOMParser.
   - Cada petición llevaría identificador y generación del documento. Una respuesta antigua nunca actualizaría otro UIBoard.
   - Cancelar, cambiar de documento o cerrar la operación detendría el trabajo pendiente.
   - Transferiría coordenadas en buffers compactos y prepararía las capas visuales por lotes. El worker elimina el bloqueo del análisis, pero dibujar todo de golpe también puede bloquear.
   - Conservaría el original; cualquier simplificación sería una representación para dibujar.
   Comprobación: importar GPX grandes mientras se interactúa con otros módulos, cancelar a mitad y repetir importaciones comprobando que la memoria vuelve a estabilizarse.
Orden de ejecución recomendado: primero 2 y 5, después la consulta acotada del 4; a continuación, el núcleo compartido de recursos de 1 y 3, las optimizaciones de edición del 1, y finalmente 6 y la gestión completa de capacidad del 4.
