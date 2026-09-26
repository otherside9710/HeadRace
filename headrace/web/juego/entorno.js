import * as THREE from "three";
import { ESCALA, delanteDe, juego } from "./estado.js";
import { colorDe } from "./escena.js";

export function crearEntorno(scene) {
  const palmeras = [];
  for (let i = 0; i < 32; i += 1) {
    const palma = crearPalmera();
    const lado = i % 2 === 0 ? -1 : 1;
    palma.userData = { marca: i * 34, lado, extra: (i % 5) * 0.55 };
    scene.add(palma);
    palmeras.push(palma);
  }
  const montes = [];
  for (let i = 0; i < 9; i += 1) {
    const alto = 12 + (i % 4) * 4;
    const monte = new THREE.Mesh(
      new THREE.ConeGeometry(9 + (i % 3) * 3, alto, 14),
      new THREE.MeshStandardMaterial({ color: 0x5ea878, roughness: 1 }),
    );
    monte.position.set(-48 + i * 9, alto * 0.2, -120);
    scene.add(monte);
    montes.push(monte);
  }
  const marGeo = new THREE.PlaneGeometry(90, 220, 28, 28);
  const mar = new THREE.Mesh(
    marGeo,
    new THREE.MeshStandardMaterial({ color: 0x1aa4c8, roughness: 0.22, metalness: 0.18 }),
  );
  mar.rotation.x = -Math.PI / 2;
  mar.position.set(28, -0.15, -40);
  scene.add(mar);
  const baseMar = marGeo.attributes.position.array.slice();
  const nubes = [];
  for (let i = 0; i < 6; i += 1) {
    const nube = crearNube();
    nube.position.set(-30 + i * 16, 16 + (i % 3) * 2, -40 - i * 6);
    scene.add(nube);
    nubes.push(nube);
  }
  const faro = crearFaro();
  faro.position.set(22, 0, -48);
  scene.add(faro);
  const edificios = [];
  for (let i = 0; i < 8; i += 1) {
    const alto = 3 + (i % 4) * 1.6;
    const edificio = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, alto, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.8 }),
    );
    edificio.position.set(16 + (i % 3) * 2.4, alto / 2, -78 - i * 6);
    scene.add(edificio);
    edificios.push(edificio);
  }
  return { palmeras, montes, mar, baseMar, nubes, faro, edificios };
}

function crearPalmera() {
  const grupo = new THREE.Group();
  const tronco = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.18, 3.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.9 }),
  );
  tronco.position.y = 1.7;
  tronco.rotation.z = 0.08;
  tronco.castShadow = true;
  grupo.add(tronco);
  const hojaMat = new THREE.MeshStandardMaterial({ color: 0x22a34a, roughness: 0.65 });
  for (let i = 0; i < 7; i += 1) {
    const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.55, 5), hojaMat);
    hoja.position.y = 3.35;
    hoja.rotation.y = (i / 7) * Math.PI * 2;
    hoja.rotation.z = 1.15;
    grupo.add(hoja);
  }
  return grupo;
}

function crearNube() {
  const grupo = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (const [x, y, z, r] of [[0, 0, 0, 1.4], [1.3, 0.2, 0, 1], [-1.1, 0.1, 0.2, 0.9]]) {
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
    esfera.position.set(x, y, z);
    grupo.add(esfera);
  }
  return grupo;
}

function crearFaro() {
  const grupo = new THREE.Group();
  const torre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.7, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }),
  );
  torre.position.y = 3;
  const franja = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.58, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0xe11d48 }),
  );
  franja.position.y = 3.2;
  const luz = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.2 }),
  );
  luz.position.y = 6.3;
  grupo.add(torre, franja, luz);
  grupo.userData.luz = luz;
  return grupo;
}

export function actualizarEntorno(entorno, c) {
  const hora = performance.now() / 1000;
  for (const palma of entorno.palmeras) {
    const dist = delanteDe(palma.userData.marca);
    palma.visible = dist > 6 && dist < 820;
    palma.position.set(palma.userData.lado * (7.1 + palma.userData.extra), 0, -dist * ESCALA);
    palma.rotation.z = Math.sin(hora * 1.2 + palma.userData.marca) * 0.05;
    palma.scale.setScalar(0.85 + (palma.userData.extra % 1) * 0.35);
  }
  entorno.montes.forEach((monte, i) => {
    monte.position.z = -125 - (i % 3) * 6;
    monte.material.color.copy(colorDe(c.crudo.monte));
  });
  const pos = entorno.mar.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = entorno.baseMar[i * 3];
    const y = entorno.baseMar[i * 3 + 1];
    pos.setZ(i, Math.sin(x * 0.18 + hora * 1.4) * 0.18 + Math.cos(y * 0.12 + hora) * 0.1);
  }
  pos.needsUpdate = true;
  entorno.mar.material.color.copy(colorDe(c.crudo.mar));
  entorno.nubes.forEach((nube, i) => {
    nube.position.x += 0.01;
    if (nube.position.x > 50) {
      nube.position.x = -50;
    }
    nube.position.y = 15 + Math.sin(hora * 0.2 + i) * 0.4;
  });
  entorno.faro.userData.luz.material.emissiveIntensity = 0.15 + c.noche * 2.2;
}
