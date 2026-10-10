# Trabajo en Angie Dashboard

## Inicio y alcance

- Trabaja en la entrega solicitada y conserva los cambios ajenos.
- Lee este archivo, el protocolo y la entrega de [plan.md](docs/archive/plan.md). Consulta las secciones necesarias del [esquema](ESQUEMA_CONCEPTUAL.md), [criterios](ACCEPTANCE_CRITERIA.md) y [especificación](docs/superpowers/specs/2026-10-05-revision-dashboard-design.md).
- Localiza los apartados con búsquedas. Amplía la lectura ante una dependencia, duda o impacto concreto. Reutiliza lo ya leído en la conversación.
- Elige herramientas y skills que aporten valor al trabajo. Ajusta su proceso a este alcance y al coste de la tarea.
- En cambios complejos, presenta un plan breve. Resuelve las decisiones técnicas habituales y consulta solo las decisiones de producto indispensables. Aplica las skills dentro de estas reglas de alcance y coste.
- Conserva estructura, nombres y convenciones. Mantén dominio, persistencia, interfaz y acceso al navegador separados.
- Ejecuta el trabajo local y sus comprobaciones con la autorización de la entrega. Reserva despliegues, pushes, cambios de producción y acciones destructivas para una petición expresa.

## Documentación vigente

- Mantén una sola versión actual de cada instrucción o requisito, reemplazando el texto afectado en su sitio.
- Usa instrucciones positivas, concretas y breves.
- Borra documentos sustituidos y referencias obsoletas. Conserva históricos únicamente cuando el usuario lo pida expresamente; Git gestiona las versiones.
- Actualiza la tabla del plan y sustituye el único cierre actual por hasta cinco líneas: resultado, comprobación realizada y pendiente útil. Mantén los requisitos y decisiones aprobados.
- Registra comandos, resultados y archivos una sola vez en `.vite/verification.json` cuando ejecutes pruebas. Guarda la salida extensa fuera del contexto y consulta solo resumen o errores; conserva capturas únicamente cuando ayuden a resolver o mostrar algo.
- Guarda las copias temporales mínimas fuera del árbol del proyecto y elimínalas al cerrar.
- Verifica cambios documentales mediante diff, coherencia y enlaces.

## Producto y recursos

- PWA personal local-first para Windows y Android: React, TypeScript, Vite, shadcn/ui con Radix y CSS propio, React Grid Layout, Konva, Dexie y Proj4.
- Formato visible vigente JSON 3, con lectura validada de V1/V2; autoguardado en IndexedDB y temporizadores en su repositorio independiente.
- Usa ejemplos operativos ficticios sin datos clínicos ni de pacientes.
- Conserva los PNG de `public/assets/elements`, el timbre `public/assets/audio/alarm.mp3` y las fuentes originales. Crea archivos nuevos para los derivados necesarios.
- Netlify es el destino previsto cuando el usuario solicite publicar.

## Verificación durante la edición

- Comprueba el cambio concreto. El objetivo habitual es una selección de 1–3 archivos y casos unitarios/componentes, y 0–3 escenarios E2E; usa `-t` para filtrar por nombre cuando un archivo abarque funciones ajenas. Son una referencia de alcance, no una cuota de pruebas nuevas.
- Estilo, textos, iconos y ajustes visuales: diff y una comprobación visual del área afectada. Reutiliza las pruebas existentes; añade una regresión cuando haya lógica nueva o un fallo reproducible.
- Interacción: selecciona los casos del control modificado. Datos, persistencia, conversiones o temporizadores: cubre las invariantes afectadas y usa un caso que falle antes de corregir un defecto.
- E2E solo cuando el comportamiento necesite integración real de navegador y la prueba focalizada no baste. Selecciona archivo y casos con `--grep` y el proyecto pertinente con `--project`; usa escritorio y móvil únicamente si el cambio afecta a ambos.
- Para cambios visuales, comprueba 100 % y el ancho o zoom donde pueda fallar el área tocada. Reserva matrices completas y capturas sistemáticas para una revisión completa solicitada.
- Ejecuta lint sobre archivos JS/TS afectados. Comprueba tipos una vez si cambia TypeScript o su contrato. Compila cuando cambien dependencias, configuración, PWA/recursos o necesites una compilación vigente para E2E o el usuario pida un artefacto de producción; un build correcto incluye tipos. CSS o documentación se comprueban con diff, coherencia y el resultado pertinente.
- Al estabilizar, ejecuta una sola pasada de las comprobaciones seleccionadas. Tras una corrección repite solo las afectadas. Un fallo o riesgo compartido concreto permite ampliar la selección necesaria; indica el motivo en una frase.
- Las suites completas, auditorías globales, matrices exhaustivas y revisiones por agentes se realizan cuando el usuario las solicite expresamente, también al terminar el flujo. La edición habitual usa la revisión del diff por el mismo agente.
- Comprueba recursos originales cuando el cambio los alcance o el diff muestre modificaciones; usa hashes si existe una duda concreta sobre su integridad.
- La revisión funcional del usuario es a petición y no bloquea entregas posteriores. Detén solo la parte afectada por pérdida de datos, bloqueo grave o una decisión imprescindible; informa del problema.
- Informa brevemente del cambio, la selección comprobada y los pendientes útiles. Identifica la emulación cuando corresponda.
