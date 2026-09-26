# ADR-003: JSON de una línea

**Estado:** accepted
**Fecha:** 2026-09-25
**Decidido por:** Julio Sarmiento Peña
**Aprobado por:** Julio Sarmiento Peña

## Contexto

Python y el futuro firmware tienen que coincidir sin rehacerse varias veces. El contexto del proyecto ya propuso el formato.

## Decisión

Cada mensaje es un objeto JSON terminado en salto de línea.

Hacia el control: `head_x`, `head_y`, enteros de −100 a 100.

Desde el control: `car_x`, `car_speed`, `obstacle_dist`, `obstacle_alert`.

La bandera `captura` (`con_rostro`, `sin_rostro`, `sin_camara`) solo viaja en el SocketIO hacia el navegador. No se envía al ESP32.

Una línea inválida se descarta. El estado anterior se mantiene.

## Consecuencias

Cualquier campo nuevo tiene que acordarse en los dos lados. El firmware puede ignorar campos que no conozca; el parser de la laptop debe tolerar eso cuando se conecte la placa.

## Alternativas consideradas

CSV o un binario fijo. Se descartaron porque el contexto ya eligió JSON y es más fácil de leer en la consola durante la práctica.
