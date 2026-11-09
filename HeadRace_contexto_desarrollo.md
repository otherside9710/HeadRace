# HeadRace — Contexto del proyecto y especificación de desarrollo

> Este documento resume el contexto técnico actual del proyecto para continuar la implementación e integración del software y la electrónica.

## 1. Contexto académico

- **Materia:** Sistemas de Control
- **Programa:** Ingeniería de Sistemas
- **Institución:** Corporación Universitaria Latinoamericana (CUL), Barranquilla, Colombia
- **Docente:** Jorge Antonio Ruiz Escorcia
- **Integrantes:** Rafael Manotas Borja y Julio Sarmiento Peña
- **Modalidad:** Proyecto universitario en equipo
- **Plazo total:** 2 meses (8 semanas)
- **Nivel de experiencia del estudiante:** ninguna experiencia previa con ESP32, control PID, lógica difusa ni desarrollo embebido. Es la primera vez que trabaja estos temas.

Ya existe un documento formal de propuesta (`Propuesta_HeadRace.docx`) entregado/aprobado con la estructura completa (introducción, objetivos, marco teórico, metodología, cronograma, recursos). Este archivo markdown se enfoca en la parte técnica/de código para continuar el desarrollo.

## 2. Nombre y concepto del proyecto

**Nombre:** HeadRace

**Concepto:** un vehículo virtual en una pista 2D, mostrado en una interfaz web, que el usuario controla moviendo la cabeza frente a una cámara. El sistema usa control PID para suavizar el movimiento (simulando la inercia de un vehículo real) y lógica difusa para decidir la velocidad máxima permitida según el contexto (qué tan brusco es el movimiento de cabeza, y qué tan cerca está un obstáculo físico real detectado por un sensor). Todo el historial de sesiones (tiempos de vuelta, choques, eventos de obstáculo) se guarda en una base de datos.

## 3. Arquitectura general (integración actual)

```
Webcam (laptop)
    │
    ▼
[1] Módulo de captura — Python + OpenCV
    Detecta la posición de la cabeza (offset X, Y respecto al centro del frame)
    │  (Serial USB, formato JSON — ver sección 5)
    ▼
[2] Módulo de control — ESP32 (MicroPython)
    - Recibe posición de cabeza
    - Lee el sensor de proximidad VL53L0X V2 por I2C
    - Aplica controlador PID (suaviza el movimiento → posición/velocidad del carro)
    - Aplica lógica difusa (2 entradas: velocidad de cambio de cabeza + distancia de
      obstáculo → 1 salida: velocidad máxima permitida)
    │  (Serial USB, formato JSON de vuelta)
    ▼
[3] Backend Python — Flask + Flask-SocketIO
    Envía la posición de la cabeza al ESP32 por Serial y retransmite sus decisiones
    al navegador por WebSocket. Si la placa está desconectada usa el controlador Python
    como respaldo, y lo indica en el HUD.
    │  (WebSocket)
    ▼
[4] Frontend web — HTML + JS + Canvas
    Dibuja la pista 3D y el carro en tiempo real; administra obstáculos, colisiones y poderes
    │  (al completar vuelta / terminar sesión)
    ▼
Base de datos SQLite (gestionada desde el backend Flask)
    Guarda: fecha, tiempo de vuelta, colisiones, eventos de obstáculo, velocidad promedio
```

**Decisión de diseño clave:** en el modo conectado, el ESP32 es responsable de ejecutar PID y lógica difusa. La laptop se encarga de visión por computadora, interfaz, persistencia y transporte de datos. Cuando no hay placa disponible, el controlador Python mantiene el juego en modo simulado; el HUD distingue ese modo del control ejecutado realmente en el ESP32.

**Comunicación ESP32 ↔ Python:** por cable USB (Serial), no por WiFi. Se eligió así por ser más simple de depurar para alguien sin experiencia previa. Se puede migrar a WiFi más adelante si sobra tiempo, pero no es prioridad.

## 4. Componentes de hardware del prototipo

| Componente | Función | Notas |
|---|---|---|
| ESP32 DevKit | Ejecuta firmware MicroPython, PID y lógica difusa | El control real corre en la placa |
| Sensor VL53L0X V2 (ToF) | Mide proximidad para los gestos de escudo/llamas y como entrada de proximidad difusa | I2C: VIN/VCC, GND, SDA, SCL; verificar voltaje del módulo |
| Cable USB (datos, no solo carga) | Comunicación Serial ESP32 ↔ laptop | — |
| Webcam | Captura de video para detección de cabeza | La integrada en la laptop es suficiente |

El sensor actualmente definido es el VL53L0X V2, de una zona. No usar la documentación anterior del VL53L5X ni el firmware Arduino/C++: el código del proyecto está en `firmware/esp32/` y usa MicroPython.

## 5. Protocolo de comunicación Serial (Python ↔ ESP32)

Formato actual: JSON de una línea por mensaje (`\n` como terminador), para que sea fácil de parsear en ambos lados.

**Laptop → ESP32** (posición de cabeza y entrada de obstáculo, ~20 mensajes/segundo):
```json
{"head_x": 42, "head_y": -15, "dt": 0.05, "obstacle_dist": 2000}
```
- `head_x`: offset horizontal de la nariz respecto al centro del frame, rango sugerido -100 a 100
- `head_y`: offset vertical, mismo rango (opcional si solo se usa para dirección, no para acelerar/frenar)

**ESP32 → Laptop** (estado calculado por el firmware, misma frecuencia):
```json
{"car_x": 37, "car_speed": 68, "obstacle_dist": 120, "obstacle_alert": true, "sensor_conectado": true, "sensor_distancia_mm": 120, "sensor_mano_detectada": true, "sensor_zona": "llamas", "power_event": "flames"}
```
- `car_x`: posición horizontal del carro ya suavizada por el PID (mismo rango -100 a 100)
- `car_speed`: velocidad actual permitida/aplicada (0-100), resultado de la lógica difusa
- `obstacle_dist`: lectura ToF válida usada como proximidad para el controlador difuso; si no hay lectura, usa la entrada simulada del backend
- `obstacle_alert`: booleano, true si la proximidad de entrada está bajo el umbral de 400 mm
- `sensor_distancia_mm`, `sensor_mano_detectada`, `sensor_zona`: estado actual del sensor y el gesto
- `power_event`: evento de una sola muestra (`shield`, `flames` o `null`)

El enlace tiene un único dueño en el backend para evitar que varios hilos abran el mismo puerto USB.

## 6. Código implementado

- `headrace/captura`: detección de cara y cálculo del offset horizontal/vertical entre −100 y 100.
- `firmware/esp32/control.py`: PID con Kp=0.35, Ki=0.01, Kd=0.02, límites de salida y lógica difusa Sugeno con nueve reglas.
- `firmware/esp32/sensor.py` y `vl53l0x_nb.py`: lectura I2C del VL53L0X y reintento si el sensor no responde; el driver coincide con el que estaba instalado en la placa.
- `firmware/esp32/main.py`: protocolo JSON serial, PID, velocidad difusa y detección de gestos. El ToF en 151–350 mm por 300 ms solicita escudo; a 150 mm o menos solicita llamas; a 450 mm rearma.
- `headrace/backend/app.py`: un solo hilo posee el puerto USB, envía posición de cabeza a la placa y reenvía sus respuestas a Socket.IO. El PID Python se usa solo como respaldo cuando no hay respuesta del ESP32.
- `frontend/src/game` y `frontend/src/ui`: integra `car_x`, `car_speed`, estado del sensor y eventos de poder. La carga del escudo y las reglas de carrera permanecen en el juego.
- `headrace/backend/sesiones.py`: historial de carrera en SQLite.

El firmware y el controlador Python comparten las reglas y las ganancias iniciales para mantener el modo simulado mientras no haya placa. El HUD distingue el controlador simulado del que corre en el ESP32.

## 7. Verificación pendiente con hardware

- Calibrar el VL53L0X V2, confirmar SDA/SCL y voltaje del módulo y revisar el ruido de lectura.
- Copiar los archivos de `firmware/esp32/` a la placa y confirmar que `main.py` arranque.
- Sintonizar PID y reglas difusas con latencia real. Kp/Ki/Kd son valores iniciales, no definitivos.
- Verificar estabilidad y tiempos de respuesta del sistema completo (cámara + serial + navegador).

## 8. Cronograma de referencia

| Semana | Actividad |
|---|---|
| 1 | Detección de posición de cabeza con la cámara |
| 2 | Comunicación Python ↔ ESP32 por USB serial |
| 3 | Firmware MicroPython con controlador PID en ESP32 |
| 4 | Lógica difusa e integración del VL53L0X V2 |
| 5 | Backend Flask + Socket.IO e integración web |
| 6 | Base de datos SQLite e historial de sesiones |
| 7 | Integración completa y pruebas con hardware |
| 8 | Documentación final y preparación de la sustentación |

**Estado actual:** el ESP32 está desconectado. El firmware y el protocolo están en el repositorio, pero no se han grabado ni validado en la placa. La aplicación usa el respaldo simulado hasta recibir respuestas reales del ESP32.

## 9. Próximo paso al reconectar el ESP32

Seguir `firmware/esp32/README.md`: instalar los archivos MicroPython, revisar el cableado I2C y reiniciar la placa. Después, cerrar Thonny/REPL, arrancar HeadRace y confirmar que el HUD cambie a **PID + lógica difusa · ESP32**. Ajustar umbrales y ganancias con lecturas reales del sensor.
