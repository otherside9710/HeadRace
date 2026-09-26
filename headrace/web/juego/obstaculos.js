import * as THREE from "three";
import { ESCALA, delanteDe, ejeX, juego } from "./estado.js";

export function crearObstaculos(scene) {
  const banco = {
    cono: crearCono(),
    caja: crearCaja(),
    barrera: crearBarrera(),
  };
  const vivos = [];
  for (let i = 0; i < 16; i += 1) {
    const grupo = new THREE.Group();
    grupo.visible = false;
    scene.add(grupo);
    vivos.push({ grupo, tipo: "" });
  }
  return { banco, vivos };
}

function crearCono() {
  const grupo = new THREE.Group();
  const cono = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 1.05, 14),
    new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.55 }),
  );
  cono.position.y = 0.55;
  cono.castShadow = true;
  const banda = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff7ed }),
  );
  banda.position.y = 0.42;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: 0x9a3412 }),
  );
  base.position.y = 0.04;
  grupo.add(cono, banda, base);
  return grupo;
}

function crearCaja() {
  const grupo = new THREE.Group();
  const caja = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.9, 1.05),
    new THREE.MeshStandardMaterial({ map: texturaCaja(), roughness: 0.7 }),
  );
  caja.position.y = 0.48;
  caja.castShadow = true;
  caja.receiveShadow = true;
  grupo.add(caja);
  return grupo;
}

function texturaCaja() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 128;
  lienzo.height = 128;
  const g = lienzo.getContext("2d");
  g.fillStyle = "#d97706";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#78350f";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 112, 112);
  g.beginPath();
  g.moveTo(8, 64);
  g.lineTo(120, 64);
  g.moveTo(64, 8);
  g.lineTo(64, 120);
  g.stroke();
  g.fillStyle = "#fef3c7";
  g.font = "700 36px sans-serif";
  g.textAlign = "center";
  g.fillText("HR", 64, 78);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crearBarrera() {
  const grupo = new THREE.Group();
  const tabla = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.55, 0.28),
    new THREE.MeshStandardMaterial({ map: texturaBarrera(), roughness: 0.6 }),
  );
  tabla.position.y = 0.48;
  tabla.castShadow = true;
  const pata = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.4, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1f2937 }),
  );
  const izq = pata.clone();
  izq.position.set(-0.85, 0.2, 0);
  const der = pata.clone();
  der.position.set(0.85, 0.2, 0);
  grupo.add(tabla, izq, der);
  return grupo;
}

function texturaBarrera() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 256;
  lienzo.height = 64;
  const g = lienzo.getContext("2d");
  g.fillStyle = "#f8fafc";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#e11d48";
  for (let x = -20; x < 256; x += 36) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 18, 0);
    g.lineTo(x + 36, 64);
    g.lineTo(x + 18, 64);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function actualizarObstaculos(obs) {
  const lista = juego.mapa;
  for (let i = 0; i < obs.vivos.length; i += 1) {
    const vivo = obs.vivos[i];
    const dato = lista[i];
    if (!dato) {
      vivo.grupo.visible = false;
      continue;
    }
    const dist = delanteDe(dato.s);
    const z = -dist * ESCALA;
    const visible = dist > 4 && dist < 760;
    vivo.grupo.visible = visible;
    if (!visible) {
      continue;
    }
    if (vivo.tipo !== dato.tipo) {
      vivo.grupo.clear();
      vivo.grupo.add(obs.banco[dato.tipo].clone());
      vivo.tipo = dato.tipo;
    }
    vivo.grupo.position.set(ejeX(dato.x), 0, z);
  }
}
