# Angie Dashboard

## Referencias de trabajo

- [Flujo de trabajo](docs/development.md#delimitar-localizar-y-evaluar)
- [Contratos de datos y persistencia](docs/architecture.md#datos-y-persistencia)
- [Diseño e integración](docs/design.md#integración-compartida)

- Empieza por el archivo que define el comportamiento y sigue sus consumidores directos. En `docs/` y `output/`, localiza primero los encabezados y lee solo la sección pertinente. Si un archivo supera unos 20.000 caracteres, usa sus encabezados o símbolos para localizar los bloques completos que necesitas. Cuando edites documentación, elimina explicaciones duplicadas y enlaza al documento donde se mantiene la regla.
- Los parámetros y comportamientos de la app se definen en su código propietario. Consérvalos salvo que la petición acuerde cambiarlos, pero advierte si detectas un problema o una alternativa mejor antes de editar.
- No reconstruyas decisiones ausentes como si estuvieran confirmadas, ni asumas decisiones abiertas; pregunta antes de implementar.
- Actualiza cada materia únicamente en su documento propietario cuando forme parte de la tarea y enlázala desde los demás. Si una implementación observada no confirma una decisión de diseño, márcala como «Pendiente» en su sección propietaria.

## Proyecto y entorno

- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2.
- Gestión de dependencias: Lee SIEMPRE `package.json` antes de importar. No asumas ni instales librerías externas sin autorización.
- Cuando la tarea requiera instalar dependencias autorizadas, usa `npm ci` desde la raíz con `package-lock.json`. Actualiza versiones solo cuando la petición lo incluya.
- Conserva los recursos originales intactos en `public/assets`.

## Código e interfaz

- Antes de escribir código, contrasta el enfoque solicitado con los contratos existentes, sus consumidores, los casos borde, el rendimiento y las posibilidades de reutilización. Si detectas un problema relevante, indica en el chat dónde está, qué consecuencia tendría y qué alternativa recomiendas. Resuelve por tu cuenta los detalles que preserven el resultado y el alcance acordados. Si seguir el enfoque solicitado rompería un contrato, introduciría una regresión relevante o exigiría una decisión pendiente, espera mi decisión antes de editar la parte afectada y avanza en el trabajo independiente. Pide autorización antes de aplicar cualquier alternativa que cambie el resultado solicitado o amplíe el alcance.
- Sigue el recorrido entre el componente propietario, sus consumidores y los datos afectados. Mantén las convenciones del área y conserva el trabajo local existente.
- Centraliza cada responsabilidad en su base compartida existente. Reutiliza componentes, tokens y CSS.
- Limpieza: Al sustituir una implementación dentro del alcance acordado, retira el código muerto o restos que ya no tengan consumidores.
- Superficie visual: Una tarea funcional conserva la apariencia actual; una petición visual puede evolucionarla según la dirección acordada.
- Interfaz y UX: Usa etiquetas breves y directas. Incorpora ayudas o textos explicativos cuando se soliciten y recomiéndalos si mejoran la claridad operativa.
- Estado del árbol: Mantén los planes y análisis ordinarios en el chat. Crea documentos de trabajo solo si se piden expresamente y elimina cualquier archivo temporal antes de entregar, sin dejar copias `.bak` ni reportes sueltos en el repositorio.

## Pruebas y depuración

- **Pruebas E2E (Playwright):**
    - Las pruebas automatizadas están desactivadas temporalmente para evitar el consumo excesivo de recursos ("context flooding").
    - La validación funcional de la interfaz y la lógica de dominio la realizará el desarrollador de forma manual.
- **Depuración silenciosa (Para el Agente):**
    - Prohibido: Imprimir arrays de datos pesados o hacer volcados completos del DOM (ej. `screen.debug()`) en la consola.
    - Excepción: Solo puedes imprimir la traza de error mínima necesaria para identificar la línea exacta que falla (ej. `console.error(err.message)`).
- **Validación Estática:**
    - Ejecuta comprobaciones estáticas (`npm run lint`, `npm run typecheck`) y compilación (`npm run build`) para verificar los cambios antes de solicitar pruebas manuales.

## Comprobaciones y entrega

- La lectura de los archivos afectados y la revisión del diff.
- Reserva las auditorías completas del proyecto solo para peticiones expresas.
- En las revisiones: Presenta los hallazgos indicando ubicación, consecuencia, evidencia y propuesta de solución. Distingue hipótesis de hechos comprobados y aplica correcciones dentro del alcance acordado.
- En la respuesta final, indica el resultado y enlaza los archivos modificados cuando los haya. Menciona las comprobaciones que aporten evidencia relevante, los fallos que afecten a la entrega y la validación manual que quede pendiente. Omite las comprobaciones rutinarias sin incidencias y las que no apliquen.

## Control de versiones y calidad de código

- **Gestión manual por defecto:** No crees ramas ni ejecutes `git commit`, `git pull`, `git push` o PRs por iniciativa propia. Trabaja directamente sobre el árbol local actual para ahorrar tiempo y tokens; el control de versiones lo gestiona el desarrollador.
- **Operaciones Git solo bajo petición:** Únicamente cuando se pida de forma explícita en el chat crear ramas o commits, aplica nombres en minúsculas separados por guiones con prefijos estándar (`feat/`, `fix/`, `refactor/`) y mensajes claros sobre el cambio funcional.
- **Requisitos de calidad en cada entrega:**
    - Todo cambio debe respetar los [límites de entrada y procesamiento](docs/architecture.md#límites-de-entrada-y-procesamiento).
    - Se rechazará cualquier cambio que introduzca "valores duros" (*magic numbers* o colores HEX en los componentes) si ya existe un token en el sistema de diseño para ese propósito.
