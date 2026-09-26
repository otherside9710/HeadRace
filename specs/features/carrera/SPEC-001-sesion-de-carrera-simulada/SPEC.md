---
id: SPEC-001
slug: sesion-de-carrera-simulada
module: carrera
workspace: local-headrace
title: "Sesión de carrera simulada"
status: LISTO_PARA_CERTIFICACION
priority: high
type: feature
created: 2026-09-25
updated: 2026-09-25
owner: Julio Sarmiento Peña
assigned_to: null
created_by: Julio Sarmiento Peña
approved_by: Julio Sarmiento Peña
approved_at: 2026-09-25T23:14:00-05:00
linked_repos: []
ado:
  epic_id: null
  feature_id: null
  iteration: null
migration:
  migrated: false
  migrated_at: null
  migrated_by: null
  original_path: null
  completeness: null
  missing_artifacts: []
---

# Spec: SPEC-001-sesion-de-carrera-simulada

**ID:** SPEC-001
**Módulo:** carrera
**Estado:** LISTO_PARA_CERTIFICACION
**Fecha:** 2026-09-25
**Ruta:** `specs/features/carrera/SPEC-001-sesion-de-carrera-simulada/`

Identificador local. No hay repositorio remoto de specs ni work items de Azure. Este SDD no incluye plan de pruebas.

---

## 1. Resumen ejecutivo

HeadRace simula la carrera completa en la laptop: la webcam mide la cabeza, un núcleo Python aplica PID y lógica difusa, la pista dibuja el carro y SQLite guarda los tiempos. El JSON de una línea queda fijo para cambiar ese núcleo por el ESP32 cuando lleguen los componentes, sin rehacer la pista ni la base.

---

## 2. Requirements

Documento fuente: `requirements.md`

### Resumen

- Objetivo: demo de punta a punta sin hardware.
- Actores: estudiante, webcam, núcleo de control, pista, SQLite.
- Casos de uso principales: UC-001 a UC-007.
- Reglas críticas: el navegador no calcula el control (RN-002); la tabla difusa (RN-003); una fila por `evento_id` (RN-005); no se persiste una vuelta cortada por una caída (RN-009).
- Criterios de aceptación: 18 (CA-001 a CA-018). No hay casos de prueba asociados.

---

## 3. Design

Documento fuente: `design.md`

### Resumen técnico

- Componentes: `captura`, `control`, `backend`, `web`.
- Modelo: muestra de cabeza, estado del carro, fila `sesiones`.
- Contratos: `GET /`, `GET /historial`, `POST /sesiones`, SocketIO `estado` y `simular_obstaculo`, más el JSON de línea del futuro Serial.
- Datos: SQLite con `evento_id` único.
- Riesgos: Haar, salto del derivativo, sintonía que no viaja tal cual al ESP32, un solo dueño del puerto.

---

## 4. Tasks

Documento fuente: `tasks.md`

### Resumen de implementación

- Total de tareas: 8
- Orden: estado del ciclo, contratos, SQLite, PID y difusa, Flask, captura y pista, README, revisión de la demo.
- Tareas críticas: TASK-004 (núcleo) y TASK-006 (pista).
- Dependencias: el núcleo no importa Flask ni OpenCV.
- ADO IDs: no aplica. Proyecto universitario, sin Azure.

---

## 5. Test Plan

No aplica. Este SDD custom no incluye `test-plan.md`, casos de prueba ni `/sdd-test`.

---

## 6. Decisiones arquitectónicas

Ver carpeta `adr/`.

| ADR | Título | Estado | Decidido por | Fecha |
|---|---|---|---|---|
| ADR-001 | Núcleo de control portable | accepted | Julio Sarmiento Peña | 2026-09-25 |
| ADR-002 | Un solo dueño del enlace | accepted | Julio Sarmiento Peña | 2026-09-25 |
| ADR-003 | JSON de una línea | accepted | Julio Sarmiento Peña | 2026-09-25 |
| ADR-004 | Difusa explícita sin scikit-fuzzy | accepted | Julio Sarmiento Peña | 2026-09-25 |

---

## 7. Riesgos y mitigaciones

| Riesgo | Fuente | Impacto | Mitigación |
|---|---|---|---|
| El derivativo dispara `car_x` en un escalón | Design | Alto | Tope de 12 unidades por ciclo |
| Sin rostro, el carro gira solo | Requirements | Medio | A los 500 ms el offset es 0 |
| Duplicar vueltas al reintentar el POST | Requirements | Medio | `evento_id` único |
| El contrato cambia al escribir el firmware | Design | Alto | ADR-003 fija los campos |

---

## 8. Decisiones abiertas

| Decisión | Estado | Responsable | Fecha límite |
|---|---|---|---|
| Módulo `carrera` | Definida | Julio Sarmiento Peña | 2026-09-25 |
| `head_y` no controla el carro en esta spec | Definida | Julio Sarmiento Peña | 2026-09-25 |
| Sin plan de pruebas | Definida | Julio Sarmiento Peña | 2026-09-25 |

---

## 8b. Historial de asignación

| Fecha | Asignada a | Asignada por | Reemplaza a |
|---|---|---|---|

## 9. Estado de aprobación

**Estado:** APROBADO
**Creado por:** Julio Sarmiento Peña
**Aprobado por:** Julio Sarmiento Peña
**Fecha de aprobación:** 2026-09-25

---

## 10. Checklist final

- [x] Módulo confirmado por el usuario
- [x] Frontmatter canónico completo
- [x] Requirements completos
- [x] Design completo
- [x] Tasks completas (ADO no aplica)
- [x] Test plan excluido a propósito
- [x] ADRs documentados
- [x] Riesgos documentados
- [x] Criterios de aceptación verificables
- [x] Trazabilidad CA → tests no aplica
- [x] Aprobación explícita del usuario
- [x] `.metadata.json` actualizado
- [x] `INDEX.md` del módulo actualizado

---

## 11. Próximo paso

Cuando la spec esté aprobada:

```
/sdd-build SPEC-001
```
