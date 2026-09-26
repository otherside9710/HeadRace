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
export const ESPERA = 2000;
export const DT_MAX = 0.1;
const CICLO = 78;
const BORDE_M = 5.5;

export type Tipo = TipoObs;
export type Obs = ObsCarril;
export type Fila = {
  tiempo_vuelta: number;
  colisiones: number;
  eventos_obstaculo: number;
  velocidad_promedio: number | null;
  fecha_hora: string;
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
  colisiones: 0,
  segundos: 0,
  ultimoCruce: 0,
  estabaFuera: false,
  eventos: 0,
  alertaPrev: false,
  muestras: [] as number[],
  golpeado: new Set<string>(),
  flashHasta: 0,
  shakeHasta: 0,
  vista: "",
  filas: [] as Fila[],
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
  const respuesta = await fetch("/historial");
  if (!respuesta.ok) return;
  const filas = await respuesta.json();
  if (Array.isArray(filas)) carrera.filas = filas as Fila[];
}

async function guardar(motivo: string, tiempo: number | null, foto?: { colisiones: number; eventos: number; promedio: number | null }) {
  const respuesta = await fetch("/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento_id: crypto.randomUUID(),
      motivo,
      tiempo_vuelta: tiempo,
      colisiones: foto ? foto.colisiones : carrera.colisiones,
      eventos_obstaculo: foto ? foto.eventos : carrera.eventos,
      velocidad_promedio: foto ? foto.promedio : promedio(),
    }),
  });
  if (respuesta.ok) await cargarHistorial();
}

function marcarGolpe() {
  carrera.colisiones += 1;
  sonarChoque();
  const ahora = performance.now();
  carrera.flashHasta = ahora + 220;
  carrera.shakeHasta = ahora + 280;
}

function revisarGolpes() {
  for (const obs of carrera.mapa) {
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
  const fuera = Math.abs(carrera.kartX) > BORDE_M;
  if (fuera && !carrera.estabaFuera && carrera.recibido && !carrera.detenida) marcarGolpe();
  carrera.estabaFuera = fuera;
  if (carrera.recibido && !carrera.detenida) {
    if (carrera.ultimoCruce === 0) carrera.ultimoCruce = ahora;
    carrera.segundos = (ahora - carrera.ultimoCruce) / 1000;
    const antes = carrera.s;
    const paso = (carrera.carSpeed / 100) * AVANCE * dt;
    carrera.s = (carrera.s + paso) % LARGO;
    revisarGolpes();
    if (paso > 0 && carrera.s < antes && ahora - carrera.ultimoCruce >= ESPERA) {
      const foto = {
        colisiones: carrera.colisiones,
        eventos: carrera.eventos,
        promedio: promedio(),
      };
      const tiempo = Math.round(carrera.segundos * 10) / 10;
      carrera.colisiones = 0;
      carrera.eventos = 0;
      carrera.muestras = [];
      carrera.ultimoCruce = ahora;
      carrera.alertaPrev = carrera.alert;
      carrera.estabaFuera = Math.abs(carrera.kartX) > BORDE_M;
      void guardar("vuelta_completa", tiempo, foto);
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
  void guardar("fin_sesion", null);
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
