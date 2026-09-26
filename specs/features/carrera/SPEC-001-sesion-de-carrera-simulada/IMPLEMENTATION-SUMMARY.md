# Resumen de implementación: SPEC-001

**Estado del spec:** LISTO_PARA_CERTIFICACION  
**Fecha:** 2026-09-25  
**Este SDD custom no incluye plan de pruebas ni `/sdd-test`.**

## Qué quedó construido

Carrera simulada en un proceso Python: captura Haar, PID, lógica difusa, Flask/SocketIO, pista Canvas y SQLite.

## Archivos creados

- `main.py`, `requirements.txt`, `README.md`
- `headrace/parametros.py`
- `headrace/control/pid.py`, `difusa.py`, `paso.py`
- `headrace/captura/detector.py`
- `headrace/backend/sesiones.py`, `app.py`
- `headrace/web/index.html`, `pista.js`

## Verificación hecha en esta sesión

No es un plan de pruebas. Es el recorrido del build contra los criterios.

| Criterio | Resultado |
|---|---|
| CA-001 | Tras 60 ciclos con cabeza en 40 y obstáculo lejos, `car_x` 40.0 y velocidad 90 |
| CA-002 | Escalón a 80 mueve `car_x` 12, el tope del ciclo |
| CA-003 | Distancia 100 mm y movimiento brusco → velocidad 30 y alerta |
| CA-004 | Distancia 2000 mm y movimiento suave → velocidad 90 sin alerta |
| CA-005 | Distancia −1 → velocidad 90 sin alerta |
| CA-006 | Línea que no es JSON se descarta |
| CA-007 | Offset 140 y −140 quedan en 100 y −100 |
| CA-009 | Sin permiso de cámara el proceso sigue y la página dice «Sin cámara» |
| CA-010, CA-012, CA-014, CA-017 | Alta 201, duplicado 200, top ordenado, `fin_sesion` con tiempo nulo fuera del ranking |
| CA-011 | Historial vacío devuelve `[]` (comprobado en base temporal) |
| CA-016, CA-018 | El navegador recibió velocidad 60 y el aviso «Obstáculo cerca» al simular el obstáculo |
| CA-008, CA-015 | Quedan en el código (500 ms sin rostro; flanco al salir del carril). En esta sesión no hubo rostro ni `|car_x| > 70` |

La cámara no abrió aquí porque el proceso no tiene permiso de macOS. Al correr `python main.py` en Terminal, hay que aceptar el aviso de cámara.

## Trazabilidad

| CA | Dónde |
|---|---|
| CA-001, CA-002 | `headrace/control/pid.py` |
| CA-003, CA-004, CA-005 | `headrace/control/difusa.py` |
| CA-006, CA-007 | `headrace/control/paso.py` |
| CA-008, CA-009 | `headrace/captura/detector.py` |
| CA-010 a CA-014, CA-017 | `headrace/backend/sesiones.py` |
| CA-015, CA-016, CA-018 | `headrace/web/pista.js` y `headrace/backend/app.py` |

## Pendiente fuera de esta spec

Firmware del ESP32 y el VL53L5X. El punto de cambio es dejar de llamar a `paso()` y usar el mismo JSON por Serial.
