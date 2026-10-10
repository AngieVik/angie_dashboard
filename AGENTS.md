# Angie Dashboard

- Trabaja en la petición actual y conserva los cambios ajenos.
- Lee solo el código y las instrucciones necesarios; reutiliza el contexto disponible.
- Usa herramientas y skills cuando aporten valor, ajustando su proceso al alcance.
- Mantén estructura, nombres, convenciones y comportamiento ajeno al cambio.
- Conserva la PWA local-first Windows/Android, la compatibilidad de documentos y la persistencia; los temporizadores usan almacenamiento independiente.
- Conserva los recursos originales de public/assets y usa datos ficticios sin información clínica ni de pacientes.
- Comprueba solo el cambio: diff, casos pertinentes y revisión visual del área afectada. Reutiliza pruebas; añade una regresión para lógica nueva o un defecto reproducible.
- Filtra pruebas por archivo y nombre (-t); usa E2E solo si necesitas navegador real, con casos (--grep) y proyecto (--project) concretos.
- Ejecuta lint sobre JS/TS modificado y tipos una vez cuando corresponda. Compila cuando lo requiera el cambio o la comprobación; aprovecha los tipos incluidos en build.
- Repite solo comprobaciones afectadas por correcciones; amplía ante un fallo o riesgo concreto.
- Suites completas, auditorías, matrices y revisión por agentes: a petición expresa.
- Resuelve decisiones técnicas habituales; consulta únicamente decisiones imprescindibles o problemas graves.
- Actualiza instrucciones en su sitio; conserva históricos e informes solo a petición y elimina temporales al cerrar.
- Resume brevemente qué cambió, qué comprobaste y qué queda pendiente. Distingue emulación de dispositivo físico.
- Publicaciones, pushes, migraciones y cambios en producción requieren autorización expresa.
