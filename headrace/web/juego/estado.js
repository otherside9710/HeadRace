export const LARGO = 1000;
export const AVANCE = 88;
export const CARRIL = 70;
export const ESPERA_VUELTA_MS = 2000;
export const DT_MAX = 0.1;
export const REACH = 480;
export const SLICES = 60;
export const GOLPE_RADIO = 32;
export const GIRO = 3;
export const ESCALA = 0.105;
export const CARRIL_M = 3.5;

export function ejeX(valor) {
  return (valor / 100) * CARRIL_M;
}
const CICLO_S = 78;

export const juego = {
  s: 0,
  detenida: false,
  ultimoFrame: 0,
  ultimoCruce: 0,
  colisiones: 0,
  estabaFuera: false,
  eventosObstaculo: 0,
  alertaPrev: false,
  muestrasVelocidad: [],
  segundosVuelta: 0,
  hayVista: false,
  vista: new Image(),
  yaGolpeado: new Set(),
  flashHasta: 0,
  shakeHasta: 0,
  hora: 0.08,
  ancho: 1280,
  alto: 720,
  estado: {
    car_x: 0,
    car_speed: 0,
    obstacle_alert: false,
    captura: "esperando",
    recibido: false,
  },
  mapa: [
    { s: 90, x: -48, tipo: "cono" },
    { s: 150, x: 48, tipo: "cono" },
    { s: 220, x: 0, tipo: "caja" },
    { s: 300, x: -48, tipo: "barrera" },
    { s: 360, x: 48, tipo: "caja" },
    { s: 440, x: 0, tipo: "cono" },
    { s: 510, x: 48, tipo: "barrera" },
    { s: 580, x: -48, tipo: "caja" },
    { s: 660, x: 0, tipo: "cono" },
    { s: 730, x: 48, tipo: "cono" },
    { s: 810, x: -48, tipo: "barrera" },
    { s: 900, x: 0, tipo: "caja" },
  ],
};

export function lateral() {
  const crudo = juego.estado.car_x;
  if (Math.abs(crudo) < 5) {
    return 0;
  }
  return Math.max(-100, Math.min(100, crudo * GIRO));
}

export function delanteDe(marca) {
  return (marca - juego.s + LARGO) % LARGO;
}

export function avanzarHora(dt) {
  juego.hora = (juego.hora + dt / CICLO_S) % 1;
}

function suave(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function tramo(t, a, b) {
  if (t <= a) {
    return 0;
  }
  if (t >= b) {
    return 1;
  }
  return suave((t - a) / (b - a));
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function mezclar(a, b, t) {
  return a.map((n, i) => Math.round(n + (b[i] - n) * t));
}

const DIA = {
  top: [78, 186, 245],
  mid: [150, 214, 255],
  bot: [255, 244, 214],
  pasto: [24, 156, 64],
  pasto2: [18, 128, 52],
  asfalto: [58, 64, 74],
  monte: [62, 128, 92],
  monte2: [98, 156, 114],
  mar: [28, 164, 204],
};
const ORO = {
  top: [86, 104, 188],
  mid: [242, 132, 74],
  bot: [255, 196, 110],
  pasto: [48, 118, 46],
  pasto2: [36, 92, 38],
  asfalto: [64, 54, 48],
  monte: [126, 78, 62],
  monte2: [176, 108, 72],
  mar: [32, 92, 138],
};
const NOCHE = {
  top: [6, 10, 28],
  mid: [14, 26, 58],
  bot: [24, 34, 68],
  pasto: [8, 46, 34],
  pasto2: [6, 32, 26],
  asfalto: [22, 26, 36],
  monte: [16, 26, 46],
  monte2: [26, 38, 62],
  mar: [6, 24, 52],
};

export function clima() {
  const t = juego.hora;
  const calor = Math.max(tramo(t, 0.28, 0.46) * (1 - tramo(t, 0.46, 0.58)), t > 0.8 ? tramo(t, 0.8, 0.9) * (1 - tramo(t, 0.9, 0.98)) : 0);
  const noche = t < 0.58 ? tramo(t, 0.44, 0.6) : t < 0.8 ? 1 : 1 - tramo(t, 0.8, 0.96);
  const base = {};
  for (const clave of Object.keys(DIA)) {
    base[clave] = mezclar(mezclar(DIA[clave], ORO[clave], calor), NOCHE[clave], noche);
  }
  let etiqueta = "Día";
  if (noche > 0.62) {
    etiqueta = "Noche";
  } else if (calor > 0.4) {
    etiqueta = "Tarde";
  }
  return {
    noche,
    calor,
    etiqueta,
    top: rgb(base.top),
    mid: rgb(base.mid),
    bot: rgb(base.bot),
    pasto: rgb(base.pasto),
    pasto2: rgb(base.pasto2),
    asfalto: rgb(base.asfalto),
    monte: rgb(base.monte),
    monte2: rgb(base.monte2),
    mar: rgb(base.mar),
    pastoRaw: base.pasto,
    crudo: base,
  };
}

export function horizonte() {
  return juego.alto * 0.33 + Math.sin(juego.s / 150) * 8;
}

export function proyectar(dist) {
  const h = horizonte();
  const norm = Math.max(0, Math.min(1, dist / REACH));
  const p = Math.pow(norm, 0.6);
  const y = juego.alto + (h - juego.alto) * p;
  const medio = juego.ancho * 0.4;
  const half = medio + (36 - medio) * p;
  return { y, half, p };
}

export function xEnPista(lado, half) {
  return juego.ancho * 0.5 + (lado / 100) * half;
}

export function astro() {
  const t = juego.hora;
  const w = juego.ancho;
  const h = horizonte();
  const c = clima();
  if (t < 0.5) {
    const u = t / 0.5;
    return { tipo: "sol", x: w * (0.58 + u * 0.2), y: 64 + u * (h - 70), alpha: 1 - c.noche };
  }
  if (t > 0.82) {
    const u = (t - 0.82) / 0.18;
    return { tipo: "sol", x: w * (0.16 + u * 0.22), y: h - 16 - u * (h - 80), alpha: 1 - c.noche * 0.2 };
  }
  const u = (t - 0.5) / 0.32;
  return { tipo: "luna", x: w * (0.2 + u * 0.48), y: 72 + Math.sin(u * Math.PI) * 18, alpha: c.noche };
}
