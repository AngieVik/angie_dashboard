# Angie Dashboard

Escritorio operativo con módulos de recursos, estados, registro, notas, cartografía, reloj e informes. Aplicación web instalable como PWA, con datos locales en el navegador y guardado en archivos UIBoard.

## Arranque rápido

Desde la raíz del repositorio, con las versiones de Node.js y npm indicadas en [SETUP.md](SETUP.md):

```powershell
npm ci
npm run dev
```

Abre la dirección que muestra Vite en la terminal. Para detenerlo, pulsa Ctrl+C.

## Documentación

- [SETUP.md](SETUP.md): preparar el entorno y arrancar en desarrollo.
- [TESTING.md](TESTING.md): validar cambios y comprobar la app manualmente.
- [DEPLOYMENT.md](DEPLOYMENT.md): servir la compilación, publicar y revertir una versión.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md): resolver problemas habituales.
- [ARQUITECTURA.md](ARQUITECTURA.md): funcionamiento y datos que se conservan.
- [FRONTEND_STYLE.md](FRONTEND_STYLE.md): diseño objetivo de la interfaz.

La copia local del navegador y el archivo guardado son independientes. Consulta el alcance del UIBoard en [Datos y persistencia](ARQUITECTURA.md#datos-y-persistencia). Los mapas y las teselas necesitan conexión.
