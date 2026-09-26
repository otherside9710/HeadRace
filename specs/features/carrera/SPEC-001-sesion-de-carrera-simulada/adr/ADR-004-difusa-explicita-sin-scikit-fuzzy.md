# ADR-004: Difusa explícita sin scikit-fuzzy

**Estado:** accepted
**Fecha:** 2026-09-25
**Decidido por:** Julio Sarmiento Peña
**Aprobado por:** Julio Sarmiento Peña

## Contexto

El contexto del curso sugiere diseñar las reglas con scikit-fuzzy. Esa librería no corre en el ESP32, y una dependencia de más estorba en una materia sin experiencia previa en embebidos.

## Decisión

La ejecución usa pertenencia triangular y consecuentes singleton, escritos en el diseño: baja 30, media 60, alta 90, con la tabla de nueve reglas. El peso de cada regla es el mínimo de sus dos antecedentes. La salida es el promedio ponderado, redondeado al entero.

scikit-fuzzy no entra al proceso de la demo. Si más adelante se usa para comparar, es fuera de este lazo y no cambia el contrato.

## Consecuencias

Los casos con una sola regla activa dan 30 o 90 exactos, que es lo que piden CA-003 y CA-004. Mezclas de reglas dan enteros intermedios. Portar a C++ es traducir esas funciones, no enlazar una librería.

## Alternativas consideradas

Dejar scikit-fuzzy como motor y reimplementar «a ojo» en C++. Se descartó porque las dos versiones divergirían antes de la sustentación.
