from dataclasses import dataclass

from headrace.parametros import (
    DELTA_MAX,
    DT_MAX,
    DT_MIN,
    INTEGRAL_MAX,
    KD,
    KI,
    KP,
    RANGO,
)


def acotar(valor: float, minimo: float, maximo: float) -> float:
    return min(maximo, max(minimo, valor))


def acotar_dt(dt: float) -> float:
    return acotar(dt, DT_MIN, DT_MAX)


@dataclass
class MemoriaPid:
    car_x: float = 0.0
    integral: float = 0.0
    error_anterior: float = 0.0


def actualizar_pid(head_x: float, memoria: MemoriaPid, dt: float) -> float:
    dt = acotar_dt(dt)
    error = head_x - memoria.car_x
    memoria.integral = acotar(memoria.integral + error * dt, -INTEGRAL_MAX, INTEGRAL_MAX)
    derivada = (error - memoria.error_anterior) / dt
    salida = KP * error + KI * memoria.integral + KD * derivada
    delta = acotar(salida, -DELTA_MAX, DELTA_MAX)
    memoria.car_x = acotar(memoria.car_x + delta, -RANGO, RANGO)
    memoria.error_anterior = error
    return memoria.car_x
