import { io, type Socket } from "socket.io-client";
import { sonarChoque, sonarDestruccion, sonarEscudo } from "./audio";
import {
  ANCHO_CARRIL_M,
  CENTROS_M,
  MAPA_BASE,
  RADIO_M,
  pasoLateral,
  type ObsCarril,
  type TipoObs,
} from "./carriles";

export const LARGO = 1000;
export const AVANCE = 88;
export const ESCALA = 0.105;
export const DT_MAX = 0.1;
export const DURACION_DESTRUCCION_MS = 1100;
export const ESQUIVAS_PARA_ESCUDO = 3;
export const DURACION_ESCUDO_MS = 10_000;
export const DURACION_LLAMAS_MS = 3_000;
const CICLO = 78;
const BORDE_M = 5.5;
const DISTANCIA_DETECCION_ESQUIVA = 80;
const DISTANCIA_DETECCION_CHOQUE = 22;
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
  centroCabeza: 0,
  carril: 1,
  kartX: 0,
  velX: 0,
  inclinacion: 0,
  carSpeed: 0,
  alert: false,
  sensorConectado: false,
  modoControl: "simulacion" as "esp32" | "simulacion",
  sensorDistanciaMm: null as number | null,
  sensorManoDetectada: false,
  sensorZona: "reposo" as "reposo" | "escudo" | "llamas",
  escudoActivo: false,
  escudoHasta: 0,
  llamasHasta: 0,
  esquivasConsecutivas: 0,
  iniciada: false,
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
  muestras: [] as number[],
  golpeado: new Set<string>(),
  esquivasPendientes: new Set<string>(),
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
  const paso = pasoLateral(
    carrera.kartX,
    carrera.velX,
    carrera.carril,
    carrera.carX - carrera.centroCabeza,
    carrera.recibido,
    dt,
  );
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
  carrera.esquivasConsecutivas = 0;
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
    if (obs.destruidoAt !== undefined) continue;
    if (
      frente <= DISTANCIA_DETECCION_ESQUIVA &&
      frente > 0 &&
      carrera.carril === obs.carril &&
      Math.abs(carrera.kartX - centroDe(obs)) < ANCHO_CARRIL_M / 2
    ) {
      carrera.esquivasPendientes.add(id);
    }
    if (frente < DISTANCIA_DETECCION_CHOQUE && !carrera.golpeado.has(id) && Math.abs(carrera.kartX - centroDe(obs)) < RADIO_M[obs.tipo]) {
      carrera.golpeado.add(id);
      if (carrera.escudoActivo) {
        obs.destruidoAt = performance.now();
        carrera.eventos += 1;
        sonarDestruccion();
      } else {
        marcarGolpe();
      }
    }
  }
}

function registrarObstaculosSuperados(sAnterior: number, paso: number) {
  if (paso <= 0 || carrera.detenida) return;
  for (const obs of carrera.mapa) {
    const distancia = (obs.s - sAnterior + LARGO) % LARGO || LARGO;
    if (distancia > paso) continue;
    const id = `${obs.s}:${obs.carril}:${obs.tipo}`;
    if (carrera.esquivasPendientes.has(id) && !carrera.golpeado.has(id) && obs.destruidoAt === undefined) {
      carrera.esquivasConsecutivas = Math.min(ESQUIVAS_PARA_ESCUDO, carrera.esquivasConsecutivas + 1);
    }
    carrera.esquivasPendientes.delete(id);
    carrera.golpeado.delete(id);
  }
}

function reactivarObstaculos(ahora: number) {
  for (const obs of carrera.mapa) {
    if (obs.destruidoAt === undefined || ahora - obs.destruidoAt < DURACION_DESTRUCCION_MS || delante(obs.s) <= 180) continue;
    obs.destruidoAt = undefined;
  }
}

export function avanzar(ahora: number) {
  const dt = ultimoFrame === 0 ? 0 : Math.min(DT_MAX, (ahora - ultimoFrame) / 1000);
  ultimoFrame = ahora;
  if (carrera.escudoActivo && ahora >= carrera.escudoHasta) desactivarEscudo();
  if (!carrera.iniciada || carrera.detenida) return;
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
    const sAnterior = carrera.s;
    const paso = (carrera.carSpeed / 100) * AVANCE * dt;
    carrera.s = (carrera.s + paso) % LARGO;
    reactivarObstaculos(ahora);
    revisarGolpes();
    registrarObstaculosSuperados(sAnterior, paso);
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

export function activarEscudo() {
  if (carrera.detenida || carrera.escudoActivo || carrera.esquivasConsecutivas < ESQUIVAS_PARA_ESCUDO) return;
  encenderEscudo();
}

function encenderEscudo() {
  carrera.esquivasConsecutivas = 0;
  carrera.llamasHasta = 0;
  carrera.escudoActivo = true;
  carrera.escudoHasta = performance.now() + DURACION_ESCUDO_MS;
  sonarEscudo(true);
}

export function activarEscudoPorSensor() {
  if (
    !carrera.iniciada ||
    carrera.detenida ||
    carrera.escudoActivo ||
    carrera.esquivasConsecutivas < ESQUIVAS_PARA_ESCUDO
  ) return;
  encenderEscudo();
}

export function activarLlamasPorSensor() {
  if (!carrera.iniciada || carrera.detenida || carrera.escudoActivo) return;
  carrera.llamasHasta = performance.now() + DURACION_LLAMAS_MS;
}

export function iniciarCarrera() {
  if (carrera.detenida) return;
  carrera.centroCabeza = carrera.carX;
  carrera.iniciada = true;
}

export function desactivarEscudo() {
  if (!carrera.escudoActivo) return;
  carrera.escudoActivo = false;
  carrera.escudoHasta = 0;
  sonarEscudo(false);
}

export function terminarSesion() {
  if (carrera.detenida) return;
  const ahora = performance.now();
  if (carrera.inicioTramo !== 0) carrera.segundos = (ahora - carrera.inicioTramo) / 1000;
  if (carrera.inicioSesion !== 0) carrera.segundosSesion = (ahora - carrera.inicioSesion) / 1000;
  carrera.detenida = true;
  carrera.llamasHasta = 0;
  desactivarEscudo();
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
  carrera.iniciada = true;
  carrera.escudoActivo = false;
  carrera.escudoHasta = 0;
  carrera.llamasHasta = 0;
  carrera.esquivasConsecutivas = 0;
  carrera.errorGuardado = "";
  carrera.colisiones = 0;
  carrera.colisionesCarrera = 0;
  carrera.inicioTramo = 0;
  carrera.ultimoCruce = 0;
  carrera.segundos = 0;
  carrera.centroCabeza = carrera.carX;
  carrera.inicioSesion = 0;
  carrera.ultimaVueltaAt = 0;
  carrera.segundosSesion = 0;
  carrera.vueltasCarrera = 0;
  carrera.carreraId = crypto.randomUUID();
  carrera.estabaFuera = false;
  carrera.eventos = 0;
  carrera.muestras = [];
  carrera.golpeado.clear();
  carrera.esquivasPendientes.clear();
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
  socket.on("estado", (mensaje: {
    car_x: number;
    car_speed: number;
    obstacle_alert: boolean;
    captura?: string;
    sensor_conectado?: boolean;
    modo_control?: "esp32" | "simulacion";
    sensor_distancia_mm?: number | null;
    sensor_mano_detectada?: boolean;
    sensor_zona?: "reposo" | "escudo" | "llamas";
  }) => {
    const captura = mensaje.captura || "con_rostro";
    if (captura === "con_rostro") carrera.carX = Number(mensaje.car_x);
    carrera.carSpeed = Number(mensaje.car_speed);
    carrera.alert = Boolean(mensaje.obstacle_alert);
    carrera.sensorConectado = mensaje.sensor_conectado === true;
    carrera.modoControl = mensaje.modo_control === "esp32" ? "esp32" : "simulacion";
    carrera.sensorDistanciaMm = mensaje.sensor_distancia_mm ?? null;
    carrera.sensorManoDetectada = mensaje.sensor_mano_detectada === true;
    carrera.sensorZona = mensaje.sensor_zona || "reposo";
    carrera.captura = captura;
    carrera.recibido = true;
    if (carrera.detenida) return;
    carrera.muestras.push(carrera.carSpeed);
  });
  socket.on("gesto_escudo", (mensaje: { distancia_mm?: number }) => {
    if (typeof mensaje?.distancia_mm === "number") carrera.sensorDistanciaMm = mensaje.distancia_mm;
    carrera.sensorManoDetectada = true;
    activarEscudoPorSensor();
  });
  socket.on("gesto_llamas", (mensaje: { distancia_mm?: number }) => {
    if (typeof mensaje?.distancia_mm === "number") carrera.sensorDistanciaMm = mensaje.distancia_mm;
    carrera.sensorManoDetectada = true;
    activarLlamasPorSensor();
  });
  socket.on("vista", (mensaje: { jpeg?: string }) => {
    if (mensaje?.jpeg) carrera.vista = "data:image/jpeg;base64," + mensaje.jpeg;
  });
  void cargarHistorial();
}
