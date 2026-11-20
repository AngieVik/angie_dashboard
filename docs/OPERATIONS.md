# Operaciones

## Validación

Desde la raíz, con las dependencias de [README.md](../README.md):

```powershell
npm run lint
npm run build
```

`build` comprueba tipos y genera `dist/`; `npm run typecheck` permite comprobar solo tipos. Los hooks de avisos se describen en [la guía de scripts](guia_scripts.md#catálogo-de-avisos). Aplica la política de pruebas y entrega de [AGENTS.md](../AGENTS.md#pruebas-y-depuración).

### Comprobación manual

Sirve la compilación según [Servidor Node](#servidor-node-incluido) y usa datos ficticios en un perfil de prueba. Elige el área modificada y sus consumidores; antes de publicar, recorre las áreas aplicables. Consulta contratos en [Arquitectura](architecture.md) y medidas/composición en [Diseño](design.md).

| Área                | Comprobar                                                                                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documento y archivo | Crear, editar, guardar y reabrir UIBoard; verificar datos portables y módulos abiertos. Distinguir selector, descarga, cancelación, permiso denegado y archivo modificado externamente.                                                                                                                                                 |
| Recuperación local  | Recargar tras escritura confirmada. Simular lectura/escritura/cuota fallida y revisión anterior en otra pestaña: conservar memoria y copia previa, comunicar conflicto y recuperar mediante acción explícita.                                                                                                                           |
| Ventanas y gestos   | Apertura/medición sin solapamiento automático, cierre/reapertura, expansión, mínimos manuales y autoajuste. Ordenar/recoger, extensión que crece y se reduce, barras completas/estables y cámara a distintos zooms. Soltar fuera del módulo/escritorio, perder foco o captura y comenzar otro gesto; repetir con ratón y táctil físico. |
| Módulos visuales    | Pins/nombres/estados en listas; reparto y edición de Operativo; notas/checklists mezclados; duración/Zulu; Calendario mensual/semanal y agenda lateral/inferior con contenido largo. Revisar teclado, bloqueo, scroll, zoom y escalas de texto.                                                                                         |
| Configuración       | Navegación no modal, borrador común y Guardar, cierre con cambios, restablecimiento y fallo/conflicto. Formatos, contraste/movimiento, imán en movimiento/tamaño, límites numéricos y lectura de preferencias anteriores.                                                                                                               |
| Vistas y arranque   | Inicio normal frente a F5 con recuperación; lista vacía y apertura de otro archivo. Capturar/recuperar disposiciones entre documentos, tamaños de pantalla y ventanas nuevas/montadas; comprobar capas, activo/cámara, contenido conservado, nombres duplicados y límites de colección.                                                 |
| Avisos y permisos   | Filtros por texto/nivel y grupos parciales/multinivel, mensajes variables, acciones requeridas, duración e historial nuevo tras recargar. Concesión/rechazo/error/API ausente de persistencia, posibilidad de solicitar otra vez y estimación de espacio.                                                                               |
| Limpieza            | Selección inicial activo/todos, selección parcial, módulos cerrados, temporizadores, vista previa y efectos cruzados. Cancelar, cambiar documento antes de confirmar y fallo del guardado de temporizadores.                                                                                                                            |
| Límites de entrada  | Valor inferior, exacto y superior de cada presupuesto, manteniendo los demás válidos; archivos corruptos, texto/colecciones y diagnósticos truncados. Un rechazo debe conservar el contenido anterior.                                                                                                                                  |
| Carga diferida      | Bloquear el chunk concreto antes de abrir; retirar bloqueo y reintentar/cerrar/reabrir. Verificar aislamiento, estado del formulario y foco. Antes de confirmar recarga, conservar datos portables.                                                                                                                                     |
| Informes            | Selección, tablas largas, vista previa, HTML e impresión/PDF con fuente local y fallback. Probar fuente fallida/tardía, dos peticiones concurrentes, cierre/cambio de documento durante generación y paginación estable.                                                                                                                |
| Cartografía y GPX   | Conexión, búsqueda con caché inaccesible, selección/PK/perfil y encuadre individual/conjunto; recorridos pequeños/grandes, segmentos separados y cancelación/cambio de documento. Medir cálculo y pintura por separado en el dispositivo.                                                                                               |
| Antimeridiano       | Cruce 179,9° ↔ −179,9° en ambos sentidos: recorrido corto, encuadre completo y segmentos separados. Repetir selección/PK/perfil y dibujo/borrado en otra copia del mundo, con cruces en límites de tandas y puntos ±180°.                                                                                                               |
| Temporizadores      | Iniciar/pausar/reanudar/reiniciar/cancelar/reconocer, audio y prueba de sonido; cambios de zona/hora, segundo plano, suspensión real, freeze/resume y recarga. Comparar captura de informe con valores al solicitarlo.                                                                                                                  |
| Dos pestañas        | Órdenes rápidas y antes del vencimiento, pestaña oculta/suspendida, borrador/foco, reconocimiento remoto, fallo de primera lectura/escritura y conflicto. Repetir sin BroadcastChannel y sin Web Locks, según el contrato del motor.                                                                                                    |
| PWA                 | Primera carga online, instalación, reapertura local sin red y actualización; conservar cartografía online.                                                                                                                                                                                                                              |

Registra revisión y cambios locales, navegador/sistema/dispositivo, pasos, resultado observado y limitaciones cuando se realice una comprobación. Las listas son procedimientos de consulta; su presencia conserva la validación pendiente hasta tener evidencia. Para simular fallos o cambiar hora/permisos usa un perfil de prueba y restaura el entorno al terminar.

## Servidor Node incluido

Con `dist/` compilado, ejecuta `npm start`. Sirve por defecto [http://127.0.0.1:4180](http://127.0.0.1:4180); Ctrl+C detiene el proceso. Requiere Node, `package.json`, `server/` y `dist/`.

| Variable | Valor inicial | Uso                                                                       |
| -------- | ------------- | ------------------------------------------------------------------------- |
| `HOST`   | `127.0.0.1`   | Interfaz de escucha.                                                      |
| `PORT`   | `4180`        | Puerto entero entre 1 y 65535, o `0` para que el sistema elija uno libre. |

Para cambiar el puerto en PowerShell, establece `$env:PORT = '4181'` antes de iniciar. El servidor lee el entorno del proceso y sirve HTTP; un alojamiento público debe aportar HTTPS.

## Publicar, actualizar o revertir

El destino documentado es el proyecto Netlify [angie-dashboard](https://app.netlify.com/projects/angie-dashboard), con dirección [angie-dashboard.netlify.app](https://angie-dashboard.netlify.app/). Consulta la identidad histórica en [CHANGELOG.md](../CHANGELOG.md#registro-de-publicaciones) y verifica el estado actual en la plataforma antes de operar.

1. Identifica revisión exacta, cambios locales y versión; completa validación y conserva `dist/` íntegro y la referencia al despliegue anterior. Aplica la autorización de publicación de [AGENTS.md](../AGENTS.md).
2. Comprueba repositorio, rama de producción y publicación automática del proyecto. Contrasta base raíz, comando `npm run build`, salida `dist` y entorno Node/npm con este repositorio.
3. Publica mediante el flujo Git autorizado o carga manual del contenido completo de `dist/`, incluidos assets, manifiesto y service worker. Confirma el deploy publicado en la dirección principal.
4. Comprueba acceso, flujos afectados y PWA. Registra en CHANGELOG fecha/hora/zona, versión, revisión/cambios locales, ID/enlace de deploy, dirección principal, modo de publicación, artefacto, versión anterior, autorización y validación. Marca lo desconocido como pendiente.

Para revertir, identifica el despliegue anterior correcto y conservado, obtén autorización y usa **Publish Deploy**. **Retry deploy** reconstruye y puede producir otro artefacto. Comprueba la automatización para evitar que un nuevo deploy sustituya la reversión; cualquier ajuste sigue su autorización correspondiente. La reversión del código conserva los datos del usuario.

La PWA mantiene la actualización en espera mientras haya clientes anteriores. Guarda lo recuperable y conserva aparte el contenido de sesión necesario; cierra todas las ventanas/pestañas de Angie y vuelve a abrir. Verifica la nueva versión manteniendo el almacenamiento existente.

## Resolución de problemas

| Síntoma                             | Acción                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Instalación o comprobación fallida  | Conserva primer error, archivo/línea, versiones y revisión. Contrasta manifiesto/lock antes de cambiar dependencias.       |
| Falta el build                      | Ejecuta `npm run build` y después `npm start`.                                                                             |
| Puerto ocupado                      | Usa otro `PORT` para compilación o `npm run dev -- --port 5174` en desarrollo.                                             |
| Descarga iniciada                   | Comprueba que recibiste el archivo antes de cerrar.                                                                        |
| Copia local no disponible/conflicto | Conserva la sesión en archivo y utiliza la recuperación explícita del centro de avisos.                                    |
| Módulo fallido                      | Reintenta; antes de recargar conserva datos portables. En fallo global usa Descargar copia recuperable si está disponible. |
| Cartografía ausente                 | Comprueba conexión, servicio externo y avisos de Mapa/Plano.                                                               |
| Versión anterior                    | Aplica el cierre/reapertura de clientes descrito arriba.                                                                   |

Para investigar más, reúne pasos reproducibles con datos ficticios y el mensaje mínimo; los diagnósticos por área están en [la guía de scripts](guia_scripts.md).
