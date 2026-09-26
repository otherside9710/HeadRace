import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Hud } from "./ui/Hud";
import { Mundo } from "./scene/Mundo";
import "./ui/hud.css";

export function App() {
  return (
    <div className="juego">
      <Canvas
        shadows
        gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        camera={{ position: [0, 1.62, 3.85], fov: 64, near: 0.1, far: 280 }}
        dpr={[1, 1.6]}
      >
        <Mundo />
      </Canvas>
      <Hud />
    </div>
  );
}
