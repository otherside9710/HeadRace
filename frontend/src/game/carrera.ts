import { io, type Socket } from "socket.io-client";
import { sonarChoque } from "./audio";
import {
  CENTROS_M,
  MAPA_BASE,
  RADIO_M,
  elegirSpawn,
  pasoLateral,
  type ObsCarril,
  type TipoObs,
} from "./carriles";

export const LARGO = 1000;
export const AVANCE = 88;
export const ESCALA = 0.105;
export const DT_MAX = 0.1;
const CICLO = 78;
const BORDE_M = 5.5;
export const LIMITE_CHOQUES = 10;

export type Tipo = TipoObs;
export type Obs = ObsCarril;
export type MejorCarrera = {
  carrera_id: string;
  fecha_hora: string;
  tramo: number;
  vueltas: number;
  colisiones: number;
};

export const carrera = {
  s: 0,
  hora: 0.1,
  carX: 0,
  carril: 1,
  kartX: 0,
  velX: 0,
  inclinacion: 0,
  carSpeed: 0,
  alert: false,
  captura: "esperando",
  recibido: false,
  detenida: false,
  derrotada: false,
  colisiones: 0,
  colisionesCarrera: 0,
  segundos: 0,
  segundosSesion: 0,
  ultimoCruce: 0,
  inicioTramo: 0,
  inicioSesion: 0,
  ultimaVueltaAt: 0,
  vueltasCarrera: 0,
  carreraId: crypto.randomUUID(),
  estabaFuera: false,
  eventos: 0,
  alertaPrev: false,
  muestras: [] as number[],
  golpeado: new Set<string>(),
  flashHasta: 0,
  shakeHasta: 0,
  vista: "",
  mejoresCarreras: [] as MejorCarrera[],
  errorGuardado: "",
  mapa: MAPA_BASE.map((obs) => ({ ...obs })),
};

let socket: Socket | null = null;
let ultimoFrame = 0;

export function centroDe(obs: Obs) {
  return CENTROS_M[obs.carril];
}

function moverKart(dt: number) {
  if (carrera.detenida) return;
  const paso = pasoLateral(carrera.kartX, carrera.velX, carrera.carril, carrera.carX, carrera.recibido, dt);
  carrera.kartX = paso.x;
  carrera.velX = paso.vel;
  carrera.carril = paso.carril;
  carrera.inclinacion = paso.inclinacion;
}

export function delante(marca: number) {
  return (marca - carrera.s + LARGO) % LARGO;
}

function suave(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function tramo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return suave((t - a) / (b - a));
}

export function momento() {
  const t = carrera.hora;
  const noche = tramo(t, 0.54, 0.68) * (1 - tramo(t, 0.78, 0.96));
  const calor = Math.max(
    tramo(t, 0.38, 0.52) * (1 - tramo(t, 0.55, 0.68)),
    tramo(t, 0.78, 0.88) * (1 - tramo(t, 0.91, 0.99)),
  );
  let etiqueta = "Día";
  if (t >= 0.8 && t < 0.96) etiqueta = "Amanecer";
  else if (t >= 0.6 && t < 0.8) etiqueta = "Noche";
  else if (calor > 0.28) etiqueta = "Tarde";
  return { noche, calor, etiqueta, hora: t };
}

/** Reloj ambiental autónomo: sigue el ciclo incluso cuando la carrera termina. */
export function avanzarAmbiente(dt: number) {
  carrera.hora = (carrera.hora + Math.min(Math.max(dt, 0), DT_MAX) / CICLO) % 1;
}

function promedio() {
  if (carrera.muestras.length === 0) return null;
  const suma = carrera.muestras.reduce((a, b) => a + b, 0);
  return Math.round((suma / carrera.muestras.length) * 10) / 10;
}

export async function cargarHistorial() {
  const respuestaMejores = await fetch("/mejores-carreras");
  if (respuestaMejores.ok) {
    const mejores = await respuestaMejores.json();
    if (Array.isArray(mejores)) carrera.mejoresCarreras = mejores as MejorCarrera[];
  }
}

async function guardar(motivo: string, tiempo: number | null, foto?: { colisiones: number; eventos: number; promedio: number | null; duracion: number }) {
  try {
    const respuesta = await fetch("/sesiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento_id: crypto.randomUUID(),
        carrera_id: carrera.carreraId,
        motivo,
        tiempo_vuelta: tiempo,
        duracion_tramo: foto ? foto.duracion : carrera.segundosSesion,
        colisiones: foto ? foto.colisiones : carrera.colisionesCarrera,
        eventos_obstaculo: foto ? foto.eventos : carrera.eventos,
        velocidad_promedio: foto ? foto.promedio : promedio(),
      }),
    });
    if (!respuesta.ok) {
      carrera.errorGuardado = "No se pudo guardar la sesión en la base de datos.";
      console.error("No se pudo guardar la sesión", await respuesta.text());
      return;
    }
    carrera.errorGuardado = "";
    await cargarHistorial();
  } catch (error) {
    carrera.errorGuardado = "No se pudo conectar con la base de datos.";
    console.error("Error guardando la sesión", error);
  }
}

function marcarGolpe() {
  if (carrera.detenida) return;
  carrera.colisiones += 1;
  carrera.colisionesCarrera += 1;
  sonarChoque();
  const ahora = performance.now();
  carrera.flashHasta = ahora + 220;
  carrera.shakeHasta = ahora + 280;
  if (carrera.colisionesCarrera >= LIMITE_CHOQUES) {
    carrera.derrotada = true;
    terminarSesion();
  }
}

function revisarGolpes() {
  for (const obs of carrera.mapa) {
    if (carrera.detenida) return;
    const id = `${obs.s}:${obs.carril}:${obs.tipo}`;
    const frente = delante(obs.s);
    if (frente > 180) {
      carrera.golpeado.delete(id);
    } else if (frente < 22 && !carrera.golpeado.has(id) && Math.abs(carrera.kartX - centroDe(obs)) < RADIO_M[obs.tipo]) {
      carrera.golpeado.add(id);
      marcarGolpe();
    }
  }
}

export function avanzar(ahora: number) {
  const dt = ultimoFrame === 0 ? 0 : Math.min(DT_MAX, (ahora - ultimoFrame) / 1000);
  ultimoFrame = ahora;
  moverKart(dt);
  if (carrera.inicioTramo !== 0) carrera.segundos = (ahora - carrera.inicioTramo) / 1000;
  const fuera = Math.abs(carrera.kartX) > BORDE_M;
  if (fuera && !carrera.estabaFuera && carrera.recibido && !carrera.detenida) marcarGolpe();
  carrera.estabaFuera = fuera;
  if (carrera.recibido && !carrera.detenida) {
    if (carrera.inicioTramo === 0) {
      carrera.inicioTramo = ahora;
      carrera.ultimoCruce = ahora;
    }
    if (carrera.inicioSesion === 0) {
      carrera.inicioSesion = ahora;
      carrera.ultimaVueltaAt = ahora;
    }
    carrera.segundosSesion = (ahora - carrera.inicioSesion) / 1000;
    const paso = (carrera.carSpeed / 100) * AVANCE * dt;
    carrera.s = (carrera.s + paso) % LARGO;
    revisarGolpes();
    while (!carrera.detenida && ahora - carrera.ultimaVueltaAt >= 10_000) {
      carrera.ultimaVueltaAt += 10_000;
      carrera.vueltasCarrera += 1;
      const foto = {
        colisiones: carrera.colisionesCarrera,
        eventos: carrera.eventos,
        promedio: promedio(),
        duracion: carrera.segundosSesion,
      };
      void guardar("vuelta_completa", 10, foto);
    }
  }
}

export function soltarObstaculo() {
  const nuevo = elegirSpawn(carrera.mapa, carrera.s, Math.random);
  if (nuevo) carrera.mapa.push(nuevo);
}

export function terminarSesion() {
  if (carrera.detenida) return;
  carrera.detenida = true;
  void guardar("fin_sesion", null, {
    colisiones: carrera.colisionesCarrera,
    eventos: carrera.eventos,
    promedio: promedio(),
    duracion: carrera.segundosSesion,
  });
}

export function reiniciarCarrera() {
  carrera.s = 0;
  carrera.carril = 1;
  carrera.kartX = 0;
  carrera.velX = 0;
  carrera.inclinacion = 0;
  carrera.detenida = false;
  carrera.derrotada = false;
  carrera.errorGuardado = "";
  carrera.colisiones = 0;
  carrera.colisionesCarrera = 0;
  carrera.inicioSesion = 0;
  carrera.ultimaVueltaAt = 0;
  carrera.segundosSesion = 0;
  carrera.vueltasCarrera = 0;
  carrera.carreraId = crypto.randomUUID();
  carrera.estabaFuera = false;
  carrera.eventos = 0;
  carrera.alertaPrev = carrera.alert;
  carrera.muestras = [];
  carrera.golpeado.clear();
  carrera.flashHasta = 0;
  carrera.shakeHasta = 0;
  carrera.mapa = MAPA_BASE.map((obs) => ({ ...obs }));
  ultimoFrame = 0;
}

export function conectar() {
  if (socket) return;
  socket = io();
  socket.on("connect", () => {
    socket?.emit("simular_obstaculo", { activo: false });
  });
  socket.on("estado", (mensaje: { car_x: number; car_speed: number; obstacle_alert: boolean; captura?: string }) => {
    carrera.carX = Number(mensaje.car_x);
    carrera.carSpeed = Number(mensaje.car_speed);
    carrera.alert = Boolean(mensaje.obstacle_alert);
    carrera.captura = mensaje.captura || "con_rostro";
    carrera.recibido = true;
    if (carrera.detenida) return;
    carrera.muestras.push(carrera.carSpeed);
    if (carrera.alert && !carrera.alertaPrev) carrera.eventos += 1;
    carrera.alertaPrev = carrera.alert;
  });
  socket.on("vista", (mensaje: { jpeg?: string }) => {
    if (mensaje?.jpeg) carrera.vista = "data:image/jpeg;base64," + mensaje.jpeg;
  });
  void cargarHistorial();
}
