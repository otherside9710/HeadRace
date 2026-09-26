import { clima, juego, proyectar, xEnPista, lateral, CARRIL } from "./estado.js?v=2";

export function dibujarObstaculo(ctx, obs, dist) {
  const p = proyectar(dist);
  const x = xEnPista(obs.x, p.half);
  const escala = Math.min(1.05, Math.max(0.1, p.half / (juego.ancho * 0.4)));
  ctx.save();
  ctx.translate(x, p.y);
  ctx.scale(escala, escala);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (obs.tipo === "cono") {
    ctx.fillStyle = "#9a3412";
    ctx.fillRect(-16, -3, 32, 7);
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(20, -2);
    ctx.lineTo(-20, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.moveTo(-12, -24);
    ctx.lineTo(12, -24);
    ctx.lineTo(9, -16);
    ctx.lineTo(-9, -16);
    ctx.fill();
  } else if (obs.tipo === "caja") {
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.lineTo(28, -6);
    ctx.lineTo(38, -20);
    ctx.lineTo(-18, -20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d97706";
    ctx.fillRect(-28, -6, 56, 42);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.strokeRect(-28, -6, 56, 42);
    ctx.fillStyle = "#fef3c7";
    ctx.font = "700 14px Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HR", 0, 20);
  } else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(-38, -4, 8, 18);
    ctx.fillRect(30, -4, 8, 18);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-40, -26, 80, 22);
    ctx.fillStyle = "#e11d48";
    for (let i = -40; i < 40; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, -26);
      ctx.lineTo(i + 10, -26);
      ctx.lineTo(i + 16, -4);
      ctx.lineTo(i + 6, -4);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function dibujarKart(ctx) {
  const pos = lateral();
  const ancla = proyectar(108);
  const x = xEnPista(pos, ancla.half);
  const y = ancla.y;
  const fuera = Math.abs(pos) > CARRIL;
  const c = clima();
  const vel = Math.max(0, Math.min(1, juego.estado.car_speed / 100));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pos / 520);
  ctx.scale(1.35, 1.35);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(6, 18, 62, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  if (fuera) {
    ctx.fillStyle = "rgba(120,92,48,0.35)";
    ctx.beginPath();
    ctx.ellipse(-34, 12, 16, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(40, 10, 14, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function rueda(cx) {
    const giro = (juego.s * 0.35) % 10;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(cx, 2, 15, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(203,213,225,0.7)";
    ctx.beginPath();
    ctx.moveTo(cx, 2 - 8 + giro);
    ctx.lineTo(cx, 2 + 4);
    ctx.stroke();
  }
  rueda(-42);
  rueda(42);

  const cuerpo = ctx.createLinearGradient(0, -58, 0, 18);
  cuerpo.addColorStop(0, "#67e8f9");
  cuerpo.addColorStop(0.45, "#0891b2");
  cuerpo.addColorStop(1, "#155e75");
  ctx.fillStyle = cuerpo;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(20, -30);
  ctx.lineTo(32, 0);
  ctx.lineTo(26, 16);
  ctx.lineTo(-26, 16);
  ctx.lineTo(-32, 0);
  ctx.lineTo(-20, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.fillRect(-18, -8, 36, 6);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(0, -18, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.ellipse(0, -24, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.fillRect(-3, -30, 6, 12);
  ctx.fillStyle = "#e0f2fe";
  ctx.fillRect(-8, -20, 16, 4);

  ctx.fillStyle = c.noche > 0.4 ? "#ef4444" : "#b91c1c";
  ctx.shadowColor = c.noche > 0.4 ? "#ef4444" : "transparent";
  ctx.shadowBlur = c.noche > 0.4 ? 12 : 0;
  ctx.beginPath();
  ctx.arc(-16, 12, 3.4, 0, Math.PI * 2);
  ctx.arc(16, 12, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#082f49";
  ctx.fillRect(-48, -36, 5, 20);
  ctx.fillRect(43, -36, 5, 20);
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(-48, -38, 96, 7);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-11, 2, 22, 9);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 8px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HR", 0, 9);

  if (vel > 0.45) {
    ctx.fillStyle = `rgba(56,189,248,${0.35 + vel * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(-10, 22, 4, 8 + vel * 8, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 22, 4, 8 + vel * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
