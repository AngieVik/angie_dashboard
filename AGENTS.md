# Instrucciones para construir Angie Dashboard

## Lectura obligatoria

Antes de modificar código, lee completos y en este orden:

1. `ESQUEMA_CONCEPTUAL.md`: fuente de verdad funcional y visual.
2. `ACCEPTANCE_CRITERIA.md`: condiciones verificables de finalización.
3. `IMPLEMENTATION_PLAN.md`: orden de implementación y pruebas.

La revisión activa es el [plan de revisión](docs/archive/plan.md), con el [catálogo definitivo de estados y fases](docs/archive/estados_fase.md) y la [maqueta de estilo aprobada](docs/archive/prueba-estilo.html). Leer su protocolo, reglas comunes, entrega solicitada, referencias y cierres de dependencias en «Seguimiento». Desde fase 2, leer también la especificación y el plan definitivos registrados en el cierre de fase 1. Las fases visuales leen «Estilo aprobado» y «Componentes aprobados».

Estas tres referencias de `docs/archive` están expresamente autorizadas por el usuario para esta revisión. El resto de esa carpeta conserva su carácter histórico. La construcción original, la revisión adaptativa de 2026-10-02 y la corrección compacta de 2026-10-03 son antecedentes; consultar sus diseños, planes e informes para conservar comportamientos y evidencia, sin ejecutarlos automáticamente. La aceptación integrada adaptativa conserva su pendiente histórico.

La petición actual del usuario define el alcance; nuevas instrucciones explícitas pueden sustituir acuerdos anteriores. El esquema recoge el comportamiento aprobado y distingue el contrato base actual de los cambios de esta revisión. Las sustituciones expresas del plan autorizado prevalecen sobre las reglas anteriores afectadas; el resto se conserva. Si queda una ambigüedad o contradicción de producto sin resolver, detén únicamente esa parte, documéntala y solicita decisión. No reabras acuerdos ya aprobados ni inventes soluciones.

## Alcance

- Ejecuta únicamente la fase o entrega solicitada del plan autorizado. El producto actual utiliza JSON 2 y reconoce V1; JSON 3 y los cambios de módulos pertenecen a entregas posteriores, con el contrato definitivo pendiente de fase 1.
- No añadas funciones, módulos, integraciones ni comportamientos fuera del esquema y las sustituciones expresamente aprobadas en este plan. Propón las mejoras ajenas y espera autorización antes de incorporarlas.
- La petición de ejecutar una entrega autoriza su trabajo y las verificaciones que le correspondan, sin solicitar una segunda aprobación idéntica. Consulta solo decisiones indispensables pendientes y acciones que requieran autorización adicional expresa.
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

- `IMPLEMENTATION_PLAN.md` enlaza el plan de revisión activo. Comprueba que las dependencias de la entrega solicitada estén entregadas y revisadas; no ejecutes fases anteriores automáticamente.
- Ejecuta una entrega por conversación. Al terminar, actualiza únicamente su fila de «Seguimiento» y su cierre en el plan activo, distinguiendo implementación, verificación y revisión del usuario. Detente y espera revisión expresa antes de iniciar o preparar la siguiente. La fase 5 se divide en 5A, 5B y 5C, cada una con su revisión.
- Conserva los checks e informes históricos. El cierre de la primera etapa comunicado por el usuario y la instalación PWA móvil comprobada por él el 2026-10-04 no convierten en nuevas verificaciones los pendientes anteriores.
- Utiliza desarrollo guiado por pruebas para lógica de dominio, persistencia, conversiones, temporizadores y colocación de módulos.
- Mantén componentes y módulos pequeños, con responsabilidades e interfaces explícitas.
- No refactorices ni añadas dependencias fuera del alcance de la tarea activa.
- Conserva los cambios preexistentes que no pertenezcan a la tarea.
- No traslades documentos históricos sin rutas concretas y autorización. `docs/` sigue excluida por `.gitignore`; revisa también el diff de los archivos ignorados, sin cambiar esa exclusión.
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

Las fases 0–1 de esta revisión son documentales: se verifican mediante diff, alcance, coherencia de requisitos y enlaces. No requieren pruebas de aplicación, lint, tipos, build ni instalaciones; no acreditan comportamiento de producto ni permiten marcar criterios funcionales sin evidencia.

Conserva la instalación PWA móvil comprobada por el usuario el 2026-10-04 como evidencia de ese caso. No la extiendas a apertura offline física, instalación Windows, selector nativo, suspensión Android, audición en altavoces ni nuevos flujos físicos. Informa emulación como emulación y conserva los límites de los informes anteriores.

La V1 solo estará terminada cuando todos los puntos de `ACCEPTANCE_CRITERIA.md` aplicables estén comprobados y no únicamente implementados por inspección.
