export const N_CARRILES = 3;
export const CENTROS_M = [-4, 0, 4] as const;
export const ANCHO_CARRIL_M = 4;
const ENTRAR_IZQUIERDA = 14;
const ENTRAR_DERECHA = 10;
export const ZONA_CENTRO = 8;
export const REACCION = 48;
export const LARGO_PISTA = 1000;
const TIEMPO_SUAVE = 0.16;
const VEL_MAX = 12;

export type TipoObs = "cono" | "caja" | "barrera";
export type ObsCarril = { s: number; carril: number; tipo: TipoObs; destruidoAt?: number };

export const RADIO_M: Record<TipoObs, number> = {
  cono: 1.05,
  caja: 1.25,
  barrera: 1.7,
};

export const MAPA_BASE: ObsCarril[] = [
  { s: 90, carril: 0, tipo: "cono" },
  { s: 150, carril: 2, tipo: "cono" },
  { s: 220, carril: 1, tipo: "caja" },
  { s: 300, carril: 0, tipo: "barrera" },
  { s: 360, carril: 2, tipo: "caja" },
  { s: 440, carril: 1, tipo: "cono" },
  { s: 510, carril: 2, tipo: "barrera" },
  { s: 580, carril: 0, tipo: "caja" },
  { s: 660, carril: 1, tipo: "cono" },
  { s: 730, carril: 2, tipo: "cono" },
  { s: 810, carril: 0, tipo: "barrera" },
  { s: 900, carril: 1, tipo: "caja" },
];

export function centroCarril(carril: number) {
  return CENTROS_M[carril];
}

export function carrilDesdeCabeza(carX: number, actual: number) {
  if (carX <= -ENTRAR_IZQUIERDA) return 0;
  if (carX >= ENTRAR_DERECHA) return 2;
  if (Math.abs(carX) <= ZONA_CENTRO) return 1;
  return actual;
}

export function distanciaPista(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, LARGO_PISTA - d);
}

function cierraPista(mapa: ObsCarril[], marca: number, carril: number) {
  const origenes = [marca];
  for (const obs of mapa) {
    if (distanciaPista(obs.s, marca) < REACCION) origenes.push(obs.s);
  }
  for (const origen of origenes) {
    const lanes = new Set<number>([carril]);
    for (const obs of mapa) {
      if (distanciaPista(obs.s, origen) < REACCION) lanes.add(obs.carril);
    }
    if (lanes.size >= N_CARRILES) return true;
  }
  return false;
}

export function carrilesLibres(mapa: ObsCarril[], marca: number) {
  const ocupados = new Set<number>();
  for (const obs of mapa) {
    if (distanciaPista(obs.s, marca) < REACCION) ocupados.add(obs.carril);
  }
  const libres: number[] = [];
  for (let carril = 0; carril < N_CARRILES; carril += 1) {
    if (ocupados.has(carril)) continue;
    if (!cierraPista(mapa, marca, carril)) libres.push(carril);
  }
  return libres;
}

export function elegirSpawn(mapa: ObsCarril[], sActual: number, aleatorio: () => number): ObsCarril | null {
  const tipos: TipoObs[] = ["cono", "caja", "barrera"];
  let marca = (sActual + 160 + aleatorio() * 80) % LARGO_PISTA;
  const avance = 18;
  const pasos = Math.ceil(LARGO_PISTA / avance);
  for (let i = 0; i < pasos; i += 1) {
    const libres = carrilesLibres(mapa, marca);
    if (libres.length > 0) {
      const carril = libres[Math.floor(aleatorio() * libres.length)];
      const tipo = tipos[Math.floor(aleatorio() * tipos.length)];
      return { s: marca, carril, tipo };
    }
    marca = (marca + avance) % LARGO_PISTA;
  }
  return null;
}

export function smoothDamp(actual: number, meta: number, vel: number, dt: number) {
  const suave = Math.max(0.0001, TIEMPO_SUAVE);
  const omega = 2 / suave;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let cambio = actual - meta;
  const tope = VEL_MAX * suave;
  cambio = Math.max(-tope, Math.min(tope, cambio));
  const objetivo = actual - cambio;
  const temp = (vel + omega * cambio) * dt;
  const velNueva = (vel - omega * temp) * exp;
  let salida = objetivo + (cambio + temp) * exp;
  if (meta - actual > 0 === salida > meta) {
    salida = meta;
    return { x: salida, vel: 0 };
  }
  return { x: salida, vel: velNueva };
}

export function pasoLateral(x: number, vel: number, carril: number, carX: number, recibido: boolean, dt: number) {
  const destino = recibido ? carrilDesdeCabeza(carX, carril) : carril;
  const meta = CENTROS_M[destino];
  const paso = dt > 0 ? smoothDamp(x, meta, vel, dt) : { x, vel };
  const inclinacion = Math.max(-0.055, Math.min(0.055, -paso.vel * 0.005));
  return { x: paso.x, vel: paso.vel, carril: destino, inclinacion };
}
