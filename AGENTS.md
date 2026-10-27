# Angie Dashboard

- Trabaja en la petición actual y conserva los cambios ajenos.
- Trabaja una sola fase por turno. Si la tarea requiere varias fases, propón su división antes de empezar. Detente obligatoriamente al terminar la fase acordada y espera la indicación del usuario para continuar; no encadenes fases en una misma respuesta ni sobrecargues el contexto.
- Lee solo el código y las instrucciones necesarios; reutiliza el contexto disponible.
- Usa herramientas y skills cuando aporten valor, ajustando su proceso al alcance.
- Propón en lugar de inventar: no añadas requisitos, comportamientos, archivos, funciones, dependencias ni resultados no solicitados o no comprobados. Presenta las ideas nuevas como propuestas y espera su aceptación antes de implementarlas.
- Pregunta en lugar de asumir: cuando falte información o exista una ambigüedad que afecte a la tarea, pregunta antes de actuar.
- Ante cualquier hallazgo que genere distracción o confusión, detén el trabajo, comunícalo y pregunta. Resuélvelo con el usuario antes de continuar.
- Mantén estructura, nombres, convenciones y comportamiento ajeno al cambio.
- Conserva la PWA local-first Windows/Android, la compatibilidad de documentos y la persistencia; los temporizadores usan almacenamiento independiente.
- Conserva los recursos originales de public/assets y usa datos ficticios sin información clínica ni de pacientes.
- No añadas ni ejecutes tests o comprobaciones por defecto: pruebas unitarias, E2E, lint, tipos, build, navegador o dispositivo requieren petición o aceptación expresa del usuario y un alcance concreto. No restablezcas automatismos retirados sin autorización expresa.
- Suites completas, auditorías, matrices y revisión por agentes: únicamente a petición expresa, también al terminar un flujo.
- No generes ni guardes históricos de desarrollo, instrucciones antiguas ni revisiones de la app. No crees informes de trabajo ni copias de instrucciones como registro de lo realizado. Esta norma no afecta a las copias de seguridad ni a las recuperaciones de los UIBoards del usuario. Elimina los temporales al cerrar.
- Al generar código o revisar un área, elimina dentro del alcance autorizado lo que haya quedado obsoleto o se haya confirmado que no funciona. No acumules implementaciones sustituidas, código muerto ni restos de soluciones anteriores. Si no está claro qué debe retirarse, pregunta antes de borrarlo.
- Actualiza las instrucciones en su sitio. Al alcanzar una meta, elimina sus archivos de instrucciones específicos y retira las instrucciones ya cumplidas; conserva únicamente las normas generales y de diseño que sigan vigentes.
- El objetivo es una app funcional, con desarrollo evolutivo y código limpio, bien escrito y bien ordenado. No amplíes el alcance por iniciativa propia para perseguir ese objetivo.
- Si detectas una norma que limite tu creatividad digital o te obligue a tomar decisiones que produzcan resultados básicos o comunes, avisa al usuario en cuanto lo detectes, identifica la norma y explica la limitación antes de continuar.
- Resume brevemente qué cambió, qué comprobaste y qué queda pendiente. Distingue emulación de dispositivo físico.
- Publicaciones, pushes, migraciones y cambios en producción requieren autorización expresa.

## Entorno

- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2. Instala desde la raíz con `npm ci`, utilizando `package-lock.json`; conserva sus versiones salvo que la petición incluya actualizarlas.

## Diseño

- Consulta DISEÑO.md cuando se indique trabajar, definir, revisar o consolidar el estilo o diseño.
- En tareas funcionales, reutiliza los componentes y tokens existentes sin iniciar una revisión visual general.

## Textos

- No escribas explicaciones innecesarias en los cuadros de diálogo, textos repetidos, ayudas ni minitutoriales. Los textos explicativos requieren petición explícita; puedes sugerirlos si los consideras necesarios, sin añadirlos por iniciativa propia.
- Los botones, indicaciones, complementos y demás elementos deben ceñirse a su cometido. Usa etiquetas breves y directas.

## Reglas vigentes de movimiento, zoom y tamaño

- El zoom global y el interno de los módulos admiten 25–200 %, con inicio al 100 % cuando no hay navegación guardada. Los cambios de zoom mantienen anclada la esquina superior izquierda visible.
- La navegación se realiza por arrastre, con origen firme y extensión hacia la derecha y abajo. El segundo dedo cancela la manipulación en curso; el tercero cancela el gesto hasta levantar todos los dedos.
- La cabecera mueve las ventanas y el tirador inferior derecho las redimensiona. Conserva los mínimos de cabecera e icono. Un clic/tap en el icono recoge la ventana a icono o restaura su tamaño; en modo icono no se muestra el tirador.
- Los contenedores flexibles ocupan el área útil conservando el diseño; el zoom interno escala textos e iconos. Operativo adapta filas y columnas, y Calculadora conserva el teclado. Las altas y bajas de contenido ajustan el tamaño.
