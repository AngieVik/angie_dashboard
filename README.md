# Angie Dashboard

Escritorio operativo con módulos de recursos, estados, registro, notas, cartografía, reloj e informes. Aplicación web instalable como PWA, con datos locales en el navegador y guardado en archivos UIBoard.

## Documentación

- [AGENTS.md](AGENTS.md): reglas generales de trabajo en el repositorio.
- [SECURITY.md](SECURITY.md): política activa de seguridad y comunicación de vulnerabilidades.
- [OPERATIONS.md](docs/OPERATIONS.md): validar cambios, comprobar la app manualmente, servir la compilación, publicar, revertir y resolver problemas habituales.
- [architecture.md](docs/architecture.md): funcionamiento y datos que se conservan.
- [design.md](docs/design.md): diseño objetivo e integración de la interfaz.
- [development.md](docs/development.md): flujo de desarrollo.
- [guia_scripts.md](docs/guia_scripts.md): comandos y resultados de diagnóstico.

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
- El arranque actual no requiere un archivo `.env` ni claves de servicios. Las variables opcionales del servidor de la compilación se describen en [OPERATIONS.md](docs/OPERATIONS.md#servidor-node-incluido).

## Siguiente paso

Usa [OPERATIONS.md](docs/OPERATIONS.md) para validar cambios. Para probar la compilación y la PWA, sigue [OPERATIONS.md](docs/OPERATIONS.md); el servidor de desarrollo no sustituye esa comprobación.
