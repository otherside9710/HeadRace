# MOVA / HeadRace - Firmware ESP32 (MicroPython)
# Entrada (Python -> ESP32): {"head_x": 42, "head_y": -15}
# Salida  (ESP32 -> Python): {"car_x": 37.2, "car_speed": 60,
#                             "obstacle_dist": 320, "obstacle_alert": true}
# Sensor: VL53L0X por I2C (SDA=GPIO21, SCL=GPIO22), libreria vl53l0x_nb.py

import sys
import json
import time
import select
from machine import I2C, Pin

# ---------------- Parametros (ajustar en la calibracion) ----------------
PERIODO_MS = 50          # 20 Hz
DT = PERIODO_MS / 1000

# PID (valores de partida: reemplazar por los del PID de Python)
KP = 0.30
KI = 0.02
KD = 0.005
SALIDA_MAX = 12          # maximo cambio de car_x por ciclo
INTEGRAL_MAX = 50

ALERTA_MM = 400          # alerta si la distancia valida es menor
LEJOS_MM = 2000          # valor que se reporta cuando no se detecta nada
SIN_OBJETO_MM = 1500     # lecturas >= a esto se consideran "nada" (el sensor da ~8190)
DIST_SEGURA_MM = 500     # distancia usada en la difusa si la lectura es invalida

VEL_BAJA, VEL_MEDIA, VEL_ALTA = 30, 60, 90


# ---------------- Utilidades ----------------
def limitar(v, lo, hi):
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def rampa_baja(x, a, b):
    """1 si x<=a, 0 si x>=b, lineal entre ambos."""
    if x <= a:
        return 1.0
    if x >= b:
        return 0.0
    return (b - x) / (b - a)


def rampa_alta(x, a, b):
    return 1.0 - rampa_baja(x, a, b)


def triangulo(x, a, b, c):
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


# ---------------- Logica difusa ----------------
# Entradas: brusquedad del movimiento de cabeza y distancia al obstaculo (mm).
# Salida: velocidad 0-100 (promedio ponderado de 30, 60 y 90).
TABLA = (
    # cerca, media, lejos
    (VEL_MEDIA, VEL_ALTA, VEL_ALTA),   # movimiento suave
    (VEL_BAJA, VEL_MEDIA, VEL_ALTA),   # movimiento moderado
    (VEL_BAJA, VEL_BAJA, VEL_MEDIA),   # movimiento brusco
)


def velocidad_difusa(brusq, dist):
    mov = (
        rampa_baja(brusq, 3, 8),
        triangulo(brusq, 3, 8, 15),
        rampa_alta(brusq, 8, 15),
    )
    dis = (
        rampa_baja(dist, 200, 400),
        triangulo(dist, 200, 500, 900),
        rampa_alta(dist, 500, 900),
    )
    num = 0.0
    den = 0.0
    for i in range(3):
        for j in range(3):
            peso = min(mov[i], dis[j])
            num += peso * TABLA[i][j]
            den += peso
    if den == 0:
        return VEL_MEDIA
    return num / den


# ---------------- Sensor ----------------
def leer_distancia(sensor):
    """Devuelve mm, LEJOS_MM si no hay objeto, o -1 si la lectura no es valida."""
    try:
        d = sensor.range
    except OSError:
        return -1
    if d is None or d < 0:
        return -1
    if d >= SIN_OBJETO_MM:
        return LEJOS_MM
    return d


# ---------------- Entrada serial ----------------
def leer_cabeza(poll, actual):
    """Lee las lineas pendientes y conserva el ultimo head_x valido."""
    nuevo = actual
    while poll.poll(0):
        linea = sys.stdin.readline()
        if not linea:
            break
        try:
            datos = json.loads(linea)
            nuevo = limitar(float(datos["head_x"]), -100, 100)
        except (ValueError, KeyError, TypeError):
            pass  # linea mal formada: se descarta
    return nuevo


# ---------------- Programa principal ----------------
def main():
    from vl53l0x_nb import VL53L0X

    i2c = I2C(0, sda=Pin(21), scl=Pin(22), freq=400000)
    sensor = VL53L0X(i2c)

    poll = select.poll()
    poll.register(sys.stdin, select.POLLIN)

    head_x = 0.0
    prev_head = 0.0
    car_x = 0.0
    integral = 0.0
    err_prev = 0.0
    brusq = 0.0

    siguiente = time.ticks_add(time.ticks_ms(), PERIODO_MS)

    while True:
        head_x = leer_cabeza(poll, head_x)
        dist = leer_distancia(sensor)

        # PID de posicion lateral
        error = head_x - car_x
        integral = limitar(integral + error * DT, -INTEGRAL_MAX, INTEGRAL_MAX)
        deriv = (error - err_prev) / DT
        err_prev = error
        salida = KP * error + KI * integral + KD * deriv
        salida = limitar(salida, -SALIDA_MAX, SALIDA_MAX)
        car_x = limitar(car_x + salida, -100, 100)

        # Brusquedad del movimiento (cambio de head_x entre ciclos, suavizado)
        brusq = 0.5 * brusq + 0.5 * abs(head_x - prev_head)
        prev_head = head_x

        # Velocidad con logica difusa
        d_difusa = DIST_SEGURA_MM if dist < 0 else dist
        velocidad = limitar(velocidad_difusa(brusq, d_difusa), 0, 100)
        alerta = 0 <= dist < ALERTA_MM

        print(json.dumps({
            "car_x": round(car_x, 1),
            "car_speed": round(velocidad),
            "obstacle_dist": dist,
            "obstacle_alert": alerta,
        }))

        # Mantener el ciclo en PERIODO_MS
        restante = time.ticks_diff(siguiente, time.ticks_ms())
        if restante > 0:
            time.sleep_ms(restante)
            siguiente = time.ticks_add(siguiente, PERIODO_MS)
        else:
            siguiente = time.ticks_add(time.ticks_ms(), PERIODO_MS)


if __name__ == "__main__":
    main()