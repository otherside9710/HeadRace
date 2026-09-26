# Design: SPEC-001-sesion-de-carrera-simulada

**Versión:** 1.0  
**Estado:** APROBADO  
**Fecha:** 2026-09-25  
**Responsable técnico:** Julio Sarmiento Peña

---

## 1. Resumen técnico

Un proceso Python en `127.0.0.1` captura la cara, corre PID y lógica difusa, sirve la pista y guarda vueltas en SQLite. El navegador solo dibuja y detecta meta y bordes. El núcleo de control es una función de un ciclo, sin Flask y sin OpenCV, para copiarla después a C++ y dejar el resto igual.

---

## 2. Contexto técnico

| Elemento | Valor |
|---|---|
| Tipo de cambio | Nueva feature |
| Stack confirmado | Python 3.11, OpenCV, Flask, Flask-SocketIO, SQLite, HTML/JS/Canvas. Ver `specs/technical-context.md`. |
| Componentes afectados | `captura`, `control`, `backend`, `web` (aún no existen) |
| Sistemas externos | Webcam. ESP32 fuera de esta spec. |
| Persistencia | SQLite en `data/headrace.sqlite` |

---

## 3. Modelo conceptual

### Entidades principales

```txt
MuestraCabeza
├─ head_x          entero [-100, 100]
├─ head_y          entero [-100, 100]
└─ rostro          booleano (no viaja al futuro ESP32)

EstadoCarro
├─ car_x           número [-100, 100], un decimal
├─ car_speed       entero [0, 100]
├─ obstacle_dist   entero, mm, o -1
└─ obstacle_alert  booleano

Sesion
├─ id
├─ evento_id       único
├─ fecha_hora      ISO 8601 UTC
├─ tiempo_vuelta   real o nulo
├─ colisiones
├─ eventos_obstaculo
├─ velocidad_promedio
└─ motivo          vuelta_completa | fin_sesion
```

### Relaciones

```txt
Sesion ──1───1── fila SQLite
Vuelta en curso (memoria del navegador) ──al cruzar o terminar──> Sesion
MuestraCabeza ──cada 50 ms──> EstadoCarro
```

### Estados relevantes

| Entidad | Estado | Descripción |
|---|---|---|
| Captura | con_rostro | Hay cara en los últimos 500 ms |
| Captura | sin_rostro | Sin cara por 500 ms o más. Offset forzado a 0 |
| Captura | sin_camara | El dispositivo no abre. Offset 0 |
| Pista | en_marcha | Avanza con el último `car_speed` |
| Pista | detenida | Tras «Terminar sesión» o sin estado todavía |
| Obstáculo simulado | lejos | 2000 mm |
| Obstáculo simulado | cerca | 200 mm, lo activa la pista |

---

## 4. Flujo principal

```txt
1. El estudiante abre http://127.0.0.1:5000/
2. La captura lee un frame y publica head_x, head_y.
3. El núcleo ejecuta paso(muestra, distancia, dt) y devuelve EstadoCarro.
4. SocketIO emite el evento "estado".
5. La pista integra el avance, dibuja el carro y, si cruza la meta, hace POST /sesiones.
6. GET /historial refresca la tabla.
```

---

## 5. Componentes afectados

| Componente | Tipo | Cambio esperado |
|---|---|---|
| `captura` | Otro | Haar Cascade, offset, bandera de rostro y de cámara |
| `control` | Otro | `paso`, PID, difusa, parámetros |
| `backend` | Backend | Flask, SocketIO, SQLite, escenario de obstáculo |
| `web` | Frontend | Pista, aviso, tabla, botones |
| `data/headrace.sqlite` | DB | Tabla `sesiones` creada al arrancar |

---

## 6. Modelo de datos

### Entidad: sesiones

| Campo | Tipo | Requerido | Reglas | Descripción |
|---|---|---:|---|---|
| id | INTEGER | Sí | PK autoincrement | Identificador interno |
| evento_id | TEXT | Sí | UNIQUE | Lo genera la pista, un UUID por guardado |
| fecha_hora | TEXT | Sí | ISO 8601 UTC escrito por el servidor | Momento del insert |
| tiempo_vuelta | REAL | No | > 0 si motivo es vuelta_completa; nulo si fin_sesion a mitad | Segundos |
| colisiones | INTEGER | Sí | ≥ 0, default 0 | Flancos de salida del carril en ese tramo |
| eventos_obstaculo | INTEGER | Sí | ≥ 0, default 0 | Flancos de falso → verdadero de la alerta |
| velocidad_promedio | REAL | No | 0 a 100 si hay muestras | Media aritmética de `car_speed` del tramo |
| motivo | TEXT | Sí | `vuelta_completa` o `fin_sesion` | Por qué se guardó |

```sql
CREATE TABLE IF NOT EXISTS sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id TEXT NOT NULL UNIQUE,
    fecha_hora TEXT NOT NULL,
    tiempo_vuelta REAL,
    colisiones INTEGER NOT NULL DEFAULT 0,
    eventos_obstaculo INTEGER NOT NULL DEFAULT 0,
    velocidad_promedio REAL,
    motivo TEXT NOT NULL CHECK (motivo IN ('vuelta_completa', 'fin_sesion'))
);
```

### Consideraciones de persistencia

- Índice único en `evento_id` (lo da UNIQUE).
- No se actualizan filas. No hay borrado en esta spec.
- Sin migraciones más allá del `CREATE TABLE IF NOT EXISTS`.
- `CHECK` de motivo. `tiempo_vuelta` nulo solo se acepta si `motivo` es `fin_sesion`. Si `motivo` es `vuelta_completa`, `tiempo_vuelta` es obligatorio y > 0. Esa segunda regla se valida en la aplicación antes del insert, porque SQLite en versiones viejas no combina bien el NULL con un CHECK cruzado; si el SQLite local lo permite, puede añadirse el CHECK, si no, basta el rechazo 400.

---

## 7. Contratos / APIs / Eventos

### Contrato: página

```txt
GET /
```

**Descripción:** Devuelve `index.html`.

**Request:** sin cuerpo.

**Response exitosa:** HTML 200.

**Response error:** No aplica en esta ruta si el archivo está en el paquete.

---

### Contrato: historial

```txt
GET /historial
```

**Descripción:** Top 10 de vueltas con tiempo.

**Request:** sin cuerpo.

**Response exitosa:**

```json
[
  {
    "fecha_hora": "2026-09-25T20:00:00Z",
    "tiempo_vuelta": 11.2,
    "colisiones": 0,
    "eventos_obstaculo": 1,
    "velocidad_promedio": 84.0
  }
]
```

Arreglo vacío si no hay vueltas. Orden: `tiempo_vuelta ASC`. Límite 10. Excluye tiempo nulo.

**Response error:** 500 solo si el archivo no se puede leer, con `{"error": {"code": "DB_NO_DISPONIBLE", "message": "No se pudo leer el historial"}}`.

---

### Contrato: guardar tramo

```txt
POST /sesiones
Content-Type: application/json
```

**Descripción:** Inserta una vuelta completa o un fin de sesión.

**Request:**

```json
{
  "evento_id": "2f1c0e2a-7b4d-4c1a-9a11-0c5e6d7f8001",
  "motivo": "vuelta_completa",
  "tiempo_vuelta": 12.5,
  "colisiones": 1,
  "eventos_obstaculo": 2,
  "velocidad_promedio": 76.4
}
```

`fin_sesion` envía `"tiempo_vuelta": null`.

**Response exitosa (alta):** 201 y la fila guardada, incluyendo `fecha_hora` del servidor.

**Response duplicado:** 200 y `{"duplicado": true, "evento_id": "..."}` sin cambiar la fila.

**Response error:**

```json
{
  "error": {
    "code": "SESION_INVALIDA",
    "message": "motivo debe ser vuelta_completa o fin_sesion"
  }
}
```

Código 400. También 400 si `vuelta_completa` trae tiempo nulo o ≤ 0, o si los conteos son negativos.

---

### Contrato: estado en vivo

```txt
SocketIO evento servidor → cliente: "estado"
```

**Descripción:** Un mensaje por ciclo de control.

```json
{
  "car_x": 37.2,
  "car_speed": 90,
  "obstacle_dist": 2000,
  "obstacle_alert": false,
  "captura": "con_rostro"
}
```

`captura` es `con_rostro`, `sin_rostro` o `sin_camara`. Ese campo es de la laptop. No forma parte del JSON que en el futuro cruzará el Serial hacia el ESP32.

**Response error:** No aplica. Una línea interna inválida no emite un estado nuevo (CA-006).

---

### Contrato: simular obstáculo

```txt
SocketIO evento cliente → servidor: "simular_obstaculo"
```

```json
{ "activo": true }
```

`true` fija la distancia en 200 mm. `false` la devuelve a 2000 mm. Valor distinto se ignora.

---

### Contrato: JSON del futuro ESP32 (mismo núcleo hoy, en memoria)

Hacia el control, una línea:

```json
{"head_x": 42, "head_y": -15}
```

Desde el control, una línea:

```json
{"car_x": 37.2, "car_speed": 90, "obstacle_dist": 2000, "obstacle_alert": false}
```

Hoy no hay cable: `paso()` devuelve ese objeto. Cuando exista el ESP32, la app escribirá la primera línea por Serial y leerá la segunda, y dejará de llamar a `paso()`. Los campos y rangos no cambian.

---

## 8. Validaciones

| ID | Validación | Dónde aplica | Error esperado | Regla relacionada |
|---|---|---|---|---|
| VAL-001 | Recortar head_x y head_y a [−100, 100] | Captura | No es error; se recorta | RN-001 |
| VAL-002 | Recortar car_x y limitar el salto a 12 por ciclo | Control | No es error; se recorta | RN-001 |
| VAL-003 | `car_speed` es 30, 60 o 90, o un entero entre ellos si se mezclan reglas | Control | No emite fuera de [0, 100] | RN-003 |
| VAL-004 | Distancia −1 no alerta | Control | `obstacle_alert` falso | RN-004 |
| VAL-005 | `evento_id` presente, motivo válido, conteos ≥ 0 | POST /sesiones | 400 `SESION_INVALIDA` | RN-005 |
| VAL-006 | `vuelta_completa` exige tiempo > 0 | POST /sesiones | 400 `SESION_INVALIDA` | RN-006 |
| VAL-007 | Línea JSON sin los campos esperados | Lazo interno | Se ignora y se registra | RN-001 |

---

## 9. Seguridad

- Autenticación: No aplica. Solo localhost.
- Autorización: No aplica.
- Validación de entrada: VAL-005 y VAL-006. Consultas parametrizadas.
- Datos sensibles: No aplica. No hay datos personales más allá de tiempos de una práctica.
- Auditoría: Log de arranque, de línea inválida y de insert.
- Riesgos de abuso: El bind es `127.0.0.1`. No hay rate limit adicional.

---

## 10. Observabilidad

### Logs requeridos

| Evento de log | Nivel | Campos mínimos |
|---|---|---|
| Arranque | INFO | host, puerto, ruta del sqlite, modo simulado |
| Línea de control inválida | WARN | texto recortado a 200 caracteres |
| Sesión guardada | INFO | evento_id, motivo |
| Cámara no disponible | ERROR | mensaje de OpenCV, una vez al fallar y no en cada frame |

### Métricas

| Métrica | Tipo | Objetivo |
|---|---|---|
| No aplica | — | Una demo local no exige exportar métricas. El periodo del lazo se puede imprimir en DEBUG si hace falta afinar. |

---

## 11. Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Haar pierde la cara | Alta | Medio | A los 500 ms el offset va a 0 y la pista lo dice |
| El derivativo del PID dispara en un escalón | Alta | Alto | Tope de 12 unidades de `car_x` por ciclo |
| La sintonía no sirve en el ESP32 | Alta | Medio | Parámetros en un solo módulo, marcados como punto de partida |
| Dos dueños del Serial en el futuro | Media | Alto | Esta spec deja un solo proceso como dueño del enlace |

---

## 12. Decisiones técnicas

| Decisión | Alternativas consideradas | Justificación |
|---|---|---|
| Núcleo `paso()` en Python | Control en el navegador; scikit-fuzzy en runtime | Hay que portarlo a C++. Ver ADR-001 y ADR-004. |
| Llamada en memoria, no un puerto falso | Dos procesos y un pty serial desde ya | Menos piezas para la primera demo. El JSON ya es el contrato. Ver ADR-002. |
| Pista: avance = velocidad, lateral = `car_x` | `car_x` como posición en píxeles de una recta | Hace falta una vuelta cerrada para el historial. |
| Singleton 30/60/90 | Centroides continuos de scikit-fuzzy | Se pueden recalcular a mano y copiar a C++. |

---

## 13. Compatibilidad y migración

- ¿Rompe contratos existentes?: No. No había contratos.
- ¿Requiere migración de datos?: No.
- ¿Requiere feature flag?: No. El modo hardware será otra spec.
- ¿Requiere plan de rollback?: No. Basta no ejecutar el proceso.

### Plan de rollback

Borrar `data/headrace.sqlite` devuelve el historial a vacío. No hay despliegue que revertir.

---

## 14. Diseño de interfaz

No aplica. No hay diseño en Figma ni en Stitch.

La pista, igual, tiene que mostrar: óvalo, carro, velocidad, tiempo de la vuelta en curso, colisiones, aviso de obstáculo cuando `obstacle_alert` es verdadero, texto «sin cámara» o «sin rostro», botón «Simular obstáculo» y botón «Terminar sesión», y la tabla de `GET /historial`.

---

## 15. Parámetros de control (normativos)

Periodo nominal `dt` = 0.05 s. Si el `dt` medido cae fuera de [0.02, 0.10], se usa el extremo más cercano.

### PID

Entrada de referencia: `head_x`. Variable: `car_x`.

```txt
error = head_x - car_x
integral = recorte(integral + error * dt, -50, 50)
derivada = (error - error_anterior) / dt
salida = Kp*error + Ki*integral + Kd*derivada
delta = recorte(salida, -12, 12)
car_x = recorte(car_x + delta, -100, 100)
```

Punto de partida: `Kp = 0.35`, `Ki = 0`, `Kd = 0.02`.

Con estos números, un escalón de error 80 en un ciclo produce una salida cruda grande por el derivativo y el tope la deja en 12. Eso es lo que pide CA-002. Con la cabeza quieta, el derivativo cae y `car_x` se acerca al offset dentro de 60 ciclos (CA-001).

### Pertenencia de la brusquedad

`b = |head_x - head_x_anterior|` en el mismo ciclo, ya en la escala −100..100. No se divide por `dt`.

Triángulos. Fuera de la base, pertenencia 0. En el plateau indicado, 1.

| Conjunto | Forma |
|---|---|
| bajo | 1 en 0, baja lineal hasta 0 en 15 |
| medio | 0 en 5, 1 en 20, 0 en 35 |
| alto | 0 en 25, 1 desde 40 hacia arriba |

### Pertenencia de la distancia (mm)

Si `obstacle_dist` es −1, la pertenencia de `lejos` es 1 y las otras 0. No se evalúan los triángulos.

| Conjunto | Forma |
|---|---|
| cerca | 1 en 0, 0 en 500 |
| medio | 0 en 300, 1 en 700, 0 en 1100 |
| lejos | 0 en 900, 1 desde 1500 hacia arriba |

### Reglas (mínimo de antecedentes, consecuente singleton)

| Movimiento \ Obstáculo | cerca | medio | lejos |
|---|---|---|---|
| bajo | media (60) | alta (90) | alta (90) |
| medio | baja (30) | media (60) | alta (90) |
| alto | baja (30) | baja (30) | media (60) |

La velocidad es el promedio ponderado de los singletons, con peso = mínimo de las dos pertenencias de la regla. Se redondea al entero más cercano y se recorta a [0, 100]. Si la suma de pesos es 0, la velocidad es 60.

Casos de una sola regla activa, usados por los criterios:

| Distancia | b | Velocidad | Alerta |
|---|---|---|---|
| 2000 | 0 | 90 | falso |
| 100 | 50 | 30 | verdadero |
| −1 | 0 | 90 | falso |

Umbral de alerta: distancia ≥ 0 y distancia < 400.

### Pista

- Longitud de la línea media: 1000 unidades.
- Avance por segundo: `(car_speed / 100) * 200` unidades. A velocidad 90, una vuelta dura unos 5.6 s. A velocidad 30, unos 16.7 s.
- La meta está en el punto 0. Un cruce cuenta si el sentido es de avance y pasaron al menos 2 s desde el cruce anterior.
- El carril se sale cuando `|car_x| > 70`. El sprite se dibuja recortado a ±70. El PID no se reinicia.
- Colisiones y alertas del tramo: solo el flanco de entrada.
- `velocidad_promedio`: media de los `car_speed` recibidos desde el cruce o el inicio anteriores.

### Arranque

- Host `127.0.0.1`, puerto `5000`.
- Crear `data/` y la tabla si no existen.
- Obstáculo inicial: 2000 mm.
- Estado inicial del PID: `car_x = 0`, integral 0, error anterior 0.
