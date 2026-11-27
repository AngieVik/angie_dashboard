# Flujo de desarrollo

Complementa las reglas de [AGENTS.md](../AGENTS.md); aquí solo está el recorrido técnico.

## Antes de empezar

1. Mira el estado local con `git status --short` y el diff del área: puede haber trabajo de Angie sin guardar.
2. Localiza el propietario según [Capas y propietarios](architecture.md#capas-y-propietarios) y sigue sus consumidores y datos.
3. Si la tarea es compleja, concreta los pasos en el chat antes de escribir código.

## Qué recorrer al cambiar

- Interfaz: componente, estilos, medición, zoom y portales.
- Datos: edición, validación, guardado, recuperación y consumidores.
- Diagnósticos puntuales: el comando específico de [la guía de scripts](guia_scripts.md).

## Al terminar

- Comandos de validación: [Operaciones](OPERATIONS.md#validación).
- Si cambias documentación, comprueba que sus enlaces sigan funcionando.
- Servir, publicar o revertir: [Operaciones](OPERATIONS.md).
