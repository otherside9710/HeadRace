import { LARGO, clima, delanteDe, juego } from "./estado.js";

export function actualizarInterfaz() {
  const c = clima();
  const vel = juego.estado.recibido ? juego.estado.car_speed : 0;
  const arco = document.getElementById("arco");
  if (arco) {
    const largo = 126;
    arco.style.strokeDasharray = String(largo);
    arco.style.strokeDashoffset = String(largo * (1 - vel / 100));
  }
  const dia = document.getElementById("etiqueta-dia");
  if (dia) {
    dia.textContent = c.etiqueta;
  }
  const impacto = document.getElementById("impacto");
  if (impacto) {
    impacto.classList.toggle("activo", performance.now() < juego.flashHasta);
  }
  const marcas = document.getElementById("marcas");
  if (!marcas) {
    return;
  }
  while (marcas.children.length < juego.mapa.length) {
    marcas.appendChild(document.createElement("i"));
  }
  while (marcas.children.length > juego.mapa.length) {
    marcas.lastChild.remove();
  }
  juego.mapa.forEach((obs, i) => {
    const dist = delanteDe(obs.s);
    const el = marcas.children[i];
    el.style.top = `${6 + (1 - dist / LARGO) * 82}%`;
    el.style.left = obs.x < 0 ? "22%" : obs.x > 0 ? "62%" : "42%";
    el.className = obs.tipo;
  });
  const jugador = document.getElementById("jugador");
  if (jugador) {
    jugador.style.transform = `translateX(${Math.sin(performance.now() / 180) * 2}px)`;
  }
}
