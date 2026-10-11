# Angie Dashboard

- Trabaja en la petición actual y conserva los cambios ajenos.
- Lee solo el código y las instrucciones necesarios; reutiliza el contexto disponible.
- Usa herramientas y skills cuando aporten valor, ajustando su proceso al alcance.
- Mantén estructura, nombres, convenciones y comportamiento ajeno al cambio.
- Conserva la PWA local-first Windows/Android, la compatibilidad de documentos y la persistencia; los temporizadores usan almacenamiento independiente.
- Conserva los recursos originales de public/assets y usa datos ficticios sin información clínica ni de pacientes.
- Ajusta la verificación al alcance y riesgo del cambio. Para colores, bordes, textos y otros retoques visuales, revisa el diff y el área afectada; las pruebas automáticas se reservan para un riesgo concreto.
- Antes de añadir o ejecutar pruebas, propón brevemente los casos concretos, su finalidad y el coste aproximado en tiempo; ejecútalos cuando el usuario los acepte. Reutiliza los existentes y propone regresiones para lógica nueva o defectos reproducibles.
- Ejecuta únicamente los casos aceptados, filtrados por archivo y nombre (-t); usa E2E cuando necesites navegador real, con caso (--grep) y proyecto (--project) concretos.
- Incluye lint, tipos o build en la propuesta solo cuando el cambio los justifique, con el alcance mínimo necesario; aprovecha los tipos incluidos en build.
- Repite los casos aceptados afectados por una corrección; acuerda cualquier ampliación. Continúa el trabajo y consulta si aparece un problema grave.
- Suites completas, auditorías, matrices y revisión por agentes: únicamente a petición expresa, también al terminar un flujo.
- Resuelve decisiones técnicas habituales; consulta únicamente decisiones imprescindibles o problemas graves.
- Actualiza instrucciones en su sitio; conserva históricos e informes solo a petición y elimina temporales al cerrar.
- Resume brevemente qué cambió, qué comprobaste y qué queda pendiente. Distingue emulación de dispositivo físico.
- Publicaciones, pushes, migraciones y cambios en producción requieren autorización expresa.
