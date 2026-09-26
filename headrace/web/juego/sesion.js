import {
  AVANCE,
  CARRIL,
  DT_MAX,
  ESPERA_VUELTA_MS,
  GOLPE_RADIO,
  LARGO,
  delanteDe,
  juego,
  lateral,
} from "./estado.js";

const aviso = document.getElementById("aviso");
const velocidadEl = document.getElementById("velocidad");
const tiempoEl = document.getElementById("tiempo");
const colisionesEl = document.getElementById("colisiones");
const capturaEl = document.getElementById("captura");
const botonObstaculo = document.getElementById("obstaculo");
const botonTerminar = document.getElementById("terminar");

const socket = io();

socket.on("connect", () => {
  socket.emit("simular_obstaculo", { activo: false });
});

socket.on("estado", (mensaje) => {
  juego.estado.car_x = Number(mensaje.car_x);
  juego.estado.car_speed = Number(mensaje.car_speed);
  juego.estado.obstacle_alert = Boolean(mensaje.obstacle_alert);
  juego.estado.captura = mensaje.captura || "con_rostro";
  juego.estado.recibido = true;
  if (!juego.detenida) {
    juego.muestrasVelocidad.push(juego.estado.car_speed);
    if (juego.estado.obstacle_alert && !juego.alertaPrev) {
      juego.eventosObstaculo += 1;
    }
    const fuera = Math.abs(lateral()) > CARRIL;
    if (fuera && !juego.estabaFuera) {
      marcarGolpe();
    }
    juego.estabaFuera = fuera;
    juego.alertaPrev = juego.estado.obstacle_alert;
  }
});

socket.on("vista", (mensaje) => {
  if (!mensaje || !mensaje.jpeg) {
    return;
  }
  juego.vista.src = "data:image/jpeg;base64," + mensaje.jpeg;
  juego.hayVista = true;
  const foto = document.getElementById("vista");
  if (foto && foto !== juego.vista) {
    foto.src = juego.vista.src;
  }
});

botonObstaculo.addEventListener("click", () => {
  soltarObstaculo();
});

botonTerminar.addEventListener("click", () => {
  if (juego.detenida) {
    return;
  }
  juego.detenida = true;
  botonTerminar.disabled = true;
  guardar("fin_sesion", null);
});

function marcarGolpe() {
  juego.colisiones += 1;
  const ahora = performance.now();
  juego.flashHasta = ahora + 220;
  juego.shakeHasta = ahora + 280;
}

function promedio() {
  if (juego.muestrasVelocidad.length === 0) {
    return null;
  }
  const suma = juego.muestrasVelocidad.reduce((acum, valor) => acum + valor, 0);
  return Math.round((suma / juego.muestrasVelocidad.length) * 10) / 10;
}

function reiniciarTramo(ahora) {
  juego.colisiones = 0;
  juego.eventosObstaculo = 0;
  juego.muestrasVelocidad = [];
  juego.ultimoCruce = ahora;
  juego.alertaPrev = juego.estado.obstacle_alert;
  juego.estabaFuera = Math.abs(lateral()) > CARRIL;
}

async function guardar(motivo, tiempo) {
  const respuesta = await fetch("/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento_id: crypto.randomUUID(),
      motivo,
      tiempo_vuelta: tiempo,
      colisiones: juego.colisiones,
      eventos_obstaculo: juego.eventosObstaculo,
      velocidad_promedio: promedio(),
    }),
  });
  if (respuesta.ok) {
    await cargarHistorial();
  }
}

function soltarObstaculo() {
  const tipos = ["cono", "caja", "barrera"];
  const carriles = [-48, 0, 48];
  const tipo = tipos[Math.floor(Math.random() * tipos.length)];
  let carril = carriles[Math.floor(Math.random() * carriles.length)];
  const adelante = 150 + Math.random() * 140;
  const marca = (juego.s + adelante) % LARGO;
  const ocupado = juego.mapa.some((obs) => {
    const cerca = Math.min(Math.abs(obs.s - marca), LARGO - Math.abs(obs.s - marca));
    return cerca < 40 && obs.x === carril;
  });
  if (ocupado) {
    carril = carriles[(carriles.indexOf(carril) + 1) % carriles.length];
  }
  juego.mapa.push({ s: marca, x: carril, tipo });
}

function revisarGolpes() {
  for (const obs of juego.mapa) {
    const id = obs.s + ":" + obs.x + ":" + obs.tipo;
    const delante = delanteDe(obs.s);
    if (delante < 22) {
      if (!juego.yaGolpeado.has(id)) {
        juego.yaGolpeado.add(id);
        if (Math.abs(lateral() - obs.x) < GOLPE_RADIO) {
          marcarGolpe();
        }
      }
    } else if (delante > 180) {
      juego.yaGolpeado.delete(id);
    }
  }
}

export function avanzar(ahora) {
  const dt = juego.ultimoFrame === 0 ? 0 : Math.min(DT_MAX, (ahora - juego.ultimoFrame) / 1000);
  juego.ultimoFrame = ahora;
  if (juego.estado.recibido && !juego.detenida) {
    if (juego.ultimoCruce === 0) {
      juego.ultimoCruce = ahora;
    }
    juego.segundosVuelta = (ahora - juego.ultimoCruce) / 1000;
    const antes = juego.s;
    const paso = (juego.estado.car_speed / 100) * AVANCE * dt;
    juego.s = (juego.s + paso) % LARGO;
    revisarGolpes();
    if (paso > 0 && juego.s < antes && ahora - juego.ultimoCruce >= ESPERA_VUELTA_MS) {
      const tiempo = juego.segundosVuelta;
      const fotoColisiones = juego.colisiones;
      const fotoEventos = juego.eventosObstaculo;
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
  return dt;
}

export function actualizarAviso() {
  velocidadEl.textContent = String(juego.estado.car_speed);
  tiempoEl.textContent = juego.segundosVuelta.toFixed(1);
  colisionesEl.textContent = String(juego.colisiones);
  const textos = {
    con_rostro: "LIVE",
    sin_rostro: "SIN ROSTRO",
    sin_camara: "SIN CÁMARA",
    esperando: "…",
  };
  capturaEl.textContent = textos[juego.estado.captura] || "LIVE";
  if (juego.detenida) {
    aviso.textContent = "Sesión terminada";
  } else if (juego.estado.obstacle_alert) {
    aviso.textContent = "Obstáculo del sensor · frenando";
  } else if (juego.estado.captura === "sin_rostro") {
    aviso.textContent = "Pon la cara frente a la cámara";
  } else if (juego.estado.captura === "sin_camara") {
    aviso.textContent = "No se pudo abrir la cámara";
  } else {
    aviso.textContent = "";
  }
}

export async function cargarHistorial() {
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
