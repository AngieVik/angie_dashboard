# Política de seguridad

Este documento define el alcance de soporte y cómo comunicar vulnerabilidades de Angie Dashboard. Los resultados y pendientes de revisiones concretas se conservan en el [registro de auditorías](docs/security-audits.md).

## Versiones soportadas

El soporte de seguridad se limita a la **última versión publicada** de Angie Dashboard. Las versiones anteriores requieren actualizar; no se mantienen correcciones de seguridad para ellas. Una revisión de desarrollo en main no se considera publicada por existir en la rama.

La versión y revisión efectivamente publicadas se identifican en el [registro de publicaciones](CHANGELOG.md#registro-de-publicaciones). La consulta del 2026-11-14 identifica un despliegue existente y la versión declarada en su revisión; el valor de package.json por sí solo no acredita una etiqueta de lanzamiento ni la versión del artefacto servido. Consulta de nuevo el despliegue publicado antes de aplicar el alcance de soporte a una revisión concreta.

## Comunicación privada de vulnerabilidades

El medio acordado es el archivo [security-reports.md](docs/security-reports.md), donde las personas con acceso al repositorio pueden registrar informes siguiendo su plantilla. Es un registro interno; no se ha definido un buzón externo ni se presupone que GitHub tenga habilitados los informes privados.

La privacidad depende de los permisos del repositorio y de cualquier copia compartida. El archivo no añade controles de acceso. Si la información es sensible, debe mantenerse en un entorno de acceso restringido y no incorporarse a una copia pública del repositorio.

El informe debe seguir los campos de la plantilla, con pasos reproducibles y datos ficticios. Las conclusiones verificadas y su fecha se incorporan al [registro de auditorías](docs/security-audits.md), enlazando el identificador del informe.

No se incluyen pruebas de explotación, credenciales ni datos reales en issues o pull requests públicos. Los plazos de respuesta y corrección no están comprometidos en esta política.

## Mantenimiento y evidencia

- Los cambios en dependencias o mitigaciones se tramitan dentro del alcance autorizado y se validan según [OPERATIONS.md](docs/OPERATIONS.md#validación).
- Los overrides, su motivación y su criterio de retirada se documentan únicamente en [Arquitectura](docs/architecture.md#overrides-temporales-de-herramientas). La configuración ejecutable pertenece a package.json y package-lock.json.
- El [registro de auditorías](docs/security-audits.md) conserva fechas, resultados, limitaciones, estado registrado y criterios de cierre de cada hallazgo. No sustituye una comprobación actual ni una aceptación de riesgo.
