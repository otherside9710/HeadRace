# ADR-001: Núcleo de control portable

**Estado:** accepted
**Fecha:** 2026-09-25
**Decidido por:** Julio Sarmiento Peña
**Aprobado por:** Julio Sarmiento Peña

## Contexto

La materia exige PID y lógica difusa en el ESP32. La placa aún no llega, y hace falta ver la pista funcionando.

## Decisión

El control de un ciclo vive en una función Python `paso(muestra, distancia, dt)` que no importa Flask ni OpenCV. Los números están en el diseño de SPEC-001. Cuando llegue el hardware, esa función se reescribe en C++ y el proceso Python solo mueve las líneas JSON.

## Consecuencias

La pista y SQLite no conocen si el estado lo calculó Python o el ESP32. Hay que mantener dos copias del algoritmo el día del porte, con los mismos parámetros de partida. Esas ganancias no son la sintonía definitiva.

## Alternativas consideradas

Calcular el movimiento en el navegador. Se descartó porque la materia no evaluaría el control en el microcontrolador.
