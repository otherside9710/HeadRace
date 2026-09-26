# SPEC-001-sesion-de-carrera-simulada

**Estado:** LISTO_PARA_CERTIFICACION  
**Versión:** 1.0  
**Fecha:** 2026-09-25

---

## Resumen

Carrera HeadRace en la laptop, sin ESP32: la cabeza mueve el carro, el PID lo suaviza, la lógica difusa limita la velocidad y las vueltas quedan en SQLite.

---

## Archivos de la spec

| Archivo | Propósito | Audiencia principal |
|---|---|---|
| `requirements.md` | Objetivo, alcance, casos de uso, reglas y criterios de aceptación | Estudiante |
| `design.md` | Diseño técnico, contratos, PID, difusa y datos | Implementación |
| `tasks.md` | Plan de implementación | Implementación |
| `SPEC.md` | Vista consolidada | Estudiante |
| `.metadata.json` | Metadatos | Agentes |
| `test-plan.md` | No forma parte de este SDD | — |

---

## Estado actual

- Estado: APROBADO
- Pendientes: ninguno de spec
- Riesgos relevantes: salto del PID, pérdida de rostro, contrato JSON que debe sobrevivir al firmware
- Próximo paso: `/sdd-build SPEC-001`

---

## Cómo continuar

Si la spec está en revisión:

```txt
Revisar requirements.md, design.md y tasks.md.
Responder APROBADO cuando esté lista.
```

Si la spec está aprobada:

```txt
/sdd-build SPEC-001
```
