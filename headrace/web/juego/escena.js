import * as THREE from "three";
import { clima, juego, lateral } from "./estado.js";

export function crearEscena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fd6f5, 55, 175);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 280);
  const ambiente = new THREE.HemisphereLight(0xcfefff, 0x3d6b45, 0.55);
  const sol = new THREE.DirectionalLight(0xfff4d2, 1.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.near = 8;
  sol.shadow.camera.far = 80;
  sol.shadow.camera.left = -16;
  sol.shadow.camera.right = 16;
  sol.shadow.camera.top = 16;
  sol.shadow.camera.bottom = -16;
  sol.shadow.bias = -0.0008;
  scene.add(sol.target);
  const luna = new THREE.DirectionalLight(0xb7c7ff, 0);
  const solMalla = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false }),
  );
  const lunaMalla = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8eeff }),
  );
  const estrellas = crearEstrellas();
  const cieloLienzo = document.createElement("canvas");
  cieloLienzo.width = 4;
  cieloLienzo.height = 256;
  const cieloTex = new THREE.CanvasTexture(cieloLienzo);
  cieloTex.colorSpace = THREE.SRGBColorSpace;
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(150, 28, 18),
    new THREE.MeshBasicMaterial({ map: cieloTex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  scene.add(cielo);

  function ajustar() {
    const ancho = canvas.clientWidth || window.innerWidth;
    const alto = canvas.clientHeight || window.innerHeight;
    camera.aspect = ancho / Math.max(1, alto);
    camera.updateProjectionMatrix();
    renderer.setSize(ancho, alto, false);
  }
  ajustar();
  window.addEventListener("resize", ajustar);

  scene.add(ambiente, sol, luna, solMalla, lunaMalla, estrellas);

  return { renderer, scene, camera, ambiente, sol, luna, solMalla, lunaMalla, estrellas, cieloLienzo, cieloTex, ajustar };
}

function crearEstrellas() {
  const n = 280;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.2 + Math.random() * 1.1;
    const r = 90 + Math.random() * 40;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - 20;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0 });
  return new THREE.Points(geo, mat);
}

export function colorDe(rgb) {
  return new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
}

export function aplicarCiclo(mundo) {
  const c = clima();
  const t = juego.hora;
  const noche = c.noche;
  let elevacion = 1.05;
  let azimut = -0.4;
  if (t < 0.5) {
    elevacion = 1.15 - t * 2.1;
    azimut = -0.5 + t * 1.4;
  } else if (t > 0.82) {
    const u = (t - 0.82) / 0.18;
    elevacion = 0.12 + u * 0.95;
    azimut = 0.9 - u * 0.4;
  } else {
    elevacion = 0.45;
    azimut = 1.1;
  }
  const dist = 70;
  const y = Math.max(4, Math.sin(elevacion) * dist);
  const x = Math.cos(elevacion) * Math.sin(azimut) * dist;
  mundo.solMalla.position.set(x * 0.35 + 18, Math.max(8, y * 0.45), -55);
  mundo.sol.position.copy(mundo.solMalla.position);
  mundo.sol.target.position.set(0, 0, -12);
  mundo.sol.intensity = 1.75 * (1 - noche) + 0.08;
  mundo.sol.color.set(noche > 0.45 ? 0xffb46a : 0xfff3cf);
  mundo.solMalla.visible = noche < 0.72 && (t < 0.56 || t > 0.8);
  mundo.lunaMalla.position.set(-x * 0.45, 28 + noche * 12, -36);
  mundo.luna.position.copy(mundo.lunaMalla.position);
  mundo.luna.intensity = 0.45 * noche;
  mundo.lunaMalla.visible = noche > 0.25;
  mundo.estrellas.material.opacity = Math.max(0, noche - 0.15);
  mundo.ambiente.intensity = 0.62 - noche * 0.28;
  mundo.scene.fog.color.copy(colorDe(c.crudo.bot));
  mundo.renderer.toneMappingExposure = 1.12 - noche * 0.28;
  pintarCielo(mundo, c);
  return c;
}

function pintarCielo(mundo, c) {
  const g = mundo.cieloLienzo.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  grad.addColorStop(0, css(c.crudo.top));
  grad.addColorStop(0.55, css(c.crudo.mid));
  grad.addColorStop(1, css(c.crudo.bot));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  mundo.cieloTex.needsUpdate = true;
  mundo.scene.background = null;
}

export function actualizarCamara(camera, ahora) {
  const pos = lateral();
  const vel = Math.max(0, Math.min(1, juego.estado.car_speed / 100));
  let sx = 0;
  let sy = 0;
  if (ahora < juego.shakeHasta) {
    const k = (juego.shakeHasta - ahora) / 280;
    sx = Math.sin(ahora * 0.09) * 0.18 * k;
    sy = Math.cos(ahora * 0.13) * 0.08 * k;
  }
  const deseada = new THREE.Vector3(pos * 0.008 + sx, 1.72 + sy, 4.15);
  camera.position.lerp(deseada, 0.14);
  camera.lookAt(pos * 0.012, 0.48, -16);
  camera.rotateZ(-pos * 0.0014);
  const fov = 66 + vel * 6;
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
