# Entorno de desarrollo

## Requisitos

- Node.js 24.12.0 y npm 11.6.2, versiones de referencia del proyecto.
- PowerShell para los ejemplos de estos documentos.
- Navegador actualizado. La disponibilidad del selector de archivos y de la instalación PWA depende del navegador.

Abre la terminal en la raíz del repositorio, donde está `package.json`, y comprueba las versiones:

```powershell
node --version
npm --version
```

## Instalar y arrancar

```powershell
npm ci
npm run dev
```

`npm ci` instala las versiones de `package-lock.json`; necesita acceso al registro de paquetes si no están en caché. Conserva el lock y evita actualizar dependencias como parte de la instalación.

Abre la URL que muestra Vite. Mantén la terminal abierta mientras trabajas; Ctrl+C detiene el servidor.

El arranque actual no requiere un archivo `.env` ni claves de servicios. Las variables opcionales del servidor de la compilación se describen en [DEPLOYMENT.md](DEPLOYMENT.md#servidor-node-incluido).

## Siguiente paso

Usa [TESTING.md](TESTING.md) para validar cambios. Para probar la compilación y la PWA, sigue [DEPLOYMENT.md](DEPLOYMENT.md); el servidor de desarrollo no sustituye esa comprobación.
