import { REACH, astro, clima, delanteDe, horizonte, juego, proyectar, xEnPista } from "./estado.js?v=2";

function quad(ctx, ax, ay, bx, by, cx, cy, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.closePath();
  ctx.fill();
}

export function dibujarCielo(ctx) {
  const h = horizonte();
  const c = clima();
  const cielo = ctx.createLinearGradient(0, 0, 0, h + 40);
  cielo.addColorStop(0, c.top);
  cielo.addColorStop(0.55, c.mid);
  cielo.addColorStop(1, c.bot);
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, juego.ancho, h + 50);

  if (c.noche > 0.15) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * c.noche})`;
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 97 + 20) % juego.ancho;
      const y = (i * 53) % (h - 20);
      const r = i % 5 === 0 ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const cuerpo = astro();
  if (cuerpo.alpha > 0.05) {
    const glow = ctx.createRadialGradient(cuerpo.x, cuerpo.y, 8, cuerpo.x, cuerpo.y, 78);
    if (cuerpo.tipo === "sol") {
      glow.addColorStop(0, `rgba(255,244,210,${0.95 * cuerpo.alpha})`);
      glow.addColorStop(1, "rgba(255,244,210,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cuerpo.x, cuerpo.y, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,248,220,${cuerpo.alpha})`;
      ctx.beginPath();
      ctx.arc(cuerpo.x, cuerpo.y, 22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      glow.addColorStop(0, `rgba(210,224,255,${0.55 * cuerpo.alpha})`);
      glow.addColorStop(1, "rgba(210,224,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cuerpo.x, cuerpo.y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(236,242,255,${cuerpo.alpha})`;
      ctx.beginPath();
      ctx.arc(cuerpo.x, cuerpo.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.top;
      ctx.beginPath();
      ctx.arc(cuerpo.x + 6, cuerpo.y - 3, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = `rgba(255,255,255,${0.78 - c.noche * 0.45})`;
  const nubes = [
    [160, 78, 58],
    [340, 120, 36],
    [620, 64, 50],
    [900, 108, 42],
    [1100, 70, 34],
  ];
  for (const [x, y, r] of nubes) {
    const cx = (x + juego.hora * 80) % (juego.ancho + 180) - 90;
    ctx.beginPath();
    ctx.ellipse(cx, y, r, r * 0.58, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.65, y + 6, r * 0.7, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.monte;
  ctx.beginPath();
  ctx.moveTo(0, h + 18);
  ctx.lineTo(140, h - 70);
  ctx.lineTo(280, h - 18);
  ctx.lineTo(430, h - 96);
  ctx.lineTo(590, h - 10);
  ctx.lineTo(760, h - 78);
  ctx.lineTo(940, h - 8);
  ctx.lineTo(1120, h - 64);
  ctx.lineTo(juego.ancho, h + 8);
  ctx.lineTo(juego.ancho, h + 36);
  ctx.lineTo(0, h + 36);
  ctx.fill();
  ctx.fillStyle = c.monte2;
  ctx.beginPath();
  ctx.moveTo(40, h + 24);
  ctx.lineTo(220, h - 28);
  ctx.lineTo(380, h + 16);
  ctx.lineTo(560, h - 20);
  ctx.lineTo(780, h + 20);
  ctx.lineTo(980, h - 12);
  ctx.lineTo(juego.ancho, h + 22);
  ctx.lineTo(juego.ancho, h + 36);
  ctx.lineTo(40, h + 36);
  ctx.fill();

  ctx.fillStyle = c.mar;
  ctx.beginPath();
  ctx.moveTo(juego.ancho * 0.62, h + 8);
  ctx.lineTo(juego.ancho, h - 6);
  ctx.lineTo(juego.ancho, h + 34);
  ctx.lineTo(juego.ancho * 0.7, h + 28);
  ctx.fill();
}

export function dibujarEntorno(ctx) {
  const piezas = [];
  for (let marca = 0; marca < 1000; marca += 70) {
    const dist = delanteDe(marca);
    if (dist > 12 && dist < REACH) {
      const lado = marca % 140 === 0 ? -1 : 1;
      const variante = (marca / 70) % 3;
      piezas.push({ dist, lado, variante, marca });
    }
  }
  piezas.sort((a, b) => b.dist - a.dist);
  for (const pieza of piezas) {
    dibujarPalmera(ctx, pieza);
  }
}

function dibujarPalmera(ctx, pieza) {
  const p = proyectar(pieza.dist);
  const lateral = pieza.lado * (138 + (pieza.variante === 1 ? 18 : 0));
  const x = xEnPista(lateral, p.half);
  const escala = Math.max(0.08, p.half / (juego.ancho * 0.4));
  const balanceo = Math.sin(juego.s / 18 + pieza.marca) * 0.12;
  const alto = 168 * escala;
  ctx.save();
  ctx.translate(x, p.y);
  ctx.rotate(balanceo * pieza.lado);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 18 * escala, 6 * escala, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = clima().noche > 0.5 ? "#3a2a1c" : "#8a5a32";
  ctx.fillRect(-4 * escala, -alto * 0.72, 8 * escala, alto * 0.72);
  ctx.fillStyle = clima().noche > 0.5 ? "#145032" : "#1f8a45";
  for (let i = 0; i < 6; i += 1) {
    const ang = -Math.PI / 2 + (i - 2.5) * 0.42;
    ctx.beginPath();
    ctx.ellipse(Math.cos(ang) * 28 * escala, -alto * 0.72 + Math.sin(ang) * 10 * escala, 26 * escala, 7 * escala, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pieza.variante === 2) {
    ctx.fillStyle = clima().calor > 0.4 ? "#fb7185" : "#f472b6";
    ctx.beginPath();
    ctx.arc(-16 * escala, -6 * escala, 5 * escala, 0, Math.PI * 2);
    ctx.arc(14 * escala, 2 * escala, 4 * escala, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export { quad };
