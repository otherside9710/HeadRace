import * as THREE from "three";
import { juego } from "./estado.js";

export function crearParticulas(scene) {
  const grupo = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  const geo = new THREE.BoxGeometry(0.05, 0.015, 1.5);
  const piezas = [];
  for (let i = 0; i < 36; i += 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set((Math.random() - 0.5) * 9, 0.15 + Math.random() * 0.35, -Math.random() * 22);
    grupo.add(m);
    piezas.push(m);
  }
  scene.add(grupo);
  return { grupo, piezas, mat };
}

export function actualizarParticulas(part, dt) {
  const vel = Math.max(0, Math.min(1, juego.estado.car_speed / 100));
  part.mat.opacity = vel < 0.35 ? 0 : 0.15 + vel * 0.35;
  const paso = (8 + vel * 28) * dt;
  for (const pieza of part.piezas) {
    pieza.position.z += paso;
    if (pieza.position.z > 1.5) {
      pieza.position.z = -26 - Math.random() * 8;
      pieza.position.y = 0.12 + Math.random() * 0.3;
    }
  }
}
