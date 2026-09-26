# Tasks: SPEC-001-sesion-de-carrera-simulada

**Versión:** 1.0  
**Estado:** APROBADO  
**Fecha:** 2026-09-25

Este SDD custom no incluye tareas de pruebas. Los pasos 7, 8 y 9 de la estrategia genérica no aplican.

---

## 1. Estrategia de implementación

Orden recomendado:

1. Modelo / dominio
2. Contratos / DTOs / schemas
3. Persistencia / conectores
4. Casos de uso / lógica
5. Adaptadores / endpoints / handlers
6. UI / consumidor / integración
7. Pruebas unitarias — No aplica. Este SDD custom no incluye pruebas.
8. Pruebas de integración — No aplica. Este SDD custom no incluye pruebas.
9. Pruebas E2E o funcionales — No aplica. Este SDD custom no incluye pruebas.
10. Documentación
11. Validación final contra los criterios de aceptación, en la demo, sin un plan de pruebas aparte.

---

## 2. Tareas

### TASK-001: Definir el estado del ciclo de control

**Objetivo:** Dejar fijos los tipos de la muestra, el estado del carro y la memoria del PID.  
**Depende de:** Ninguna  
**Criterios relacionados:** CA-001, CA-002, CA-007  
**Reglas relacionadas:** RN-001, RN-002

**Entregables:**

- [ ] Estructuras de muestra, estado y memoria del PID
- [ ] Recortes de rango
- [ ] Parámetros en un solo módulo, con los números del diseño
- [ ] `control` sin imports de Flask ni OpenCV

---

### TASK-002: Fijar el contrato JSON y el de HTTP

**Objetivo:** Codificar y decodificar las líneas de control y validar el cuerpo de `POST /sesiones`.  
**Depende de:** TASK-001  
**Criterios relacionados:** CA-006, CA-010, CA-016  
**Reglas relacionadas:** RN-001, RN-005

**Entregables:**

- [ ] Línea de cabeza y línea de estado, como en el diseño
- [ ] Descarte de línea inválida sin perder el estado anterior
- [ ] Cuerpo de alta de sesión y códigos 201, 200 duplicado y 400
- [ ] Ejemplos de payload iguales a los del diseño

---

### TASK-003: Crear SQLite y el alta de sesiones

**Objetivo:** Persistir vueltas sin duplicar `evento_id` y listar el top 10.  
**Depende de:** TASK-001, TASK-002  
**Criterios relacionados:** CA-010, CA-011, CA-012, CA-013, CA-014, CA-017  
**Reglas relacionadas:** RN-005, RN-006, RN-009

**Entregables:**

- [ ] `CREATE TABLE IF NOT EXISTS` al arrancar
- [ ] Insert parametrizado
- [ ] Duplicado que no modifica la fila
- [ ] `GET /historial` con el orden y el límite del diseño

---

### TASK-004: Implementar PID, difusa y el paso del lazo

**Objetivo:** Cumplir los números normativos del diseño.  
**Depende de:** TASK-001, TASK-002  
**Criterios relacionados:** CA-001, CA-002, CA-003, CA-004, CA-005  
**Reglas relacionadas:** RN-002, RN-003, RN-004

**Entregables:**

- [ ] PID con tope de delta 12 e integral acotada
- [ ] Tabla difusa y singletons 30, 60 y 90
- [ ] Distancia −1 tratada como lejos y sin alerta
- [ ] Obstáculo simulado en 2000 mm, conmutable a 200 mm

---

### TASK-005: Servir Flask y el estado por SocketIO

**Objetivo:** Exponer la página, el historial, el alta y el evento `estado`.  
**Depende de:** TASK-003, TASK-004  
**Criterios relacionados:** CA-009, CA-016  
**Reglas relacionadas:** RN-002, RN-004

**Entregables:**

- [ ] `GET /`, `GET /historial`, `POST /sesiones`
- [ ] Evento `estado` con los cuatro campos de control más `captura`
- [ ] Evento `simular_obstaculo`
- [ ] Escucha en `127.0.0.1:5000`
- [ ] La cámara que no abre no impide servir `/`

---

### TASK-006: Captura y pista

**Objetivo:** Cerrar el recorrido desde la webcam hasta el dibujo y el guardado.  
**Depende de:** TASK-005  
**Criterios relacionados:** CA-008, CA-009, CA-015, CA-018  
**Reglas relacionadas:** RN-007, RN-008

**Entregables:**

- [ ] Offset con Haar Cascade y recorte a [−100, 100]
- [ ] Sin rostro a los 500 ms → offset 0 y texto en la pista
- [ ] Óvalo, carro, HUD, aviso, botones y tabla
- [ ] Cruce de meta con espera mínima de 2 s y `POST` de vuelta
- [ ] «Terminar sesión» con tiempo nulo
- [ ] Colisión solo en el flanco `|car_x| > 70`

---

### TASK-007: Documentar cómo se corre y cómo se sustituye el núcleo

**Objetivo:** Dejar por escrito el arranque local y el punto donde entrará el ESP32.  
**Depende de:** TASK-006

**Entregables:**

- [ ] README con el comando de arranque y la dependencia de la webcam
- [ ] Nota de que `paso()` se reemplaza por Serial sin cambiar el JSON
- [ ] Parámetros marcados como punto de partida, no como sintonía final

---

### TASK-008: Revisar la demo contra los criterios

**Objetivo:** Recorrer los CA en la laptop y anotar lo que no se cumpla.  
**Depende de:** TASK-006, TASK-007

**Entregables:**

- [ ] Lista de CA cumplidos y pendientes, en una nota corta del README o del changelog de build
- [ ] Desviaciones escritas antes de seguir construyendo
- [ ] Sin archivo `test-plan.md`

---

## 3. Matriz de dependencias

| Tarea | Depende de | Bloquea |
|---|---|---|
| TASK-001 | Ninguna | TASK-002, TASK-004 |
| TASK-002 | TASK-001 | TASK-003, TASK-004, TASK-005 |
| TASK-003 | TASK-001, TASK-002 | TASK-005 |
| TASK-004 | TASK-001, TASK-002 | TASK-005 |
| TASK-005 | TASK-003, TASK-004 | TASK-006 |
| TASK-006 | TASK-005 | TASK-007, TASK-008 |
| TASK-007 | TASK-006 | TASK-008 |
| TASK-008 | TASK-006, TASK-007 | Ninguna |

---

## 4. Criterios de salida

- [ ] Tareas TASK-001 a TASK-008 completadas
- [ ] Criterios de aceptación cubiertos por el comportamiento, no por un plan de pruebas
- [ ] Reglas de negocio visibles en el núcleo, la pista o el alta
- [ ] README de arranque escrito
- [ ] Desviaciones anotadas
