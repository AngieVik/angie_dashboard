# Security

- Políticas de seguridad, versiones soportadas y el proceso para reportar vulnerabilidades de forma privada.

## L4. Deuda de actualización en herramientas

**Estado: parcialmente mitigado; permanece abierto.** Última comprobación: 2026-11-05.

### Aviso pendiente

- **Dependencia:** `deepmerge@4.3.1`.
- **Aviso:** [GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), contaminación del prototipo del objeto devuelto por `mergeObject()`.
- **Severidad en npm audit:** baja.
- **Cadena instalada:** `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` → `@rollup/plugin-node-resolve@16.0.3` → `deepmerge@4.3.1`.
- **Impedimento para corregirlo:** el aviso no publica una versión corregida y el consumidor instalado sigue dependiendo de deepmerge. No se ha encontrado una actualización oficial de esta cadena que elimine el aviso.

El audit actual devuelve **cuatro registros bajos derivados de este único aviso raíz**: `deepmerge`, `@rollup/plugin-node-resolve`, `workbox-build` y `vite-plugin-pwa`. `npm audit --omit=dev` devuelve cero. El registro continúa abierto; no representa una aceptación del riesgo ni una corrección de deepmerge.

### Evidencia y límites

En `node_modules/@rollup/plugin-node-resolve/dist/es/index.js`, la única llamada a `deepMerge` es `deepMerge({}, defaults)`, al inicializar `DEFAULTS`. `defaults` contiene constantes internas; las opciones recibidas por `nodeResolve` se combinan después mediante spread.

No se ha identificado entrada de datos de la app hacia esa llamada ni se ha acreditado explotación desde Angie. Esta evidencia corresponde al consumidor y las versiones examinados; deberá revisarse si cambia la cadena o sus entradas. El resultado de `--omit=dev` describe el árbol de dependencias declarado y no demuestra por sí solo ausencia de exposición en todos los entornos.

### Correcciones aplicadas y mantenimiento pendiente

Se actualizaron `serialize-javascript` de `7.1.2` a `7.1.4`, `minimatch` de `10.2.6` a `11.0.4` y `glob` de `11.1.0` a `14.0.3`. El audit pasó de 20 registros iniciales (16 moderados y 4 bajos) a 18 tras la primera actualización y a los cuatro bajos actuales.

Los overrides temporales de minimatch y glob y su acoplamiento se describen en [ARQUITECTURA.md](docs/ARQUITECTURA.md). Queda pendiente retirarlos cuando los consumidores incorporen versiones corregidas en sus rangos oficiales, verificando de nuevo su compatibilidad.

### Revisión y criterio de cierre

Revisar este registro cuando se publique una corrección de deepmerge o una actualización de sus consumidores que lo sustituya o elimine, y al modificar la cadena de herramientas PWA. Si cambia la llamada o admite entradas externas, reevaluar la exposición aunque el aviso no cambie.

Para cerrar el pendiente de deepmerge:

1. Incorporar una solución compatible que retire la versión afectada del árbol instalado y del lockfile; una exclusión del informe de audit no constituye una corrección.
2. Comprobar `npm ci`, `npm ls deepmerge --all`, lint, tipos y compilación, y repetir ambos audits. El aviso raíz debe desaparecer; cualquier aviso distinto se evaluará por separado.
3. Comparar la selección y las revisiones de la precaché y completar la validación manual de instalación y actualización PWA, reapertura del App Shell sin red y mapas online.

Tras el segundo paso se verificaron instalación reproducible, árbol de dependencias, lint, tipos, compilación y diff; la precaché generada conservó las mismas 127 URLs y revisiones. **La validación funcional en navegador o dispositivo sigue pendiente de realización manual por el desarrollador.**
