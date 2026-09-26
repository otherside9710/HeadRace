import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Cone, RoundedBox } from "@react-three/drei";
import type { Group, MeshStandardMaterial } from "three";
import * as THREE from "three";
import { CENTROS_M } from "../game/carriles";
import { ESCALA, carrera, delante, type Tipo } from "../game/carrera";

const CAJA = textura("#e08a2a", "HR");
const BARRERA = rayas();

function textura(fondo: string, texto: string) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = fondo;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#7c4a12";
  g.lineWidth = 8;
  g.strokeRect(10, 10, 108, 108);
  g.beginPath();
  g.moveTo(10, 64);
  g.lineTo(118, 64);
  g.moveTo(64, 10);
  g.lineTo(64, 118);
  g.stroke();
  g.fillStyle = "#fff7e6";
  g.font = "700 34px sans-serif";
  g.textAlign = "center";
  g.fillText(texto, 64, 76);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rayas() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#f8fafc";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#e11d48";
  for (let x = -16; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 16, 0);
    g.lineTo(x + 32, 64);
    g.lineTo(x + 16, 64);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Cuerpo({ tipo }: { tipo: Tipo }) {
  if (tipo === "cono") {
    return (
      <group>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.39, 0.09, 40, 1]} />
          <meshStandardMaterial color="#3b414b" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.31, 0.35, 0.045, 40]} />
          <meshStandardMaterial color="#f97316" roughness={0.58} />
        </mesh>
        <Cone args={[0.3, 1.02, 48]} position={[0, 0.56, 0]} castShadow>
          <meshStandardMaterial color="#f97316" roughness={0.52} metalness={0.03} />
        </Cone>
        <mesh position={[0, 0.365, 0]}>
          <cylinderGeometry args={[0.197, 0.223, 0.09, 48, 1, true]} />
          <meshStandardMaterial color="#fff5df" roughness={0.25} metalness={0.1} emissive="#fff1ca" emissiveIntensity={0.12} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.097, 0.12, 0.075, 48, 1, true]} />
          <meshStandardMaterial color="#fff5df" roughness={0.25} metalness={0.1} emissive="#fff1ca" emissiveIntensity={0.12} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  if (tipo === "caja") {
    return (
      <RoundedBox args={[1.02, 0.88, 1.02]} radius={0.14} smoothness={5} position={[0, 0.48, 0]} castShadow>
        <meshStandardMaterial map={CAJA} roughness={0.65} />
      </RoundedBox>
    );
  }
  return (
    <group>
      <RoundedBox args={[2.1, 0.52, 0.26]} radius={0.12} smoothness={5} position={[0, 0.48, 0]} castShadow>
        <meshStandardMaterial map={BARRERA} roughness={0.55} />
      </RoundedBox>
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 0.24, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Obstaculos() {
  const refs = useRef<(Group | null)[]>([]);
  const [cantidad, setCantidad] = useState(carrera.mapa.length);
  useFrame(() => {
    if (carrera.mapa.length !== cantidad) setCantidad(carrera.mapa.length);
    for (let i = 0; i < carrera.mapa.length; i += 1) {
      const g = refs.current[i];
      const obs = carrera.mapa[i];
      if (!g || !obs) continue;
      const z = -delante(obs.s) * ESCALA;
      g.visible = z < -1.4 && z > -80;
      g.position.set(CENTROS_M[obs.carril], 0, z);
    }
  });
  return (
    <group>
      {carrera.mapa.slice(0, cantidad).map((obs, i) => (
        <group key={`${obs.s}-${obs.carril}-${i}`} ref={(nodo) => { refs.current[i] = nodo; }}>
          <Cuerpo tipo={obs.tipo} />
        </group>
      ))}
    </group>
  );
}

export function colorAlerta(material: MeshStandardMaterial | null) {
  if (!material) return;
  material.color.set(carrera.alert ? "#f97316" : "#14c8d0");
  material.emissive.set(carrera.alert ? "#7c2d12" : "#000000");
}
