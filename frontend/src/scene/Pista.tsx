import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ESCALA, carrera, momento } from "../game/carrera";

const LARGO = 200;
const ANCHO = 12;
const ASFALTO_DIA = new THREE.Color("#626773");
const ASFALTO_TARDE = new THREE.Color("#77615e");
const ASFALTO_NOCHE = new THREE.Color("#20283a");
const LINEAS_DIA = new THREE.Color("#ffffff");
const LINEAS_NOCHE = new THREE.Color("#b8d9ff");
const ESCALA_NORMAL = new THREE.Vector2(0.16, 0.16);

function crearBrazo(lado: number) {
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.7, 0),
    new THREE.Vector3(-lado * 0.08, 3.05, 0),
    new THREE.Vector3(-lado * 0.34, 3.22, 0),
    new THREE.Vector3(-lado * 0.64, 3.2, 0),
  ]);
  return new THREE.TubeGeometry(curva, 16, 0.046, 10, false);
}

const BRAZO_IZQUIERDO = crearBrazo(-1);
const BRAZO_DERECHO = crearBrazo(1);

function texturaLineas() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 256;
  lienzo.height = 512;
  const g = lienzo.getContext("2d");
  if (!g) return new THREE.CanvasTexture(lienzo);
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.fillRect(10, 0, 6, 512);
  g.fillRect(240, 0, 6, 512);
  const px = (metros: number) => ((metros + 6) / 12) * 256;
  for (const borde of [-2, 2]) {
    const x = px(borde);
    for (let y = 0; y < 512; y += 48) g.fillRect(x - 2, y, 4, 22);
  }
  g.fillStyle = "#e11d48";
  g.fillRect(0, 0, 8, 256);
  g.fillRect(248, 256, 8, 256);
  g.fillStyle = "#f8fafc";
  g.fillRect(0, 256, 8, 256);
  g.fillRect(248, 0, 8, 256);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function texturaAsfalto() {
  const size = 128;
  const alturas = new Uint8Array(size * size);
  let semilla = 92341;
  const aleatorio = () => {
    semilla = (semilla * 1664525 + 1013904223) >>> 0;
    return semilla / 4294967296;
  };
  for (let i = 0; i < alturas.length; i += 1) alturas[i] = 116 + Math.floor(aleatorio() * 28);

  const difuso = new Uint8Array(size * size * 4);
  const normales = new Uint8Array(size * size * 4);
  const rugosidad = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const izquierda = alturas[y * size + (x + size - 1) % size];
      const derecha = alturas[y * size + (x + 1) % size];
      const arriba = alturas[((y + size - 1) % size) * size + x];
      const abajo = alturas[((y + 1) % size) * size + x];
      const nx = THREE.MathUtils.clamp(128 - (derecha - izquierda) * 1.5, 0, 255);
      const ny = THREE.MathUtils.clamp(128 - (abajo - arriba) * 1.5, 0, 255);
      const d = i * 4;
      const gris = alturas[i];
      difuso.set([gris, gris, gris, 255], d);
      normales.set([nx, ny, 252, 255], d);
      const rugoso = 216 + (gris % 39);
      rugosidad.set([rugoso, rugoso, rugoso, 255], d);
    }
  }
  const crear = (data: Uint8Array, colorSpace: THREE.ColorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 64);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    map: crear(difuso, THREE.SRGBColorSpace),
    normalMap: crear(normales),
    roughnessMap: crear(rugosidad),
  };
}

export function Pista() {
  const lineas = useMemo(() => texturaLineas(), []);
  const asfaltoMapas = useMemo(() => texturaAsfalto(), []);
  const asfalto = useRef<THREE.MeshStandardMaterial>(null);
  const pintura = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    lineas.offset.y = -((carrera.s * ESCALA) / LARGO) * 14;
    const fase = momento();
    if (asfalto.current) {
      asfalto.current.color.copy(ASFALTO_DIA).lerp(ASFALTO_TARDE, fase.calor).lerp(ASFALTO_NOCHE, fase.noche);
      asfalto.current.roughness = THREE.MathUtils.lerp(0.78, 0.9, fase.noche);
    }
    if (pintura.current) pintura.current.color.copy(LINEAS_DIA).lerp(LINEAS_NOCHE, fase.noche * 0.64);
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -LARGO / 2 + 8]} receiveShadow>
        <planeGeometry args={[ANCHO, LARGO]} />
        <meshStandardMaterial
          ref={asfalto}
          map={asfaltoMapas.map}
          normalMap={asfaltoMapas.normalMap}
          normalScale={ESCALA_NORMAL}
          roughnessMap={asfaltoMapas.roughnessMap}
          roughness={0.82}
          color="#626773"
          metalness={0.06}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -LARGO / 2 + 8]}>
        <planeGeometry args={[ANCHO, LARGO]} />
        <meshBasicMaterial ref={pintura} map={lineas} transparent depthWrite={false} />
      </mesh>
      <LucesPista />
      {[-1, 1].map((lado) => (
        <group key={lado} position={[lado * (ANCHO / 2 + 0.45), 0, 0]}>
          <mesh position={[0, 0.55, -70]} castShadow>
            <boxGeometry args={[0.12, 0.1, 160]} />
            <meshStandardMaterial color="#d5dee8" metalness={0.7} roughness={0.28} />
          </mesh>
          {Array.from({ length: 28 }, (_, i) => (
            <mesh key={i} position={[0, 0.28, 6 - i * 6]} castShadow>
              <boxGeometry args={[0.08, 0.55, 0.08]} />
              <meshStandardMaterial color="#c5d0dc" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function LucesPista() {
  const bombillas = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const focos = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(() => {
    const noche = momento().noche;
    for (let i = 0; i < 8; i += 1) {
      const intensidad = THREE.MathUtils.smoothstep(noche, 0.18, 0.85);
      if (bombillas.current[i]) bombillas.current[i]!.emissiveIntensity = intensidad * 3.2;
      if (focos.current[i]) focos.current[i]!.intensity = intensidad * 2.2;
    }
  });
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const lado = i % 2 === 0 ? -1 : 1;
      const z = -18 - Math.floor(i / 2) * 35;
      const indice = i;
      const brazoX = -lado * 0.64;
      return (
        <group key={i} position={[lado * 6.8, 0, z]}>
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.18, 0.22, 24]} />
            <meshStandardMaterial color="#273442" metalness={0.65} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <cylinderGeometry args={[0.095, 0.11, 0.06, 20]} />
            <meshStandardMaterial color="#81909d" metalness={0.78} roughness={0.28} />
          </mesh>
          <mesh position={[0, 1.58, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.095, 3.05, 16, 8]} />
            <meshStandardMaterial color="#354556" metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh geometry={lado < 0 ? BRAZO_IZQUIERDO : BRAZO_DERECHO} castShadow>
            <meshStandardMaterial color="#455768" metalness={0.76} roughness={0.29} />
          </mesh>
          <mesh position={[brazoX, 3.15, 0]} rotation-z={Math.PI / 2} castShadow>
            <capsuleGeometry args={[0.105, 0.34, 8, 16]} />
            <meshPhysicalMaterial color="#263646" metalness={0.72} roughness={0.25} clearcoat={0.5} />
          </mesh>
          <mesh position={[brazoX, 3.065, 0]} rotation-z={Math.PI / 2}>
            <capsuleGeometry args={[0.064, 0.27, 8, 16]} />
            <meshStandardMaterial
              ref={(material) => { bombillas.current[indice] = material; }}
              color="#dbeafe"
              emissive="#bfdbfe"
              emissiveIntensity={0}
              roughness={0.24}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            ref={(light) => { focos.current[indice] = light; }}
            position={[brazoX, 3.02, 0]}
            color="#b8d9ff"
            intensity={0}
            distance={18}
            decay={2}
          />
        </group>
      );
      })}
    </group>
  );
}
