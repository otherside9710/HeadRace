type Efecto = "escudo-activar" | "escudo-desactivar" | "explosion";

const INICIO_AUDIO_MOTOR_S = 2;
let contexto: AudioContext | null = null;
let habilitado = false;
let motorEnMarcha = false;
let motor: HTMLAudioElement | null = null;
const efectos = new Map<Efecto, HTMLAudioElement>();
const efectosActivos = new Set<HTMLAudioElement>();

function rutaAudio(nombre: string) {
  return `${import.meta.env.BASE_URL}audio/${nombre}.mp3`;
}

function prepararAudios() {
  if (typeof Audio === "undefined") return false;

  if (!motor) {
    motor = new Audio(rutaAudio("motor"));
    motor.loop = false;
    motor.preload = "auto";
    motor.volume = 0;
    motor.addEventListener("ended", () => {
      if (!motor || !habilitado || !motorEnMarcha) return;
      motor.currentTime = INICIO_AUDIO_MOTOR_S;
      void motor.play().catch(() => { motorEnMarcha = false; });
    });
  }

  for (const efecto of ["escudo-activar", "escudo-desactivar", "explosion"] as const) {
    if (!efectos.has(efecto)) {
      const audio = new Audio(rutaAudio(efecto));
      audio.preload = "auto";
      audio.addEventListener("ended", () => efectosActivos.delete(audio));
      efectos.set(efecto, audio);
    }
  }

  return true;
}

/** Habilita el audio desde el clic explícito del usuario y prepara los clips locales. */
export async function activarAudio() {
  if (!prepararAudios() || !motor) return false;

  let reproduccionMotor: Promise<void>;
  try {
    motor.volume = 0;
    motor.currentTime = INICIO_AUDIO_MOTOR_S;
    reproduccionMotor = motor.play();
  } catch {
    return false;
  }

  try {
    if (typeof window.AudioContext !== "undefined") {
      contexto ??= new window.AudioContext();
      if (contexto.state !== "running") await contexto.resume();
    }
  } catch {
    // La reproducción de archivos sigue funcionando aunque Web Audio no esté disponible.
  }

  try {
    await reproduccionMotor;
    habilitado = true;
    return true;
  } catch {
    habilitado = false;
    motor.pause();
    return false;
  }
}

export function silenciarAudio() {
  habilitado = false;
  motorEnMarcha = false;
  if (motor) {
    motor.volume = 0;
    motor.pause();
  }
  for (const audio of efectosActivos) {
    audio.pause();
    audio.currentTime = 0;
  }
  efectosActivos.clear();
}

export function actualizarMotor(velocidad: number, enMarcha: boolean) {
  if (!motor) return;
  const vel = Math.max(0, Math.min(100, velocidad));
  const debeSonar = habilitado && enMarcha;
  if (debeSonar && !motorEnMarcha) {
    motor.currentTime = INICIO_AUDIO_MOTOR_S;
    void motor.play().catch(() => { motorEnMarcha = false; });
  }
  if (!debeSonar && motorEnMarcha) motor.pause();
  motorEnMarcha = debeSonar;
  motor.playbackRate = 0.82 + (vel / 100) * 0.55;
  motor.volume = debeSonar ? 0.12 + (vel / 100) * 0.2 : 0;
}

function reproducirEfecto(nombre: Efecto, volumen: number) {
  if (!habilitado) return;
  const audio = efectos.get(nombre);
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  audio.volume = volumen;
  efectosActivos.add(audio);
  void audio.play().catch(() => efectosActivos.delete(audio));
}

export function sonarEscudo(activado: boolean) {
  reproducirEfecto(activado ? "escudo-activar" : "escudo-desactivar", 0.78);
}

export function sonarDestruccion() {
  reproducirEfecto("explosion", 0.88);
}

export function sonarChoque() {
  if (!habilitado || !contexto || contexto.state !== "running") return;

  const ahora = contexto.currentTime;
  const golpe = contexto.createOscillator();
  const volumenGolpe = contexto.createGain();
  golpe.type = "sine";
  golpe.frequency.setValueAtTime(125, ahora);
  golpe.frequency.exponentialRampToValueAtTime(38, ahora + 0.22);
  volumenGolpe.gain.setValueAtTime(0.32, ahora);
  volumenGolpe.gain.exponentialRampToValueAtTime(0.001, ahora + 0.24);
  golpe.connect(volumenGolpe);
  volumenGolpe.connect(contexto.destination);
  golpe.start(ahora);
  golpe.stop(ahora + 0.25);

  const duracion = 0.2;
  const buffer = contexto.createBuffer(1, Math.floor(contexto.sampleRate * duracion), contexto.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i += 1) {
    datos[i] = (Math.random() * 2 - 1) * (1 - i / datos.length) ** 2;
  }
  const ruido = contexto.createBufferSource();
  const filtro = contexto.createBiquadFilter();
  const volumenRuido = contexto.createGain();
  ruido.buffer = buffer;
  filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(1800, ahora);
  filtro.frequency.exponentialRampToValueAtTime(220, ahora + duracion);
  volumenRuido.gain.setValueAtTime(0.2, ahora);
  volumenRuido.gain.exponentialRampToValueAtTime(0.001, ahora + duracion);
  ruido.connect(filtro);
  filtro.connect(volumenRuido);
  volumenRuido.connect(contexto.destination);
  ruido.start(ahora);
  ruido.stop(ahora + duracion);
}
