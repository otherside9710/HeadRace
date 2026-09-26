const LARGO = 1000;
const AVANCE = 200;
const CARRIL = 70;
const ESPERA_VUELTA_MS = 2000;
const DT_MAX = 0.1;
const REACH = 340;
const SLICES = 56;
const ROAD_X = 500;
const BOTTOM = 640;
const GOLPE_RADIO = 32;
const GIRO = 3;

const MAPA = [
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
];

const canvas = document.getElementById("pista");
const ctx = canvas.getContext("2d");
const aviso = document.getElementById("aviso");
const velocidadEl = document.getElementById("velocidad");
const tiempoEl = document.getElementById("tiempo");
const colisionesEl = document.getElementById("colisiones");
const capturaEl = document.getElementById("captura");
const botonObstaculo = document.getElementById("obstaculo");
const botonTerminar = document.getElementById("terminar");

const estado = {
  car_x: 0,
  car_speed: 0,
  obstacle_alert: false,
  captura: "esperando",
  recibido: false,
};
let s = 0;
let detenida = false;
let ultimoFrame = 0;
let ultimoCruce = 0;
let colisiones = 0;
let estabaFuera = false;
let eventosObstaculo = 0;
let alertaPrev = false;
let muestrasVelocidad = [];
let segundosVuelta = 0;
const vista = new Image();
let hayVista = false;
const yaGolpeado = new Set();
let flashHasta = 0;

const socket = io();

socket.on("connect", () => {
  socket.emit("simular_obstaculo", { activo: false });
});

socket.on("estado", (mensaje) => {
  estado.car_x = Number(mensaje.car_x);
  estado.car_speed = Number(mensaje.car_speed);
  estado.obstacle_alert = Boolean(mensaje.obstacle_alert);
  estado.captura = mensaje.captura || "con_rostro";
  estado.recibido = true;
  if (!detenida) {
    muestrasVelocidad.push(estado.car_speed);
    if (estado.obstacle_alert && !alertaPrev) {
      eventosObstaculo += 1;
    }
    const fuera = Math.abs(lateral()) > CARRIL;
    if (fuera && !estabaFuera) {
      colisiones += 1;
      flashHasta = performance.now() + 160;
    }
    estabaFuera = fuera;
    alertaPrev = estado.obstacle_alert;
  }
});

socket.on("vista", (mensaje) => {
  if (!mensaje || !mensaje.jpeg) {
    return;
  }
  vista.src = "data:image/jpeg;base64," + mensaje.jpeg;
  hayVista = true;
});

botonObstaculo.addEventListener("click", () => {
  soltarObstaculo();
});

botonTerminar.addEventListener("click", () => {
  if (detenida) {
    return;
  }
  detenida = true;
  botonTerminar.disabled = true;
  guardar("fin_sesion", null);
});

function lateral() {
  const crudo = estado.car_x;
  if (Math.abs(crudo) < 5) {
    return 0;
  }
  return Math.max(-100, Math.min(100, crudo * GIRO));
}

function soltarObstaculo() {
  const tipos = ["cono", "caja", "barrera"];
  const carriles = [-48, 0, 48];
  const tipo = tipos[Math.floor(Math.random() * tipos.length)];
  let carril = carriles[Math.floor(Math.random() * carriles.length)];
  const adelante = 120 + Math.random() * 110;
  const marca = (s + adelante) % LARGO;
  const ocupado = MAPA.some((obs) => {
    const cerca = Math.min(Math.abs(obs.s - marca), LARGO - Math.abs(obs.s - marca));
    return cerca < 40 && obs.x === carril;
  });
  if (ocupado) {
    carril = carriles[(carriles.indexOf(carril) + 1) % carriles.length];
  }
  MAPA.push({ s: marca, x: carril, tipo });
}

function promedio() {
  if (muestrasVelocidad.length === 0) {
    return null;
  }
  const suma = muestrasVelocidad.reduce((acum, valor) => acum + valor, 0);
  return Math.round((suma / muestrasVelocidad.length) * 10) / 10;
}

function reiniciarTramo(ahora) {
  colisiones = 0;
  eventosObstaculo = 0;
  muestrasVelocidad = [];
  ultimoCruce = ahora;
  alertaPrev = estado.obstacle_alert;
  estabaFuera = Math.abs(estado.car_x) > CARRIL;
}

async function guardar(motivo, tiempo) {
  const respuesta = await fetch("/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento_id: crypto.randomUUID(),
      motivo,
      tiempo_vuelta: tiempo,
      colisiones,
      eventos_obstaculo: eventosObstaculo,
      velocidad_promedio: promedio(),
    }),
  });
  if (respuesta.ok) {
    await cargarHistorial();
  }
}

function delanteDe(marca) {
  return (marca - s + LARGO) % LARGO;
}

function horizonte() {
  return 228 + Math.sin(s / 95) * 14;
}

function proyectar(dist) {
  const norm = Math.max(0, Math.min(1, dist / REACH));
  const p = Math.pow(norm, 0.58);
  const y = BOTTOM + (horizonte() - BOTTOM) * p;
  const half = 470 + (34 - 470) * p;
  return { y, half, p };
}

function xEnPista(lateral, half) {
  return ROAD_X + (lateral / 100) * half;
}

function quad(ax, ay, bx, by, cx2, cy2, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx2, cy2);
  ctx.lineTo(dx, dy);
  ctx.closePath();
  ctx.fill();
}

function revisarGolpes() {
  for (const obs of MAPA) {
    const id = obs.s + ":" + obs.x;
    const delante = delanteDe(obs.s);
    if (delante < 20) {
      if (!yaGolpeado.has(id)) {
        yaGolpeado.add(id);
        if (Math.abs(lateral() - obs.x) < GOLPE_RADIO) {
          colisiones += 1;
          flashHasta = performance.now() + 220;
        }
      }
    } else if (delante > 180) {
      yaGolpeado.delete(id);
    }
  }
}

function dibujarCielo() {
  const h = horizonte();
  const cielo = ctx.createLinearGradient(0, 0, 0, h + 30);
  cielo.addColorStop(0, "#7ec8f8");
  cielo.addColorStop(0.55, "#b9e3ff");
  cielo.addColorStop(1, "#e7f6ff");
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, canvas.width, h + 40);
  const solX = 860 + Math.sin(s / 400) * 20;
  const glow = ctx.createRadialGradient(solX, 78, 8, solX, 78, 70);
  glow.addColorStop(0, "rgba(255,244,214,0.95)");
  glow.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(solX, 78, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.arc(solX, 78, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const nubes = [
    [140, 70, 54],
    [280, 110, 36],
    [640, 64, 48],
    [980, 96, 40],
  ];
  for (const [x, y, r] of nubes) {
    const cx = (x + s * 0.15) % (canvas.width + 160) - 80;
    ctx.beginPath();
    ctx.ellipse(cx, y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.7, y + 6, r * 0.72, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8fb89a";
  ctx.beginPath();
  ctx.moveTo(0, h + 8);
  ctx.lineTo(180, h - 36);
  ctx.lineTo(340, h + 6);
  ctx.lineTo(520, h - 48);
  ctx.lineTo(760, h + 4);
  ctx.lineTo(980, h - 28);
  ctx.lineTo(canvas.width, h + 10);
  ctx.lineTo(canvas.width, h + 36);
  ctx.lineTo(0, h + 36);
  ctx.fill();
  ctx.fillStyle = "#6e9a78";
  ctx.beginPath();
  ctx.moveTo(40, h + 18);
  ctx.lineTo(220, h - 10);
  ctx.lineTo(400, h + 20);
  ctx.lineTo(700, h - 6);
  ctx.lineTo(1100, h + 22);
  ctx.lineTo(1100, h + 36);
  ctx.lineTo(40, h + 36);
  ctx.fill();
}

function dibujarCamino() {
  ctx.fillStyle = "#187538";
  ctx.fillRect(0, horizonte() - 8, canvas.width, canvas.height);
  for (let i = SLICES; i >= 1; i -= 1) {
    const lejos = proyectar((i / SLICES) * REACH);
    const cerca = proyectar(((i - 1) / SLICES) * REACH);
    const world = s + (i / SLICES) * REACH;
    const banda = Math.floor(world / 28) % 2;
    ctx.fillStyle = banda ? "#1c8a40" : "#187538";
    quad(0, lejos.y, canvas.width, lejos.y, canvas.width, cerca.y, 0, cerca.y);

    const asfalto = Math.floor(58 + (1 - lejos.p) * 18);
    ctx.fillStyle = `rgb(${asfalto},${asfalto + 3},${asfalto + 10})`;
    quad(
      ROAD_X - lejos.half, lejos.y,
      ROAD_X + lejos.half, lejos.y,
      ROAD_X + cerca.half, cerca.y,
      ROAD_X - cerca.half, cerca.y,
    );

    const sa = lejos.half * 0.1;
    const sb = cerca.half * 0.1;
    ctx.fillStyle = "#c6a56a";
    quad(
      ROAD_X - lejos.half - sa, lejos.y,
      ROAD_X - lejos.half, lejos.y,
      ROAD_X - cerca.half, cerca.y,
      ROAD_X - cerca.half - sb, cerca.y,
    );
    quad(
      ROAD_X + lejos.half, lejos.y,
      ROAD_X + lejos.half + sa, lejos.y,
      ROAD_X + cerca.half + sb, cerca.y,
      ROAD_X + cerca.half, cerca.y,
    );

    const rumble = Math.floor(world / 14) % 2;
    ctx.fillStyle = rumble ? "#e11d48" : "#f8fafc";
    const ta = Math.max(1.5, lejos.half * 0.055);
    const tb = Math.max(1.5, cerca.half * 0.055);
    quad(
      ROAD_X - lejos.half - ta, lejos.y,
      ROAD_X - lejos.half, lejos.y,
      ROAD_X - cerca.half, cerca.y,
      ROAD_X - cerca.half - tb, cerca.y,
    );
    quad(
      ROAD_X + lejos.half, lejos.y,
      ROAD_X + lejos.half + ta, lejos.y,
      ROAD_X + cerca.half + tb, cerca.y,
      ROAD_X + cerca.half, cerca.y,
    );

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    const borde = 0.012;
    quad(
      ROAD_X - lejos.half, lejos.y,
      ROAD_X - lejos.half * (1 - borde), lejos.y,
      ROAD_X - cerca.half * (1 - borde), cerca.y,
      ROAD_X - cerca.half, cerca.y,
    );
    quad(
      ROAD_X + lejos.half * (1 - borde), lejos.y,
      ROAD_X + lejos.half, lejos.y,
      ROAD_X + cerca.half, cerca.y,
      ROAD_X + cerca.half * (1 - borde), cerca.y,
    );

    if (Math.floor(world / 18) % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (const carril of [-0.33, 0.33]) {
        quad(
          ROAD_X + lejos.half * carril - ta * 0.25, lejos.y,
          ROAD_X + lejos.half * carril + ta * 0.25, lejos.y,
          ROAD_X + cerca.half * carril + tb * 0.25, cerca.y,
          ROAD_X + cerca.half * carril - tb * 0.25, cerca.y,
        );
      }
    }
  }
}

function dibujarMeta() {
  const dist = delanteDe(0);
  if (dist <= 8 || dist >= REACH) {
    return;
  }
  const a = proyectar(dist + 6);
  const b = proyectar(dist);
  const columnas = 10;
  for (let i = 0; i < columnas; i += 1) {
    const t0 = i / columnas;
    const t1 = (i + 1) / columnas;
    const lado = (v, t) => ROAD_X - v.half + v.half * 2 * t;
    ctx.fillStyle = (i + Math.floor(dist / 8)) % 2 === 0 ? "#f8fafc" : "#111827";
    quad(lado(a, t0), a.y, lado(a, t1), a.y, lado(b, t1), b.y, lado(b, t0), b.y);
  }
  if (dist > 40 && dist < 220) {
    const poste = proyectar(dist);
    const escala = poste.half / 470;
    ctx.strokeStyle = "#123524";
    ctx.lineWidth = Math.max(2, 8 * escala);
    ctx.beginPath();
    ctx.moveTo(ROAD_X - poste.half, poste.y);
    ctx.lineTo(ROAD_X - poste.half, poste.y - 70 * escala);
    ctx.lineTo(ROAD_X + poste.half, poste.y - 70 * escala);
    ctx.lineTo(ROAD_X + poste.half, poste.y);
    ctx.stroke();
    ctx.fillStyle = "#b6f27c";
    ctx.font = "700 " + Math.max(10, 22 * escala) + "px Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HEADRACE", ROAD_X, poste.y - 78 * escala);
  }
}

function dibujarArbol(lado, dist) {
  if (dist < 10 || dist > REACH) {
    return;
  }
  const p = proyectar(dist);
  const x = xEnPista(lado * 128, p.half);
  const escala = Math.max(0.08, p.half / 470);
  const alto = 150 * escala;
  const ancho = 54 * escala;
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(x - 4 * escala, p.y - alto * 0.45, 8 * escala, alto * 0.45);
  ctx.fillStyle = "#146b34";
  ctx.beginPath();
  ctx.arc(x, p.y - alto * 0.62, ancho, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f8a45";
  ctx.beginPath();
  ctx.arc(x - ancho * 0.35, p.y - alto * 0.78, ancho * 0.72, 0, Math.PI * 2);
  ctx.arc(x + ancho * 0.4, p.y - alto * 0.7, ancho * 0.66, 0, Math.PI * 2);
  ctx.fill();
}

function dibujarObstaculo(obs) {
  const dist = delanteDe(obs.s);
  if (dist < 6 || dist > REACH) {
    return dist;
  }
  const p = proyectar(dist);
  const x = xEnPista(obs.x, p.half);
  const escala = Math.max(0.14, (p.half / 470) * 1.75);
  ctx.save();
  ctx.translate(x, p.y);
  ctx.scale(escala, escala);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (obs.tipo === "cono") {
    ctx.fillStyle = "#9a3412";
    ctx.fillRect(-20, -4, 40, 8);
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.lineTo(26, -4);
    ctx.lineTo(-26, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffedd5";
    ctx.beginPath();
    ctx.moveTo(-16, -28);
    ctx.lineTo(16, -28);
    ctx.lineTo(12, -18);
    ctx.lineTo(-12, -18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -52);
    ctx.lineTo(10, -52);
    ctx.lineTo(7, -42);
    ctx.lineTo(-7, -42);
    ctx.fill();
  } else if (obs.tipo === "caja") {
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(-34, -8);
    ctx.lineTo(34, -8);
    ctx.lineTo(46, -24);
    ctx.lineTo(-22, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d97706";
    ctx.fillRect(-34, -8, 68, 52);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 3;
    ctx.strokeRect(-34, -8, 68, 52);
    ctx.beginPath();
    ctx.moveTo(-34, 16);
    ctx.lineTo(34, 16);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 44);
    ctx.stroke();
    ctx.fillStyle = "#fef3c7";
    ctx.font = "700 18px Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HR", 0, 22);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(-46, -8, 10, 28);
    ctx.fillRect(36, -8, 10, 28);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-48, -36, 96, 30);
    ctx.fillStyle = "#e11d48";
    for (let i = -48; i < 48; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, -36);
      ctx.lineTo(i + 12, -36);
      ctx.lineTo(i + 20, -6);
      ctx.lineTo(i + 8, -6);
      ctx.fill();
    }
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(-28, -21, 4, 0, Math.PI * 2);
    ctx.arc(28, -21, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return dist;
}

function dibujarKart() {
  const pos = lateral();
  const ancla = proyectar(5);
  const x = xEnPista(pos, ancla.half);
  const y = ancla.y + 4;
  const fuera = Math.abs(pos) > CARRIL;
  const alerta = estado.obstacle_alert;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pos / 380);
  ctx.scale(1.7, 1.7);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 58, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  if (fuera) {
    ctx.fillStyle = "rgba(120, 92, 48, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-30, 10, 14, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(32, 8, 12, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function rueda(cx) {
    ctx.fillStyle = "#0b0f14";
    ctx.beginPath();
    ctx.ellipse(cx, 4, 14, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(cx, 4, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  rueda(-40);
  rueda(40);

  ctx.fillStyle = alerta ? "#7c2d12" : "#052e16";
  ctx.beginPath();
  ctx.moveTo(-28, 18);
  ctx.lineTo(28, 18);
  ctx.lineTo(22, 6);
  ctx.lineTo(-22, 6);
  ctx.closePath();
  ctx.fill();

  const cuerpo = ctx.createLinearGradient(0, -48, 0, 16);
  if (alerta) {
    cuerpo.addColorStop(0, "#ffedd5");
    cuerpo.addColorStop(1, "#ea580c");
  } else {
    cuerpo.addColorStop(0, "#ecfdf5");
    cuerpo.addColorStop(0.45, "#34d399");
    cuerpo.addColorStop(1, "#047857");
  }
  ctx.fillStyle = cuerpo;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(18, -28);
  ctx.lineTo(30, 2);
  ctx.lineTo(24, 14);
  ctx.lineTo(-24, 14);
  ctx.lineTo(-30, 2);
  ctx.lineTo(-18, -28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = alerta ? "#9a3412" : "#064e3b";
  ctx.beginPath();
  ctx.moveTo(-16, -6);
  ctx.lineTo(16, -6);
  ctx.lineTo(12, 10);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(0, -16, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(0, -22, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#67e8f9";
  ctx.fillRect(-7, -20, 14, 4);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-12, 2, 24, 10);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 8px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HR", 0, 10);

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(-16, 12, 3.2, 0, Math.PI * 2);
  ctx.arc(16, 12, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-46, -34, 4, 22);
  ctx.fillRect(42, -34, 4, 22);
  ctx.fillStyle = alerta ? "#fdba74" : "#6ee7b7";
  ctx.fillRect(-46, -36, 92, 7);
  ctx.fillStyle = "#022c22";
  ctx.fillRect(-30, -34, 60, 3);

  if (estado.car_speed > 55) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 22);
    ctx.lineTo(-24, 40);
    ctx.moveTo(18, 22);
    ctx.lineTo(26, 40);
    ctx.stroke();
  }
  ctx.restore();
}

function panel(x, y, w, h) {
  ctx.fillStyle = "rgba(8, 16, 28, 0.72)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function dibujarHud() {
  panel(18, 16, 168, 78);
  ctx.textAlign = "left";
  ctx.fillStyle = "#dbeafe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("VELOCIDAD", 32, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(String(estado.recibido ? estado.car_speed : "—"), 32, 72);

  panel(198, 16, 150, 78);
  ctx.fillStyle = "#dbeafe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("TRAMO", 214, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(ultimoCruce === 0 ? "—" : segundosVuelta.toFixed(1) + "s", 214, 70);

  panel(360, 16, 120, 78);
  ctx.fillStyle = "#dbeafe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("CHOQUES", 376, 36);
  ctx.fillStyle = colisiones > 0 ? "#fb7185" : "#ffffff";
  ctx.font = "700 28px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(String(colisiones), 376, 70);

  panel(980, 120, 96, 390);
  ctx.fillStyle = "#dbeafe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("MAPA", 1004, 142);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(1020, 158, 16, 320);
  for (const obs of MAPA) {
    const dist = delanteDe(obs.s);
    const y = 470 - (dist / LARGO) * 300;
    ctx.fillStyle = obs.tipo === "cono" ? "#fb923c" : obs.tipo === "caja" ? "#fbbf24" : "#fb7185";
    ctx.fillRect(1016 + (obs.x > 0 ? 12 : obs.x < 0 ? 0 : 6), y, 8, 8);
  }
  ctx.fillStyle = "#b6f27c";
  ctx.beginPath();
  ctx.moveTo(1028, 468);
  ctx.lineTo(1020, 482);
  ctx.lineTo(1036, 482);
  ctx.fill();

  panel(18, 470, 220, 150);
  ctx.fillStyle = "#dbeafe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("CÁMARA", 32, 490);
  if (hayVista && vista.complete && vista.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(32, 500, 192, 104, 8);
    ctx.clip();
    ctx.drawImage(vista, 32, 500, 192, 104);
    ctx.restore();
  }

  const textos = {
    con_rostro: "Rostro en pista",
    sin_rostro: "Sin rostro",
    sin_camara: "Sin cámara",
    esperando: "Conectando",
  };
  ctx.textAlign = "right";
  ctx.fillStyle = estado.captura === "con_rostro" ? "#b6f27c" : "#fde68a";
  ctx.font = "700 13px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(textos[estado.captura] || "Cámara", 960, 36);
  ctx.textAlign = "left";

  if (estado.obstacle_alert && !detenida) {
    ctx.fillStyle = "rgba(225, 29, 72, 0.88)";
    ctx.fillRect(500, 18, 220, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SENSOR · FRENANDO", 610, 42);
    ctx.textAlign = "left";
  }
  if (performance.now() < flashHasta) {
    ctx.fillStyle = "rgba(225, 29, 72, 0.28)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function actualizarAviso() {
  velocidadEl.textContent = String(estado.car_speed);
  tiempoEl.textContent = segundosVuelta.toFixed(1);
  colisionesEl.textContent = String(colisiones);
  capturaEl.textContent = estado.captura;
  if (detenida) {
    aviso.textContent = "Sesión terminada";
  } else if (estado.obstacle_alert) {
    aviso.textContent = "Obstáculo del sensor · frenando";
  } else if (estado.captura === "sin_rostro") {
    aviso.textContent = "Pon la cara frente a la cámara";
  } else if (estado.captura === "sin_camara") {
    aviso.textContent = "No se pudo abrir la cámara";
  } else {
    aviso.textContent = "";
  }
}

function dibujar(ahora) {
  const dt = ultimoFrame === 0 ? 0 : Math.min(DT_MAX, (ahora - ultimoFrame) / 1000);
  ultimoFrame = ahora;
  if (estado.recibido && !detenida) {
    if (ultimoCruce === 0) {
      ultimoCruce = ahora;
    }
    segundosVuelta = (ahora - ultimoCruce) / 1000;
    const antes = s;
    const avance = (estado.car_speed / 100) * AVANCE * dt;
    s = (s + avance) % LARGO;
    revisarGolpes();
    if (avance > 0 && s < antes && ahora - ultimoCruce >= ESPERA_VUELTA_MS) {
      const tiempo = segundosVuelta;
      const fotoColisiones = colisiones;
      const fotoEventos = eventosObstaculo;
      const fotoPromedio = promedio();
      reiniciarTramo(ahora);
      fetch("/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: crypto.randomUUID(),
          motivo: "vuelta_completa",
          tiempo_vuelta: Math.round(tiempo * 10) / 10,
          colisiones: fotoColisiones,
          eventos_obstaculo: fotoEventos,
          velocidad_promedio: fotoPromedio,
        }),
      }).then((respuesta) => {
        if (respuesta.ok) {
          cargarHistorial();
        }
      });
    }
  }

  dibujarCielo();
  dibujarCamino();
  dibujarMeta();
  const adornos = [];
  for (let marca = 0; marca < LARGO; marca += 55) {
    adornos.push({ dist: delanteDe(marca), lado: marca % 110 === 0 ? -1 : 1 });
  }
  adornos.sort((a, b) => b.dist - a.dist);
  for (const arbol of adornos) {
    dibujarArbol(arbol.lado, arbol.dist);
  }
  const orden = MAPA.map((obs) => ({ obs, dist: delanteDe(obs.s) })).sort((a, b) => b.dist - a.dist);
  for (const item of orden) {
    dibujarObstaculo(item.obs);
  }
  dibujarKart();
  dibujarHud();
  actualizarAviso();
  requestAnimationFrame(dibujar);
}

async function cargarHistorial() {
  const respuesta = await fetch("/historial");
  if (!respuesta.ok) {
    return;
  }
  const filas = await respuesta.json();
  const cuerpo = document.getElementById("filas");
  const tabla = document.getElementById("tabla");
  const vacio = document.getElementById("vacio");
  cuerpo.replaceChildren();
  if (!Array.isArray(filas) || filas.length === 0) {
    tabla.hidden = true;
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;
  tabla.hidden = false;
  for (const fila of filas) {
    const tr = document.createElement("tr");
    const fecha = String(fila.fecha_hora).replace("T", " ").replace("Z", "");
    for (const texto of [
      Number(fila.tiempo_vuelta).toFixed(1) + " s",
      fila.colisiones,
      fila.eventos_obstaculo,
      fila.velocidad_promedio ?? "—",
      fecha,
    ]) {
      const td = document.createElement("td");
      td.textContent = String(texto);
      tr.appendChild(td);
    }
    cuerpo.appendChild(tr);
  }
}

cargarHistorial();
requestAnimationFrame(dibujar);
