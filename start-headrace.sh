#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no está instalado o no está en PATH." >&2
  exit 1
fi

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
  echo "Faltan las dependencias del frontend. Ejecuta: cd frontend && npm install" >&2
  exit 1
fi

if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "Error: no se encontró Python 3." >&2
  exit 1
fi

if [[ -z "${HEADRACE_PORT:-}" ]]; then
  HEADRACE_PORT="$("$PYTHON" - <<'PY'
import socket

for port in range(5000, 5010):
    with socket.socket() as server:
        try:
            server.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit("No hay puertos libres entre 5000 y 5009.")
PY
)"
fi
export HEADRACE_PORT

cleanup() {
  trap - EXIT INT TERM
  for pid in "${BACKEND_PID:-}" "${FRONTEND_PID:-}"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait "${BACKEND_PID:-}" 2>/dev/null || true
  wait "${FRONTEND_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$ROOT_DIR"
"$PYTHON" main.py &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
"$FRONTEND_DIR/node_modules/.bin/vite" --host 127.0.0.1 --strictPort &
FRONTEND_PID=$!

echo "HeadRace está iniciando:"
echo "  Juego (React + Vite): http://127.0.0.1:5173/"
echo "  Backend (Flask):      http://127.0.0.1:$HEADRACE_PORT/"
echo "Pulsa Ctrl+C para detener ambos procesos."

is_running() {
  jobs -pr | grep -qx "$1"
}

while is_running "$BACKEND_PID" && is_running "$FRONTEND_PID"; do
  sleep 1
done

if ! is_running "$BACKEND_PID"; then
  if wait "$BACKEND_PID"; then
    echo "El backend terminó." >&2
  else
    status=$?
    echo "El backend terminó con error (código $status)." >&2
    exit "$status"
  fi
fi

if ! is_running "$FRONTEND_PID"; then
  if wait "$FRONTEND_PID"; then
    echo "El frontend terminó." >&2
  else
    status=$?
    echo "El frontend terminó con error (código $status)." >&2
    exit "$status"
  fi
fi
