import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, ShaderMaterial } from "three";
import * as THREE from "three";
import { ESCALA, carrera, delante, momento } from "../game/carrera";

const AGUA = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#1aa6d6") },
    uShoreSide: { value: 0 },
    uNight: { value: 0 },
  },
  vertexShader: `
    uniform float uTime;
      varying float vOla;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying float vCresta;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        vUv = uv;
        float faseX = position.x * 0.075 + uTime * 0.38;
        float faseY = position.y * 0.052 - uTime * 0.31;
        float faseCorta = position.x * 0.21 + position.y * 0.13 + uTime * 0.62;
        float ondaLarga = sin(faseX) * 0.105 + cos(faseY) * 0.072;
        float ondaCorta = sin(faseCorta) * 0.022;
        vOla = ondaLarga + ondaCorta;
        vCresta = clamp((ondaLarga + 0.12) * 3.2, 0.0, 1.0);
        float pendienteX = cos(faseX) * 0.007875 + cos(faseCorta) * 0.00462;
        float pendienteY = -sin(faseY) * 0.003744 + cos(faseCorta) * 0.00286;
        vNormal = normalize(mat3(modelMatrix) * vec3(-pendienteX, -pendienteY, 1.0));
        p.z += vOla;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uShoreSide;
    uniform float uNight;
    varying float vOla;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vCresta;
    varying vec3 vNormal;
    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);
      float detailX = sin(vUv.x * 108.0 + sin(vUv.y * 34.0 + uTime * 1.1) * 1.6);
      float detailY = cos(vUv.y * 164.0 - sin(vUv.x * 47.0 + uTime * 0.8) * 1.4);
      normal = normalize(normal + vec3(detailX * 0.095, 0.0, detailY * 0.095));
      float fresnel = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), 2.4);
      float rippleA = sin(vUv.x * 142.0 + sin(vUv.y * 41.0 + uTime * 0.72) * 1.7 + uTime * 0.8);
      float rippleB = cos(vUv.y * 217.0 - uTime * 0.65 + sin(vUv.x * 57.0) * 1.2);
      float ripples = rippleA * rippleB;
      float reflected = pow(max(0.0, dot(reflect(-viewDir, normal), normalize(vec3(-0.18, 0.92, 0.36)))), 27.0);
      float glint = reflected * mix(0.7, 0.16, uNight)
        + pow(0.5 + 0.5 * ripples, 7.0) * mix(0.18, 0.035, uNight);
      float shoreDistance = mix(vUv.x, 1.0 - vUv.x, uShoreSide);
      float shoreBand = 1.0 - smoothstep(0.012, 0.09, shoreDistance);
      float foamNoise = 0.5 + 0.5 * sin(vUv.y * 198.0 + sin(vUv.x * 53.0) * 5.0 + uTime * 1.2 + rippleA * 0.6);
      float foam = shoreBand * smoothstep(0.38, 0.84, foamNoise) * mix(0.19, 0.075, uNight);
      vec3 reflectionTint = mix(vec3(0.34, 0.53, 0.64), vec3(0.035, 0.085, 0.16), uNight);
      vec3 color = uColor * (0.86 + ripples * 0.18 + vCresta * 0.045);
      color = mix(color, reflectionTint, fresnel * mix(0.42, 0.28, uNight));
      color += mix(vec3(0.8, 0.91, 0.96), vec3(0.15, 0.28, 0.43), uNight) * (glint * mix(0.68, 0.34, uNight));
      color += vec3(max(ripples, 0.0) * mix(0.07, 0.018, uNight));
      color = mix(color, mix(vec3(0.62, 0.79, 0.84), vec3(0.08, 0.16, 0.25), uNight), foam);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
const AGUA_DIA = new THREE.Color("#2c9ab6");
const AGUA_TARDE = new THREE.Color("#c27c75");
const AGUA_NOCHE = new THREE.Color("#071c30");
const ARENA_DIA = new THREE.Color("#d2bd92");
const ARENA_TARDE = new THREE.Color("#a9856e");
const ARENA_NOCHE = new THREE.Color("#1c2530");
const PASTO_DIA = new THREE.Color("#1f9a48");
const PASTO_TARDE = new THREE.Color("#a57842");
const PASTO_NOCHE = new THREE.Color("#183d35");
const HOJAS_DIA = new THREE.Color("#22a34a");
const HOJAS_TARDE = new THREE.Color("#b58245");
const HOJAS_NOCHE = new THREE.Color("#174b46");
const MAT_PASTO = new THREE.MeshStandardMaterial({ color: PASTO_DIA, roughness: 1 });
const MAT_ARENA = new THREE.MeshStandardMaterial({ color: ARENA_DIA, roughness: 0.96 });
const MAT_HOJAS = new THREE.MeshStandardMaterial({
  color: HOJAS_DIA,
  emissive: "#0a2410",
  emissiveIntensity: 0.22,
  roughness: 0.88,
  side: THREE.DoubleSide,
  vertexColors: true,
});
const FRONDAS_GEOMETRIAS = [
  crearFrondas(9, 2.05, 20, 0.92),
  crearFrondas(10, 2.25, 22, 1),
  crearFrondas(11, 2.12, 24, 1.08),
  crearFrondas(8, 2.38, 19, 0.96),
];
const COLOR_ROCA = new THREE.Color("#6e766d");

const SIERRAS = [
  { x: -28, z: -226, ancho: 310, alto: 43, fondo: 30, semilla: 1.1 },
  { x: 37, z: -198, ancho: 228, alto: 29, fondo: 19, semilla: 4.2 },
  { x: -113, z: -188, ancho: 112, alto: 21, fondo: 16, semilla: 7.3 },
].map((sierra) => ({ ...sierra, geometria: crearSierra(sierra.ancho, sierra.alto, sierra.fondo, sierra.semilla) }));

function crearFrondas(cantidad: number, largoMaximo: number, foliolos: number, inclinacion: number) {
  const vertices: number[] = [];
  const colores: number[] = [];
  const indices: number[] = [];
  const vértice = (r: number, y: number, lateral: number, ángulo: number, tono: number) => {
    const índice = vertices.length / 3;
    vertices.push(
      r * Math.cos(ángulo) - lateral * Math.sin(ángulo),
      y,
      -r * Math.sin(ángulo) - lateral * Math.cos(ángulo),
    );
    colores.push(tono, tono * 1.04, tono * 0.84);
    return índice;
  };
  for (let hoja = 0; hoja < cantidad; hoja += 1) {
    const ángulo = (hoja / cantidad) * Math.PI * 2 + cantidad * 0.037;
    const curva = (t: number) => largoMaximo * t;
    const altura = (t: number) => inclinacion * t * (1 - t) - 0.5 * t;
    const eje = vertices.length / 3;
    for (let i = 0; i <= 18; i += 1) {
      const t = i / 18;
      const r = curva(t);
      const y = altura(t);
      const ancho = 0.025 * (1 - t * 0.65);
      vértice(r, y - 0.012, -ancho, ángulo, 0.82);
      vértice(r, y + 0.045, 0, ángulo, 0.96);
      vértice(r, y - 0.012, ancho, ángulo, 0.82);
      if (i > 0) {
        const a = eje + (i - 1) * 3;
        const b = eje + i * 3;
        indices.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
      }
    }
    for (let i = 1; i <= foliolos; i += 1) {
      const t = 0.075 + (i / foliolos) * 0.84;
      const r = curva(t);
      const y = altura(t);
      const largo = 0.68 * Math.sin(Math.PI * t) ** 0.34 * (1 - t * 0.48);
      const caida = 0.23 + t * 0.16;
      for (const lado of [-1, 1]) {
        const tono = 0.78 + 0.12 * Math.sin(i * 1.7 + hoja * 2.3);
        const base = vertices.length / 3;
        vértice(r, y, 0, ángulo, tono);
        vértice(r + largo * 0.17, y - caida * 0.24, lado * largo * 0.58, ángulo, tono * 1.04);
        vértice(r + largo * 0.2, y - caida * 0.76, lado * largo * 0.92, ángulo, tono * 0.92);
        vértice(r + largo * 0.12, y - caida, lado * largo, ángulo, tono * 0.84);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

function crearSierra(ancho: number, alto: number, fondo: number, semilla: number) {
  const segmentosX = 180;
  const segmentosZ = 18;
  const vertices: number[] = [];
  const colores: number[] = [];
  const indices: number[] = [];
  const picos = [
    [-0.88, 0.35, 0.13], [-0.63, 0.66, 0.17], [-0.3, 0.5, 0.2],
    [-0.02, 0.91, 0.17], [0.25, 0.58, 0.22], [0.57, 0.78, 0.18], [0.86, 0.34, 0.16],
  ].map(([centro, h, anchoPico], i) => [
    centro + Math.sin(semilla + i * 2.1) * 0.055,
    h * (0.82 + 0.18 * Math.sin(semilla * 1.7 + i)),
    anchoPico * (1.18 + 0.35 * Math.sin(semilla + i * 3.2)),
  ]);
  const tonos = [new THREE.Color("#254b39"), new THREE.Color("#536f55"), COLOR_ROCA];
  for (let iz = 0; iz <= segmentosZ; iz += 1) {
    const profundidad = iz / segmentosZ;
    for (let ix = 0; ix <= segmentosX; ix += 1) {
      const x = ix / segmentosX * 2 - 1;
      let perfil = 0;
      for (const [centro, h, sigma] of picos) {
        const asimetria = x > centro ? 1.2 : 0.82;
        const d = (x - centro) / (sigma * asimetria);
        perfil += h * Math.exp(-d * d * 0.5);
      }
      const ruptura = 0.92 + 0.06 * Math.sin(x * 29 + semilla) + 0.025 * Math.sin(x * 71 - semilla * 2);
      const perfilSuave = perfil * ruptura * (1 - profundidad * 0.2);
      const ladera = 0.34 + 0.66 * (1 - profundidad) ** 0.72;
      const y = 0.35 + alto * perfilSuave * ladera;
      const z = -fondo * profundidad + Math.sin(x * 9 + semilla) * profundidad * 1.2;
      vertices.push(x * ancho * 0.5, y, z);
      const alturaRelativa = y / alto;
      const roca = THREE.MathUtils.smoothstep(alturaRelativa, 0.56, 0.86);
      const c = tonos[0].clone().lerp(tonos[1], THREE.MathUtils.smoothstep(alturaRelativa, 0.02, 0.38))
        .lerp(tonos[2], roca * 0.76);
      const luz = 0.9 + 0.1 * Math.sin(x * 17 + profundidad * 21 + semilla);
      colores.push(c.r * luz, c.g * luz, c.b * luz);
    }
  }
  for (let iz = 0; iz < segmentosZ; iz += 1) {
    for (let ix = 0; ix < segmentosX; ix += 1) {
      const a = iz * (segmentosX + 1) + ix;
      const b = a + 1;
      const c = b + segmentosX + 1;
      const d = a + segmentosX + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

export function Costa() {
  const palmas = useRef<(Group | null)[]>([]);
  const aguas = useRef<(ShaderMaterial | null)[]>([]);
  const marcas = useMemo(() => Array.from({ length: 28 }, (_, i) => i * 36), []);
  useFrame((_, dt) => {
    const c = momento();
    aguas.current.forEach((material) => {
      if (!material) return;
      material.uniforms.uTime.value += dt;
      material.uniforms.uColor.value.copy(AGUA_DIA).lerp(AGUA_TARDE, c.calor).lerp(AGUA_NOCHE, c.noche);
      material.uniforms.uNight.value = c.noche;
    });
    MAT_PASTO.color.copy(PASTO_DIA).lerp(PASTO_TARDE, c.calor).lerp(PASTO_NOCHE, c.noche);
    MAT_ARENA.color.copy(ARENA_DIA).lerp(ARENA_TARDE, c.calor).lerp(ARENA_NOCHE, c.noche);
    MAT_HOJAS.color.copy(HOJAS_DIA).lerp(HOJAS_TARDE, c.calor).lerp(HOJAS_NOCHE, c.noche);
    MAT_HOJAS.emissiveIntensity = 0.2 + c.noche * 0.12;
    marcas.forEach((marca, i) => {
      const palma = palmas.current[i];
      if (!palma) return;
      const dist = delante(marca);
      palma.visible = dist > 8 && dist < 780;
      const lado = i % 2 === 0 ? -1 : 1;
      palma.position.set(lado * (9.1 + (i % 4) * 0.42), 0, -dist * ESCALA);
      const viento = performance.now() * 0.00055 + i * 1.73;
      palma.rotation.z = Math.sin(carrera.s * 0.02 + i) * 0.012 + Math.sin(viento) * 0.006;
      const tronco = palma.children[0];
      const copa = tronco?.children[1];
      if (copa) {
        copa.rotation.z = Math.sin(viento) * 0.028;
        copa.rotation.x = Math.cos(viento * 0.78) * 0.018;
      }
    });
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, -80]} receiveShadow>
        <planeGeometry args={[30, 280]} />
        <primitive object={MAT_PASTO} attach="material" />
      </mesh>
      {[-1, 1].map((lado) => (
        <group key={lado}>
          <mesh rotation-x={-Math.PI / 2} position={[lado * 19, -0.045, -80]}>
            <planeGeometry args={[8, 280]} />
            <primitive object={MAT_ARENA} attach="material" />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[lado * 65, -0.045, -80]}>
            <planeGeometry args={[84, 360, 36, 72]} />
            <shaderMaterial
              ref={(material) => { aguas.current[lado < 0 ? 0 : 1] = material; }}
              uniforms={{
                uTime: { value: 0 },
                uColor: { value: AGUA_DIA.clone() },
                uShoreSide: { value: lado < 0 ? 1 : 0 },
                uNight: { value: 0 },
              }}
              vertexShader={AGUA.vertexShader}
              fragmentShader={AGUA.fragmentShader}
            />
          </mesh>
        </group>
      ))}
      {SIERRAS.map((sierra, i) => (
        <mesh key={i} geometry={sierra.geometria} position={[sierra.x, 0, sierra.z]} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.96} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {marcas.map((marca, i) => (
        <group key={marca} ref={(nodo) => { palmas.current[i] = nodo; }}>
        <Palmera escala={0.85 + (i % 3) * 0.12} semilla={i} />
        </group>
      ))}
      <Faro />
    </group>
  );
}

function Palmera({ escala, semilla }: { escala: number; semilla: number }) {
  return (
    <group scale={escala} rotation-y={semilla * 0.83}>
        <mesh position={[0.1, 1.7, 0]} rotation={[0, 0, 0.12 + Math.sin(semilla * 1.7) * 0.08]} castShadow>
        <cylinderGeometry args={[0.1, 0.2, 3.4, 20, 12]} />
        <meshStandardMaterial color="#755039" roughness={0.88} />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow={false} rotation-y={semilla * 0.41}>
        <primitive object={FRONDAS_GEOMETRIAS[semilla % FRONDAS_GEOMETRIAS.length]} attach="geometry" />
        <primitive object={MAT_HOJAS} attach="material" />
      </mesh>
    </group>
  );
}

function Faro() {
  const luz = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (luz.current) luz.current.emissiveIntensity = 0.2 + momento().noche * 2.4;
  });
  return (
    <group position={[26, 0, -52]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.68, 6, 12]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.7, 12]} />
        <meshStandardMaterial color="#e11d48" />
      </mesh>
      <mesh position={[0, 6.3, 0]}>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial ref={luz} color="#fef08a" emissive="#fef08a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
