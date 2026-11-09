# HeadRace

Proyecto de Sistemas de Control: una carrera 3D controlada con la posición de la cabeza detectada por webcam. El control de dirección se calcula con PID y la velocidad se decide con lógica difusa.

## Dónde se ejecuta el control

- **ESP32 conectado:** el firmware MicroPython de `firmware/esp32/` ejecuta el PID, la lógica difusa y la lectura del VL53L0X. El backend envía la posición de cabeza por USB serial y reenvía al navegador los resultados calculados por la placa.
- **ESP32 desconectado:** el juego sigue funcionando en modo de respaldo; el mismo PID y las mismas reglas difusas corren en Python. El HUD indica claramente que el control es simulado.

La cámara, el backend Flask/Socket.IO, la interfaz React/Three.js y SQLite siguen en la laptop. Solo un hilo del backend es dueño del puerto serial y la comunicación es bidireccional a 115200 baudios.

## Ejecutar la aplicación

Para desarrollo, inicia Flask y Vite juntos:

```bash
./start-headrace.sh
```

Abre <http://127.0.0.1:5173/>. Pulsa `Ctrl+C` en la terminal para detener ambos procesos. Para la primera instalación del frontend:

```bash
cd frontend && npm install
```

## Firmware ESP32 y sensor

Los archivos que deben quedar instalados en la placa están en [`firmware/esp32/`](firmware/esp32/README.md). La placa debe ejecutar MicroPython. El controlador serial espera mensajes JSON con la posición de cabeza y responde con `car_x` y `car_speed`, que son los valores que conducen el kart.

El VL53L0X se comunica por I2C. La configuración inicial usa SDA GPIO 21 y SCL GPIO 22, ajustables en `firmware/esp32/sensor.py`. El sensor clasifica los gestos: mantener 151–350 mm durante 300 ms solicita el escudo y acercar la mano a 150 mm o menos solicita las llamas; alejarla a 450 mm o retirarla del rango rearma el sensor. La carrera aplica las reglas existentes de carga, duración y exclusión de poderes.

El firmware usa la medida ToF válida como entrada de proximidad para la lógica difusa. Si la medida no está disponible, usa la distancia de obstáculo simulada recibida del backend. Las ganancias PID y umbrales están al inicio de `firmware/esp32/control.py` y `firmware/esp32/main.py`; son valores iniciales que se deben sintonizar con la placa y el cableado reales.

## Compilar frontend para servir desde Flask

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

Para ejecutar backend y frontend de desarrollo a la vez, usa `./start-headrace.sh`; abre la URL del juego que imprime el script. El script elige un puerto libre entre 5000 y 5009 para el backend y muestra su URL. En esta Mac el puerto 5000 lo ocupa Control Center, así que HeadRace está usando el 5001. Si la cámara no está disponible, la página carga y reporta el estado.

## Estructura relevante

| Carpeta | Responsabilidad |
|---|---|
| `firmware/esp32` | Firmware MicroPython: PID, lógica difusa, VL53L0X y gestos |
| `headrace/captura` | Detección facial y offset horizontal/vertical de −100 a 100 |
| `headrace/control` | Control PID/difuso de respaldo cuando la placa está desconectada |
| `headrace/backend` | Flask, enlace serial bidireccional, Socket.IO y SQLite |
| `frontend/src/scene` | Kart, pista, costa, obstáculos y escena 3D |
| `frontend/src/game` | Estado y reglas de carrera, carriles, poderes y ciclo ambiental |
| `frontend/src/ui` | HUD, cámara, mapa y controles |

El ciclo ambiental dura 78 segundos y repite día → tarde → noche → amanecer → día, incluso después de terminar una sesión.
