"""PID y logica difusa ejecutados en el ESP32 (MicroPython)."""

# Mantener estos valores sincronizados con headrace/parametros.py.
KP = 0.35
KI = 0.01
KD = 0.02
DT_MIN = 0.02
DT_MAX = 0.10
INTEGRAL_MAX = 50.0
DELTA_MAX = 12.0
RANGO = 100
UMBRAL_ALERTA_MM = 400
VELOCIDAD_SIN_REGLA = 60


def _acotar(valor, minimo, maximo):
    return min(maximo, max(minimo, valor))


def _triangulo(valor, izquierda, pico, derecha):
    if valor <= izquierda or valor >= derecha:
        return 0.0
    if valor <= pico:
        return (valor - izquierda) / (pico - izquierda)
    return (derecha - valor) / (derecha - pico)


def _bajo(brusquedad):
    if brusquedad <= 0:
        return 1.0
    if brusquedad >= 15:
        return 0.0
    return (15 - brusquedad) / 15


def _medio_movimiento(brusquedad):
    return _triangulo(brusquedad, 5, 20, 35)


def _alto(brusquedad):
    if brusquedad <= 25:
        return 0.0
    if brusquedad >= 40:
        return 1.0
    return (brusquedad - 25) / 15


def _cerca(distancia):
    if distancia <= 0:
        return 1.0
    if distancia >= 500:
        return 0.0
    return (500 - distancia) / 500


def _medio_distancia(distancia):
    return _triangulo(distancia, 300, 700, 1100)


def _lejos(distancia):
    if distancia <= 900:
        return 0.0
    if distancia >= 1500:
        return 1.0
    return (distancia - 900) / 600


def velocidad_difusa(brusquedad, distancia_mm):
    """Devuelve (velocidad 0..100, alerta de proximidad)."""
    alerta = distancia_mm >= 0 and distancia_mm < UMBRAL_ALERTA_MM
    if distancia_mm < 0:
        lejos, medio_d, cerca = 1.0, 0.0, 0.0
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
    peso = sum(regla[0] for regla in reglas)
    if peso == 0:
        return VELOCIDAD_SIN_REGLA, alerta
    acumulado = sum(peso_regla * singleton for peso_regla, singleton in reglas)
    velocidad = int(acumulado / peso + 0.5)
    return _acotar(velocidad, 0, 100), alerta


class Controlador:
    """Estado persistente del PID y del antecedente de movimiento difuso."""

    def __init__(self):
        self.car_x = 0.0
        self.integral = 0.0
        self.error_anterior = 0.0
        self.head_x_anterior = 0.0
        self.tiene_muestra = False

    def actualizar(self, head_x, obstacle_dist, dt):
        head_x = _acotar(float(head_x), -RANGO, RANGO)
        dt = _acotar(float(dt), DT_MIN, DT_MAX)
        brusquedad = abs(head_x - self.head_x_anterior) if self.tiene_muestra else 0.0

        error = head_x - self.car_x
        integral_nueva = _acotar(self.integral + error * dt, -INTEGRAL_MAX, INTEGRAL_MAX)
        derivada = (error - self.error_anterior) / dt
        salida = KP * error + KI * integral_nueva + KD * derivada
        delta = _acotar(salida, -DELTA_MAX, DELTA_MAX)
        self.car_x = _acotar(self.car_x + delta, -RANGO, RANGO)
        self.integral = integral_nueva
        self.error_anterior = error
        self.head_x_anterior = head_x
        self.tiene_muestra = True

        velocidad, alerta = velocidad_difusa(brusquedad, int(obstacle_dist))
        return round(self.car_x, 1), velocidad, alerta
