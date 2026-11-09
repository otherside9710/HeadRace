"""Acceso I2C al sensor de distancia VL53L0X / VL53L0X V2."""

import time

from machine import I2C, Pin

from vl53l0x_nb import VL53L0X


# Pines I2C por defecto del ESP32 DevKit V1. Cambiar si el cableado real usa otros.
PIN_SDA = 21
PIN_SCL = 22
FRECUENCIA_I2C = 400000
PERIODO_LECTURA_MS = 50
REINTENTO_MS = 1500
DISTANCIA_MIN_MM = 20
DISTANCIA_MAX_MM = 2000


class SensorDistancia:
    def __init__(self):
        self.i2c = None
        self.dispositivo = None
        self.conectado = False
        self.proximo_reintento = 0
        self._iniciar()

    def _iniciar(self):
        try:
            self.i2c = I2C(
                0,
                scl=Pin(PIN_SCL),
                sda=Pin(PIN_SDA),
                freq=FRECUENCIA_I2C,
            )
            self.dispositivo = VL53L0X(self.i2c)
            self.conectado = True
            return True
        except Exception:
            self.dispositivo = None
            self.conectado = False
            self.proximo_reintento = time.ticks_add(time.ticks_ms(), REINTENTO_MS)
            return False

    def leer_mm(self):
        if self.dispositivo is None:
            ahora = time.ticks_ms()
            if time.ticks_diff(ahora, self.proximo_reintento) < 0:
                return None
            if not self._iniciar():
                return None

        try:
            distancia = int(self.dispositivo.range)
        except Exception:
            self.dispositivo = None
            self.conectado = False
            self.proximo_reintento = time.ticks_add(time.ticks_ms(), REINTENTO_MS)
            return None

        if distancia < DISTANCIA_MIN_MM or distancia > DISTANCIA_MAX_MM:
            return None
        return distancia
