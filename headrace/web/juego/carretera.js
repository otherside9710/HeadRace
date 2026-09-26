import * as THREE from "three";
import { ESCALA, juego } from "./estado.js";

const LARGO = 18;
const CANTIDAD = 10;
const ANCHO = 12;

export function crearCarretera(scene) {
  const textura = texturaAsfalto();
  const material = new THREE.MeshStandardMaterial({ map: textura, roughness: 0.9, metalness: 0.02 });
  const geo = new THREE.PlaneGeometry(ANCHO, LARGO);
  geo.rotateX(-Math.PI / 2);
  const segmentos = [];
  for (let i = 0; i < CANTIDAD; i += 1) {
    const grupo = new THREE.Group();
    const piso = new THREE.Mesh(geo, material);
    piso.receiveShadow = true;
    grupo.add(piso);
    grupo.add(franja(-ANCHO / 2 - 0.28, 0xe11d48));
    grupo.add(franja(ANCHO / 2 + 0.28, 0xf8fafc));
    grupo.add(riel(-ANCHO / 2 - 0.7));
    grupo.add(riel(ANCHO / 2 + 0.7));
    scene.add(grupo);
    segmentos.push(grupo);
  }
  const pasto = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 260),
    new THREE.MeshStandardMaterial({ color: 0x1c9a46, roughness: 1 }),
  );
  pasto.rotation.x = -Math.PI / 2;
  pasto.position.set(0, -0.04, -70);
  pasto.receiveShadow = true;
  scene.add(pasto);
  return { segmentos, pasto };
}

function franja(x, color) {
  const malla = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.05, LARGO),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  malla.position.set(x, 0.03, 0);
  malla.receiveShadow = true;
  return malla;
}

function riel(x) {
  const grupo = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd7dee8, metalness: 0.65, roughness: 0.35 });
  const barra = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, LARGO), metal);
  barra.position.y = 0.55;
  const poste = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), metal);
  for (let z = -LARGO / 2 + 2; z < LARGO / 2; z += 4) {
    const copia = poste.clone();
    copia.position.set(0, 0.28, z);
    grupo.add(copia);
  }
  grupo.add(barra);
  grupo.position.x = x;
  return grupo;
}

function texturaAsfalto() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 256;
  lienzo.height = 512;
  const g = lienzo.getContext("2d");
  g.fillStyle = "#3c4452";
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  }
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(8, 0, 5, 512);
  g.fillRect(243, 0, 5, 512);
  for (let y = 0; y < 512; y += 46) {
    g.fillRect(84, y, 4, 24);
    g.fillRect(168, y, 4, 24);
  }
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function actualizarCarretera(pista, c) {
  const viaje = (juego.s * ESCALA) % LARGO;
  for (let i = 0; i < pista.segmentos.length; i += 1) {
    let z = i * -LARGO + viaje;
    if (z > 8) {
      z -= CANTIDAD * LARGO;
    }
    pista.segmentos[i].position.z = z;
    const rumble = Math.floor((juego.s + i * 20) / 16) % 2;
    pista.segmentos[i].children[1].material.color.set(rumble ? 0xe11d48 : 0xf8fafc);
    pista.segmentos[i].children[2].material.color.set(rumble ? 0xf8fafc : 0xe11d48);
  }
  pista.pasto.material.color.copy(c);
}
