import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh, ShaderMaterial } from "three";
import { momento } from "../game/carrera";

const CIELO_DIA = new THREE.Color("#2584d0");
const HORIZONTE_DIA = new THREE.Color("#b7ddf2");
const CIELO_TARDE = new THREE.Color("#687da9");
const HORIZONTE_TARDE = new THREE.Color("#f2af91");
const CIELO_NOCHE = new THREE.Color("#071126");
const HORIZONTE_NOCHE = new THREE.Color("#1a2d49");
const LUZ_SOL_DIA = new THREE.Color("#fff0c2");
const LUZ_SOL_TARDE = new THREE.Color("#ff9668");

const VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uNight;
  varying vec3 vDirection;
  void main() {
    vec3 direction = normalize(vDirection);
    float height = smoothstep(-0.14, 0.62, direction.y);
    vec3 color = mix(uHorizon, uZenith, height);
    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
    float halo = pow(sunDot, 18.0) * 0.12;
    color += uSunColor * halo * (1.0 - uNight);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function Cielo({ sol }: { sol: THREE.Vector3 }) {
  const domo = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const { camera } = useThree();
  const uniforms = useMemo(() => ({
    uZenith: { value: CIELO_DIA.clone() },
    uHorizon: { value: HORIZONTE_DIA.clone() },
    uSunDirection: { value: new THREE.Vector3(0.45, 0.6, -0.65) },
    uSunColor: { value: LUZ_SOL_DIA.clone() },
    uNight: { value: 0 },
  }), []);
  useFrame(() => {
    const cielo = material.current;
    if (!cielo) return;
    const fase = momento();
    cielo.uniforms.uZenith.value.copy(CIELO_DIA).lerp(CIELO_TARDE, fase.calor).lerp(CIELO_NOCHE, fase.noche);
    cielo.uniforms.uHorizon.value.copy(HORIZONTE_DIA).lerp(HORIZONTE_TARDE, fase.calor).lerp(HORIZONTE_NOCHE, fase.noche);
    cielo.uniforms.uSunDirection.value.copy(sol).normalize();
    cielo.uniforms.uSunColor.value.copy(LUZ_SOL_DIA).lerp(LUZ_SOL_TARDE, fase.calor);
    cielo.uniforms.uNight.value = fase.noche;
    // These uniforms are mutated outside React; force the shader material to upload them
    // so the dome cannot keep the previous phase after the night-to-day transition.
    cielo.uniformsNeedUpdate = true;
    domo.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={domo} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[250, 40, 24]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
