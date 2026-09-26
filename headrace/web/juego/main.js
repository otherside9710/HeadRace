import { colorDe, crearEscena, aplicarCiclo, actualizarCamara } from "./escena.js";
import { crearCarretera, actualizarCarretera } from "./carretera.js";
import { crearKart, actualizarKart } from "./kart.js";
import { crearObstaculos, actualizarObstaculos } from "./obstaculos.js";
import { crearEntorno, actualizarEntorno } from "./entorno.js";
import { crearParticulas, actualizarParticulas } from "./particulas.js";
import { actualizarInterfaz } from "./interfaz.js";
import { actualizarAviso, avanzar, cargarHistorial } from "./sesion.js";
import { avanzarHora } from "./estado.js";

const canvas = document.getElementById("pista");
const mundo = crearEscena(canvas);
const carretera = crearCarretera(mundo.scene);
const kart = crearKart(mundo.scene);
const obstaculos = crearObstaculos(mundo.scene);
const entorno = crearEntorno(mundo.scene);
const particulas = crearParticulas(mundo.scene);

function frame(ahora) {
  const dt = avanzar(ahora);
  avanzarHora(dt);
  const c = aplicarCiclo(mundo);
  actualizarCarretera(carretera, colorDe(c.crudo.pasto));
  actualizarEntorno(entorno, c);
  actualizarObstaculos(obstaculos);
  actualizarKart(kart, c.noche);
  actualizarParticulas(particulas, dt);
  actualizarCamara(mundo.camera, ahora);
  mundo.renderer.render(mundo.scene, mundo.camera);
  actualizarInterfaz();
  actualizarAviso();
  requestAnimationFrame(frame);
}

cargarHistorial();
requestAnimationFrame(frame);
