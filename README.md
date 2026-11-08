# Angie Dashboard

Escritorio operativo con módulos de recursos, estados, registro, notas, cartografía, reloj e informes. Aplicación web instalable como PWA, con datos locales en el navegador y guardado en archivos UIBoard.

## Documentación

- [OPERATIONS.md](docs/OPERATIONS.md): validar cambios y comprobar la app manualmente.
- [OPERATIONS.md](docs/OPERATIONS.md): servir la compilación, publicar y revertir una versión.
- [OPERATIONS.md](docs/OPERATIONS.md): resolver problemas habituales.
- [ARQUITECTURA.md](docs/ARQUITECTURA.md): funcionamiento y datos que se conservan.
- [FRONTEND_STYLE.md](docs/DEVELOPMENT-GUIDE.md): diseño objetivo de la interfaz.

La copia local del navegador y el archivo guardado son independientes. Consulta el alcance del UIBoard en [Datos y persistencia](docs/ARQUITECTURA.md#datos-y-persistencia). Los mapas y las teselas necesitan conexión.

## Entorno de desarrollo

### Requisitos

- Node.js 24.12.0 y npm 11.6.2, versiones de referencia del proyecto.
- PowerShell para los ejemplos de estos documentos.
- Navegador actualizado. La disponibilidad del selector de archivos y de la instalación PWA depende del navegador.

Abre la terminal en la raíz del repositorio, donde está `package.json`, y comprueba las versiones:

```powershell
node --version
npm --version
```

### Instalar y arrancar


```powershell
npm ci
npm run dev
```

- `npm ci` instala las versiones de `package-lock.json`; necesita acceso al registro de paquetes si no están en caché. Conserva el lock y evita actualizar dependencias como parte de la instalación.
- Abre la URL que muestra Vite. Mantén la terminal abierta mientras trabajas; Ctrl+C detiene el servidor.
- El arranque actual no requiere un archivo `.env` ni claves de servicios. Las variables opcionales del servidor de la compilación se describen en [DEPLOYMENT.md](docs/OPERATIONS.md#servidor-node-incluido).

## Siguiente paso

Usa [OPERATIONS.md](docs/OPERATIONS.md) para validar cambios. Para probar la compilación y la PWA, sigue [OPERATIONS.md](docs/OPERATIONS.md); el servidor de desarrollo no sustituye esa comprobación.
