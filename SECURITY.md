# Política de seguridad

## Soporte

El soporte se limita a la última versión publicada de Angie Dashboard. Identifica la revisión y el artefacto efectivamente servidos antes de determinar su alcance; [CHANGELOG.md](CHANGELOG.md#registro-de-publicaciones) conserva la identidad documentada de publicaciones. Las versiones anteriores requieren actualizar.

## Comunicación de vulnerabilidades

Comparte los informes con los responsables del proyecto mediante un medio privado de acceso restringido. El canal externo específico está pendiente de definir; comprueba el destinatario y los permisos antes de enviar detalles sensibles.

Incluye fecha, versión/revisión, entorno, descripción, pasos mínimos con datos ficticios, resultado esperado/observado e impacto acreditado o posible. Conserva credenciales, datos personales y datos operativos reales fuera del informe; limita la evidencia a lo necesario para reproducirlo.

Mantén el seguimiento y los detalles de explotación en un entorno restringido. El cierre debe identificar motivo, evidencia, revisión de la corrección y versión publicada cuando exista. Los plazos de respuesta y corrección quedan pendientes de acuerdo.

## Mantenimiento

Los cambios de dependencias y mitigaciones siguen el alcance autorizado y la [validación del proyecto](docs/OPERATIONS.md#validación). Los overrides y su revisión pertenecen a [Arquitectura](docs/architecture.md#overrides-temporales-de-herramientas); manifiesto y lock son sus fuentes ejecutables.

Para evaluar dependencias, ejecuta una auditoría actual del árbol completo y otra sin desarrollo, contrasta alcance y consumidores y distingue un aviso detectado de una explotación demostrada. Vincula las conclusiones a fecha y revisión verificadas. Una corrección requiere retirar o mitigar la causa y comprobar el resultado; eliminar el aviso de un informe conserva el problema sin resolver.
