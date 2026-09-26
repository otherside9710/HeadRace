let contexto: AudioContext | null = null;
let motor: OscillatorNode | null = null;
let armonico: OscillatorNode | null = null;
let filtroMotor: BiquadFilterNode | null = null;
let volumenMotor: GainNode | null = null;
let habilitado = false;

/** Habilita Web Audio desde una interacción explícita del usuario. */
export async function activarAudio() {
  const AudioContextWeb = window.AudioContext;
  if (!AudioContextWeb) return false;

  if (!contexto) {
    contexto = new AudioContextWeb();
    filtroMotor = contexto.createBiquadFilter();
    filtroMotor.type = "lowpass";
    filtroMotor.frequency.value = 420;
    volumenMotor = contexto.createGain();
    volumenMotor.gain.value = 0;
    filtroMotor.connect(volumenMotor);
    volumenMotor.connect(contexto.destination);

    motor = contexto.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.value = 55;
    motor.connect(filtroMotor);
    motor.start();

    armonico = contexto.createOscillator();
    armonico.type = "triangle";
    armonico.frequency.value = 110;
    const volumenArmonico = contexto.createGain();
    volumenArmonico.gain.value = 0.28;
    armonico.connect(volumenArmonico);
    volumenArmonico.connect(filtroMotor);
    armonico.start();
  }

  await contexto.resume();
  habilitado = contexto.state === "running";
  return habilitado;
}

export function silenciarAudio() {
  habilitado = false;
  if (contexto && volumenMotor) {
    volumenMotor.gain.setTargetAtTime(0, contexto.currentTime, 0.04);
  }
}

export function actualizarMotor(velocidad: number, enMarcha: boolean) {
  if (!contexto || !motor || !armonico || !filtroMotor || !volumenMotor) return;

  const ahora = contexto.currentTime;
  const vel = Math.max(0, Math.min(100, velocidad));
  const volumen = habilitado && enMarcha ? 0.018 + (vel / 100) * 0.048 : 0;
  motor.frequency.setTargetAtTime(48 + vel * 1.18, ahora, 0.09);
  armonico.frequency.setTargetAtTime(96 + vel * 2.36, ahora, 0.09);
  filtroMotor.frequency.setTargetAtTime(300 + vel * 11, ahora, 0.1);
  volumenMotor.gain.setTargetAtTime(volumen, ahora, 0.12);
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
