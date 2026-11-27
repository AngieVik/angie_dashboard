# Angie Dashboard

## Dónde está cada cosa

- Flujo de trabajo: [docs/development.md](docs/development.md)
- Datos, contratos y persistencia: [docs/architecture.md](docs/architecture.md)
- Diseño visual y componentes: [docs/design.md](docs/design.md)
- Comandos y diagnósticos: [docs/guia_scripts.md](docs/guia_scripts.md)
- Informes de auditoría generados: `output/` (no se versiona)

Cada tema se documenta en un solo archivo; los demás enlazan a él. En archivos largos, busca el encabezado y lee solo esa sección.

## Proyecto y entorno

- Windows con PowerShell; Node.js 24.12.0 y npm 11.6.2.
- Dependencias: lee `package.json` antes de importar. No instales ni actualices librerías sin autorización; si se autoriza, usa `npm ci` desde la raíz.
- No modifiques los recursos originales de `public/assets`.

## Cómo trabajar

### Antes de editar

- No supongas: si falta una decisión o la petición admite varias lecturas, pregunta antes de implementar.
- Contrasta la petición con contratos, consumidores, casos borde, rendimiento, reutilización y deuda técnica. Si ves un problema, di en el chat dónde está, qué consecuencia tiene y qué alternativa recomiendas.
- Si la petición rompería un contrato, causaría una regresión o depende de una decisión pendiente, espera la decisión de Angie para esa parte y avanza en lo independiente.
- Pide autorización antes de cambiar el resultado pedido o ampliar el alcance. Los detalles que no cambian ninguna de las dos cosas, resuélvelos tú.

### Al editar

- Conserva los parámetros y comportamientos existentes salvo que la petición los cambie.
- Sigue el recorrido componente propietario → consumidores → datos. Mantén las convenciones del área y respeta los cambios locales sin guardar.
- Reutiliza la base compartida: `src/components/ui`, tokens y CSS existentes.
- Al sustituir una implementación, retira el código que quede sin uso.
- Si el código no confirma una decisión de diseño, márcala «Pendiente» en su documento.
- Los planes y análisis van en el chat. No dejes en el repositorio documentos de trabajo, copias `.bak` ni informes sueltos, salvo que se pidan.

### Interfaz

- Una tarea funcional no cambia la apariencia; una tarea visual sí, según lo acordado.
- No uses colores HEX ni medidas fijas si existe un token para ese uso.
- Antes de crear un estilo o componente nuevo, busca uno existente que sirva; si no hay, propónlo antes de crearlo.
- Etiquetas breves y directas. Añade textos de ayuda si se piden, y recomiéndalos si mejoran la claridad.

## Pruebas y depuración

- No hay pruebas automáticas de interfaz: la validación funcional la hace Angie a mano. Al terminar, dile exactamente qué probar y cómo, paso a paso.
- Antes de pedir esa prueba, pasa `npm run lint`, `npm run typecheck` y `npm run build`.
- `npm run test:audit` solo cubre los scripts de auditoría: pásalo si los tocas.
- Al depurar, no vuelques datos pesados ni el DOM completo en consola; imprime solo el error mínimo que identifica la línea que falla.

## Comprobaciones y entrega

- Antes de entregar, relee los archivos afectados y revisa el diff.
- Todo cambio respeta los [límites de entrada y procesamiento](docs/architecture.md#límites-de-entrada-y-procesamiento).
- Auditorías completas del proyecto: solo si se piden.
- En revisiones, cada hallazgo lleva ubicación, consecuencia, evidencia y propuesta. Distingue hechos comprobados de hipótesis y corrige solo dentro del alcance acordado.
- Respuesta final, breve: qué has hecho, archivos modificados (enlazados), comprobaciones hechas y qué queda pendiente o qué debe probar Angie. Omite las comprobaciones rutinarias sin incidencias.

## Git

- No crees ramas ni hagas commit, pull, push o PR salvo petición expresa. Trabaja sobre el árbol local; Angie gestiona el control de versiones.
- Si se pide: ramas en minúsculas con guiones y prefijo (`feat/`, `fix/`, `refactor/`), y mensajes claros sobre el cambio funcional.
