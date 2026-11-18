# Flujo de desarrollo

## Delimitar y localizar

1. Lee `AGENTS.md`, la petición y el estado local con `git status --short` y el diff del área afectada.
2. Localiza el propietario en `src/app`, `src/features`, `src/domain`, `src/layout`, `src/platform` o `src/storage`; sigue sus consumidores y datos.
3. Consulta únicamente la sección necesaria de [Arquitectura](architecture.md) para contratos y persistencia, o de [Diseño](design.md) para decisiones visuales e integración.
4. Para tareas complejas, concreta en el chat el resultado y los pasos; identifica las decisiones que necesitan respuesta antes de implementarlas.

## Implementar

Trabaja sobre la base compartida del área y conserva el trabajo local existente. Resuelve cada responsabilidad en su propietario y retira los restos de la implementación sustituida dentro del alcance autorizado.

Al cambiar una interfaz, recorre componente, estilos, medición, zoom y portales. Al cambiar datos, recorre edición, validación, guardado, recuperación y consumidores. Para diagnósticos puntuales, elige el comando específico de [la guía de scripts](guia_scripts.md).

## Validar y entregar

Aplica la política de comprobaciones y entrega de [AGENTS.md](../AGENTS.md#comprobaciones-y-entrega), con los comandos de [Validación](OPERATIONS.md#validación). Revisa el diff final y los enlaces documentales afectados.

Actualiza únicamente el documento propietario indicado en [Responsabilidades de la documentación](../AGENTS.md#responsabilidades-de-la-documentación). Distingue el diseño acordado de la implementación observada y conserva las decisiones abiertas como «Pendiente».

Entrega los cambios y la evidencia obtenida; identifica la validación manual que corresponde al área. Los procedimientos para servir, publicar o revertir están en [Operaciones](OPERATIONS.md).
