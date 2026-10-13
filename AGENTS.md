# Angie Dashboard

- Trabaja en la petición actual y conserva los cambios ajenos.
- Lee solo el código y las instrucciones necesarios; reutiliza el contexto disponible.
- Usa herramientas y skills cuando aporten valor, ajustando su proceso al alcance.
- Mantén estructura, nombres, convenciones y comportamiento ajeno al cambio.
- Conserva la PWA local-first Windows/Android, la compatibilidad de documentos y la persistencia; los temporizadores usan almacenamiento independiente.
- Conserva los recursos originales de public/assets y usa datos ficticios sin información clínica ni de pacientes.
- Ajusta la verificación al alcance y riesgo del cambio. Para colores, bordes, textos y otros retoques visuales, revisa el diff y el área afectada; las pruebas automáticas se reservan para un riesgo concreto.
- Antes de añadir o ejecutar pruebas, propón brevemente los casos concretos, su finalidad, las herramientas previstas (incluidas las online) y el coste aproximado en tiempo; procede únicamente tras la aceptación expresa del usuario de los casos y herramientas propuestos. Reutiliza los existentes y propone regresiones para lógica nueva o defectos reproducibles.
- Ejecuta únicamente los casos aceptados, filtrados por archivo y nombre (-t); usa E2E cuando necesites navegador real, con caso (--grep) y proyecto (--project) concretos.
- Conserva únicamente los tres E2E esenciales: arranque, guardado/recuperación y funcionamiento offline. Ejecútalos solo cuando el cambio pueda afectar a alguno de estos recorridos, filtrando los casos afectados; las ejecuciones completas requieren petición expresa del usuario.
- Incluye lint, tipos o build en la propuesta solo cuando el cambio los justifique, con el alcance mínimo necesario; aprovecha los tipos incluidos en build.
- Repite los casos aceptados afectados por una corrección; acuerda cualquier ampliación. Continúa el trabajo y consulta si aparece un problema grave.
- Suites completas, auditorías, matrices y revisión por agentes: únicamente a petición expresa, también al terminar un flujo.
- Resuelve decisiones técnicas habituales; consulta únicamente decisiones imprescindibles o problemas graves.
- Actualiza instrucciones en su sitio; conserva históricos e informes solo a petición y elimina temporales al cerrar.
- Resume brevemente qué cambió, qué comprobaste y qué queda pendiente. Distingue emulación de dispositivo físico.
- Publicaciones, pushes, migraciones y cambios en producción requieren autorización expresa.

## Reproducción y comprobaciones

- Entorno de referencia: Node.js 24.12.0 y npm 11.6.2. Instala desde la raíz con `npm ci`, utilizando `package-lock.json`; conserva sus versiones salvo que la petición incluya actualizarlas.
- Lint: `npm run lint`, con cero avisos permitidos. Los parámetros intencionadamente sin usar llevan prefijo `_`; las variables locales sin usar y las reglas de React Hooks y Fast Refresh siguen comprobándose.
- Casos unitarios aceptados: `npm test -- src/ruta/archivo.test.tsx -t 'nombre del caso'`. Vitest usa jsdom; no demuestra comportamiento en navegador ni dispositivo físico.
- El build aprobado se ejecuta con `npm run build` e incluye tipos; evita repetir `typecheck` por separado.
- Los tres E2E vigentes están en `tests/e2e/smoke.spec.ts`, `tests/e2e/files-and-autosave.spec.ts` y `tests/e2e/offline.spec.ts`. Playwright usa un build previo y Chromium desktop: ejecuta únicamente los archivos y casos aceptados con `npm run e2e -- tests/e2e/archivo.spec.ts --project=desktop --grep 'nombre del caso'`. No equivale a una comprobación física en Android ni a instalación nativa de la PWA.

## Reglas vigentes de movimiento, zoom y tamaño

- El zoom global y el interno de los módulos admiten 25–200 %, con inicio al 100 % cuando no hay navegación guardada. Los cambios de zoom mantienen anclada la esquina superior izquierda visible.
- La navegación se realiza por arrastre, con origen firme y extensión hacia la derecha y abajo. El segundo dedo cancela la manipulación en curso; el tercero cancela el gesto hasta levantar todos los dedos.
- La cabecera mueve las ventanas y el tirador inferior derecho las redimensiona. Conserva los mínimos de cabecera e icono. Un clic/tap en el icono recoge la ventana a icono o restaura su tamaño; en modo icono no se muestra el tirador.
- Los contenedores flexibles ocupan el área útil conservando el diseño; el zoom interno escala textos e iconos. Operativo adapta filas y columnas, y Calculadora conserva el teclado. Las altas y bajas de contenido ajustan el tamaño sin imponer un mínimo manual artificial.
- Pizarra escala el lienzo completo y mantiene las herramientas fuera de ese escalado.
- La geometría pertenece al documento; la navegación se guarda localmente por documento, sin cambiar el formato JSON ni el almacenamiento independiente de los temporizadores.
