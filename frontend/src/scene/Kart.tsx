import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, MeshPhysicalMaterial, MeshStandardMaterial, SpotLight } from "three";
import * as THREE from "three";
import { AVANCE, ESCALA, carrera, momento } from "../game/carrera";

const CARROCERIA = crearCarroceria();
const PONTON = crearPonton();
const TEXTURA_PINTURA = crearTexturaPintura();
const NORMAL_PINTURA = crearNormalPintura();
const CARBONO = new THREE.MeshStandardMaterial({ color: "#101923", roughness: 0.68, metalness: 0.32 });

function crearTexturaPintura() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const imagen = ctx.createImageData(canvas.width, canvas.height);
  let seed = 71829;
  for (let i = 0; i < imagen.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    imagen.data[i] = 14 + (seed & 7);
    imagen.data[i + 1] = 185 + ((seed >>> 3) & 15);
    imagen.data[i + 2] = 194 + ((seed >>> 7) & 15);
    imagen.data[i + 3] = 255;
  }
  ctx.putImageData(imagen, 0, 0);
  ctx.fillStyle = "#173952";
  ctx.fillRect(0.198 * canvas.width, 0, 0.018 * canvas.width, canvas.height);
  ctx.fillRect(0.284 * canvas.width, 0, 0.018 * canvas.width, canvas.height);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(0.218 * canvas.width, 0, 0.018 * canvas.width, canvas.height);
  ctx.fillRect(0.264 * canvas.width, 0, 0.018 * canvas.width, canvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0.239 * canvas.width, 0, 0.022 * canvas.width, canvas.height);
  ctx.fillStyle = "#263541";
  ctx.fillRect(0.232 * canvas.width, 0.76 * canvas.height, 0.036 * canvas.width, 0.16 * canvas.height);
  ctx.strokeStyle = "rgba(225,245,247,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0.232 * canvas.width, 0.76 * canvas.height, 0.036 * canvas.width, 0.16 * canvas.height);
  ctx.fillStyle = "#facc15";
  ctx.font = "700 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HR", 0.25 * canvas.width, 0.7 * canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function crearNormalPintura() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 49531;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = 126 + (seed & 3);
    data[i + 1] = 126 + ((seed >>> 3) & 3);
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function crearCarroceria() {
  const secciones = [
    [-1.38, 0.018, 0.024], [-1.2, 0.1, 0.055], [-0.94, 0.25, 0.095],
    [-0.64, 0.39, 0.13], [-0.25, 0.49, 0.16], [0.2, 0.54, 0.18],
    [0.58, 0.55, 0.18], [0.9, 0.55, 0.17], [1.12, 0.49, 0.15], [1.22, 0.34, 0.12],
    [1.26, 0.08, 0.06],
  ];
  const segmentos = 48;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  secciones.forEach(([z, ancho, alto], fila) => {
    for (let i = 0; i <= segmentos; i += 1) {
      const a = (i / segmentos) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      vertices.push(
        ancho * Math.sign(cos) * Math.abs(cos) ** 0.54,
        0.43 + alto * Math.sign(sin) * Math.abs(sin) ** 0.54,
        z,
      );
      uvs.push(i / segmentos, fila / (secciones.length - 1));
    }
  });
  for (let r = 0; r < secciones.length - 1; r += 1) {
    for (let i = 0; i < segmentos; i += 1) {
      const a = r * (segmentos + 1) + i;
      const b = a + 1;
      const c = (r + 1) * (segmentos + 1) + i + 1;
      const d = (r + 1) * (segmentos + 1) + i;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

function crearPonton() {
  const secciones = [
    [-1.0, 0.025, 0.035], [-0.76, 0.12, 0.08], [-0.42, 0.19, 0.13],
    [0.18, 0.19, 0.14], [0.56, 0.15, 0.11], [0.82, 0.025, 0.03],
  ];
  const lados = 32;
  const posiciones: number[] = [];
  const indices: number[] = [];
  secciones.forEach(([z, ancho, alto]) => {
    for (let i = 0; i <= lados; i += 1) {
      const a = (i / lados) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      posiciones.push(ancho * Math.sign(cos) * Math.abs(cos) ** 0.6, 0.39 + alto * Math.sign(sin) * Math.abs(sin) ** 0.6, z);
    }
  });
  for (let r = 0; r < secciones.length - 1; r += 1) {
    for (let i = 0; i < lados; i += 1) {
      const a = r * (lados + 1) + i;
      const b = a + 1;
      const c = (r + 1) * (lados + 1) + i + 1;
      const d = (r + 1) * (lados + 1) + i;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  geometry.computeVertexNormals();
  geometry.setIndex(indices);
  return geometry;
}

export function Kart() {
  const grupo = useRef<Group>(null);
  const pintura = useRef<MeshPhysicalMaterial>(null);
  const faros = useRef<MeshStandardMaterial[]>([]);
  const focos = useRef<SpotLight[]>([]);
  const destinos = useRef<Group[]>([]);

  useEffect(() => {
    focos.current.forEach((foco, i) => {
      const destino = destinos.current[i];
      if (foco && destino) foco.target = destino;
    });
  }, []);

  useFrame(() => {
    const g = grupo.current;
    if (!g) return;
    g.position.x = carrera.kartX;
    g.rotation.z = carrera.inclinacion;
    g.rotation.y = 0;
    pintura.current?.color.set(carrera.alert ? "#ff9c45" : "#ffffff");
    const noche = momento().noche;
    focos.current.forEach((foco) => { if (foco) foco.intensity = 280 * noche; });
    faros.current.forEach((lente) => {
      if (!lente) return;
      lente.emissiveIntensity = 0.4 + noche * 5;
      lente.color.set(noche > 0.08 ? "#fff8d8" : "#b8e9ef");
    });
  });

  return (
    <group ref={grupo} position={[0, 0, 0.2]}>
      {/* Carrocería de formas continuas: nariz baja, pontones y cubierta trasera. */}
      <mesh geometry={CARROCERIA} castShadow receiveShadow>
        <meshPhysicalMaterial
          ref={pintura}
          color="#14c8d0"
          map={TEXTURA_PINTURA}
          normalMap={NORMAL_PINTURA}
          normalScale={new THREE.Vector2(0.025, 0.025)}
          roughness={0.24}
          metalness={0.34}
          clearcoat={1}
          clearcoatRoughness={0.16}
        />
      </mesh>
      {[-0.51, 0.51].map((x) => (
        <mesh key={x} position={[x, 0, 0.2]} geometry={PONTON} castShadow receiveShadow>
          <meshPhysicalMaterial color="#087b91" roughness={0.3} metalness={0.34} clearcoat={0.88} clearcoatRoughness={0.18} />
        </mesh>
      ))}
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={x} position={[x, 0.61, 0.72 - i * 0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.018, 0.2, 4, 8]} />
          <primitive object={CARBONO} attach="material" />
        </mesh>
      ))}
      {[-1, 1].map((lado) => (
        <group key={`entrada-${lado}`}>
          <mesh position={[lado * 0.67, 0.43, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.028, 0.2, 5, 10]} />
            <primitive object={CARBONO} attach="material" />
          </mesh>
          <mesh position={[lado * 0.67, 0.43, 0.36]} rotation={[Math.PI / 2, 0, 0]} scale={[0.65, 0.65, 0.65]}>
            <capsuleGeometry args={[0.025, 0.19, 5, 10]} />
            <meshBasicMaterial color="#1dcbd0" />
          </mesh>
        </group>
      ))}

      {/* Cockpit envolvente y casco. */}
      <mesh position={[0, 0.63, 0.18]} scale={[0.35, 0.22, 0.48]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial color="#061b35" roughness={0.13} metalness={0.34} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0.86, 0.23]} scale={[0.19, 0.2, 0.2]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        <meshPhysicalMaterial color="#1646b8" roughness={0.22} clearcoat={0.9} />
      </mesh>
      <mesh position={[0, 0.91, 0.25]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.17, 0.025, 12, 32]} />
        <meshStandardMaterial color="#facc15" metalness={0.55} roughness={0.3} />
      </mesh>

      {/* Ala trasera con cantos redondeados y soportes inclinados. */}
      <RoundedBox args={[1.58, 0.1, 0.3]} radius={0.045} smoothness={4} position={[0, 1.02, 0.98]} castShadow>
        <meshPhysicalMaterial color="#087d96" roughness={0.24} metalness={0.25} clearcoat={0.85} />
      </RoundedBox>
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.82, 0.91]} rotation={[0.12, 0, x < 0 ? -0.12 : 0.12]} castShadow>
          <capsuleGeometry args={[0.035, 0.34, 6, 12]} />
          <meshStandardMaterial color="#a7c2cc" metalness={0.65} roughness={0.28} />
        </mesh>
      ))}

      <Rueda x={-0.82} z={0.62} escala={1.08} />
      <Rueda x={0.82} z={0.62} escala={1.08} />
      <Rueda x={-0.72} z={-0.91} escala={0.82} />
      <Rueda x={0.72} z={-0.91} escala={0.82} />

      {/* Faros frontales: los focos y lentes siguen el ciclo de iluminación. */}
      {[-0.39, 0.39].map((x, i) => (
        <group key={x}>
          <mesh position={[x, 0.49, -1.46]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.055, 32]} />
            <meshStandardMaterial ref={(m) => { if (m) faros.current[i] = m; }} color="#b8e9ef" emissive="#fff8d8" emissiveIntensity={0.4} metalness={0.12} roughness={0.18} />
          </mesh>
          <spotLight
            ref={(l) => { if (l) focos.current[i] = l; }}
            position={[x, 0.5, -1.46]}
            color="#d9efff"
            intensity={0}
            distance={52}
            angle={0.56}
            penumbra={0.8}
            decay={1.1}
          />
          <group ref={(g) => { if (g) destinos.current[i] = g; }} position={[x * 1.5, 0.12, -42]} />
        </group>
      ))}

      <RoundedBox args={[1.02, 0.13, 0.07]} radius={0.052} smoothness={5} position={[0, 0.46, 1.31]}>
        <meshStandardMaterial color="#07505e" metalness={0.58} roughness={0.3} />
      </RoundedBox>
      {[-0.38, 0.38].map((x) => (
        <RoundedBox key={x} args={[0.24, 0.072, 0.045]} radius={0.032} smoothness={5} position={[x, 0.49, 1.355]}>
          <meshStandardMaterial color="#ff3b4f" emissive="#ff1736" emissiveIntensity={2.1} roughness={0.2} />
        </RoundedBox>
      ))}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.3, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.045, 0.28, 20]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function Rueda({ x, z, escala }: { x: number; z: number; escala: number }) {
  const giro = useRef<Group>(null);
  const ranuras = useRef<THREE.InstancedMesh>(null);
  const geometriaRanura = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const matriz = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ranuras.current;
    if (!mesh) return;
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const lado = i % 2 === 0 ? -1 : 1;
      matriz.position.set(Math.sin(angle) * 0.34 * escala, lado * 0.048 * escala, Math.cos(angle) * 0.34 * escala);
      matriz.rotation.set(0, angle, lado * 0.18);
      matriz.scale.set(0.026 * escala, 0.13 * escala, 0.012 * escala);
      matriz.updateMatrix();
      mesh.setMatrixAt(i, matriz.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [escala, matriz]);
  useFrame((_, dt) => {
    if (!giro.current) return;
    const velocidad = Math.max(0, carrera.carSpeed) / 100 * AVANCE * ESCALA;
    giro.current.rotation.y += (velocidad / (0.34 * escala)) * dt;
  });
  return (
    <group position={[x, 0.34 * escala, z]} rotation={[0, 0, Math.PI / 2]}>
      <group ref={giro}>
        <mesh castShadow>
          <cylinderGeometry args={[0.34 * escala, 0.34 * escala, 0.25, 32]} />
          <meshStandardMaterial color="#101722" roughness={0.78} />
        </mesh>
        <instancedMesh ref={ranuras} args={[geometriaRanura, MATERIAL_RANURAS, 32]} />
        <mesh>
          <cylinderGeometry args={[0.2 * escala, 0.2 * escala, 0.265, 32]} />
          <meshStandardMaterial color="#b8c5d0" metalness={0.82} roughness={0.24} />
        </mesh>
        {[-1, 1].map((lado) => (
          <mesh key={lado} position={[0, lado * 0.14 * escala, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26 * escala, 0.018 * escala, 8, 32]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.78} roughness={0.24} />
          </mesh>
        ))}
        {[-1, 1].flatMap((lado) => Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          return (
            <mesh key={`${lado}-${i}`} position={[Math.sin(angle) * 0.135 * escala, lado * 0.14 * escala, Math.cos(angle) * 0.135 * escala]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.032 * escala, 0.018 * escala, 0.19 * escala]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.82} roughness={0.22} />
            </mesh>
          );
        }))}
        <mesh>
          <cylinderGeometry args={[0.075 * escala, 0.075 * escala, 0.28, 24]} />
          <meshStandardMaterial color="#526779" metalness={0.8} roughness={0.24} />
        </mesh>
      </group>
    </group>
  );
}

const MATERIAL_RANURAS = new THREE.MeshStandardMaterial({ color: "#344150", roughness: 0.92 });
