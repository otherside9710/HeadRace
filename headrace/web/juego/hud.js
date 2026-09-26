import { LARGO, clima, delanteDe, juego, lateral } from "./estado.js?v=2";

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(8, 18, 36, 0.55)";
  ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();
}

export function dibujarHud(ctx) {
  const c = clima();
  const vel = juego.estado.recibido ? juego.estado.car_speed : 0;
  panel(ctx, 22, 16, 230, 86);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.9)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(68, 62, 26, Math.PI * 0.85, Math.PI * 0.85 + Math.PI * 1.3 * (vel / 100));
  ctx.stroke();
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("VELOCIDAD", 108, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(String(vel), 108, 68);
  ctx.font = "600 12px Avenir Next, Segoe UI, sans-serif";
  ctx.fillStyle = "#bae6fd";
  ctx.fillText("km/h", 168, 68);

  panel(ctx, 264, 16, 150, 86);
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("TRAMO", 280, 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(juego.ultimoCruce === 0 ? "—" : juego.segundosVuelta.toFixed(1) + "s", 280, 72);

  panel(ctx, 426, 16, 140, 86);
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("CHOQUES", 442, 38);
  ctx.fillStyle = juego.colisiones > 0 ? "#fb7185" : "#ffffff";
  ctx.font = "700 28px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(String(juego.colisiones), 442, 72);

  panel(ctx, juego.ancho - 168, 16, 146, 42);
  ctx.fillStyle = "#fef9c3";
  ctx.font = "700 14px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(c.etiqueta, juego.ancho - 95, 43);

  panel(ctx, juego.ancho - 150, 130, 118, 390);
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("MAPA", juego.ancho - 128, 152);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(juego.ancho - 91, 176);
  ctx.lineTo(juego.ancho - 91, 480);
  ctx.stroke();
  for (const obs of juego.mapa) {
    const dist = delanteDe(obs.s);
    const y = 470 - (dist / LARGO) * 280;
    ctx.fillStyle = obs.tipo === "cono" ? "#fb923c" : obs.tipo === "caja" ? "#fbbf24" : "#fb7185";
    ctx.fillRect(juego.ancho - 104 + (obs.x > 0 ? 16 : obs.x < 0 ? 0 : 8), y, 8, 8);
  }
  const pulso = 1 + Math.sin(performance.now() / 180) * 0.08;
  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.moveTo(juego.ancho - 91, 468);
  ctx.lineTo(juego.ancho - 91 - 8 * pulso, 484);
  ctx.lineTo(juego.ancho - 91 + 8 * pulso, 484);
  ctx.fill();

  const camX = 22;
  const camY = juego.alto - 268;
  panel(ctx, camX, camY, 250, 156);
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "600 11px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CÁMARA", camX + 16, camY + 22);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(camX + 210, camY + 18, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#bbf7d0";
  ctx.font = "700 10px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("LIVE", camX + 188, camY + 22);
  if (juego.hayVista && juego.vista.complete && juego.vista.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(camX + 14, camY + 32, 222, 108, 10);
    ctx.clip();
    ctx.drawImage(juego.vista, camX + 14, camY + 32, 222, 108);
    ctx.restore();
  }

  const textos = {
    con_rostro: "Rostro en pista",
    sin_rostro: "Sin rostro",
    sin_camara: "Sin cámara",
    esperando: "Conectando",
  };
  ctx.textAlign = "right";
  ctx.fillStyle = juego.estado.captura === "con_rostro" ? "#bbf7d0" : "#fde68a";
  ctx.font = "700 13px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(textos[juego.estado.captura] || "Cámara", juego.ancho - 180, 42);

  if (juego.estado.obstacle_alert && !juego.detenida) {
    ctx.fillStyle = "rgba(225, 29, 72, 0.88)";
    ctx.beginPath();
    ctx.roundRect(juego.ancho * 0.5 - 110, 112, 220, 34, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SENSOR · FRENANDO", juego.ancho * 0.5, 134);
  }
  if (performance.now() < juego.flashHasta) {
    ctx.fillStyle = "rgba(248, 113, 113, 0.22)";
    ctx.fillRect(0, 0, juego.ancho, juego.alto);
  }
  ctx.textAlign = "left";
}

export function niebla(ctx) {
  const c = clima();
  const y = juego.alto * 0.3;
  const velo = ctx.createLinearGradient(0, y - 10, 0, y + 70);
  velo.addColorStop(0, "rgba(255,255,255,0)");
  velo.addColorStop(1, c.noche > 0.5 ? "rgba(8,12,28,0.35)" : "rgba(255,255,255,0.18)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, y - 10, juego.ancho, 80);
}

export { lateral };
