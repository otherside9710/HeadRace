import * as THREE from "three";
import { ejeX, juego, lateral } from "./estado.js";

export function crearKart(scene) {
  const grupo = new THREE.Group();
  const pintura = new THREE.MeshPhysicalMaterial({
    color: 0x14c4c8,
    roughness: 0.28,
    metalness: 0.15,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
  });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x0b3a44, roughness: 0.45 });
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 1.85), pintura);
  cuerpo.position.set(0, 0.46, -0.1);
  cuerpo.castShadow = true;
  const cola = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.3, 0.72), pintura);
  cola.position.set(0, 0.5, 0.62);
  cola.castShadow = true;
  const nariz = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.62), pintura);
  nariz.position.set(0, 0.4, -1.15);
  nariz.castShadow = true;
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.62), oscuro);
  cabina.position.set(0, 0.66, -0.05);
  const casco = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 }),
  );
  casco.position.set(0, 0.82, 0.28);
  casco.scale.set(1, 0.86, 1.05);
  const franja = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.16), amarillo);
  franja.position.set(0, 0.9, 0.28);
  const banda = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.1), amarillo);
  banda.position.set(0, 0.62, 0.96);
  const ala = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.05, 0.28), pintura);
  ala.position.set(0, 1.18, 0.95);
  const soporteI = posteAla(-0.62);
  const soporteD = posteAla(0.62);
  const difusor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.28), oscuro);
  difusor.position.set(0, 0.28, 0.95);
  const ruedas = [
    rueda(-0.82, 0.7, 1.15),
    rueda(0.82, 0.7, 1.15),
    rueda(-0.7, -1.0, 0.82),
    rueda(0.7, -1.0, 0.82),
  ];
  const luces = [];
  for (const x of [-0.32, 0.32]) {
    const luz = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 }),
    );
    luz.position.set(x, 0.52, 0.95);
    luces.push(luz);
    grupo.add(luz);
  }
  const escapes = [];
  for (const x of [-0.18, 0.18]) {
    const fuego = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.35, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
    );
    fuego.rotation.x = Math.PI / 2;
    fuego.position.set(x, 0.32, 1.15);
    escapes.push(fuego);
    grupo.add(fuego);
  }
  const sombra = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  grupo.add(cuerpo, cola, nariz, cabina, casco, franja, banda, ala, soporteI, soporteD, difusor, sombra, ...ruedas.map((r) => r.pivot));
  scene.add(grupo);
  return { grupo, ruedas, luces, escapes, pintura };
}

function posteAla(x) {
  const poste = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.42, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x082f49 }),
  );
  poste.position.set(x, 0.92, 0.95);
  return poste;
}

function rueda(x, z, escala = 1) {
  const pivot = new THREE.Group();
  const llanta = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34 * escala, 0.34 * escala, 0.26, 18),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }),
  );
  llanta.rotation.z = Math.PI / 2;
  llanta.castShadow = true;
  const aro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * escala, 0.16 * escala, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 }),
  );
  aro.rotation.z = Math.PI / 2;
  pivot.add(llanta, aro);
  pivot.position.set(x, 0.34 * escala, z);
  return { pivot, llanta };
}

export function actualizarKart(kart, noche) {
  const x = ejeX(lateral());
  kart.grupo.position.x = x;
  kart.grupo.position.y = 0;
  kart.grupo.rotation.z = -lateral() * 0.0011;
  kart.grupo.rotation.y = -lateral() * 0.002;
  const giro = juego.s * 0.08;
  for (const rueda of kart.ruedas) {
    rueda.llanta.rotation.x = giro;
  }
  const vel = Math.max(0, Math.min(1, juego.estado.car_speed / 100));
  for (const fuego of kart.escapes) {
    fuego.scale.set(1, 0.4 + vel * 1.4, 1);
    fuego.material.opacity = 0.25 + vel * 0.7;
  }
  const brillo = 0.25 + noche * 1.6;
  for (const luz of kart.luces) {
    luz.material.emissiveIntensity = brillo;
  }
  if (juego.estado.obstacle_alert) {
    kart.pintura.color.set(0xf97316);
  } else {
    kart.pintura.color.set(0x14c4c8);
  }
}
