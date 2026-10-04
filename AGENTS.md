# Instrucciones para construir Angie Dashboard

## Lectura obligatoria

Antes de modificar código, lee completos y en este orden:

1. `ESQUEMA_CONCEPTUAL.md`: fuente de verdad funcional y visual.
2. `ACCEPTANCE_CRITERIA.md`: condiciones verificables de finalización.
3. `IMPLEMENTATION_PLAN.md`: orden de implementación y pruebas.

La fase activa es la corrección de interfaz compacta aprobada el 2026-10-03 (docs/superpowers/specs/2026-10-03-interfaz-compacta-design.md y docs/superpowers/plans/2026-10-03-interfaz-compacta.md), una entrega integrada. La revisión adaptativa de 2026-10-02 conserva su aceptación final pendiente. `IMPLEMENTATION_PLAN.md` enlaza su diseño y plan; lee también completos esos dos documentos antes de ejecutar sus entregas. Las tareas de construcción anteriores conservadas allí son históricas.

`docs/archive` contiene notas históricas sustituidas por el esquema y no debe utilizarse como fuente de requisitos.

Si dos instrucciones parecen incompatibles, prevalece `ESQUEMA_CONCEPTUAL.md`. No inventes una solución que cambie el producto: detén esa parte, documenta la contradicción y solicita decisión.

## Alcance

- Construye únicamente la V1 y su revisión adaptativa aprobada descritas en el esquema. La revisión utiliza formato JSON 2 e importa el contrato real V1 mediante la conversión reconocida.
- No añadas funciones, módulos, integraciones ni comportamientos que no estén definidos expresamente en `ESQUEMA_CONCEPTUAL.md`.
- No introduzcas datos clínicos ni datos de pacientes en ejemplos, pruebas o datos iniciales.
- No despliegues, publiques, hagas `push`, conectes servicios externos ni modifiques producción sin autorización expresa.
- Netlify es el destino previsto, pero el despliegue no forma parte de la construcción local.

## Contrato técnico

- Stack aprobado: React, TypeScript, Vite, PWA, shadcn/ui, React Grid Layout, React Konva, Dexie/IndexedDB y Proj4.
- La interfaz debe funcionar como una única PWA local-first en Windows y Android.
- El espacio principal se adapta al área bajo la cabecera, con módulos superpuestos y sin scroll de página. `1600 × 1000` solo es la referencia de geometrías importadas del formato V1.
- La pizarra utiliza una región rectangular sobre coordenadas estables y tiene desplazamiento y zoom propios, separados de la navegación principal.
- Todos los módulos comienzan cerrados y se abren individualmente desde `Ver`.
- La persistencia visible utiliza JSON versionado y validado: formato vigente 2 y lectura compatible de V1. El autoguardado interno utiliza IndexedDB; los temporizadores conservan su repositorio independiente.
- Mantén separadas la lógica de dominio, persistencia, interfaz y acceso al navegador.
- Conserva los nombres, campos, estados, textos y valores exactos definidos en el esquema.

## Recursos

- Los nueve PNG aprobados están en `public/assets/elements`.
- El timbre aprobado está en `public/assets/audio/alarm.mp3`.
- `public/assets/elements/icon_chincheta.png` es la fuente del icono instalable de la PWA.
- No renombres, recortes, redibujes, comprimas ni sobrescribas estos archivos originales.
- Los tamaños derivados para el manifiesto PWA deben generarse como archivos nuevos.

## Forma de trabajo

- Ejecuta `IMPLEMENTATION_PLAN.md` en orden y completa una entrega verificable antes de iniciar la siguiente.
- En la fase adaptativa ejecuta el plan activo enlazado, una entrega a la vez, y espera la revisión expresa del usuario antes de iniciar la siguiente. Conserva el progreso en ese plan sin modificar los checks históricos.
- Utiliza desarrollo guiado por pruebas para lógica de dominio, persistencia, conversiones, temporizadores y colocación de módulos.
- Mantén componentes y módulos pequeños, con responsabilidades e interfaces explícitas.
- No refactorices ni añadas dependencias fuera del alcance de la tarea activa.
- Conserva los cambios preexistentes que no pertenezcan a la tarea.
- La creación y gestión del repositorio pertenecen al usuario.
- No ejecutes `git init`, `git add`, `git commit`, cambios de rama, configuración de Git ni ninguna otra escritura sobre el repositorio sin autorización expresa del usuario.
- Si la carpeta todavía no es un repositorio, continúa trabajando sin crear uno. Al cerrar cada tarea, muestra el diff o el resumen de archivos para que el usuario decida cuándo actualizar Git.

## Verificación obligatoria

Antes de afirmar que una tarea funciona:

- Revisa el diff.
- Ejecuta las pruebas unitarias y de componentes relacionadas.
- Ejecuta lint y comprobación de tipos.
- Ejecuta la compilación de producción cuando la tarea afecte al producto integrado.
- Ejecuta las pruebas de navegador correspondientes para flujos de usuario.
- Indica con precisión qué se verificó y qué no pudo verificarse.

Una entrega exclusivamente documental, como la entrega 1 del plan adaptativo, se verifica mediante revisión de diferencias, coherencia de requisitos y alcance. No requiere pruebas de aplicación, lint, tipos, build ni instalaciones; no acredita comportamiento de producto.

La V1 solo estará terminada cuando todos los puntos de `ACCEPTANCE_CRITERIA.md` aplicables estén comprobados y no únicamente implementados por inspección.
