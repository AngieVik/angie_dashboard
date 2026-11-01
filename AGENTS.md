# Angie Dashboard

## Referencias y contexto

- [ARQUITECTURA.md](ARQUITECTURA.md)
- [DISEÑO.md](DISEÑO.md)
- Los parámetros y comportamientos de la app se definen en su código propietario. Consérvalos salvo que la petición autorice explícitamente cambiarlos.
- Lógica de dominio: Los temporizadores mantienen almacenamiento independiente. La PWA es local-first para Windows y Android; conserva su funcionamiento sin conexión, la compatibilidad de los documentos y la persistencia de datos.
- No reconstruyas decisiones ausentes como si estuvieran confirmadas, ni confirmes decisiones puntuales; pregunta.
- Gestión de datos: Asume integraciones mediante Google Sheets (prohibido proponer o importar utilidades para Excel).

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
- Documentación y estado: Actualiza las instrucciones en su lugar cuando formen parte de la tarea. Mantén los planes ordinarios en el chat; crea documentos de trabajo si se piden y elimina tus temporales al terminar. Conserva las copias de seguridad y recuperaciones de UIBoards.
- Mantenimiento documental: Si una modificación autorizada cambia propietarios o recorridos, actualiza `ARQUITECTURA.md`; si cambia una decisión visual, actualiza `DISEÑO.md`. Actualiza este `AGENTS.md` solo cuando cambie una regla de trabajo general.

## Pruebas y depuración silenciosa

- **Pruebas E2E desactivadas:** No ejecutes tests automatizados ni comandos de frameworks de testing. La validación funcional la realiza el desarrollador manualmente.
- **Bloqueo de inundación de contexto:** Prohibido imprimir arrays de datos pesados o hacer volcados completos del DOM/interfaz en la consola.
- **Verificación permitida:** Limítate a realizar comprobaciones estáticas (lint, tipos) o de compilación dentro del alcance autorizado.

## Comprobaciones y entrega

- La lectura de los archivos afectados y la revisión del diff forman parte de tu trabajo inicial.
- Reserva las auditorías completas del proyecto solo para peticiones expresas.
- En las revisiones: Presenta los hallazgos indicando ubicación, consecuencia y evidencia. Distingue hipótesis de hechos comprobados y aplica correcciones cuando estén autorizadas.
- En la entrega final de cada tarea:
    1. Indica los archivos modificados.
    2. Detalla las comprobaciones estáticas o de compilación realizadas.
    3. Identifica explícitamente las comprobaciones de funcionamiento en navegador o dispositivo que quedan pendientes para validación manual.
