# HEADRACE — CORRECCIONES PUNTUALES

La migración a React + Three.js ya está funcionando.

NO reconstruyas la arquitectura.

NO cambies el stack.

Trabaja sobre la implementación actual.

Necesito corregir específicamente los siguientes puntos.

---

## 1. OBSTÁCULOS — DEBEN ESTAR CENTRADOS EN EL CARRIL

Este punto es MUY IMPORTANTE.

Actualmente algunos obstáculos pueden aparecer sobre la línea que separa dos carriles.

Eso es incorrecto.

### REGLA

Cada obstáculo debe aparecer **exactamente en el centro de un carril**.

Nunca debe aparecer:

```text
        CARRIL 1       CARRIL 2
             \    🚧    /
              \        /
               ────────
               ❌ INCORRECTO
```

Debe aparecer:

```text
        CARRIL 1       CARRIL 2
            🚧             🚧
             │             │
             │             │
          CENTRO        CENTRO
         DEL CARRIL   DEL CARRIL
```

La posición X del obstáculo debe calcularse utilizando explícitamente el centro de cada carril.

Por ejemplo, conceptualmente:

```text
laneCenter[0]
laneCenter[1]
laneCenter[2]
```

y el obstáculo debe utilizar uno de esos valores.

NO generar una posición X aleatoria dentro de todo el ancho de la carretera.

NO colocar obstáculos en posiciones aleatorias que puedan caer sobre una línea divisoria.

### IMPORTANTE

El obstáculo debe permanecer centrado en su carril incluso mientras se desplaza hacia la cámara debido al movimiento de la pista.

---

# 2. SISTEMA DE CARRILES

Define claramente el sistema de carriles.

La pista debe tener una cantidad fija de carriles.

Por ejemplo:

```text
        ┌───────────────┐
        │  L1 │ L2 │ L3 │
        │     │    │    │
        │  🚧 │ 🏎️ │ 🚧 │
        │     │    │    │
        └───────────────┘
```

Cada carril debe tener una posición central calculable.

El vehículo del jugador también debe utilizar esas posiciones.

No utilizar posiciones X arbitrarias.

---

# 3. MOVIMIENTO DEL JUGADOR ENTRE CARRILES

Actualmente el movimiento al mover la cabeza puede hacer que el vehículo cambie de carril demasiado bruscamente.

Esto debe cambiar.

NO hacer:

```text
CARRIL 1
   🏎️
    ↓
CARRIL 3
      🏎️
```

en un solo frame.

El cambio debe ser progresivo.

---

# 4. TRANSICIÓN SUAVE DE CARRIL

Cuando el sistema de detección de cabeza determine que el jugador debe desplazarse hacia la izquierda o derecha:

1. Determinar el carril objetivo.
2. Obtener el `targetX` correspondiente al centro de ese carril.
3. Interpolar suavemente la posición actual hacia `targetX`.

Conceptualmente:

```text
currentX → targetX
```

Nunca:

```text
currentX = targetX
```

de forma inmediata.

Puedes utilizar:

* lerp;
* damp;
* easing;
* SmoothDamp equivalente;
* interpolación basada en deltaTime.

Por ejemplo conceptualmente:

```text
currentX = lerp(currentX, targetX, smoothing)
```

pero la implementación debe ser **frame-rate independent**.

---

# 5. NO CAMBIAR MÁS DE UN CARRIL DE GOLPE

El movimiento de la cabeza NO debe provocar que el vehículo pase instantáneamente de:

```text
L1 → L3
```

Debe existir una transición progresiva:

```text
L1 → L2 → L3
```

o, si el diseño determina que se puede seleccionar directamente L3, el vehículo debe **desplazarse físicamente atravesando la posición de L2**, nunca teletransportarse.

La animación visual debe mostrar claramente el desplazamiento lateral.

---

# 6. CONTROL DE CABEZA

El movimiento de cabeza debe convertirse en una intención de desplazamiento lateral.

Conceptualmente:

```text
head position
      ↓
normalización
      ↓
dead zone
      ↓
left / center / right
      ↓
target lane
      ↓
smooth movement
```

Agregar una pequeña **dead zone** para evitar que pequeños movimientos involuntarios de la cabeza hagan oscilar el vehículo.

Por ejemplo:

```text
        IZQUIERDA
             ←

       DEAD ZONE

             →

        DERECHA
```

Dentro de la dead zone:

```text
no cambiar de carril
```

---

# 7. EVITAR OSCILACIONES

Si el usuario mueve ligeramente la cabeza alrededor del límite:

```text
izquierda
derecha
izquierda
derecha
```

el vehículo NO debe estar cambiando constantemente de carril.

Utilizar:

* dead zone;
* hysteresis;
* smoothing;
* cooldown si es necesario.

La experiencia debe sentirse estable.

---

# 8. VELOCIDAD DEL CAMBIO DE CARRIL

El cambio debe sentirse:

**rápido pero suave.**

No quiero:

### DEMASIADO RÁPIDO

```text
L1 ───────────────→ L2
     instantáneo
```

Ni:

### DEMASIADO LENTO

```text
L1 ───────────────→ L2
       3 segundos
```

Debe sentirse como un vehículo que realiza una maniobra rápida.

Aproximadamente:

```text
0.25s – 0.5s
```

como referencia inicial.

Ajustar visualmente según el resultado.

---

# 9. EL KART DEBE MANTENERSE ALINEADO CON EL CARRIL

Durante el cambio de carril:

* las ruedas;
* el cuerpo;
* la sombra;
* los efectos;

deben desplazarse junto con el kart.

No mover solamente el modelo visual.

El objeto raíz del jugador debe ser el que cambie de posición.

---

# 10. ANIMACIÓN LATERAL

Durante el cambio de carril puede existir una pequeña inclinación visual del kart.

Por ejemplo:

```text
← izquierda

      🏎️
       ╲

derecha →

       ╱
      🏎️
```

Debe ser muy sutil.

NO exagerar.

La inclinación debe regresar suavemente a cero cuando el kart termine el cambio.

---

# 11. COLISIONES

Las colisiones deben utilizar la posición real del kart y del obstáculo.

No utilizar solamente la posición lógica del carril.

Durante el cambio de carril, la colisión debe reflejar la posición física actual.

Esto evita que:

```text
kart visualmente aquí
        ↓
        🏎️

pero colisión aquí
        ↓
        ❌
```

---

# 12. SPAWN DE OBSTÁCULOS

Cuando aparezca un nuevo obstáculo:

1. Seleccionar aleatoriamente un carril válido.
2. Obtener el centro exacto de ese carril.
3. Crear el obstáculo en esa posición.
4. Mantener esa posición lateral mientras avanza.

Conceptualmente:

```text
laneIndex = random(0, laneCount - 1)

x = laneCenters[laneIndex]
```

No:

```text
x = random(minRoadX, maxRoadX)
```

---

# 13. EVITAR SPAWNS IMPOSIBLES

No generar obstáculos que hagan imposible la partida.

Debe existir suficiente espacio para reaccionar.

Evitar situaciones como:

```text
🚧 🚧 🚧
🚧 🏎️ 🚧
```

si no existe ningún carril disponible para esquivar.

La generación debe considerar la separación entre obstáculos.

---

# 14. REGLA DE JUGABILIDAD

El jugador debe poder entender claramente:

```text
"El obstáculo está en ESTE carril."
```

y reaccionar moviendo la cabeza:

```text
👤 ←
   ↓
🏎️ ←
```

o:

```text
👤 →
   ↓
🏎️ →
```

La relación entre movimiento de cabeza y movimiento lateral del kart debe sentirse natural.

---

# 15. PRUEBA OBLIGATORIA

Después de implementar los cambios, prueba específicamente:

### TEST 1

Generar 20 obstáculos.

Verificar que:

**100% estén centrados en un carril.**

Ninguno debe estar sobre una línea divisoria.

### TEST 2

Mover la cabeza lentamente hacia la izquierda.

El kart debe desplazarse suavemente hacia el carril izquierdo.

### TEST 3

Mover la cabeza lentamente hacia la derecha.

El kart debe desplazarse suavemente hacia el carril derecho.

### TEST 4

Mover la cabeza rápidamente de izquierda a derecha.

El kart NO debe teletransportarse.

Debe realizar una transición suave.

### TEST 5

Mantener la cabeza aproximadamente centrada.

El kart debe permanecer en su carril.

### TEST 6

Mover ligeramente la cabeza alrededor del centro.

El kart NO debe oscilar entre carriles.

---

# 16. NO MODIFICAR INNECESARIAMENTE

No cambies:

* HUD;
* webcam;
* minimapa;
* sesión;
* sistema de puntuación;

salvo que sea estrictamente necesario para estas correcciones.

El objetivo de esta tarea es:

```text
SPAWN CORRECTO
+
MOVIMIENTO POR CARRILES
+
TRANSICIÓN SUAVE
+
CONTROL DE CABEZA ESTABLE
```

Primero haz que esto funcione correctamente.

Después podemos continuar con el polish visual.
