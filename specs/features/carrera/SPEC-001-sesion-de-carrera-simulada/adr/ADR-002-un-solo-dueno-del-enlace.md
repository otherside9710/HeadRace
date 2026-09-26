# ADR-002: Un solo dueño del enlace

**Estado:** accepted
**Fecha:** 2026-09-25
**Decidido por:** Julio Sarmiento Peña
**Aprobado por:** Julio Sarmiento Peña

## Contexto

El dibujo del contexto muestra la captura escribiendo por Serial y Flask leyendo el mismo cable. Un puerto USB solo puede abrirlo un proceso.

## Decisión

Un solo proceso Python arranca la cámara, el lazo y Flask. Hoy el lazo llama a `paso()` en memoria. Mañana ese mismo proceso abre el Serial, escribe la línea de cabeza y lee la línea de estado. La captura no abre el puerto.

## Consecuencias

No hace falta un simulador de puerto para desarrollar la pista. El primer día con la placa se cambia el origen del estado, no la forma del mensaje.

## Alternativas consideradas

Dos programas unidos por un puerto serie virtual. Se descartó para no sumar otra pieza antes de tener el hardware. WiFi queda fuera de esta spec.
