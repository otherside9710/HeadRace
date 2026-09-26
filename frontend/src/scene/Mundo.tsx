import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  BrightnessContrast,
  SSAO,
  DepthOfField,
  ToneMapping,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import { avanzar, avanzarAmbiente, carrera, momento } from "../game/carrera";
import { Pista } from "./Pista";
import { Kart } from "./Kart";
import { Obstaculos } from "./Obstaculos";
import { Costa } from "./Costa";
import { Cielo } from "./Cielo";
import { Nubes } from "./Nubes";

const DIA_CIELO = new THREE.Color("#8fd4f8");
const TARDE_CIELO = new THREE.Color("#f39a86");
const NOCHE_CIELO = new THREE.Color("#111b38");
const DIA_NIEBLA = new THREE.Color("#9ec8ea");
const TARDE_NIEBLA = new THREE.Color("#d88983");
const NOCHE_NIEBLA = new THREE.Color("#17213e");
const DIA_LUZ = new THREE.Color("#e7f6ff");
const TARDE_LUZ = new THREE.Color("#ffd0a0");
const NOCHE_LUZ = new THREE.Color("#7388d5");
const SUELO_DIA = new THREE.Color("#3d8f55");
const SUELO_NOCHE = new THREE.Color("#1b2848");
const COLOR_SOL_DIA = new THREE.Color("#fff1d1");
const COLOR_SOL_TARDE = new THREE.Color("#ff9b68");
const ABERRACION_LENTE = new THREE.Vector2(0.00006, 0.00006);
const INTENSIDAD_AMBIENTE_DIA = 0.62;
const INTENSIDAD_AMBIENTE_NOCHE = 0.2;

export function Mundo() {
  const { camera, scene } = useThree();
  const rafagas = useRef<Group>(null);
  const sol = useRef<Mesh>(null);
  const luna = useRef<Mesh>(null);
  const estrellas = useRef<THREE.Points>(null);
  const destinoCamara = useRef(new THREE.Vector3());
  const fondo = useRef<THREE.Color>(null);
  const niebla = useRef<THREE.Fog>(null);
  const hemisferica = useRef<THREE.HemisphereLight>(null);
  const luzSolar = useRef<THREE.DirectionalLight>(null);
  const luzLunar = useRef<THREE.DirectionalLight>(null);
  const direccionSol = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    const ahora = performance.now();
    avanzar(ahora);
    avanzarAmbiente(delta);
    const fase = momento();
    scene.environmentIntensity = THREE.MathUtils.lerp(INTENSIDAD_AMBIENTE_DIA, INTENSIDAD_AMBIENTE_NOCHE, fase.noche);
    const t = fase.hora;
    const elevacion = elevacionSolar(t);
    const dx = Math.cos((t - 0.25) * Math.PI * 2);
    const solPos = direccionSol.current.set(dx * 55, elevacion, -42).normalize().multiplyScalar(75);
    if (fondo.current) {
      fondo.current.copy(DIA_CIELO).lerp(TARDE_CIELO, fase.calor).lerp(NOCHE_CIELO, fase.noche);
    }
    if (niebla.current) {
      niebla.current.color.copy(DIA_NIEBLA).lerp(TARDE_NIEBLA, fase.calor).lerp(NOCHE_NIEBLA, fase.noche);
      niebla.current.near = THREE.MathUtils.lerp(105, 52, fase.noche);
      niebla.current.far = THREE.MathUtils.lerp(310, 180, fase.noche);
    }
    if (hemisferica.current) {
      hemisferica.current.color.copy(DIA_LUZ).lerp(TARDE_LUZ, fase.calor).lerp(NOCHE_LUZ, fase.noche);
      hemisferica.current.groundColor.copy(SUELO_DIA).lerp(SUELO_NOCHE, fase.noche);
      hemisferica.current.intensity = THREE.MathUtils.lerp(0.86, 0.46, fase.noche) + fase.calor * 0.08;
    }
    if (luzSolar.current) {
      luzSolar.current.position.copy(solPos);
      luzSolar.current.color.copy(COLOR_SOL_DIA).lerp(COLOR_SOL_TARDE, fase.calor);
      luzSolar.current.intensity = (1.65 * (1 - fase.noche) + 0.08) * (1 - fase.noche * 0.92);
    }
    if (luzLunar.current) luzLunar.current.intensity = 1.05 * fase.noche;
    if (sol.current) {
      sol.current.position.copy(solPos).multiplyScalar(0.82);
      sol.current.visible = fase.noche < 0.8;
      sol.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.58, fase.noche));
    }
    if (luna.current) {
      luna.current.position.copy(solPos).multiplyScalar(-0.72);
      luna.current.visible = fase.noche > 0.08;
      (luna.current.material as THREE.MeshBasicMaterial).opacity = fase.noche;
    }
    if (estrellas.current) {
      estrellas.current.traverse((objeto) => {
        const material = (objeto as THREE.Points).material;
        if (material && "opacity" in material) {
          const puntos = material as THREE.PointsMaterial;
          puntos.transparent = true;
          puntos.opacity = fase.noche;
        }
      });
    }
    const x = carrera.kartX;
    let sx = 0;
    let sy = 0;
    if (ahora < carrera.shakeHasta) {
      const k = (carrera.shakeHasta - ahora) / 280;
      sx = Math.sin(ahora * 0.09) * 0.16 * k;
      sy = Math.cos(ahora * 0.12) * 0.07 * k;
    }
    const vel = Math.max(0, Math.min(1, carrera.carSpeed / 100));
    camera.position.lerp(destinoCamara.current.set(x * 0.55 + sx + 0.62, 1.62 + sy, 3.85 + vel * 0.2), 0.18);
    camera.lookAt(x * 0.28 + 0.08, 0.55, -14);
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = 64 + vel * 4;
      if (Math.abs(camera.fov - fov) > 0.02) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      camera.rotation.z = -carrera.inclinacion * 0.045;
    }
    if (rafagas.current) {
      rafagas.current.visible = vel > 0.4;
      rafagas.current.children.forEach((pieza, i) => {
        pieza.position.z += 0.35 + vel * 0.8;
        if (pieza.position.z > 2) pieza.position.z = -18 - (i % 5);
      });
    }
  });
  return (
    <>
      <color ref={fondo} attach="background" args={["#8fd4f8"]} />
      <fog ref={niebla} attach="fog" args={["#9ec8ea", 70, 210]} />
      <hemisphereLight ref={hemisferica} args={["#e7f6ff", "#3d8f55", 0.78]} />
      <directionalLight
        ref={luzSolar}
        position={[20, 45, -40]}
        intensity={1.65}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-radius={5}
      />
      <directionalLight ref={luzLunar} position={[-25, 28, -35]} color="#aebfff" intensity={0} />
      <Cielo sol={direccionSol.current} />
      <Environment files="/assets/secluded_beach_1k.hdr" background={false} environmentIntensity={INTENSIDAD_AMBIENTE_DIA} />
      <Stars ref={estrellas} radius={115} depth={42} count={650} factor={3.2} saturation={0.08} fade speed={0.12} />
      <mesh ref={sol}>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial color="#fff0c2" toneMapped={false} />
      </mesh>
      <mesh ref={luna}>
        <sphereGeometry args={[1.35, 24, 24]} />
        <meshBasicMaterial color="#e5edff" transparent opacity={0} toneMapped={false} />
      </mesh>
      <Nubes />
      <Costa />
      <Pista />
      <Obstaculos />
      <Kart />
      <group ref={rafagas}>
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i} position={[(i % 8) - 4, 0.2, -i]}>
            <boxGeometry args={[0.04, 0.012, 1.3]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
      <EffectComposer enableNormalPass resolutionScale={0.5} multisampling={0}>
        <SSAO
          samples={8}
          rings={3}
          radius={2.2}
          intensity={1.1}
          worldDistanceThreshold={28}
          worldDistanceFalloff={10}
          worldProximityThreshold={3}
          worldProximityFalloff={1}
          resolutionScale={0.5}
        />
        <DepthOfField focusDistance={0.016} focalLength={0.014} bokehScale={0.12} resolutionScale={0.7} />
        <Bloom intensity={0.3} luminanceThreshold={0.82} mipmapBlur />
        <BrightnessContrast brightness={0.015} contrast={0.08} />
        <ChromaticAberration offset={ABERRACION_LENTE} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.2} darkness={0.42} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

function elevacionSolar(t: number) {
  const clave = [
    [0, 24], [0.12, 48], [0.36, 55], [0.52, 34], [0.6, 2], [0.76, -28],
    [0.86, -14], [0.94, 8], [1, 24],
  ] as const;
  for (let i = 1; i < clave.length; i += 1) {
    const [t1, y1] = clave[i - 1];
    const [t2, y2] = clave[i];
    if (t <= t2) {
      const u = THREE.MathUtils.smoothstep(t, t1, t2);
      return THREE.MathUtils.lerp(y1, y2, u);
    }
  }
  return 18;
}
