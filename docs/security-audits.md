# Registro de auditorías de seguridad

Este documento conserva evidencias fechadas y pendientes de cada revisión. La política permanente, el alcance de soporte y el canal privado pertenecen a [SECURITY.md](../SECURITY.md); los overrides técnicos, a [Arquitectura](architecture.md#overrides-temporales-de-herramientas).

Cada nueva revisión debe registrar fecha, revisión de código y cambios locales, entorno, comandos ejecutados, resultados y límites de cobertura. Un resultado histórico no se actualiza por reorganizar documentos: una comprobación posterior se añade con su propia fecha.

## L4. Deuda de actualización en herramientas

**Fecha de la evidencia original: 2026-11-05. Estado registrado entonces: parcialmente mitigado; abierto.**

Reorganizado documentalmente el 2026-11-13 a partir del registro existente en SECURITY.md. No se han vuelto a ejecutar los audits ni las comprobaciones funcionales durante esta reorganización. Los resultados, versiones, disponibilidad de correcciones y estado de exposición siguientes se refieren exclusivamente a la revisión del 2026-11-05; no describen el estado de seguridad actual.

### Aviso registrado

- **Dependencia:** `deepmerge@4.3.1`.
- **Aviso:** [GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), contaminación del prototipo del objeto devuelto por `mergeObject()`.
- **Severidad en npm audit:** baja.
- **Cadena examinada el 2026-11-05:** `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` → `@rollup/plugin-node-resolve@16.0.3` → `deepmerge@4.3.1`.
- **Impedimento registrado el 2026-11-05:** según la investigación documentada entonces, el aviso no publicaba una versión corregida y no se había encontrado una actualización oficial de los consumidores que eliminase la dependencia. La disponibilidad posterior de correcciones no se ha comprobado en esta tarea.

El audit registrado el 2026-11-05 devolvió **cuatro registros bajos derivados de este único aviso raíz**: `deepmerge`, `@rollup/plugin-node-resolve`, `workbox-build` y `vite-plugin-pwa`. `npm audit --omit=dev` devolvió cero. El registro quedó abierto; estos resultados no constituyen una aceptación del riesgo ni una corrección de deepmerge.

### Evidencia y límites

En el consumidor examinado el 2026-11-05, `node_modules/@rollup/plugin-node-resolve/dist/es/index.js` contenía una única llamada a `deepMerge`: `deepMerge({}, defaults)`, al inicializar `DEFAULTS`. `defaults` contenía constantes internas; las opciones recibidas por `nodeResolve` se combinaban después mediante spread.

En aquella revisión no se identificó entrada de datos de la app hacia esa llamada ni se acreditó explotación desde Angie. Esta evidencia corresponde al consumidor y las versiones examinados; deberá revisarse si cambia la cadena o sus entradas. El resultado de `--omit=dev` describe el árbol de dependencias declarado y no demuestra por sí solo ausencia de exposición en todos los entornos.

### Correcciones aplicadas y mantenimiento pendiente

Se actualizaron `serialize-javascript` de `7.1.2` a `7.1.4`, `minimatch` de `10.2.6` a `11.0.4` y `glob` de `11.1.0` a `14.0.3`. El audit pasó de 20 registros iniciales (16 moderados y 4 bajos) a 18 tras la primera actualización y a los cuatro bajos registrados al terminar aquella revisión.

La configuración, justificación y condiciones de retirada de los overrides se mantienen únicamente en [Overrides temporales de herramientas](architecture.md#overrides-temporales-de-herramientas). Las versiones anteriores se conservan aquí como hechos de aquella intervención.

### Revisión y criterio de cierre

Revisar este registro cuando se publique una corrección de deepmerge o una actualización de sus consumidores que lo sustituya o elimine, y al modificar la cadena de herramientas PWA. Si cambia la llamada o admite entradas externas, reevaluar la exposición aunque el aviso no cambie.

Para cerrar el pendiente de deepmerge:

1. Incorporar una solución compatible que retire la versión afectada del árbol instalado y del lockfile; una exclusión del informe de audit no constituye una corrección.
2. Comprobar `npm ci`, `npm ls deepmerge --all`, lint, tipos y compilación, y repetir ambos audits. El aviso raíz debe desaparecer; cualquier aviso distinto se evaluará por separado.
3. Comparar la selección y las revisiones de la precaché y completar la validación manual de instalación y actualización PWA, reapertura del App Shell sin red y mapas online.

**Comprobaciones registradas el 2026-11-05:** instalación reproducible, árbol de dependencias, lint, tipos, compilación y diff; la precaché generada conservó las mismas 127 URLs y revisiones. Esto acompañó las mitigaciones y no acredita que se cumpliese el criterio de cierre de deepmerge. **La validación funcional en navegador o dispositivo quedó pendiente de realización manual por el desarrollador; no se ha aportado evidencia posterior en esta revisión documental.**
