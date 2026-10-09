# Trabajo en Angie Dashboard

## Inicio y alcance

- Trabaja en la entrega solicitada y conserva los cambios ajenos.
- Lee este archivo, el protocolo y la entrega de [plan.md](docs/archive/plan.md). Consulta las secciones necesarias del [esquema](ESQUEMA_CONCEPTUAL.md), [criterios](ACCEPTANCE_CRITERIA.md) y [especificación](docs/superpowers/specs/2026-10-05-revision-dashboard-design.md).
- Localiza los apartados con búsquedas. Amplía la lectura ante una dependencia, duda o impacto concreto. Reutiliza lo ya leído en la conversación.
- Elige herramientas y skills que aporten valor al trabajo. Ajusta su proceso a este alcance y al coste de la tarea.
- En cambios complejos, presenta un plan breve. Resuelve las decisiones técnicas habituales y consulta solo las decisiones de producto indispensables.
- Conserva estructura, nombres y convenciones. Mantén dominio, persistencia, interfaz y acceso al navegador separados.
- Ejecuta el trabajo local y sus comprobaciones con la autorización de la entrega. Reserva despliegues, pushes, cambios de producción y acciones destructivas para una petición expresa.

## Documentación vigente

- Mantén una sola versión actual de cada instrucción o requisito, reemplazando el texto afectado en su sitio.
- Usa instrucciones positivas, concretas y breves.
- Borra documentos sustituidos y referencias obsoletas. Conserva históricos únicamente cuando el usuario lo pida expresamente; Git gestiona las versiones.
- Actualiza la tabla del plan y sustituye el único cierre actual, de 100–150 palabras. Mantén los requisitos y decisiones aprobados.
- Mantén un único registro de resultados y archivos en `.vite/verification.json`, enlazado desde el cierre; usa logs y capturas como evidencia, sin informes auxiliares repetidos.
- Guarda las copias temporales mínimas fuera del árbol del proyecto y elimínalas al cerrar.
- Verifica cambios documentales mediante diff, coherencia y enlaces.

## Producto y recursos

- PWA personal local-first para Windows y Android: React, TypeScript, Vite, shadcn/ui con Radix y CSS propio, React Grid Layout, Konva, Dexie y Proj4.
- Formato visible vigente JSON 3, con lectura validada de V1/V2; autoguardado en IndexedDB y temporizadores en su repositorio independiente.
- Usa ejemplos operativos ficticios sin datos clínicos ni de pacientes.
- Conserva los PNG de `public/assets/elements`, el timbre `public/assets/audio/alarm.mp3` y las fuentes originales. Crea archivos nuevos para los derivados necesarios.
- Netlify es el destino previsto cuando el usuario solicite publicar.

## Verificación proporcional

- Usa TDD para dominio, persistencia, conversiones, temporizadores y colocación.
- Diagnostica con el caso mínimo y el entorno necesario. Amplía las pruebas al estabilizar las correcciones y según el impacto.
- Revisa el diff, incluidos documentos ignorados por Git, y ejecuta las pruebas relacionadas y lint. Comprueba tipos y compila cuando afecte al producto integrado.
- Un `npm run build` correcto acredita tipos mientras incluya la misma comprobación que `typecheck`; informa «tipos incluidos en build». Ejecuta `npm run typecheck` cuando falte esa comprobación.
- Verifica los flujos afectados en navegador; usa la compilación vigente para el E2E final. Comprueba cambios visuales en escritorio y móvil emulado con los zooms aplicables.
- Solicita revisión adicional cuando el riesgo, alcance o un fallo lo justifiquen, con contexto acotado.
- Repite una comprobación correcta cuando cambie algo relevante para ella o aparezca un riesgo concreto.
- Informa brevemente qué cambió, qué comprobaste y qué queda pendiente. Identifica la emulación y los límites de las comprobaciones físicas.
