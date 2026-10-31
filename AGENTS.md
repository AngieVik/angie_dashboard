# Angie Dashboard

Estas instrucciones concretan las pautas generales para este repositorio. Las decisiones del chat delimitan qué parte de la app o de sus instrucciones se está trabajando.

## Referencias y contexto

- [ARQUITECTURA.md](ARQUITECTURA.md) localiza los propietarios y recorridos actuales; [DISEÑO.md](DISEÑO.md) reúne el estándar visual. Consulta las secciones necesarias para la petición.
- Los parámetros y comportamientos de la app se definen en su código propietario. Consérvalos salvo que la petición autorice cambiarlos; este archivo no duplica tamaños, límites ni valores predeterminados de la interfaz.
- `docs/` contiene documentos personales y de trabajo locales y permanece fuera de Git. Sus propuestas, copias e inventarios no sustituyen estas referencias ni autorizan cambios por sí mismos.
- Al continuar un trabajo, conserva el objetivo, las decisiones y las autorizaciones disponibles del chat y contrástalos con el checkout. No reconstruyas decisiones ausentes como si estuvieran confirmadas; pregunta solo cuando esa ausencia cambie el resultado.

## Proyecto y entorno

- Conserva la PWA local-first para Windows y Android, su funcionamiento sin conexión y la compatibilidad de los documentos y la persistencia. Los temporizadores mantienen almacenamiento independiente.
- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2. Cuando la tarea requiera instalar dependencias, usa `npm ci` desde la raíz con `package-lock.json`. Actualiza versiones cuando la petición lo incluya.
- Conserva los originales de `public/assets` y utiliza datos ficticios sin información clínica ni de pacientes.

## Código e interfaz

- Sigue el recorrido entre el componente propietario, sus consumidores y los datos afectados. Mantén las convenciones del área y conserva los cambios previos del usuario.
- Centraliza cada responsabilidad en su base compartida existente. Reutiliza componentes, tokens y CSS; al sustituir una implementación dentro del alcance, retira sus restos cuando ya no tengan consumidores.
- Resuelve con cuidado la superficie autorizada. Una tarea funcional conserva la apariencia; una petición visual puede evolucionarla según la dirección acordada.
- Usa etiquetas breves y directas. Incorpora ayudas o textos explicativos a la interfaz cuando el usuario los solicite.
- Actualiza las instrucciones y documentación en su lugar cuando formen parte de la tarea. Mantén los planes ordinarios en el chat; crea documentos de trabajo si se piden y elimina tus temporales al terminar. Conserva las copias de seguridad y recuperaciones de UIBoards.

## Comprobaciones y entrega

- La lectura de los archivos afectados y la revisión del diff forman parte del trabajo. Ejecuta o añade pruebas, lint, tipos, compilación, navegador y comprobaciones de dispositivo dentro del alcance expresamente autorizado por el usuario. Esta política concreta las pautas generales de verificación para Angie.
- Reserva las suites completas, auditorías y revisiones por agentes para peticiones expresas. Completa cada comprobación autorizada sin repetir la aprobación para sus pasos ordinarios.
- En las revisiones, presenta los hallazgos con ubicación, consecuencia y evidencia. Distingue hipótesis de hechos comprobados y aplica correcciones cuando estén incluidas en la petición.
- Al entregar, atribuye a cada comprobación lo que demuestra: revisión estática, compilación, navegador, emulación o dispositivo físico. Identifica las comprobaciones de funcionamiento que queden pendientes.

## Mantenimiento de las referencias

- Actualiza `AGENTS.md` cuando cambie una regla de trabajo acordada. Un ajuste de código o diseño no obliga a añadir aquí sus parámetros ni a registrar el historial de la tarea.
- Si una modificación autorizada cambia propietarios o recorridos, actualiza la sección afectada de `ARQUITECTURA.md`; si cambia una decisión visual compartida, actualiza su lugar en `DISEÑO.md`. Mantén una sola fuente para cada dato.
- Contrasta las referencias con los archivos actuales antes de usarlas. Si una diferencia requiere una decisión de producto, señálala; no conviertas una descripción antigua en autorización para modificar la app.
- En la entrega, indica los archivos modificados, las comprobaciones realizadas y los pendientes. La documentación describe decisiones o implementación; solo la evidencia de comprobación acredita funcionamiento.
