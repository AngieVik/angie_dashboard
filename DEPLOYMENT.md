# Compilación y despliegue

La app se publica como archivos estáticos. El repositorio incluye un servidor Node para servirlos; no define un proveedor de alojamiento ni un pipeline CI/CD. El destino y el procedimiento de publicación de producción están pendientes de concretar.

## Preparar la versión

1. Instala las dependencias según [SETUP.md](SETUP.md).
2. Completa las comprobaciones de [TESTING.md](TESTING.md), incluida la compilación con `npm run build`.
3. Conserva la revisión de código y una copia completa de `dist/` como artefacto de esa versión.

## Servidor Node incluido

Con `dist/` ya generado, desde la raíz:

```powershell
npm start
```

Por defecto, sirve la app en [http://127.0.0.1:4180](http://127.0.0.1:4180). Ctrl+C detiene el proceso. Requiere Node.js, `package.json`, `server/` y `dist/`; no es el servidor de desarrollo.

| Variable de entorno | Valor por defecto | Uso |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Interfaz en la que escucha el servidor. |
| `PORT` | `4180` | Puerto entero entre 1 y 65535. |

Para utilizar otro puerto en PowerShell:

```powershell
$env:PORT = '4181'
npm start
```

Estas variables se leen del entorno del proceso; el servidor no carga archivos `.env`. El servidor incluido sirve HTTP; la publicación pública requiere configurar HTTPS en el alojamiento o proxy.

## Publicar los archivos

- Publica el contenido completo de `dist/` en la raíz `/` del sitio, conservando rutas y nombres. El manifiesto PWA está configurado para esa raíz.
- Sirve los recursos como archivos reales, incluidos fuentes, workers y WASM. El fallback a `index.html` corresponde a rutas de navegación, no a recursos ausentes. El servidor incluido implementa esa distinción.
- Mantén los tipos de contenido correctos, incluido `application/wasm`, y permite la revalidación de `index.html` y del service worker. El servidor incluido utiliza `Cache-Control: no-cache`.
- En la URL publicada, comprueba carga, guardado, recursos cartográficos e instalación PWA según el navegador.

## Actualizar o revertir

Publica cada versión como un conjunto completo y conserva el artefacto anterior para poder restaurarlo en el mismo origen. La reversión del código no revierte los datos guardados por el usuario.

El service worker mantiene la versión nueva en espera mientras existan ventanas o pestañas controladas por la anterior. Guarda el UIBoard y conserva por separado los datos de sesión necesarios antes de cerrar todas las ventanas de Angie y volver a abrirla. El alcance del guardado está en [Arquitectura](ARQUITECTURA.md#datos-y-persistencia).

Tras publicar o restaurar una versión, comprueba su carga y el comportamiento PWA. Este procedimiento no requiere borrar el almacenamiento del navegador.
