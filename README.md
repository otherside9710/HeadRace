# HeadRace

Carrera simulada de la materia Sistemas de Control. La webcam mide la cabeza, un núcleo Python aplica PID y lógica difusa, y el navegador dibuja la pista. El ESP32 todavía no entra: cuando llegue, se sustituye la llamada a `paso()` por el mismo JSON en el puerto serie.

## Arranque

Para desarrollo, inicia Flask y Vite juntos:

```bash
./start-headrace.sh
```

Abre http://127.0.0.1:5173/. Pulsa `Ctrl+C` en la terminal para detener los dos procesos.

La primera vez, si aún no instalaste las dependencias de Node:

```bash
cd frontend && npm install
```

## Arranque de producción local

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd frontend
npm install
npm run build
cd ..
python main.py
```

Abrir http://127.0.0.1:5000/

Si la cámara no abre, la página igual carga y muestra «Sin cámara». El carro queda centrado.

El frontend usa React, TypeScript, Three.js y React Three Fiber. `npm run build` genera los archivos que Flask sirve desde `headrace/web/dist`. Para iterar solo en el frontend, ejecuta `npm run dev` dentro de `frontend`.

## Qué hace cada parte

| Carpeta | Rol |
|---|---|
| `headrace/captura` | Offset de la cara, de −100 a 100 |
| `headrace/control` | PID, lógica difusa y el JSON de una línea |
| `headrace/backend` | Flask, SocketIO y SQLite |
| `frontend/src/scene` | Kart, carretera, costa, obstáculos y escena 3D |
| `frontend/src/game` | Estado de carrera, carriles, cámara y ciclo ambiental |
| `frontend/src/ui` | HUD, minimapa, cámara y controles |

El ciclo ambiental dura 78 segundos y repite día → tarde → noche → amanecer → día, incluso después de terminar una sesión.

Las ganancias están en `headrace/parametros.py`. Son el punto de partida del simulador, no la sintonía de la placa.

## Sustituir el núcleo por el ESP32

El proceso sigue siendo el único dueño del enlace. En lugar de `paso()`, se escribe una línea `{"head_x","head_y"}` y se lee `{"car_x","car_speed","obstacle_dist","obstacle_alert"}`. La pista y la base no cambian.
