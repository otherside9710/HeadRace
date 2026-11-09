import base64
import json
import logging
import os
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO

from headrace.backend.sesiones import conectar, guardar, historial, mejores_carreras, sesiones_recientes
from headrace.captura.detector import Captura
from headrace.control.paso import (
    EstadoCarro,
    MemoriaControl,
    codificar_cabeza,
    decodificar_cabeza,
    paso,
)
from headrace.control.pid import MemoriaPid
from headrace.parametros import HOST, OBSTACULO_CERCA_MM, OBSTACULO_LEJOS_MM, PUERTO

LOG = logging.getLogger("headrace")
RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "headrace" / "web"
PUERTO_ESP32_CONFIGURADO = os.getenv("HEADRACE_ESP32_PORT")
PUERTO_ESP32 = PUERTO_ESP32_CONFIGURADO or "/dev/cu.usbserial-1140"
BAUDIOS_ESP32 = int(os.getenv("HEADRACE_ESP32_BAUD", "115200"))

DIST = WEB / "dist"


def puerto_esp32_actual() -> str:
    """Reencuentra el adaptador USB serial si macOS le asigna otro sufijo."""
    if PUERTO_ESP32_CONFIGURADO:
        return PUERTO_ESP32_CONFIGURADO
    if Path(PUERTO_ESP32).exists():
        return PUERTO_ESP32
    candidatos = sorted(Path("/dev").glob("cu.usbserial-*"))
    return str(candidatos[0]) if candidatos else PUERTO_ESP32


class EstadoApp:
    def __init__(self) -> None:
        self.candado = threading.Lock()
        self.linea = codificar_cabeza(0, 0)
        self.captura = "sin_camara"
        self.obstacle_dist = OBSTACULO_LEJOS_MM
        self.memoria = MemoriaControl(pid=MemoriaPid())
        self.estado = EstadoCarro(0.0, 60, OBSTACULO_LEJOS_MM, False)
        self.tiene_estado = False
        self.sensor_conectado = False
        self.sensor_distancia_mm: int | None = None
        self.sensor_mano_detectada = False
        self.sensor_zona = "reposo"
        self.esp32_conectado = False
        self.modo_control = "simulacion"


def crear_app(ruta_db: Path) -> tuple[Flask, SocketIO, EstadoApp]:
    app = Flask(__name__)
    socketio = SocketIO(app, async_mode="threading", cors_allowed_origins="*")
    estado = EstadoApp()
    conexion = conectar(ruta_db)
    db_candado = threading.Lock()

    @app.get("/")
    def pagina():
        respuesta = send_from_directory(DIST, "index.html")
        respuesta.headers["Cache-Control"] = "no-store"
        return respuesta

    @app.get("/assets/<path:nombre>")
    def assets(nombre: str):
        return send_from_directory(DIST / "assets", nombre)

    @app.get("/historial")
    def ruta_historial():
        try:
            with db_candado:
                filas = historial(conexion)
        except sqlite_error():
            return jsonify(
                {"error": {"code": "DB_NO_DISPONIBLE", "message": "No se pudo leer el historial"}}
            ), 500
        return jsonify(filas)

    @app.get("/sesiones")
    def ruta_sesiones_recientes():
        try:
            with db_candado:
                filas = sesiones_recientes(conexion)
        except sqlite_error():
            return jsonify(
                {"error": {"code": "DB_NO_DISPONIBLE", "message": "No se pudo leer el historial"}}
            ), 500
        return jsonify(filas)

    @app.get("/mejores-carreras")
    def ruta_mejores_carreras():
        try:
            with db_candado:
                filas = mejores_carreras(conexion)
        except sqlite_error():
            return jsonify(
                {"error": {"code": "DB_NO_DISPONIBLE", "message": "No se pudo leer el historial"}}
            ), 500
        return jsonify(filas)

    @app.post("/sesiones")
    def ruta_sesiones():
        cuerpo = request.get_json(force=True, silent=True)
        try:
            with db_candado:
                codigo, carga = guardar(conexion, cuerpo)
        except ValueError as exc:
            return jsonify({"error": {"code": "SESION_INVALIDA", "message": str(exc)}}), 400
        except sqlite_error():
            return jsonify(
                {"error": {"code": "DB_NO_DISPONIBLE", "message": "No se pudo guardar la sesion"}}
            ), 500
        if codigo == 201:
            LOG.info("sesion guardada evento_id=%s motivo=%s", carga["evento_id"], carga["motivo"])
        return jsonify(carga), codigo

    @socketio.on("simular_obstaculo")
    def simular_obstaculo(mensaje):
        if not isinstance(mensaje, dict) or not isinstance(mensaje.get("activo"), bool):
            return
        with estado.candado:
            valor = mensaje.get("distancia_mm")
            try:
                distancia = int(valor) if valor is not None else None
            except (TypeError, ValueError):
                distancia = None
            estado.obstacle_dist = (
                max(0, distancia)
                if distancia is not None
                else OBSTACULO_CERCA_MM if mensaje["activo"] else OBSTACULO_LEJOS_MM
            )

    return app, socketio, estado


def sqlite_error():
    import sqlite3

    return sqlite3.Error


def lazo_control(estado: EstadoApp, socketio: SocketIO, detener: threading.Event) -> None:
    anterior = time.monotonic()
    while not detener.is_set():
        inicio = time.monotonic()
        dt = inicio - anterior
        anterior = inicio
        with estado.candado:
            linea = estado.linea
            distancia = estado.obstacle_dist
            captura = estado.captura
            memoria = estado.memoria
            esp32_conectado = estado.esp32_conectado
            sensor_conectado = estado.sensor_conectado
            sensor_distancia_mm = estado.sensor_distancia_mm
            sensor_mano_detectada = estado.sensor_mano_detectada
            sensor_zona = estado.sensor_zona
        if esp32_conectado:
            # El firmware es la autoridad del control mientras responde por USB.
            resto = 0.05 - (time.monotonic() - inicio)
            if resto > 0:
                detener.wait(resto)
            continue
        muestra = decodificar_cabeza(linea)
        if muestra is None:
            LOG.warning("linea de control invalida: %s", linea[:200])
        else:
            head_x, head_y = muestra
            nuevo = paso(head_x, head_y, distancia, dt, memoria)
            with estado.candado:
                estado.estado = nuevo
                estado.tiene_estado = True
            mensaje = nuevo.como_mensaje()
            mensaje["captura"] = captura
            mensaje["sensor_conectado"] = sensor_conectado
            mensaje["sensor_distancia_mm"] = sensor_distancia_mm
            mensaje["sensor_mano_detectada"] = sensor_mano_detectada
            mensaje["sensor_zona"] = sensor_zona
            mensaje["modo_control"] = "simulacion"
            socketio.emit("estado", mensaje)
        resto = 0.05 - (time.monotonic() - inicio)
        if resto > 0:
            detener.wait(resto)


def lazo_captura(
    estado: EstadoApp,
    captura: Captura,
    detener: threading.Event,
    socketio: SocketIO,
) -> None:
    ultima_vista = 0.0
    while not detener.is_set():
        head_x, head_y, modo = captura.leer()
        with estado.candado:
            estado.linea = codificar_cabeza(head_x, head_y)
            estado.captura = modo
        ahora = time.monotonic()
        if ahora - ultima_vista >= 0.12:
            jpeg = captura.vista_jpeg()
            if jpeg is not None:
                socketio.emit("vista", {"jpeg": base64.b64encode(jpeg).decode("ascii")})
            ultima_vista = ahora
        detener.wait(0.05)


def _marcar_esp32_desconectado(estado: EstadoApp) -> None:
    with estado.candado:
        estado.esp32_conectado = False
        estado.modo_control = "simulacion"
        estado.sensor_conectado = False
        estado.sensor_distancia_mm = None
        estado.sensor_mano_detectada = False
        estado.sensor_zona = "reposo"


def _numero(paquete: dict, clave: str, defecto: float) -> float:
    try:
        return float(paquete.get(clave, defecto))
    except (TypeError, ValueError):
        return defecto


def lazo_sensor_esp32(estado: EstadoApp, socketio: SocketIO, detener: threading.Event) -> None:
    """Envia la cabeza y recibe del ESP32 las decisiones PID/difusas y el VL53L0X."""
    try:
        import serial
    except ImportError:
        LOG.exception("Falta pyserial; instala las dependencias de requirements.txt")
        return

    while not detener.is_set():
        puerto = puerto_esp32_actual()
        ultimo_paquete = 0.0
        anterior = time.monotonic()
        try:
            with serial.Serial(puerto, BAUDIOS_ESP32, timeout=0.08, write_timeout=0.25) as placa:
                LOG.info("enlace de control ESP32 abierto puerto=%s baudios=%s", puerto, BAUDIOS_ESP32)
                firmware_listo = False
                inicio_espera = time.monotonic()
                while not detener.is_set() and time.monotonic() - inicio_espera < 8.0:
                    linea_inicio = placa.readline()
                    if not linea_inicio:
                        continue
                    try:
                        saludo = json.loads(linea_inicio.decode("utf-8").strip())
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        # Descarta el registro de arranque del chip y espera al programa.
                        continue
                    if isinstance(saludo, dict) and saludo.get("ready") is True:
                        firmware_listo = True
                        LOG.info(
                            "firmware HeadRace listo protocolo=%s sensor_i2c=%s",
                            saludo.get("protocolo", "desconocido"),
                            saludo.get("sensor_conectado") is True,
                        )
                        break
                if not firmware_listo:
                    if not detener.is_set():
                        LOG.warning("el ESP32 no anunció el firmware HeadRace; continúa el control simulado")
                    break

                while not detener.is_set():
                    inicio = time.monotonic()
                    dt = max(0.02, min(0.1, inicio - anterior))
                    anterior = inicio
                    with estado.candado:
                        linea_cabeza = estado.linea
                        distancia_simulada = estado.obstacle_dist
                        captura = estado.captura
                    muestra = decodificar_cabeza(linea_cabeza)
                    if muestra is not None:
                        head_x, head_y = muestra
                        entrada = {
                            "head_x": head_x,
                            "head_y": head_y,
                            "dt": round(dt, 4),
                            "obstacle_dist": distancia_simulada,
                        }
                        placa.write((json.dumps(entrada, separators=(",", ":")) + "\n").encode("utf-8"))
                    respuesta = placa.readline()
                    ahora = time.monotonic()
                    if not respuesta:
                        if ultimo_paquete and ahora - ultimo_paquete > 2.0:
                            LOG.warning("el ESP32 dejó de responder; se activa el control simulado")
                            break
                        resto = 0.05 - (time.monotonic() - inicio)
                        if resto > 0:
                            detener.wait(resto)
                        continue
                    try:
                        paquete = json.loads(respuesta.decode("utf-8").strip())
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        # Ignora el banner de arranque/REPL y cualquier linea ajena al protocolo.
                        continue
                    if not isinstance(paquete, dict):
                        continue
                    if paquete.get("ready") is True:
                        continue
                    if paquete.get("error") or not {"car_x", "car_speed", "obstacle_alert"}.issubset(paquete):
                        continue

                    ultimo_paquete = ahora
                    car_x = max(-100.0, min(100.0, _numero(paquete, "car_x", 0.0)))
                    car_speed = max(0, min(100, int(_numero(paquete, "car_speed", 60))))
                    distancia = int(_numero(paquete, "obstacle_dist", OBSTACULO_LEJOS_MM))
                    sensor_distancia = paquete.get("sensor_distancia_mm")
                    try:
                        sensor_distancia = int(sensor_distancia) if sensor_distancia is not None else None
                    except (TypeError, ValueError):
                        sensor_distancia = None
                    sensor_conectado = paquete.get("sensor_conectado") is True
                    sensor_mano = paquete.get("sensor_mano_detectada") is True
                    sensor_zona = paquete.get("sensor_zona")
                    if sensor_zona not in ("reposo", "escudo", "llamas"):
                        sensor_zona = "reposo"
                    nuevo = EstadoCarro(car_x, car_speed, distancia, paquete["obstacle_alert"] is True)
                    with estado.candado:
                        estado.estado = nuevo
                        estado.tiene_estado = True
                        estado.esp32_conectado = True
                        estado.modo_control = "esp32"
                        estado.sensor_conectado = sensor_conectado
                        estado.sensor_distancia_mm = sensor_distancia
                        estado.sensor_mano_detectada = sensor_mano
                        estado.sensor_zona = sensor_zona

                    mensaje = nuevo.como_mensaje()
                    mensaje.update(
                        {
                            "captura": captura,
                            "sensor_conectado": sensor_conectado,
                            "sensor_distancia_mm": sensor_distancia,
                            "sensor_mano_detectada": sensor_mano,
                            "sensor_zona": sensor_zona,
                            "modo_control": "esp32",
                        }
                    )
                    socketio.emit("estado", mensaje)

                    evento_poder = paquete.get("power_event")
                    if evento_poder == "shield":
                        LOG.info("el ESP32 detectó el gesto de escudo distancia_mm=%s", sensor_distancia)
                        socketio.emit("gesto_escudo", {"distancia_mm": sensor_distancia})
                    elif evento_poder == "flames":
                        LOG.info("el ESP32 detectó el gesto de llamas distancia_mm=%s", sensor_distancia)
                        socketio.emit("gesto_llamas", {"distancia_mm": sensor_distancia})

                    resto = 0.05 - (time.monotonic() - inicio)
                    if resto > 0:
                        detener.wait(resto)
        except (OSError, serial.SerialException) as exc:
            _marcar_esp32_desconectado(estado)
            LOG.info("ESP32 no disponible en %s: %s; control simulado activo", puerto, exc)
            detener.wait(2)
        finally:
            _marcar_esp32_desconectado(estado)
        if not detener.is_set():
            detener.wait(1)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ruta_db = RAIZ / "data" / "headrace.sqlite"
    app, socketio, estado = crear_app(ruta_db)
    detener = threading.Event()
    captura = Captura()
    LOG.info(
        "arranque host=%s puerto=%s sqlite=%s enlace_esp32=%s baudios=%s",
        HOST,
        PUERTO,
        ruta_db,
        PUERTO_ESP32,
        BAUDIOS_ESP32,
    )
    socketio.start_background_task(lazo_captura, estado, captura, detener, socketio)
    socketio.start_background_task(lazo_control, estado, socketio, detener)
    socketio.start_background_task(lazo_sensor_esp32, estado, socketio, detener)
    try:
        socketio.run(
            app,
            host=HOST,
            port=PUERTO,
            allow_unsafe_werkzeug=True,
        )
    finally:
        detener.set()
        captura.cerrar()
