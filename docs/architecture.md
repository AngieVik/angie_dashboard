# Arquitectura de Angie Dashboard

Este documento define la estructura de alto nivel, los patrones de diseño y los flujos de datos principales de la aplicación. 

- Para reglas de trabajo, consultar `agents.md`.
- Para diseño objetivo y componentes, consultar `development.md` y `design.md`.

---

## 1. Capas del Sistema

La aplicación sigue una arquitectura modular separada en responsabilidades claras:

- **Dominio (`src/domain/`)**: Define la lógica de negocio pura, los esquemas de datos (como el formato `angie-uiboard`), la validación y los estados operativos.
- **Funcionalidades (`src/features/`)**: Contiene los módulos de negocio independientes (Mapa, Pizarra, Calendario, Calculadora, etc.). Cada módulo encapsula sus componentes, comandos y estilos.
- **Plataforma (`src/platform/`)**: Abstrae las capacidades nativas del navegador (sistema de archivos, portapapeles, permisos, zonas horarias).
- **Layout (`src/layout/`)**: Coordina el entorno de trabajo mediante un sistema de cuadrícula (Grid Layout). Gestiona el redimensionado, la navegación espacial, el zoom interno de los módulos y el comportamiento táctil.
- **Interfaz Común (`src/components/ui/` & `src/styles/`)**: Centraliza el sistema de diseño, tokens, fuentes y componentes base adaptados a la aplicación.

---

## 2. Entorno de Trabajo y Ventanas

El dashboard opera como un lienzo interactivo con múltiples ventanas (módulos):

- **Sistema de Cuadrícula (Grid)**: Integra un sistema de arrastre y redimensionado que evita el solapamiento de ventanas evaluando los ejes X e Y de forma conjunta.
- **Ajuste Automático (Snap)**: Las ventanas se ajustan a las dimensiones de otros módulos (expandidos, contraídos a icono o colapsados a barra) conservando la alineación visual.
- **Navegación y Zoom**: El espacio lógico y el *viewport* están separados. El sistema soporta gestos multitáctiles (zoom y paneo del escritorio) independientes del scroll interno de cada módulo o la navegación nativa de los mapas.

---

## 3. Gestión de Datos y Persistencia

La aplicación maneja diferentes ciclos de vida para sus datos:

### 3.1 Documento Principal (UIBoard)

- **Formato**: Utiliza un contrato único (`UIBoardData`) validado por esquemas estrictos sin versionado histórico.
- **Persistencia**: Se guarda como un archivo `*.uiboard.json` mediante la *File System Access API*.
- **Copia Local (Recuperación)**: Se mantiene una copia de seguridad automática (`active`) en IndexedDB que se actualiza tras periodos de inactividad o al ocultar la página.
- **Estado de Sesión**: Elementos como la geometría, imágenes en memoria, dibujos y cachés geográficas residen solo en memoria y se descartan al cerrar la aplicación. No se guardan en el archivo JSON.

### 3.2 Almacenes Independientes

Algunos módulos mantienen persistencia transversal, independiente del documento abierto:

- **Reloj/Temporizadores**: Usan una base de datos propia (`angie-dashboard-timers`). El motor maneja pausas, suspensiones del navegador y compensaciones de la hora civil vs. monotónica.
- **Calendario**: Los eventos se guardan en `angie-dashboard-calendar` y persisten entre diferentes documentos.
- **Configuración**: La zona horaria y ubicaciones predeterminadas se guardan a nivel de aplicación.

---

## 4. Procesamiento en Segundo Plano (Web Workers)

Para no bloquear el hilo principal de la interfaz, las tareas pesadas se delegan a *Web Workers*:

- **Carga de Documentos**: La lectura, validación de límites y parseo estructural del archivo JSON ocurren en segundo plano.
- **Análisis Geográfico (GPX)**: El parseo XML, cálculo de perfiles de elevación, distancias y preparación de geometrías se delegan a workers dedicados. La información se transfiere al hilo principal mediante paso de memoria (`ArrayBuffers`) para optimizar el rendimiento.

---

## 5. Resiliencia y Recuperación (Error Boundaries)

El sistema está diseñado para sobrevivir a fallos de importación o renderizado:

- **Aislamiento por Módulo**: Cada ventana está protegida por su propio `ModuleErrorBoundary`. Si un módulo falla, se puede reintentar o cerrar sin afectar al resto del dashboard ni al documento principal.
- **Recuperación Global**: Un `GlobalErrorBoundary` protege la raíz de la aplicación. Permite forzar la descarga del documento en memoria (copia de emergencia) en caso de un cuelgue crítico, evitando la pérdida de datos no guardados.
- **Carga Diferida (Lazy Loading)**: Módulos pesados (Mapa, Pizarra, Informes) se cargan bajo demanda (`React.lazy` + `Suspense`), optimizando el arranque inicial.
