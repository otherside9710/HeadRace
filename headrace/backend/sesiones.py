import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def conectar(ruta: Path) -> sqlite3.Connection:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    conexion = sqlite3.connect(ruta, check_same_thread=False)
    conexion.row_factory = sqlite3.Row
    conexion.execute(
        """
        CREATE TABLE IF NOT EXISTS sesiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evento_id TEXT NOT NULL UNIQUE,
            fecha_hora TEXT NOT NULL,
            tiempo_vuelta REAL,
            colisiones INTEGER NOT NULL DEFAULT 0,
            eventos_obstaculo INTEGER NOT NULL DEFAULT 0,
            velocidad_promedio REAL,
            motivo TEXT NOT NULL CHECK (motivo IN ('vuelta_completa', 'fin_sesion'))
        )
        """
    )
    conexion.commit()
    return conexion


def _entero_no_negativo(valor, nombre: str) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ValueError(f"{nombre} debe ser un entero mayor o igual a 0")
    if valor < 0:
        raise ValueError(f"{nombre} debe ser un entero mayor o igual a 0")
    return valor


def _validar(cuerpo: dict) -> dict:
    if not isinstance(cuerpo, dict):
        raise ValueError("el cuerpo debe ser un objeto")
    evento_id = cuerpo.get("evento_id")
    if not isinstance(evento_id, str) or not evento_id.strip():
        raise ValueError("evento_id es obligatorio")
    motivo = cuerpo.get("motivo")
    if motivo not in ("vuelta_completa", "fin_sesion"):
        raise ValueError("motivo debe ser vuelta_completa o fin_sesion")
    tiempo = cuerpo.get("tiempo_vuelta")
    if motivo == "vuelta_completa":
        if isinstance(tiempo, bool) or not isinstance(tiempo, (int, float)) or tiempo <= 0:
            raise ValueError("vuelta_completa exige tiempo_vuelta mayor a 0")
        tiempo = float(tiempo)
    elif tiempo is not None:
        if isinstance(tiempo, bool) or not isinstance(tiempo, (int, float)) or tiempo <= 0:
            raise ValueError("tiempo_vuelta debe ser mayor a 0 o nulo")
        tiempo = float(tiempo)
    promedio = cuerpo.get("velocidad_promedio")
    if promedio is not None:
        if isinstance(promedio, bool) or not isinstance(promedio, (int, float)):
            raise ValueError("velocidad_promedio debe ser numerica o nula")
        promedio = float(promedio)
    return {
        "evento_id": evento_id.strip(),
        "motivo": motivo,
        "tiempo_vuelta": tiempo,
        "colisiones": _entero_no_negativo(cuerpo.get("colisiones", 0), "colisiones"),
        "eventos_obstaculo": _entero_no_negativo(
            cuerpo.get("eventos_obstaculo", 0), "eventos_obstaculo"
        ),
        "velocidad_promedio": promedio,
    }


def _fila_publica(fila: sqlite3.Row) -> dict:
    return {
        "id": fila["id"],
        "evento_id": fila["evento_id"],
        "fecha_hora": fila["fecha_hora"],
        "tiempo_vuelta": fila["tiempo_vuelta"],
        "colisiones": fila["colisiones"],
        "eventos_obstaculo": fila["eventos_obstaculo"],
        "velocidad_promedio": fila["velocidad_promedio"],
        "motivo": fila["motivo"],
    }


def guardar(conexion: sqlite3.Connection, cuerpo: dict) -> tuple[int, dict]:
    datos = _validar(cuerpo)
    existente = conexion.execute(
        "SELECT * FROM sesiones WHERE evento_id = ?",
        (datos["evento_id"],),
    ).fetchone()
    if existente is not None:
        return 200, {"duplicado": True, "evento_id": datos["evento_id"]}
    fecha = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        conexion.execute(
            """
            INSERT INTO sesiones (
                evento_id, fecha_hora, tiempo_vuelta, colisiones,
                eventos_obstaculo, velocidad_promedio, motivo
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datos["evento_id"],
                fecha,
                datos["tiempo_vuelta"],
                datos["colisiones"],
                datos["eventos_obstaculo"],
                datos["velocidad_promedio"],
                datos["motivo"],
            ),
        )
        conexion.commit()
    except sqlite3.IntegrityError:
        conexion.rollback()
        return 200, {"duplicado": True, "evento_id": datos["evento_id"]}
    fila = conexion.execute(
        "SELECT * FROM sesiones WHERE evento_id = ?",
        (datos["evento_id"],),
    ).fetchone()
    return 201, _fila_publica(fila)


def historial(conexion: sqlite3.Connection) -> list[dict]:
    filas = conexion.execute(
        """
        SELECT fecha_hora, tiempo_vuelta, colisiones, eventos_obstaculo, velocidad_promedio
        FROM sesiones
        WHERE tiempo_vuelta IS NOT NULL
        ORDER BY tiempo_vuelta ASC
        LIMIT 10
        """
    ).fetchall()
    return [
        {
            "fecha_hora": fila["fecha_hora"],
            "tiempo_vuelta": fila["tiempo_vuelta"],
            "colisiones": fila["colisiones"],
            "eventos_obstaculo": fila["eventos_obstaculo"],
            "velocidad_promedio": fila["velocidad_promedio"],
        }
        for fila in filas
    ]


def contar(conexion: sqlite3.Connection) -> int:
    fila = conexion.execute("SELECT COUNT(*) AS n FROM sesiones").fetchone()
    return int(fila["n"])
