# Requirements: SPEC-001-sesion-de-carrera-simulada

**Versión:** 1.0  
**Estado:** APROBADO  
**Fecha:** 2026-09-25  
**Responsable:** Julio Sarmiento Peña

---

## 1. Objetivo

HeadRace debe poder correrse de punta a punta en la laptop, sin ESP32 ni VL53L5X.

- ¿Qué se quiere lograr? Una pista 2D donde el carro sigue la cabeza, con inercia de PID y velocidad limitada por lógica difusa, y un historial de vueltas en SQLite.
- ¿Para quién? Julio Sarmiento Peña, para avanzar el proyecto de Sistemas de Control mientras el hardware no llega, y para sustentar el modo simulado.
- ¿Qué dolor atiende? El cronograma de 8 semanas no puede quedarse parado esperando los componentes.
- ¿Resultado esperado? El estudiante mueve la cabeza, el carro se desplaza con suavidad, un obstáculo simulado baja la velocidad, y cada vuelta completa queda guardada.

---

## 2. Contexto funcional

La materia exige que PID y lógica difusa los ejecute el ESP32. Esta spec construye el resto del sistema y un núcleo de control en Python con el mismo contrato, para reemplazar ese núcleo por el firmware cuando lleguen la placa y el sensor. La visión, la pista y la base viven en la laptop.

No hay diseño de pantalla en Figma ni en Stitch. La interfaz es la descrita aquí.

---

## 3. Alcance

La funcionalidad incluye:

- Detección de la cara con la webcam y offset normalizado de −100 a 100.
- Un ciclo de control a 20 Hz: PID sobre `car_x` y lógica difusa sobre `car_speed`.
- Obstáculo simulado (lejos por defecto, y un control para ponerlo cerca).
- Pista ovalada en Canvas, avance según la velocidad, colisión con el borde y cruce de meta.
- Aviso visual cuando hay alerta de obstáculo.
- Guardado de la vuelta completa o del fin de sesión, y listado de los 10 mejores tiempos.
- Contrato JSON de una línea, estable para el futuro ESP32.

---

## 4. Fuera de alcance

La funcionalidad no incluye:

- Firmware C++ del ESP32 y lectura real del VL53L5X.
- Sintonía final del PID con la latencia del Serial.
- WiFi entre la laptop y la placa.
- Cuentas de usuario, red del salón, ni más de un navegador a la vez.
- Plan de pruebas, casos de prueba y certificación `/sdd-test`.
- `head_y` como acelerador o freno. Se captura y se reenvía; no entra al PID ni a la difusa.

---

## 5. Actores

| Actor | Descripción | Responsabilidad |
|---|---|---|
| Estudiante | Usuario frente a la webcam | Mueve la cabeza, mira la pista, termina la sesión |
| Webcam | Cámara de la laptop | Entrega frames |
| Núcleo de control | PID + difusa en Python | Calcula `car_x` y `car_speed` |
| Pista | Página en el navegador | Dibuja, detecta borde y meta, muestra el historial |
| SQLite | Archivo local | Guarda sesiones |

---

## 6. Casos de uso

### UC-001: Conducir con la cabeza

**Actor:** Estudiante  
**Objetivo:** Mover el carro a la izquierda o a la derecha con la cara.  
**Precondición:** La app está en marcha, la cámara ve un rostro y el obstáculo simulado está lejos.  
**Disparador:** El estudiante abre `/` y se coloca frente a la cámara.

**Flujo principal:**

1. La captura mide `head_x` y `head_y` en [−100, 100].
2. Cada 50 ms el núcleo aplica el PID y la difusa.
3. El servidor emite el estado por SocketIO.
4. La pista avanza el carro según `car_speed` y lo desplaza según `car_x`.

**Resultado esperado:** Con la cabeza quieta en un offset, `car_x` se acerca a ese offset sin saltar de golpe, y la velocidad es alta.  
**Postcondición:** El estado en pantalla corresponde al último mensaje de control.

---

### UC-002: Bajar la velocidad por obstáculo o por un movimiento brusco

**Actor:** Estudiante  
**Objetivo:** Ver que el carro frena cuando el contexto es peligroso.  
**Precondición:** Hay una sesión en curso.  
**Disparador:** El estudiante activa «Simular obstáculo» o mueve la cabeza de golpe.

**Flujo principal:**

1. La distancia simulada pasa a 200 mm, o el cambio de `head_x` cae en el conjunto alto.
2. La difusa elige la velocidad de la tabla de reglas.
3. Si la distancia es válida y menor a 400 mm, `obstacle_alert` es verdadero y la pista muestra el aviso.

**Resultado esperado:** Cerca y brusco produce velocidad baja (30). Lejos y suave produce velocidad alta (90).  
**Postcondición:** El aviso sigue al valor de `obstacle_alert`.

---

### UC-003: Completar una vuelta

**Actor:** Pista  
**Objetivo:** Registrar el tiempo de una vuelta válida.  
**Precondición:** El carro ya cruzó la meta al empezar, o acaba de iniciar en la meta.  
**Disparador:** El avance a lo largo de la pista cruza la meta otra vez, con al menos 2 segundos desde el cruce anterior.

**Flujo principal:**

1. La pista acumula colisiones (flancos), alertas (flancos) y el promedio de `car_speed`.
2. Envía `POST /sesiones` con `motivo` `vuelta_completa` y un `evento_id` nuevo.
3. El servidor guarda la fila con la hora UTC.
4. La tabla de mejores tiempos se actualiza.

**Resultado esperado:** Hay una fila nueva con `tiempo_vuelta` mayor a 0.  
**Postcondición:** Los contadores de la vuelta en curso vuelven a cero.

---

### UC-004: Terminar la sesión a mitad de vuelta

**Actor:** Estudiante  
**Objetivo:** Cerrar sin inventar un tiempo de vuelta.  
**Precondición:** Hay una sesión en curso y la vuelta actual no ha cruzado la meta.  
**Disparador:** Pulsa «Terminar sesión».

**Flujo principal:**

1. La pista envía `POST /sesiones` con `motivo` `fin_sesion` y `tiempo_vuelta` nulo.
2. El servidor guarda esa fila.
3. El historial de mejores tiempos no la muestra.

**Resultado esperado:** La fila existe y no entra en el top 10.  
**Postcondición:** La pista deja de avanzar.

---

### UC-005: Consultar el historial

**Actor:** Estudiante  
**Objetivo:** Ver los mejores tiempos.  
**Precondición:** La página está abierta.  
**Disparador:** Carga de `/` o fin de un guardado.

**Flujo principal:**

1. El navegador llama `GET /historial`.
2. El servidor devuelve hasta 10 filas con tiempo, ordenadas de menor a mayor.

**Resultado esperado:** La tabla muestra ese listado. Vacío si aún no hay vueltas completas.  
**Postcondición:** No se escribe nada.

---

### UC-006: Cámara o rostro no disponibles

**Actor:** Captura  
**Objetivo:** No tumbar la app ni inventar un giro.  
**Precondición:** La app está en marcha.  
**Disparador:** No se puede abrir la cámara, o pasan 500 ms sin detectar un rostro.

**Flujo alterno/error:**

1. Sin cámara: la pista muestra «sin cámara» y el offset enviado al control es 0.
2. Sin rostro durante 500 ms: la pista muestra «sin rostro» y el offset pasa a 0.
3. El lazo de control sigue.

**Resultado esperado:** El proceso sigue vivo y el carro tiende al centro.  
**Postcondición:** Al volver el rostro, se reanuda el offset medido.

---

### UC-007: Mensaje de control ilegible

**Actor:** Núcleo de control  
**Objetivo:** Ignorar basura sin perder el último estado bueno.  
**Precondición:** Ya hubo al menos un ciclo válido.  
**Disparador:** Llega una línea que no es el JSON esperado.

**Flujo alterno/error:**

1. La línea se descarta.
2. Se registra el fallo.
3. Se conserva el estado anterior.

**Resultado esperado:** No hay excepción que detenga el proceso.  
**Postcondición:** El siguiente JSON válido vuelve a mover el carro.

---

## 7. Reglas de negocio

### RN-001: Rangos del offset y del carro

**Descripción:** `head_x`, `head_y` y `car_x` viven en [−100, 100]. `car_speed` vive en [0, 100] y se emite como entero.  
**Aplicación:** Captura y núcleo de control.  
**Validación:** Valores fuera de rango se recortan al límite.  
**Impacto:** Alto  
**Casos de uso relacionados:** UC-001, UC-007

---

### RN-002: El control no vive en el navegador

**Descripción:** Solo el núcleo calcula el PID y la difusa. La pista consume `car_x` y `car_speed`.  
**Aplicación:** Frontera entre `control` y `web`.  
**Validación:** El script de la pista no contiene ganancias Kp, Ki, Kd ni la tabla difusa.  
**Impacto:** Crítico  
**Casos de uso relacionados:** UC-001, UC-002

---

### RN-003: Tabla difusa

**Descripción:** La velocidad sale de la tabla del contexto del proyecto, con singletons baja=30, media=60, alta=90. Lejos y suave → 90. Cerca y brusco → 30. El resto de celdas está en el diseño.  
**Aplicación:** Núcleo de control.  
**Validación:** Los casos fijos del diseño producen exactamente ese entero cuando un solo consecuente pesa.  
**Impacto:** Crítico  
**Casos de uso relacionados:** UC-002

---

### RN-004: Alerta de obstáculo

**Descripción:** `obstacle_alert` es verdadero solo si `obstacle_dist` es mayor o igual a 0 y menor a 400. Si la distancia es −1, no hay alerta y la distancia cuenta como lejana para la difusa.  
**Aplicación:** Núcleo de control.  
**Validación:** 399 alerta; 400 no alerta; −1 no alerta.  
**Impacto:** Alto  
**Casos de uso relacionados:** UC-002

---

### RN-005: Una vuelta, una fila

**Descripción:** `evento_id` es único. Repetir el mismo identificador no crea otra fila ni cambia la existente.  
**Aplicación:** `POST /sesiones`.  
**Validación:** Dos POST con el mismo `evento_id` dejan una sola fila.  
**Impacto:** Alto  
**Casos de uso relacionados:** UC-003, UC-004

---

### RN-006: El ranking solo incluye vueltas con tiempo

**Descripción:** `GET /historial` devuelve como máximo 10 filas con `tiempo_vuelta` no nulo, de menor a mayor tiempo. `fin_sesion` con tiempo nulo no aparece.  
**Aplicación:** Consulta SQLite.  
**Validación:** Once vueltas muestran las diez más rápidas. Una fila con tiempo nulo no está.  
**Impacto:** Medio  
**Casos de uso relacionados:** UC-003, UC-004, UC-005

---

### RN-007: La colisión se cuenta una vez por salida del carril

**Descripción:** Hay colisión cuando `|car_x|` pasa de ser ≤ 70 a ser > 70. Mantenerse fuera no suma más. Volver a entrar y salir sí suma otra.  
**Aplicación:** Pista.  
**Validación:** 30 ciclos fuera del carril cuentan 1.  
**Impacto:** Medio  
**Casos de uso relacionados:** UC-003

---

### RN-008: Sin rostro no se inventa un giro

**Descripción:** Si durante 500 ms no hay rostro, `head_x` y `head_y` enviados al control son 0.  
**Aplicación:** Captura.  
**Validación:** Tras 500 ms sin detección, el siguiente ciclo usa offset 0.  
**Impacto:** Medio  
**Casos de uso relacionados:** UC-006

---

### RN-009: No se guarda una vuelta a medias por caída

**Descripción:** La fila solo existe después de un `POST /sesiones` respondido con éxito. Si el navegador o el proceso mueren antes, no hay fila parcial.  
**Aplicación:** Persistencia.  
**Validación:** Cerrar el navegador sin «Terminar sesión» y sin cruce de meta no agrega filas.  
**Impacto:** Alto  
**Casos de uso relacionados:** UC-003, UC-004

---

## 8. Criterios de aceptación

Este SDD custom no pide casos de prueba. Estos criterios son el contrato para construir y para la sustentación.

| ID | Given | When | Then | Tipo | Prioridad | Bloqueante | Test mínimo |
|---|---|---|---|---|---|---|---|
| CA-001 | `car_x` es 0, ganancias de diseño, obstáculo lejos, cabeza quieta en 40 | Pasan 60 ciclos de 50 ms | `car_x` queda entre 35 y 45, y `car_speed` es 90 | happy_path | high | yes | no aplica |
| CA-002 | `car_x` es 0 y `head_x` pasa a 80 | Ocurre un ciclo | El cambio de `car_x` es como máximo 12, y `car_x` sigue en [−100, 100] | happy_path | high | yes | no aplica |
| CA-003 | Distancia 100 mm y el cambio de `head_x` en el ciclo es 50 | Corre un ciclo | `car_speed` es 30 y `obstacle_alert` es verdadero | happy_path | high | yes | no aplica |
| CA-004 | Distancia 2000 mm y el cambio de `head_x` es 0 | Corre un ciclo | `car_speed` es 90 y `obstacle_alert` es falso | happy_path | high | yes | no aplica |
| CA-005 | `obstacle_dist` es −1 y el movimiento es suave | Corre un ciclo | `obstacle_alert` es falso y `car_speed` es 90 | edge_case | high | yes | no aplica |
| CA-006 | Hay un estado previo válido | Llega una línea que no es JSON del contrato | El estado emitido no cambia y el proceso sigue | error | high | yes | no aplica |
| CA-007 | Llega `head_x` 140 o −140 | La captura normaliza | El valor entregado al control queda en 100 o −100 | edge_case | high | yes | no aplica |
| CA-008 | Había un rostro | Pasan 500 ms sin detección | El control recibe `head_x` 0 y la pista indica «sin rostro» | flujo_alterno | high | yes | no aplica |
| CA-009 | La cámara no abre | Arranca la app y se abre `/` | El proceso responde en `/` y la pista indica «sin cámara» | error | high | yes | no aplica |
| CA-010 | La base existe y puede estar vacía | `POST /sesiones` de vuelta completa con tiempo 12.5 y `evento_id` nuevo | Se inserta una fila y la respuesta es 201 | happy_path | high | yes | no aplica |
| CA-011 | El archivo SQLite no tiene filas | `GET /historial` | El cuerpo es un arreglo vacío | edge_case | high | yes | no aplica |
| CA-012 | Ya existe una fila con ese `evento_id` | Se repite el mismo `POST` | Sigue habiendo una sola fila y la respuesta indica duplicado, sin modificar la original | edge_case | high | yes | no aplica |
| CA-013 | No se ha hecho ningún POST de esa sesión | El navegador se cierra a mitad de vuelta | El número de filas no cambia | edge_case | high | yes | no aplica |
| CA-014 | Hay 11 vueltas con tiempo y una fila con tiempo nulo | `GET /historial` | Devuelve 10 objetos, ordenados por `tiempo_vuelta` ascendente, y ninguno tiene tiempo nulo | happy_path | high | yes | no aplica |
| CA-015 | `|car_x|` era 60 | `|car_x|` pasa a 80 y se mantiene 30 ciclos | El contador de colisiones de la vuelta sube en 1 | happy_path | medium | yes | no aplica |
| CA-016 | El socket está conectado | El núcleo publica un ciclo | El evento `estado` trae `car_x`, `car_speed`, `obstacle_dist` y `obstacle_alert` | happy_path | high | yes | no aplica |
| CA-017 | La vuelta actual no cruzó la meta | `POST /sesiones` con `motivo` `fin_sesion` y tiempo nulo | Hay una fila con ese motivo y no aparece en `GET /historial` | flujo_alterno | high | yes | no aplica |
| CA-018 | `obstacle_alert` pasa a verdadero | La pista recibe el estado | Se ve el aviso de obstáculo. Si pasa a falso, el aviso desaparece | happy_path | medium | yes | no aplica |

Valores de **Test mínimo:** `no aplica`. Este SDD custom no define pruebas.

**Invariantes de estado persistente:**

| Invariante | ¿Tiene CA? | CA asociado |
|---|---|---|
| Primera ejecución (estado vacío) | sí | CA-011 |
| Re-ejecución sobre datos existentes | sí | CA-012 |
| Estado previo incompleto | sí | CA-013 |

---

## 9. Requerimientos no funcionales

| ID | Requerimiento | Métrica esperada | Prioridad |
|---|---|---|---|
| RNF-001 | El lazo de control apunta a 20 Hz | Periodo nominal 50 ms. Un atraso puntual no acumula ciclos pendientes: se usa el `dt` real acotado entre 20 ms y 100 ms. | Alta |
| RNF-002 | La app no sale de la laptop | Flask escucha en `127.0.0.1` y un puerto fijo documentado en el diseño. | Media |
| RNF-003 | La pista se entiende en la demo | Se leen velocidad, tiempo de vuelta en curso, colisiones y el aviso de obstáculo sin abrir la consola. | Alta |
| RNF-004 | Un fallo de línea queda registrado | Log de una línea inválida con el texto recortado a 200 caracteres, sin tumbar el proceso. | Media |

---

## 10. Supuestos

- El módulo de dominio es `carrera`. El estudiante lo confirma al aprobar.
- No hay diseño de pantalla previo.
- Python 3.11+, la webcam y un navegador con Canvas están disponibles.
- Las ganancias y los umbrales del diseño son el punto de partida de la simulación, no la sintonía del ESP32.
- `SPEC-001` es el primer id local. No hay reserva en un servidor.

---

## 11. Dependencias

| Dependencia | Tipo | Estado | Comentario |
|---|---|---|---|
| Webcam de la laptop | Externa | Confirmada | Si falla, aplica UC-006. No bloquea el arranque. |
| OpenCV, Flask, Flask-SocketIO | Técnica | Pendiente de instalar en el build | Versiones mínimas en `technical-context.md`. |
| ESP32 y VL53L5X | Externa | Pendiente | Fuera de esta spec. |
| Azure DevOps / work items | Negocio | No aplica | Proyecto de la universidad. |

---

## 12. Preguntas abiertas

- Ninguna que bloquee la construcción. `head_y` se guarda en el mensaje y no controla el carro; si más adelante debe frenar o acelerar, es otra spec.
