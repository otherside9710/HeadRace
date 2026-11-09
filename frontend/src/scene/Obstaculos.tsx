import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Cone, RoundedBox } from "@react-three/drei";
import type { Group, Material, Mesh, MeshStandardMaterial } from "three";
import * as THREE from "three";
import { CENTROS_M } from "../game/carriles";
import { DURACION_DESTRUCCION_MS, ESCALA, carrera, delante, type Tipo } from "../game/carrera";

const CAJA = textura("#e08a2a", "HR");
const BARRERA = rayas();
const FRAGMENTOS = 10;
type AparienciaMaterial = { material: Material; opacity: number; transparent: boolean; depthWrite: boolean };

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
      const destruido = obs.destruidoAt !== undefined;
      const cuerpo = g.getObjectByName("cuerpo-obstaculo") as Group | undefined;
      if (destruido && g.userData.zDestruccion === undefined) g.userData.zDestruccion = z;
      if (!destruido) delete g.userData.zDestruccion;
      const zVisual = destruido ? Number(g.userData.zDestruccion) : z;
      g.visible = destruido ? zVisual < 2.8 && zVisual > -80 : z < -1.4 && z > -80;
      g.position.set(CENTROS_M[obs.carril], 0, zVisual);
      const destello = g.getObjectByName("destello-escudo") as Mesh | undefined;
      const onda = g.getObjectByName("onda-explosion") as Mesh | undefined;
      const flash = g.getObjectByName("flash-explosion") as Mesh | undefined;
      if (destruido) {
        const progreso = THREE.MathUtils.clamp((performance.now() - obs.destruidoAt!) / DURACION_DESTRUCCION_MS, 0, 1);
        let apariencias = cuerpo?.userData.apariencias as AparienciaMaterial[] | undefined;
        if (!apariencias) {
          apariencias = [];
          cuerpo?.traverse((objeto) => {
            const malla = objeto as Mesh;
            if (!malla.isMesh || !malla.material) return;
            const materiales = Array.isArray(malla.material) ? malla.material : [malla.material];
            materiales.forEach((material) => {
              apariencias?.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
            });
          });
          if (cuerpo) cuerpo.userData.apariencias = apariencias;
        }
        if (cuerpo) cuerpo.scale.setScalar(1 + Math.sin(progreso * Math.PI) * 0.12 - progreso * 0.32);
        apariencias?.forEach(({ material, opacity }) => {
          if (!material.transparent) {
            material.transparent = true;
            material.needsUpdate = true;
          }
          material.depthWrite = false;
          material.opacity = opacity * (1 - progreso) ** 1.25;
        });
        if (destello) {
          destello.visible = progreso < 0.82;
          destello.scale.setScalar(0.3 + progreso * 2.4);
          const material = destello.material as THREE.MeshBasicMaterial;
          material.opacity = 0.96 * (1 - progreso / 0.82);
        }
        if (onda) {
          onda.visible = progreso < 0.9;
          onda.scale.setScalar(0.32 + progreso * 3.6);
          (onda.material as THREE.MeshBasicMaterial).opacity = 0.88 * (1 - progreso / 0.9);
        }
        if (flash) {
          flash.visible = progreso < 0.2;
          flash.scale.setScalar(0.25 + progreso * 3.4);
          (flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progreso / 0.2);
        }
        for (let n = 0; n < FRAGMENTOS; n += 1) {
          const fragmento = g.getObjectByName(`fragmento-${n}`) as Mesh | undefined;
          if (!fragmento) continue;
          const angulo = (n / FRAGMENTOS) * Math.PI * 2 + obs.s * 0.13;
          const distancia = 0.24 + progreso * (1.2 + (n % 3) * 0.22);
          fragmento.visible = progreso < 0.96;
          fragmento.position.set(
            Math.cos(angulo) * distancia,
            0.3 + progreso * (0.92 + (n % 3) * 0.15) - progreso * progreso * 0.82,
            Math.sin(angulo) * distancia,
          );
          fragmento.rotation.set(progreso * (7 + n), progreso * (10 + n * 0.4), progreso * (8 - n * 0.3));
          fragmento.scale.setScalar(1 - progreso * 0.72);
          (fragmento.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - progreso * 1.05);
        }
      } else {
        if (cuerpo) cuerpo.scale.setScalar(1);
        const apariencias = cuerpo?.userData.apariencias as AparienciaMaterial[] | undefined;
        apariencias?.forEach(({ material, opacity, transparent, depthWrite }) => {
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
          material.opacity = opacity;
          material.depthWrite = depthWrite;
        });
        if (destello) destello.visible = false;
        if (onda) onda.visible = false;
        if (flash) flash.visible = false;
        for (let n = 0; n < FRAGMENTOS; n += 1) {
          const fragmento = g.getObjectByName(`fragmento-${n}`) as Mesh | undefined;
          if (fragmento) fragmento.visible = false;
        }
      }
    }
  });
  return (
    <group>
      {carrera.mapa.slice(0, cantidad).map((obs, i) => (
        <group key={`${obs.s}-${obs.carril}-${i}`} ref={(nodo) => { refs.current[i] = nodo; }}>
          <group name="cuerpo-obstaculo"><Cuerpo tipo={obs.tipo} /></group>
          <mesh name="destello-escudo" position={[0, 0.55, 0]} visible={false}>
            <icosahedronGeometry args={[0.62, 1]} />
            <meshBasicMaterial color="#ffe082" wireframe transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh name="onda-explosion" position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.72, 0.94, 48]} />
            <meshBasicMaterial color="#ff9e4a" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh name="flash-explosion" position={[0, 0.52, 0]} visible={false}>
            <sphereGeometry args={[0.42, 20, 14]} />
            <meshBasicMaterial color="#fff8d6" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {Array.from({ length: FRAGMENTOS }, (_, n) => (
            <mesh key={n} name={`fragmento-${n}`} visible={false} castShadow>
              <tetrahedronGeometry args={[0.15 + (n % 3) * 0.025, 0]} />
              <meshStandardMaterial
                color={n % 3 === 0 ? "#ff7138" : n % 3 === 1 ? "#ffd166" : "#4ce7f1"}
                emissive={n % 3 === 0 ? "#c53614" : n % 3 === 1 ? "#c17911" : "#087b94"}
                emissiveIntensity={2.4}
                transparent
                opacity={0}
                roughness={0.3}
                metalness={0.15}
              />
            </mesh>
          ))}
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
