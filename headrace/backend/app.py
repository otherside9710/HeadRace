import base64
import logging
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


DIST = WEB / "dist"


class EstadoApp:
    def __init__(self) -> None:
        self.candado = threading.Lock()
        self.linea = codificar_cabeza(0, 0)
        self.captura = "sin_camara"
        self.obstacle_dist = OBSTACULO_LEJOS_MM
        self.memoria = MemoriaControl(pid=MemoriaPid())
        self.estado = EstadoCarro(0.0, 60, OBSTACULO_LEJOS_MM, False)
        self.tiene_estado = False


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

    @app.get("/pista.js")
    def script_pista():
        return send_from_directory(WEB, "pista.js")

    @app.get("/juego/<path:nombre>")
    def archivo_juego(nombre: str):
        respuesta = send_from_directory(WEB / "juego", nombre)
        respuesta.headers["Cache-Control"] = "no-store"
        return respuesta

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
            estado.obstacle_dist = OBSTACULO_CERCA_MM if mensaje["activo"] else OBSTACULO_LEJOS_MM

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


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ruta_db = RAIZ / "data" / "headrace.sqlite"
    app, socketio, estado = crear_app(ruta_db)
    detener = threading.Event()
    captura = Captura()
    LOG.info(
        "arranque host=%s puerto=%s sqlite=%s modo=simulado",
        HOST,
        PUERTO,
        ruta_db,
    )
    socketio.start_background_task(lazo_captura, estado, captura, detener, socketio)
    socketio.start_background_task(lazo_control, estado, socketio, detener)
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
