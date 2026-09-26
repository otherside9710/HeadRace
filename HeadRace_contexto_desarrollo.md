# HeadRace — Contexto del proyecto y especificación de desarrollo

> Este documento resume todo el contexto acumulado en la sesión anterior para poder continuar el desarrollo del proyecto (principalmente el software) en una nueva conversación, antes de que lleguen los componentes electrónicos físicos.

## 1. Contexto académico

- **Materia:** Sistemas de Control
- **Programa:** Ingeniería de Sistemas
- **Institución:** Corporación Universitaria Latinoamericana (CUL), Barranquilla, Colombia
- **Docente:** Jorge Antonio Ruiz Escorcia
- **Estudiante:** Julio Sarmiento Peña
- **Modalidad:** Proyecto individual
- **Plazo total:** 2 meses (8 semanas)
- **Nivel de experiencia del estudiante:** ninguna experiencia previa con ESP32, control PID, lógica difusa ni desarrollo embebido. Es la primera vez que trabaja estos temas.

Ya existe un documento formal de propuesta (`Propuesta_HeadRace.docx`) entregado/aprobado con la estructura completa (introducción, objetivos, marco teórico, metodología, cronograma, recursos). Este archivo markdown se enfoca en la parte técnica/de código para continuar el desarrollo.

## 2. Nombre y concepto del proyecto

**Nombre:** HeadRace

**Concepto:** un vehículo virtual en una pista 2D, mostrado en una interfaz web, que el usuario controla moviendo la cabeza frente a una cámara. El sistema usa control PID para suavizar el movimiento (simulando la inercia de un vehículo real) y lógica difusa para decidir la velocidad máxima permitida según el contexto (qué tan brusco es el movimiento de cabeza, y qué tan cerca está un obstáculo físico real detectado por un sensor). Todo el historial de sesiones (tiempos de vuelta, choques, eventos de obstáculo) se guarda en una base de datos.

## 3. Arquitectura general (4 módulos)

```
Webcam (laptop)
    │
    ▼
[1] Módulo de captura — Python + OpenCV
    Detecta la posición de la cabeza (offset X, Y respecto al centro del frame)
    │  (Serial USB, formato JSON — ver sección 5)
    ▼
[2] Módulo de control — ESP32 (C++ / Arduino)
    - Recibe posición de cabeza
    - Lee sensor de obstáculo VL53L5X (I2C)
    - Aplica controlador PID (suaviza el movimiento → posición/velocidad del carro)
    - Aplica lógica difusa (2 entradas: velocidad de cambio de cabeza + distancia de
      obstáculo → 1 salida: velocidad máxima permitida)
    │  (Serial USB, formato JSON de vuelta)
    ▼
[3] Backend Python — Flask + Flask-SocketIO
    Lee el puerto Serial, reenvía los datos procesados por WebSocket al navegador
    │  (WebSocket)
    ▼
[4] Frontend web — HTML + JS + Canvas
    Dibuja la pista y el carro en tiempo real, detecta colisiones con los bordes
    │  (al completar vuelta / terminar sesión)
    ▼
Base de datos SQLite (gestionada desde el backend Flask)
    Guarda: fecha, tiempo de vuelta, colisiones, eventos de obstáculo, velocidad promedio
```

**Decisión de diseño clave:** el ESP32 es el único responsable de ejecutar los algoritmos de control (PID + lógica difusa) — esto es lo que exige la materia. La visión por computadora, la interfaz gráfica y la base de datos viven en la laptop (Python), fuera del microcontrolador, porque el ESP32 no tiene la capacidad de procesamiento ni de almacenamiento para hacerlo todo.

**Comunicación ESP32 ↔ Python:** por cable USB (Serial), no por WiFi. Se eligió así por ser más simple de depurar para alguien sin experiencia previa. Se puede migrar a WiFi más adelante si sobra tiempo, pero no es prioridad.

## 4. Componentes de hardware (a comprar / pendientes de llegar)

| Componente | Función | Notas |
|---|---|---|
| ESP32 DevKit | Ejecuta PID + lógica difusa | Cualquier variante DevKit V1 estándar sirve |
| Sensor VL53L5X (ToF multizona) | Detecta distancia y posición de un obstáculo | Comunicación I2C (4 pines: VCC, GND, SDA, SCL). Usar librería oficial de STMicroelectronics o la de SparkFun (`SparkFun_VL53L5CX_Arduino_Library`) |
| Cable USB (datos, no solo carga) | Comunicación Serial ESP32 ↔ laptop | — |
| Webcam | Captura de video para detección de cabeza | La integrada en la laptop es suficiente |

*(Ya no se usa el sensor ultrasónico HC-SR04 que se consideró inicialmente — se reemplazó por el VL53L5X por decisión posterior.)*

## 5. Protocolo de comunicación Serial (Python ↔ ESP32)

Formato propuesto: JSON de una línea por mensaje (`\n` como terminador), para que sea fácil de parsear en ambos lados.

**Python → ESP32** (posición de cabeza, ~20-30 mensajes/segundo):
```json
{"head_x": 42, "head_y": -15}
```
- `head_x`: offset horizontal de la nariz respecto al centro del frame, rango sugerido -100 a 100
- `head_y`: offset vertical, mismo rango (opcional si solo se usa para dirección, no para acelerar/frenar)

**ESP32 → Python** (estado procesado, misma frecuencia):
```json
{"car_x": 37, "car_speed": 68, "obstacle_dist": 120, "obstacle_alert": false}
```
- `car_x`: posición horizontal del carro ya suavizada por el PID (mismo rango -100 a 100)
- `car_speed`: velocidad actual permitida/aplicada (0-100), resultado de la lógica difusa
- `obstacle_dist`: distancia en mm al obstáculo más cercano detectado por el VL53L5X (o -1 si no hay lectura válida)
- `obstacle_alert`: booleano, true si el obstáculo está dentro del umbral de frenado

> Este formato es una propuesta inicial — se puede ajustar durante el desarrollo, pero conviene fijarlo temprano para no tener que rehacer ambos lados (Python y C++) varias veces.

## 6. Lo que hay que desarrollar en software (sin depender de la electrónica)

Esto es lo importante: **casi todo el código se puede escribir y probar antes de que lleguen los componentes**, simulando el ESP32 con datos falsos (mock). Sugerencia de orden de desarrollo:

### 6.1 Módulo de captura (Python + OpenCV)
- Detección facial en tiempo real (empezar con Haar Cascade de OpenCV por simplicidad; migrar a MediaPipe Face Mesh solo si se necesita más precisión).
- Cálculo del offset de la nariz/cara respecto al centro del frame, normalizado al rango -100 a 100.
- Envío por Serial en el formato JSON de la sección 5.
- **Se puede desarrollar y probar 100% sin el ESP32** (solo imprimir los valores por consola al inicio).

### 6.2 Simulador de ESP32 (mock, para probar sin hardware)
- Un script Python que **simule** lo que hará el ESP32: recibe `{"head_x", "head_y"}`, aplica un PID básico en software (mismo algoritmo que luego se portará a C++) y una lógica difusa simple, y devuelve `{"car_x", "car_speed", "obstacle_dist", "obstacle_alert"}` con un valor de obstáculo aleatorio o fijo (ya que no hay sensor físico todavía).
- Esto permite desarrollar y probar **todo el resto del sistema** (backend, frontend, base de datos) sin esperar a que lleguen los componentes.
- Cuando llegue el hardware, este mismo algoritmo de PID/difusa se traduce a C++ para el ESP32 real, reemplazando este simulador.

### 6.3 Backend Flask + Flask-SocketIO
- Servidor Flask básico que sirve la página web.
- Lee el puerto Serial (del ESP32 real o del simulador del punto 6.2 — el backend no necesita saber la diferencia si ambos hablan el mismo protocolo JSON).
- Reenvía los datos recibidos al navegador por SocketIO en tiempo real.
- Expone una ruta (ej. `/historial`) que consulta la base de datos y devuelve los mejores tiempos.

### 6.4 Frontend web (HTML + JS + Canvas)
- Dibuja una pista simple (óvalo o circuito con un par de curvas) usando la API de Canvas.
- Recibe datos por SocketIO (`car_x`, `car_speed`, `obstacle_alert`) y mueve el carro en consecuencia.
- Detecta colisión del carro con los bordes de la pista (lógica en JavaScript).
- Muestra un indicador visual cuando `obstacle_alert` es `true` (ej. un ícono de advertencia).
- Muestra la tabla de mejores tiempos consultando `/historial`.

### 6.5 Base de datos (SQLite)
Esquema propuesto para la tabla principal:

```sql
CREATE TABLE sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora TEXT NOT NULL,
    tiempo_vuelta REAL,
    colisiones INTEGER DEFAULT 0,
    eventos_obstaculo INTEGER DEFAULT 0,
    velocidad_promedio REAL
);
```
- Se inserta un registro cada vez que el carro completa una vuelta o termina la sesión.
- La ruta `/historial` del backend Flask hace `SELECT * FROM sesiones ORDER BY tiempo_vuelta ASC LIMIT 10` para mostrar el top de mejores tiempos.

### 6.6 Algoritmo de control (a diseñar en Python, luego portar a C++)

**PID** — entrada: `head_x` (setpoint = posición deseada), variable controlada: `car_x`.
```
error = head_x - car_x_anterior
integral += error * dt
derivada = (error - error_anterior) / dt
salida = Kp*error + Ki*integral + Kd*derivada
car_x_nuevo = car_x_anterior + salida
```
Empezar sintonizando solo con Kp, luego agregar Kd, y al final Ki si hace falta.

**Lógica difusa** — 2 entradas, 1 salida:
- Entrada 1: `|head_x - head_x_anterior|` (qué tan brusco es el movimiento) → conjuntos difusos: bajo / medio / alto
- Entrada 2: `obstacle_dist` (distancia al obstáculo) → conjuntos difusos: cerca / medio / lejos
- Salida: `car_speed` (velocidad máxima permitida) → conjuntos difusos: baja / media / alta

Tabla de reglas sugerida (punto de partida, ajustable):

| Movimiento \ Obstáculo | Cerca | Medio | Lejos |
|---|---|---|---|
| **Bajo** (suave) | Media | Alta | Alta |
| **Medio** | Baja | Media | Alta |
| **Alto** (brusco) | Baja | Baja | Media |

Diseñar y probar estas reglas primero en Python (librería `scikit-fuzzy`) antes de programarlas en C++ para el ESP32, ya que iterar en Python es mucho más rápido.

## 7. Lo que NO se puede avanzar hasta tener el hardware físico

- Calibración real del sensor VL53L5X (rangos de distancia reales, ruido de lectura).
- Sintonización final del PID y las reglas difusas con la latencia real del Serial y el hardware (los valores de Kp/Ki/Kd definidos en el simulador son un punto de partida, no definitivos).
- Pruebas de estabilidad del sistema integrado de extremo a extremo.
- Verificación de tiempos de respuesta reales (framerate de la cámara + latencia Serial + refresco del navegador).

## 8. Cronograma de referencia (documento de propuesta ya entregado)

| Semana | Actividad |
|---|---|
| 1 | Detección de posición de cabeza con la cámara (Python + OpenCV) |
| 2 | Comunicación Python ↔ ESP32 (Serial) |
| 3 | Implementación del controlador PID en el ESP32 |
| 4 | Diseño e implementación de la lógica difusa; integración del sensor VL53L5X |
| 5 | Servidor web (Flask + SocketIO) e integración con el ESP32 |
| 6 | Base de datos SQLite y tabla de resultados en la web |
| 7 | Integración completa y pruebas de estabilidad |
| 8 | Documentación final y preparación de la sustentación |

**Nota:** dado que el hardware (ESP32 + VL53L5X) aún no ha llegado, se recomienda adelantar en paralelo los puntos 6.1 a 6.5 de este documento (todo lo que no depende del hardware) mientras se espera la compra, para no perder tiempo del cronograma.

## 9. Qué pedirle a Claude en la próxima sesión

Sugerencia de primer mensaje para la siguiente conversación:

> "Aquí tienes el contexto completo de mi proyecto HeadRace (adjunto el markdown). Quiero empezar a programar: [elige una] (a) el script de detección de cabeza con OpenCV, (b) el simulador de ESP32 en Python para probar el resto del sistema sin hardware, (c) el backend Flask + SocketIO, (d) el diseño de las reglas difusas en Python con scikit-fuzzy."

Con este documento como contexto, la nueva sesión debería poder continuar sin tener que re-explicar el proyecto desde cero.
