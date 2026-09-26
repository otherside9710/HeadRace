import {
  CENTROS_M,
  MAPA_BASE,
  N_CARRILES,
  RADIO_M,
  REACCION,
  centroCarril,
  distanciaPista,
  elegirSpawn,
  pasoLateral,
  type ObsCarril,
} from "./carriles";

const fallos: string[] = [];

function ok(nombre: string, condicion: boolean, detalle: string) {
  if (!condicion) fallos.push(`${nombre}: ${detalle}`);
  else console.log(`ok  ${nombre}`);
}

function centrado(obs: ObsCarril) {
  return obs.carril >= 0 && obs.carril < N_CARRILES && centroCarril(obs.carril) === CENTROS_M[obs.carril];
}

function sinPared(mapa: ObsCarril[]) {
  for (const obs of mapa) {
    const ocupados = new Set(mapa.filter((otro) => distanciaPista(otro.s, obs.s) < REACCION).map((otro) => otro.carril));
    if (ocupados.size === N_CARRILES) return false;
  }
  return true;
}

function testSpawn() {
  const base = MAPA_BASE.map((obs) => ({ ...obs }));
  ok("base centrada", base.every(centrado), "el mapa inicial no está en centros de carril");
  ok("base sin pared", sinPared(base), "el mapa inicial tapa los tres carriles");
  let mapa: ObsCarril[] = [];
  for (let i = 0; i < 20; i += 1) {
    const nuevo = elegirSpawn(mapa, i * 37, Math.random);
    if (!nuevo) {
      fallos.push("spawn: no cupo un obstáculo sin tapar la pista");
      return;
    }
    mapa = [...mapa, nuevo];
  }
  ok("20 centrados", mapa.length === 20 && mapa.every(centrado), `generados ${mapa.length}`);
  ok(
    "20 en centro exacto",
    mapa.every((obs) => centroCarril(obs.carril) === CENTROS_M[obs.carril as 0 | 1 | 2]),
    "x fuera de CENTROS_M",
  );
  ok("20 sin pared", sinPared(mapa), "un tramo quedó sin carril libre");
  let lleno = base.map((obs) => ({ ...obs }));
  for (let i = 0; i < 30; i += 1) {
    const nuevo = elegirSpawn(lleno, 0, Math.random);
    if (!nuevo) break;
    lleno = [...lleno, nuevo];
  }
  ok("mapa lleno sigue sin pared", sinPared(lleno) && lleno.every(centrado), `total ${lleno.length}`);
}

function simular(cabezas: number[], dt: number) {
  let x = 0;
  let vel = 0;
  let carril = 1;
  const muestras: { x: number; carril: number; t: number }[] = [];
  let t = 0;
  for (const carX of cabezas) {
    const paso = pasoLateral(x, vel, carril, carX, true, dt);
    const salto = Math.abs(paso.x - x);
    muestras.push({ x: paso.x, carril: paso.carril, t });
    if (salto > ANCHO_SEGURO) fallos.push(`teletransporte ${salto.toFixed(3)} m en un frame`);
    x = paso.x;
    vel = paso.vel;
    carril = paso.carril;
    t += dt;
  }
  return { x, vel, carril, muestras };
}

const ANCHO_SEGURO = 1.6;

function tiempoHasta(cabeza: number, meta: number) {
  let x = 0;
  let vel = 0;
  let carril = 1;
  const dt = 1 / 60;
  for (let t = 0; t < 2; t += dt) {
    const paso = pasoLateral(x, vel, carril, cabeza, true, dt);
    x = paso.x;
    vel = paso.vel;
    carril = paso.carril;
    if (Math.abs(x - meta) < 0.2) return t + dt;
  }
  return 99;
}

function testMovimiento() {
  const izquierda = tiempoHasta(-40, -4);
  ok("test2 tiempo izquierda", izquierda >= 0.25 && izquierda <= 0.5, `t=${izquierda.toFixed(3)}s`);
  const lenta = simular(Array.from({ length: 90 }, (_, i) => -Math.min(40, i * 0.8)), 1 / 60);
  ok("test2 llega izquierda", lenta.carril === 0 && lenta.x < -3.5, `x=${lenta.x.toFixed(2)} carril=${lenta.carril}`);
  ok("test2 inclinación vuelve", Math.abs(lenta.muestras[lenta.muestras.length - 1] ? 0 : 1) === 0, "muestra vacía");

  const derecha = tiempoHasta(40, 4);
  ok("test3 tiempo derecha", derecha >= 0.25 && derecha <= 0.5, `t=${derecha.toFixed(3)}s`);
  const aDerecha = simular(Array.from({ length: 90 }, () => 40), 1 / 60);
  ok("test3 llega derecha", aDerecha.carril === 2 && aDerecha.x > 3.5, `x=${aDerecha.x.toFixed(2)}`);

  let x = -4;
  let vel = 0;
  let carril = 0;
  let cruzoCentro = false;
  let maxSalto = 0;
  for (let i = 0; i < 80; i += 1) {
    const paso = pasoLateral(x, vel, carril, 80, true, 1 / 60);
    maxSalto = Math.max(maxSalto, Math.abs(paso.x - x));
    if (x < 0 && paso.x >= 0) cruzoCentro = true;
    x = paso.x;
    vel = paso.vel;
    carril = paso.carril;
  }
  ok("test4 sin teletransporte", maxSalto < ANCHO_SEGURO, `salto=${maxSalto.toFixed(3)}`);
  ok("test4 atraviesa el centro", cruzoCentro && x > 3.5, `x=${x.toFixed(2)} cruzo=${cruzoCentro}`);

  const centro = simular(Array.from({ length: 120 }, () => 0), 1 / 60);
  ok("test5 centrado", centro.carril === 1 && Math.abs(centro.x) < 0.05, `x=${centro.x.toFixed(3)} carril=${centro.carril}`);

  const wobble = simular(Array.from({ length: 180 }, (_, i) => (i % 2 === 0 ? 6 : -7)), 1 / 60);
  ok("test6 sin oscilar", wobble.carril === 1 && Math.abs(wobble.x) < 0.2, `x=${wobble.x.toFixed(3)} carril=${wobble.carril}`);

  let estado = pasoLateral(0, 0, 1, -40, true, 1 / 60);
  for (let i = 0; i < 40; i += 1) estado = pasoLateral(estado.x, estado.vel, estado.carril, -40, true, 1 / 60);
  const carrilesVistos = new Set<number>();
  for (let i = 0; i < 30; i += 1) {
    const cabeza = i % 2 === 0 ? -18 : -12;
    estado = pasoLateral(estado.x, estado.vel, estado.carril, cabeza, true, 1 / 60);
    carrilesVistos.add(estado.carril);
  }
  ok("histéresis en el borde", carrilesVistos.size === 1 && estado.carril === 0, `carriles=${[...carrilesVistos].join(",")}`);

  const asentado = simular(Array.from({ length: 80 }, () => -40), 1 / 60);
  const quieto = pasoLateral(asentado.x, asentado.vel, asentado.carril, -40, true, 1 / 60);
  ok("inclinación en reposo", Math.abs(quieto.inclinacion) < 0.01, `incl=${quieto.inclinacion.toFixed(4)}`);

  const mismo = Math.abs(centroCarril(0) - centroCarril(0));
  const vecino = Math.abs(centroCarril(1) - centroCarril(0));
  const aMitad = Math.abs(-2 - centroCarril(0));
  ok("choque en el mismo carril", mismo < RADIO_M.cono, "el centro no toca su obstáculo");
  ok("carril vecino no choca", vecino > RADIO_M.barrera, `dx=${vecino}`);
  ok("transición cerca del cono", Math.abs(-3 - centroCarril(0)) < RADIO_M.cono && aMitad > RADIO_M.cono, "el radio no sigue la posición física");
}

testSpawn();
testMovimiento();

if (fallos.length) {
  console.error(fallos.join("\n"));
  throw new Error("carriles");
}
console.log("carriles ok");
