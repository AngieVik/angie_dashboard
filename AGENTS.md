# Angie Dashboard

## Contexto y responsabilidades de la documentación

| Documento                               | Contenido propietario                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                  | Reglas generales de trabajo, control de versiones, política de comprobaciones y entrega.                                            |
| [development.md](docs/development.md)   | Flujo de trabajo: delimitar, localizar, evaluar enfoque técnico, implementar y entregar.                                            |
| [design.md](docs/design.md)             | Diseño objetivo e integración: medidas, acabados, composición, componentes, tokens, CSS y portales; decisiones visuales pendientes. |
| [architecture.md](docs/architecture.md) | Implementación observada: propietarios, conexiones, contratos de datos, persistencia, procesamiento, overrides y límites técnicos.  |
| [OPERATIONS.md](docs/OPERATIONS.md)     | Procedimientos para validar, servir, publicar, actualizar, revertir y resolver incidencias.                                         |
| [guia_scripts.md](docs/guia_scripts.md) | Comandos de diagnóstico y generación, salidas y límites de interpretación.                                                          |
| [SECURITY.md](SECURITY.md)              | Política activa de soporte, comunicación de vulnerabilidades y mantenimiento de seguridad.                                          |
| [README.md](README.md)                  | Descripción del proyecto, requisitos de entorno, instalación y arranque rápido.                                                     |
| [CHANGELOG.md](CHANGELOG.md)            | Registro cronológico de versiones y evidencia de despliegues publicados.                                                            |
| [LICENSE.md](LICENSE.md)                | Licencia MIT del código propio y referencias a licencias de terceros.                                                               |

- Consulta `docs/` de forma puntual por módulo: localiza primero el propietario y lee solo las secciones relacionadas con la tarea. Los documentos extensos son referencias bajo demanda; inicia el contexto con este archivo y las fuentes afectadas, evitando cargar por defecto toda la carpeta `docs/` o los informes de `output/`.
- Los parámetros y comportamientos de la app se definen en su código propietario. Consérvalos salvo que la petición acuerde cambiarlos, pero advierte si detectas un problema o una alternativa mejor antes de editar.
- No reconstruyas decisiones ausentes como si estuvieran confirmadas, ni asumas decisiones abiertas; pregunta antes de implementar.
- Actualiza cada materia únicamente en su documento propietario cuando forme parte de la tarea y enlázala desde los demás. Si una implementación observada no confirma una decisión de diseño, márcala como «Pendiente» en su sección propietaria.

## Proyecto y entorno

- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2.
- Gestión de dependencias: Lee SIEMPRE `package.json` antes de importar. No asumas ni instales librerías externas sin autorización.
- Cuando la tarea requiera instalar dependencias autorizadas, usa `npm ci` desde la raíz con `package-lock.json`. Actualiza versiones solo cuando la petición lo incluya.
- Conserva los recursos originales intactos en `public/assets`.

## Código e interfaz

- Criterio técnico proactivo: Antes de escribir código, revisa la petición frente a los contratos existentes, los casos borde, el rendimiento y las posibilidades de reutilización de la base actual. Si detectas un problema relevante, explica brevemente la consecuencia y recomienda la mejor alternativa. Resuelve los detalles ordinarios dentro del alcance; si la alternativa cambia el resultado solicitado o amplía el alcance, espera mi decisión antes de aplicarla. Advertir y proponer en el chat no requiere autorización; modificar archivos fuera del alcance acordado sí.
- Sigue el recorrido entre el componente propietario, sus consumidores y los datos afectados. Mantén las convenciones del área y conserva el trabajo local existente.
- Centraliza cada responsabilidad en su base compartida existente. Reutiliza componentes, tokens y CSS.
- Limpieza: Al sustituir una implementación dentro del alcance acordado, retira el código muerto o restos que ya no tengan consumidores.
- Superficie visual: Una tarea funcional conserva la apariencia actual; una petición visual puede evolucionarla según la dirección acordada.
- Interfaz y UX: Usa etiquetas breves y directas. Incorpora ayudas o textos explicativos cuando se soliciten y recomiéndalos si mejoran la claridad operativa.
- Estado del árbol: Mantén los planes y análisis ordinarios en el chat. Crea documentos de trabajo solo si se piden expresamente y elimina cualquier archivo temporal antes de entregar, sin dejar copias `.bak` ni reportes sueltos en el repositorio.

## Pruebas y depuración

- **Pruebas E2E (Playwright):**
    - Las pruebas automatizadas están desactivadas temporalmente para evitar el consumo excesivo de recursos ("context flooding").
    - La validación funcional de la interfaz y la lógica de dominio la realizará el desarrollador de forma estrictamente manual.
- **Depuración silenciosa (Para el Agente):**
    - Prohibido: Imprimir arrays de datos pesados o hacer volcados completos del DOM (ej. `screen.debug()`) en la consola.
    - Excepción: Solo puedes imprimir la traza de error mínima necesaria para identificar la línea exacta que falla (ej. `console.error(err.message)`).
- **Validación Estática:**
    - Ejecuta comprobaciones estáticas (`npm run lint`, `npm run typecheck`) y compilación (`npm run build`) para verificar los cambios antes de solicitar pruebas manuales.

## Comprobaciones y entrega

- La lectura de los archivos afectados y la revisión del diff forman parte de tu trabajo inicial.
- Reserva las auditorías completas del proyecto solo para peticiones expresas.
- En las revisiones: Presenta los hallazgos indicando ubicación, consecuencia, evidencia y propuesta de solución. Distingue hipótesis de hechos comprobados y aplica correcciones dentro del alcance acordado.
- En la entrega final de cada tarea:
    1. Indica los archivos modificados.
    2. Detalla las comprobaciones estáticas o de compilación realizadas.
    3. Identifica explícitamente las comprobaciones de funcionamiento en navegador o dispositivo que quedan pendientes para validación manual.

## Control de versiones y calidad de código

- **Gestión manual por defecto:** No crees ramas ni ejecutes `git commit`, `git pull`, `git push` o PRs por iniciativa propia. Trabaja directamente sobre el árbol local actual para ahorrar tiempo y tokens; el control de versiones lo gestiona el desarrollador.
- **Operaciones Git solo bajo petición:** Únicamente cuando se pida de forma explícita en el chat crear ramas o commits, aplica nombres en minúsculas separados por guiones con prefijos estándar (`feat/`, `fix/`, `refactor/`) y mensajes claros sobre el cambio funcional.
- **Requisitos de calidad en cada entrega:**
    - Todo cambio debe respetar los [límites de entrada y procesamiento](docs/architecture.md#límites-de-entrada-y-procesamiento).
    - Se rechazará cualquier cambio que introduzca "valores duros" (*magic numbers* o colores HEX en los componentes) si ya existe un token en el sistema de diseño para ese propósito.
