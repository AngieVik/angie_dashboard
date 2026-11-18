# Angie Dashboard

## Referencias y contexto

- [architecture.md](docs/architecture.md)
- [design.md](docs/design.md)
- [development.md](docs/development.md)
- [guia_scripts.md](docs/guia_scripts.md)
- [OPERATIONS.md](docs/OPERATIONS.md)
- [CHANGELOG.md](CHANGELOG.md)
- [LICENSE.md](LICENSE.md)
- [SECURITY.md](SECURITY.md)
- [README.md](README.md)

- Los parámetros y comportamientos de la app se definen en su código propietario. Consérvalos salvo que la petición autorice explícitamente cambiarlos.
- Consulta `docs/` de forma puntual por módulo: localiza primero el propietario y lee solo las secciones relacionadas con la tarea. Los documentos extensos son referencias bajo demanda; inicia el contexto con este archivo y las fuentes afectadas, evitando la carga conjunta por defecto de `docs/` o de informes de `output/`.
- No reconstruyas decisiones ausentes como si estuvieran confirmadas, ni confirmes decisiones puntuales; pregunta.

## Responsabilidades de la documentación

| Documento | Contenido propietario |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Reglas generales de trabajo, control de versiones, política de comprobaciones y entrega. |
| [development.md](docs/development.md) | Flujo de trabajo: delimitar, localizar, implementar y entregar. |
| [design.md](docs/design.md) | Diseño objetivo e integración: medidas, acabados, composición, componentes, tokens, CSS y portales; decisiones visuales pendientes. |
| [architecture.md](docs/architecture.md) | Implementación observada: propietarios, conexiones, contratos de datos, persistencia, procesamiento y límites técnicos. |
| [OPERATIONS.md](docs/OPERATIONS.md) | Procedimientos para validar, servir, publicar, actualizar, revertir y resolver incidencias. |
| [guia_scripts.md](docs/guia_scripts.md) | Comandos de diagnóstico y generación, salidas y límites de interpretación. |
| [SECURITY.md](SECURITY.md) | Política activa de soporte, comunicación de vulnerabilidades y mantenimiento de seguridad. |

- Actualiza cada materia en su documento propietario y enlázala desde los demás. Mantén las salidas generadas de diagnóstico en `output/` y la documentación activa en las referencias de esta tabla. Los overrides técnicos se documentan únicamente en `docs/architecture.md`.
- Una implementación observada o una referencia histórica no confirma una decisión de diseño. Si no hay evidencia suficiente, marca la decisión como «Pendiente» en su sección propietaria.

## Proyecto y entorno

- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2.
- Gestión de dependencias: Lee SIEMPRE el `package.json` antes de importar. No asumas ni instales librerías externas sin autorización.
- Cuando la tarea requiera instalar dependencias explícitamente autorizadas, usa `npm ci` desde la raíz con `package-lock.json`. Actualiza versiones solo cuando la petición lo incluya.
- Conserva los originales intactos en `public/assets`.

## Código e interfaz

- Sigue el recorrido entre el componente propietario, sus consumidores y los datos afectados. Mantén las convenciones del área y conserva los cambios previos.
- Centraliza cada responsabilidad en su base compartida existente. Reutiliza componentes, tokens y CSS.
- Limpieza: Al sustituir una implementación dentro del alcance, retira sus restos cuando ya no tengan consumidores.
- Superficie visual: Una tarea funcional conserva la apariencia actual; una petición visual puede evolucionarla según la dirección acordada.
- Interfaz y UX: Usa etiquetas breves y directas. Incorpora ayudas o textos explicativos a la interfaz cuando se soliciten. Haz recomendaciones de incorporación si es necesario.
- Documentación y estado: Actualiza las instrucciones en su lugar cuando formen parte de la tarea. Mantén los planes ordinarios en el chat; crea documentos de trabajo si se piden y elimina tus temporales al terminar. Conserva las copias de seguridad.
- Mantenimiento documental: Si una modificación autorizada cambia propietarios, recorridos o contratos técnicos, actualiza `docs/architecture.md`; si cambia una decisión visual o su integración, actualiza `docs/design.md`; si cambia el flujo de desarrollo, actualiza `docs/development.md`. Mantén los procedimientos en `docs/OPERATIONS.md` y este `AGENTS.md` cuando cambie una regla general de trabajo.

## Pruebas y depuración

- **Pruebas E2E (Playwright):**
    - Las pruebas automatizadas están desactivadas temporalmente para evitar el consumo excesivo de recursos ("context flooding").
    - La validación funcional de la interfaz y la lógica de dominio la realizará el desarrollador de forma estrictamente manual.
- **Depuración silenciosa (Para el Agente):**
    - Prohibido: Imprimir arrays de datos pesados o hacer volcados completos del DOM (ej. `screen.debug()`) en la consola.
    - Excepción: Solo puedes imprimir la traza de error mínima necesaria para identificar la línea exacta que falla (ej. `console.error(err.message)`).
- **Validación Estática:**
    - Realiza comprobaciones estáticas (lint, tipos) y compilación (`npm run build`) para verificar la refactorización antes de solicitar pruebas manuales.

## Comprobaciones y entrega

- La lectura de los archivos afectados y la revisión del diff forman parte de tu trabajo inicial.
- Reserva las auditorías completas del proyecto solo para peticiones expresas.
- En las revisiones: Presenta los hallazgos indicando ubicación, consecuencia y evidencia. Distingue hipótesis de hechos comprobados y aplica correcciones cuando estén autorizadas.
- En la entrega final de cada tarea:
    1. Indica los archivos modificados.
    2. Detalla las comprobaciones estáticas o de compilación realizadas.
    3. Identifica explícitamente las comprobaciones de funcionamiento en navegador o dispositivo que quedan pendientes para validación manual.

## Flujo de Trabajo y Control de Versiones

- **Ramas (Branches):** Utiliza nombres en minúsculas y separados por guiones, usando prefijos estándar (`feat/`, `fix/`, `refactor/`).
- **Commits:** Deben ser claros e indicar el cambio funcional.
- **Pull Requests (PR):**
    - Toda PR debe respetar los [límites de entrada y procesamiento](docs/architecture.md#límites-de-entrada-y-procesamiento).
    - Se rechazará cualquier PR que introduzca "valores duros" (*magic numbers* o colores HEX en los componentes) si ya existe un token en el sistema de diseño para ese propósito.
