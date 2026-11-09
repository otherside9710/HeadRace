# Firmware MicroPython de HeadRace

Estos son los archivos fuente que se instalan en el ESP32. El control en modo real se ejecuta en `main.py`; el backend no vuelve a calcular PID ni lógica difusa cuando recibe respuestas válidas de la placa.

## Archivos

- `main.py`: protocolo USB serial, ciclo de control, clasificación de gestos y publicación del resultado.
- `control.py`: PID con ganancias `Kp=0.35`, `Ki=0.01`, `Kd=0.02`, saturación y lógica difusa Sugeno con las nueve reglas del simulador.
- `sensor.py`: configuración I2C, lectura y recuperación del sensor VL53L0X.
- `vl53l0x_nb.py`: driver MicroPython VL53L0X que ya estaba instalado y fue leído desde la placa; conserva los avisos SPDX/MIT y la referencia al repositorio de origen.
- `backup-before-integration/main.py`: copia del `main.py` que estaba instalado antes de esta integración. También quedó una copia `main.py.bak` en el ESP32.

## Cableado inicial

Configuración sugerida para ESP32 DevKit V1:

| VL53L0X | ESP32 |
|---|---|
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| GND | GND |
| VIN/VCC | Usa la tensión indicada por el fabricante de tu módulo |

Los GPIO I2C se configuran al principio de `sensor.py`. La placa y el sensor deben compartir tierra. El pinout y el nivel de alimentación de los módulos VL53L0X V2 pueden variar; revisa las etiquetas del breakout antes de alimentarlo. En la conexión actual se detectó el sensor en la dirección I2C `0x29` y el firmware confirmó su inicialización.

## Instalar en la placa

1. Instala MicroPython en el ESP32 si todavía no está instalado.
2. En Thonny, selecciona el intérprete **MicroPython (ESP32)** y el puerto USB de la placa.
3. Sube `main.py`, `control.py`, `sensor.py` y `vl53l0x_nb.py` al directorio raíz del dispositivo, conservando esos nombres.
4. Reinicia la placa. MicroPython ejecutará `main.py` al arrancar.
5. Cierra la consola/REPL de Thonny antes de arrancar HeadRace: la aplicación debe ser la única que abra el puerto serial. En la Mac conectada, el dispositivo aparece como `/dev/cu.usbserial-140`.

También se puede copiar desde terminal con `mpremote` (instalable con `python -m pip install mpremote`). Reemplaza el puerto por el que aparezca al conectar el ESP32:

```bash
mpremote connect /dev/cu.usbserial-XXXX fs cp firmware/esp32/main.py :main.py
mpremote connect /dev/cu.usbserial-XXXX fs cp firmware/esp32/control.py :control.py
mpremote connect /dev/cu.usbserial-XXXX fs cp firmware/esp32/sensor.py :sensor.py
mpremote connect /dev/cu.usbserial-XXXX fs cp firmware/esp32/vl53l0x_nb.py :vl53l0x_nb.py
mpremote connect /dev/cu.usbserial-XXXX reset
```

El puerto se detecta automáticamente en macOS (`/dev/cu.usbserial-*`). Para fijarlo, configura `HEADRACE_ESP32_PORT`; la velocidad serial predeterminada es 115200 baudios. Los cuatro archivos ya están instalados en la placa y el backend recibió el anuncio `headrace-1` con el sensor inicializado.

## Protocolo de control

El firmware anuncia periódicamente que está listo mientras espera al backend. Después, el backend envía una línea JSON cada 50 ms aproximadamente:

```json
{"head_x":42,"head_y":-15,"dt":0.05,"obstacle_dist":2000}
```

La respuesta de cada muestra lleva las decisiones calculadas por el ESP32:

```json
{"car_x":12.4,"car_speed":90,"obstacle_dist":780,"obstacle_alert":false,"sensor_conectado":true,"sensor_distancia_mm":780,"sensor_mano_detectada":false,"sensor_zona":"reposo","power_event":null}
```

`car_x` es la posición procesada por el PID; `car_speed` es la salida 0–100 de la lógica difusa; `sensor_distancia_mm` y los gestos vienen del VL53L0X. `power_event` solo se llena en la muestra en que se detecta un gesto (`shield` o `flames`). El escudo requiere mantener 151–350 mm por 300 ms; las llamas se solicitan a 150 mm o menos; 450 mm o la retirada de la mano fuera del rango rearma el sensor. El navegador conserva las reglas de carga de tres esquivas del mismo carril, duración de diez segundos y poderes excluyentes: es el juego quien decide si el escudo está realmente activo y puede bloquear las llamas.

## Estado de integración

La conexión serial y la detección del sensor se verificaron en la placa. El sensor produjo una lectura de 42 mm y el firmware emitió el evento `flames`. Cuando no hay una lectura válida, `sensor_distancia_mm` se informa como `null` y el control de obstáculos usa la distancia simulada recibida del backend. El HUD cambia a **PID + lógica difusa · ESP32** mientras la placa responde; si se desconecta, el backend vuelve al respaldo de `headrace/control/`.
