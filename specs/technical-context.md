# Technical Context

> Fuente de verdad del stack tecnológico y restricciones técnicas de HeadRace.
> Generado en local para el proyecto universitario, sin `/sdd-init`.
> Consumido por `/sdd` y `/sdd-build` en cada ejecución.
> **No modificar manualmente** — usar ADRs para registrar cambios de stack.

---

## Stack confirmado

### Backend
- **Runtime:** Python 3.11 o superior
- **Framework:** Flask + Flask-SocketIO
- **Lenguaje:** Python
- **ORM / Query builder:** SQL embebido contra sqlite3 de la biblioteca estándar. Sin ORM.

### Frontend (si aplica)
- **Framework:** Ninguno. Una página HTML.
- **Lenguaje:** JavaScript en el navegador, sin paso de compilación.
- **UI library:** Canvas 2D nativo.
- **State management:** Variables del script de la página. Sin librería de estado.

### Base de datos
- **Motor:** SQLite 3 (el que trae Python)
- **Migraciones:** `CREATE TABLE IF NOT EXISTS` al arrancar. Sin herramienta de migraciones.
- **Naming:** snake_case
- **Soft deletes:** no aplica. Las filas de sesión no se borran ni se editan.

### Infraestructura
- **Contenedores:** sin contenedores
- **CI/CD:** no aplica en esta spec
- **Ambientes:** local
- **Cloud:** no aplica. Todo corre en la laptop.

### Autenticación y autorización
- **Mecanismo:** no aplica. La app escucha solo en 127.0.0.1.
- **Estrategia de roles:** no aplica. Un solo estudiante.

---

## Modelo conceptual → arquitectura *(vista técnica)*

> La vista de negocio vive en `CONTEXT.md` sección 7b.

### Mapeo entidad → capa → módulo

| Entidad del dominio | Capa | Módulo del código |
|---|---|---|
| Muestra de cabeza | Captura | `captura` |
| Estado del carro | Dominio de control | `control` |
| Obstáculo | Dominio de control | `control` |
| Vuelta | Aplicación | `backend` |
| Sesión | Aplicación | `backend` |
| Pista | Presentación | `web` |

### Mapeo bounded context → módulo

| Bounded context (CONTEXT.md) | Módulo(s) del código |
|---|---|
| Captura | `captura` |
| Control | `control` |
| Carrera | `backend`, `web` |

### Forma preliminar de los datos

- Muestra de cabeza: `head_x`, `head_y`, ambos enteros en [−100, 100]
- Estado del carro: `car_x` (−100 a 100), `car_speed` (0 a 100), `obstacle_dist` (mm o −1), `obstacle_alert`
- Sesión persistida: `id`, `evento_id`, `fecha_hora`, `tiempo_vuelta`, `colisiones`, `eventos_obstaculo`, `velocidad_promedio`, `motivo`

---

## Especificación de arquitectura de aplicación

### Patrón arquitectónico — Backend
- **Arquitectura backend:** Monolito local por capas ligeras (captura, control, aplicación, presentación).
- **Estructura de módulos:** por contexto (`captura`, `control`, `backend`, `web`).
- **Comunicación entre servicios:** un proceso. El núcleo de control es una llamada en memoria. El navegador entra por HTTP y WebSocket.

### Capas y responsabilidades — Backend

| Capa | Responsabilidad | Depende de |
|---|---|---|
| Captura | Frame de cámara a offset | OpenCV |
| Control | Un ciclo de PID + difusa + obstáculo | Parámetros. No depende de Flask ni del navegador. |
| Aplicación | Sesiones, historial, reenvío del estado | Control, SQLite |
| Presentación | Rutas HTTP, SocketIO, HTML | Aplicación |

**Regla de dependencias:** `control` no importa Flask, OpenCV ni el DOM. `web` no implementa PID ni difusa.

### Patrón arquitectónico — Frontend (si aplica)
- **Arquitectura frontend:** Una página. Lógica de pista en un script, dibujo en Canvas.
- **Estructura de módulos:** `index.html` y `pista.js`.
- **Manejo de estado:** objeto `estado` actualizado por el evento SocketIO `estado`.
- **Navegación:** una sola ruta `/`.

### Capas y responsabilidades — Frontend (si aplica)

| Capa | Responsabilidad |
|---|---|
| Pages | `index.html` carga la pista, el aviso y la tabla. |
| Components | No aplica como librería. El canvas, el aviso y la tabla son nodos de esa página. |
| Hooks | No aplica. |
| Services | Cliente SocketIO y `fetch` a `/historial` y `POST /sesiones`. |
| Types | No aplica. JavaScript sin compilador. Los campos del mensaje están en SPEC-001. |

**Separación de responsabilidades:** el script de la pista no recalcula velocidad ni posición lateral. Usa `car_x` y `car_speed` del servidor. Sí calcula el avance a lo largo de la pista, el cruce de meta y el flanco de colisión.

### Principios de diseño obligatorios
- El núcleo `paso(muestra, obstaculo, dt)` es puro respecto de la cámara, el socket y la base de datos.
- Los parámetros numéricos (ganancias, umbrales, singletons) viven en un solo módulo.
- El contrato hacia el futuro ESP32 es el JSON de una línea, no la firma interna de Python.
- SQLite se abre con consultas parametrizadas.

### Clean Code — lineamientos del proyecto
- **Manejo de errores:** una línea JSON inválida se descarta y se registra. No tumba el lazo. Un `POST /sesiones` inválido responde 400 con código.
- **Tamaño de funciones:** una responsabilidad por función.
- **Naming:** español para el dominio de la materia (`vuelta`, `obstaculo`, `sesion`) en la API y la base. Inglés en los campos JSON ya fijados (`head_x`, `car_speed`).
- **Comentarios:** solo el porqué de una constante de control, no el qué evidente.
- **Inmutabilidad:** cada ciclo de control devuelve un estado nuevo. No se reescriben muestras ya emitidas.

### Pruebas
No aplica en este SDD custom. HeadRace no genera `test-plan.md`, casos de prueba ni certificación con `/sdd-test`. El contrato de comportamiento queda en los criterios de aceptación de `requirements.md`.

---

## Convenciones del proyecto

- **Naming de archivos:** snake_case en Python, kebab no aplica en el código.
- **Naming de endpoints:** `GET /`, `GET /historial`, `POST /sesiones`. Sin prefijo `/api`.
- **Formato de fechas:** ISO 8601 en UTC, lo escribe el servidor.
- **Paginación:** no aplica. El historial es como máximo 10 filas.
- **Decimales:** `tiempo_vuelta` y `velocidad_promedio` son REAL. `car_speed` se emite como entero. `car_x` se emite con un decimal.

---

## Restricciones técnicas conocidas

- El proceso escucha solo en `127.0.0.1`. No se expone a la red del salón en esta spec.
- No agregar un framework de frontend.
- No poner scikit-fuzzy en el camino de ejecución. Sirve solo como contraste opcional en un notebook, fuera del lazo.
- No abrir el puerto serial desde dos módulos.
- El firmware C++ no forma parte de SPEC-001.

---

## Versiones mínimas requeridas

| Herramienta | Versión mínima |
|---|---|
| Python | 3.11 |
| OpenCV (`opencv-python`) | 4.8 |
| Flask | 3.0 |
| Flask-SocketIO | 5.3 |
| SQLite | el de la stdlib |
| Navegador | uno con Canvas 2D y WebSocket |

---

## ADRs de stack

| ADR | Decisión | Estado |
|---|---|---|
| ADR-001 | Núcleo de control en Python, portable a C++, sin scikit-fuzzy en runtime | accepted |
| ADR-002 | Un proceso es dueño del enlace; el simulador es llamada en memoria | accepted |
| ADR-003 | Contrato JSON de una línea, campos de `HeadRace_contexto_desarrollo.md` | accepted |
| ADR-004 | Difusa Sugeno con la tabla del contexto y singletons 30 / 60 / 90 | accepted |

Viven en `specs/features/carrera/SPEC-001-sesion-de-carrera-simulada/adr/`.

---

## Historial de cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-09-25 | Versión inicial | Proyecto greenfield, spec local sin Azure |
