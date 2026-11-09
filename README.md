# Angie Dashboard

Escritorio operativo con módulos de recursos, estados, registro, notas, cartografía, reloj e informes. Aplicación web instalable como PWA, con datos locales en el navegador y guardado en archivos UIBoard.

## Documentación

- [operations.md](docs/operations.md): validar cambios y comprobar la app manualmente.
- [operations.md](docs/operations.md): servir la compilación, publicar y revertir una versión.
- [operations.md](docs/operations.md): resolver problemas habituales.
- [architecture.md](docs/architecture.md): funcionamiento y datos que se conservan.
- [development.md](docs/development.md): diseño objetivo de la interfaz.

La copia local del navegador y el archivo guardado son independientes. Consulta el alcance del UIBoard en [Datos y persistencia](docs/architecture.md#datos-y-persistencia). Los mapas y las teselas necesitan conexión.

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
- El arranque actual no requiere un archivo `.env` ni claves de servicios. Las variables opcionales del servidor de la compilación se describen en [operations.md](docs/operations.md#servidor-node-incluido).

## Siguiente paso

Usa [operations.md](docs/operations.md) para validar cambios. Para probar la compilación y la PWA, sigue [operations.md](docs/operations.md); el servidor de desarrollo no sustituye esa comprobación.
