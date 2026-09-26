from headrace.parametros import UMBRAL_ALERTA_MM, VELOCIDAD_SIN_REGLA

_LEJOS_FORZADA = 1.0


def _triangulo(valor: float, izquierda: float, pico: float, derecha: float) -> float:
    if valor <= izquierda or valor >= derecha:
        return 0.0
    if valor <= pico:
        return (valor - izquierda) / (pico - izquierda)
    return (derecha - valor) / (derecha - pico)


def _bajo(brusquedad: float) -> float:
    if brusquedad <= 0:
        return 1.0
    if brusquedad >= 15:
        return 0.0
    return (15 - brusquedad) / 15


def _medio_movimiento(brusquedad: float) -> float:
    return _triangulo(brusquedad, 5, 20, 35)


def _alto(brusquedad: float) -> float:
    if brusquedad <= 25:
        return 0.0
    if brusquedad >= 40:
        return 1.0
    return (brusquedad - 25) / 15


def _cerca(distancia: float) -> float:
    if distancia <= 0:
        return 1.0
    if distancia >= 500:
        return 0.0
    return (500 - distancia) / 500


def _medio_distancia(distancia: float) -> float:
    return _triangulo(distancia, 300, 700, 1100)


def _lejos(distancia: float) -> float:
    if distancia <= 900:
        return 0.0
    if distancia >= 1500:
        return 1.0
    return (distancia - 900) / 600


def evaluar(brusquedad: float, distancia_mm: int) -> tuple[int, bool]:
    alerta = distancia_mm >= 0 and distancia_mm < UMBRAL_ALERTA_MM
    if distancia_mm < 0:
        lejos, medio_d, cerca = _LEJOS_FORZADA, 0.0, 0.0
    else:
        lejos = _lejos(distancia_mm)
        medio_d = _medio_distancia(distancia_mm)
        cerca = _cerca(distancia_mm)
    bajo = _bajo(brusquedad)
    medio_m = _medio_movimiento(brusquedad)
    alto = _alto(brusquedad)
    reglas = (
        (min(bajo, cerca), 60),
        (min(bajo, medio_d), 90),
        (min(bajo, lejos), 90),
        (min(medio_m, cerca), 30),
        (min(medio_m, medio_d), 60),
        (min(medio_m, lejos), 90),
        (min(alto, cerca), 30),
        (min(alto, medio_d), 30),
        (min(alto, lejos), 60),
    )
    peso = sum(peso_regla for peso_regla, _ in reglas)
    if peso == 0:
        return VELOCIDAD_SIN_REGLA, alerta
    acumulado = sum(peso_regla * singleton for peso_regla, singleton in reglas)
    velocidad = int(acumulado / peso + 0.5)
    return min(100, max(0, velocidad)), alerta
