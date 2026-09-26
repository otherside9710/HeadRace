import json
from dataclasses import dataclass

from headrace.control.difusa import evaluar
from headrace.control.pid import MemoriaPid, actualizar_pid
from headrace.parametros import RANGO


@dataclass
class EstadoCarro:
    car_x: float
    car_speed: int
    obstacle_dist: int
    obstacle_alert: bool

    def como_mensaje(self) -> dict:
        return {
            "car_x": round(self.car_x, 1),
            "car_speed": self.car_speed,
            "obstacle_dist": self.obstacle_dist,
            "obstacle_alert": self.obstacle_alert,
        }


@dataclass
class MemoriaControl:
    pid: MemoriaPid
    head_x_anterior: float = 0.0
    tiene_muestra: bool = False


def recortar_offset(valor: int) -> int:
    return int(min(RANGO, max(-RANGO, valor)))


def paso(
    head_x: int,
    head_y: int,
    obstacle_dist: int,
    dt: float,
    memoria: MemoriaControl,
) -> EstadoCarro:
    del head_y
    head_x = recortar_offset(head_x)
    if memoria.tiene_muestra:
        brusquedad = abs(head_x - memoria.head_x_anterior)
    else:
        brusquedad = 0.0
    car_x = actualizar_pid(float(head_x), memoria.pid, dt)
    velocidad, alerta = evaluar(brusquedad, int(obstacle_dist))
    memoria.head_x_anterior = float(head_x)
    memoria.tiene_muestra = True
    return EstadoCarro(
        car_x=round(car_x, 1),
        car_speed=velocidad,
        obstacle_dist=int(obstacle_dist),
        obstacle_alert=alerta,
    )


def decodificar_cabeza(linea: str) -> tuple[int, int] | None:
    try:
        objeto = json.loads(linea)
    except json.JSONDecodeError:
        return None
    if not isinstance(objeto, dict) or "head_x" not in objeto or "head_y" not in objeto:
        return None
    try:
        head_x = int(objeto["head_x"])
        head_y = int(objeto["head_y"])
    except (TypeError, ValueError):
        return None
    return recortar_offset(head_x), recortar_offset(head_y)


def codificar_cabeza(head_x: int, head_y: int) -> str:
    return json.dumps(
        {"head_x": recortar_offset(head_x), "head_y": recortar_offset(head_y)},
        separators=(",", ":"),
    )
