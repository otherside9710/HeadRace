"""Programa de arranque del HeadRace para ESP32 con MicroPython.

Entrada USB serial, una linea JSON por muestra:
    {"head_x": 12, "head_y": -4, "dt": 0.05, "obstacle_dist": 2000}

Salida USB serial: estado PID/difuso, VL53L0X y evento de poder de esa muestra.
"""

import sys
import select
import time

try:
    import ujson as json
except ImportError:
    import json

from control import Controlador
from sensor import SensorDistancia


UMBRAL_ESCUDO_MM = 350
UMBRAL_LLAMAS_MM = 150
UMBRAL_REARME_MM = 450
TIEMPO_ESCUDO_MS = 300
DISTANCIA_OBSTACULO_POR_DEFECTO_MM = 2000


class Gestos:
    def __init__(self):
        self.armado = True
        self.en_gesto = False
        self.inicio_escudo = None
        self.escudo_emitido = False
        self.llamas_emitidas = False

    def actualizar(self, distancia_mm, ahora_ms):
        if distancia_mm is None:
            # El VL53L0X devuelve un valor fuera de rango cuando se retira la
            # mano. Tratarlo como liberacion permite repetir el siguiente gesto.
            self.armado = True
            self.en_gesto = False
            self.inicio_escudo = None
            self.escudo_emitido = False
            self.llamas_emitidas = False
            return "reposo", False, None

        if distancia_mm >= UMBRAL_REARME_MM:
            self.armado = True
            self.en_gesto = False
            self.inicio_escudo = None
            self.escudo_emitido = False
            self.llamas_emitidas = False
        elif self.armado and distancia_mm <= UMBRAL_ESCUDO_MM:
            self.en_gesto = True
            self.armado = False

        zona = "reposo"
        if self.en_gesto:
            if distancia_mm <= UMBRAL_LLAMAS_MM:
                zona = "llamas"
            elif distancia_mm <= UMBRAL_ESCUDO_MM:
                zona = "escudo"

        evento = None
        if zona == "escudo":
            if self.inicio_escudo is None:
                self.inicio_escudo = ahora_ms
            elif (
                not self.escudo_emitido
                and time_diff_ms(ahora_ms, self.inicio_escudo) >= TIEMPO_ESCUDO_MS
            ):
                self.escudo_emitido = True
                evento = "shield"
        else:
            self.inicio_escudo = None

        if (
            zona == "llamas"
            and not self.llamas_emitidas
        ):
            self.llamas_emitidas = True
            evento = "flames"

        return zona, self.en_gesto, evento


def time_diff_ms(ahora, antes):
    # Los intervalos son cortos frente al wrap-around de ticks_ms del ESP32.
    import time

    return time.ticks_diff(ahora, antes)


def _entero(paquete, clave, defecto):
    try:
        return int(paquete.get(clave, defecto))
    except (TypeError, ValueError):
        return defecto


def _procesar(paquete, controlador, sensor, gestos):
    import time

    head_x = max(-100, min(100, _entero(paquete, "head_x", 0)))
    dt = paquete.get("dt", 0.05)
    try:
        dt = float(dt)
    except (TypeError, ValueError):
        dt = 0.05

    distancia_respaldo = _entero(
        paquete,
        "obstacle_dist",
        DISTANCIA_OBSTACULO_POR_DEFECTO_MM,
    )
    sensor_mm = sensor.leer_mm()

    # El ToF se usa como proximidad real. Si no hay lectura, se conserva la
    # distancia de obstaculo enviada por el simulador/backend.
    distancia_control = sensor_mm if sensor_mm is not None else distancia_respaldo
    car_x, car_speed, obstacle_alert = controlador.actualizar(
        head_x,
        distancia_control,
        dt,
    )
    zona, mano, power_event = gestos.actualizar(sensor_mm, time.ticks_ms())

    return {
        "car_x": car_x,
        "car_speed": car_speed,
        "obstacle_dist": distancia_control,
        "obstacle_alert": obstacle_alert,
        "sensor_conectado": sensor.conectado,
        "sensor_distancia_mm": sensor_mm,
        "sensor_mano_detectada": mano,
        "sensor_zona": zona,
        "power_event": power_event,
    }


def main():
    controlador = Controlador()
    sensor = SensorDistancia()
    gestos = Gestos()
    entrada = sys.stdin
    salida = sys.stdout
    lector = select.poll()
    lector.register(entrada, select.POLLIN)
    ultimo_ready = time.ticks_ms()

    def anunciar_listo():
        salida.write(
            json.dumps(
                {
                    "ready": True,
                    "protocolo": "headrace-1",
                    "sensor_conectado": sensor.conectado,
                }
            )
            + "\n"
        )

    anunciar_listo()

    while True:
        if not lector.poll(0):
            ahora = time.ticks_ms()
            if time.ticks_diff(ahora, ultimo_ready) >= 1000:
                anunciar_listo()
                ultimo_ready = ahora
            time.sleep_ms(5)
            continue
        try:
            linea = entrada.readline()
            if not linea:
                continue
            paquete = json.loads(linea)
            if not isinstance(paquete, dict):
                continue
            resultado = _procesar(paquete, controlador, sensor, gestos)
            salida.write(json.dumps(resultado) + "\n")
        except Exception:
            # No contaminar el protocolo JSON con trazas de MicroPython.
            salida.write(
                json.dumps(
                    {
                        "error": "control_error",
                        "sensor_conectado": False,
                        "sensor_distancia_mm": None,
                    }
                )
                + "\n"
            )


main()
