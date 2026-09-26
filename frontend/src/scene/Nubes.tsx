import { useFrame } from "@react-three/fiber";
import type { MeshBasicMaterial } from "three";
import { useRef } from "react";
import * as THREE from "three";
import { momento } from "../game/carrera";

const NUBE_TEX = crearTexturaNube();
const DIA = new THREE.Color("#fff7ed");
const ATARDECER = new THREE.Color("#f4b4a1");
const NOCHE = new THREE.Color("#202d4b");

function crearTexturaNube() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const imagen = ctx.createImageData(canvas.width, canvas.height);
  const lóbulos = [
    [0.15, 0.58, 0.14, 0.25, 0.72], [0.32, 0.46, 0.18, 0.34, 0.92],
    [0.54, 0.42, 0.2, 0.37, 0.95], [0.74, 0.52, 0.17, 0.3, 0.82],
    [0.9, 0.62, 0.09, 0.2, 0.56], [0.5, 0.68, 0.43, 0.18, 0.58],
  ];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const u = x / canvas.width;
      const v = y / canvas.height;
      let density = 0;
      for (const [cx, cy, rx, ry, strength] of lóbulos) {
        const dx = (u - cx) / rx;
        const dy = (v - cy) / ry;
        density += strength * Math.exp(-2.6 * (dx * dx + dy * dy));
      }
      const turbulence = Math.sin(u * 21 + Math.sin(v * 17) * 1.7) * Math.cos(v * 25 - u * 13) * 0.075
        + Math.sin((u * 2 + v) * 59) * Math.cos(v * 47 - u * 31) * 0.038
        + Math.sin((u - v) * 123 + Math.cos(v * 83)) * 0.014;
      const t = THREE.MathUtils.clamp((density + turbulence - 0.31) / 0.48, 0, 1);
      const alpha = t * t * (3 - 2 * t);
      const k = (y * canvas.width + x) * 4;
      const shade = 0.78 + 0.22 * (1 - v) + turbulence * 0.28;
      imagen.data[k] = Math.round(255 * shade);
      imagen.data[k + 1] = Math.round(255 * shade);
      imagen.data[k + 2] = Math.round(255 * Math.min(1, shade * 1.02));
      imagen.data[k + 3] = Math.round(alpha * 238);
    }
  }
  ctx.putImageData(imagen, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function Nubes() {
  const materiales = useRef<MeshBasicMaterial[]>([]);
  useFrame(() => {
    const fase = momento();
    materiales.current.forEach((material) => {
      material.color.copy(DIA).lerp(ATARDECER, fase.calor).lerp(NOCHE, fase.noche);
      material.opacity = THREE.MathUtils.lerp(0.88, 0.68, fase.noche);
    });
  });
  return (
    <group>
      <mesh position={[-17, 24, -42]} scale={[22, 7, 1]} rotation-y={-0.16}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={(material) => { if (material) materiales.current[0] = material; }} map={NUBE_TEX} color="#fff7ed" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[9, 22, -57]} scale={[19, 6, 1]} rotation-y={0.2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={(material) => { if (material) materiales.current[1] = material; }} map={NUBE_TEX} color="#fff7ed" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[32, 25, -39]} scale={[24, 7.5, 1]} rotation-y={-0.25}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={(material) => { if (material) materiales.current[2] = material; }} map={NUBE_TEX} color="#fff7ed" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
