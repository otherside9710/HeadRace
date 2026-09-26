import { useEffect, useState } from "react";
import { activarAudio, actualizarMotor, silenciarAudio } from "../game/audio";
import {
  carrera,
  cargarHistorial,
  conectar,
  momento,
  soltarObstaculo,
  terminarSesion,
  type Fila,
} from "../game/carrera";
import "./hud.css";

export function Hud() {
  const [, setTick] = useState(0);
  const [sonido, setSonido] = useState(false);
  useEffect(() => {
    conectar();
    void cargarHistorial();
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      actualizarMotor(carrera.carSpeed, carrera.recibido && !carrera.detenida);
    }, 120);
    return () => {
      window.clearInterval(id);
      actualizarMotor(0, false);
    };
  }, []);
  const fase = momento();
  const vel = carrera.recibido ? carrera.carSpeed : 0;
  const aviso = carrera.detenida
    ? "Sesión terminada"
    : carrera.alert
      ? "Obstáculo del sensor · frenando"
      : carrera.captura === "sin_rostro"
        ? "Pon la cara frente a la cámara"
        : carrera.captura === "sin_camara"
          ? "No se pudo abrir la cámara"
          : "";
  return (
    <>
      <div className="hud">
        <div className="medidores">
          <div className="vidrio vel">
            <Medidor valor={vel} />
            <div>
              <span>VELOCIDAD</span>
              <strong>{vel}</strong>
              <small> km/h</small>
            </div>
          </div>
          <div className="vidrio">
            <span>TRAMO</span>
            <strong>{carrera.ultimoCruce === 0 ? "—" : carrera.segundos.toFixed(1) + "s"}</strong>
          </div>
          <div className="vidrio">
            <span>CHOQUES</span>
            <strong className={carrera.colisiones > 0 ? "malo" : ""}>{carrera.colisiones}</strong>
          </div>
        </div>
        <div className={`dia fase-${fase.etiqueta.toLowerCase()}`} aria-live="polite">
          <span className="fase-icon" aria-hidden="true">
            {fase.etiqueta === "Noche" ? "☾" : fase.etiqueta === "Amanecer" ? "◒" : fase.etiqueta === "Tarde" ? "◉" : "☼"}
          </span>
          <span>{fase.etiqueta}</span>
          <span className="fase-track" aria-hidden="true"><i style={{ transform: `scaleX(${fase.hora})` }} /></span>
        </div>
        <Mapa />
        <div className="camara">
          <header>
            <span>CÁMARA</span>
            <em>LIVE</em>
          </header>
          {carrera.vista ? <img src={carrera.vista} alt="Cámara" /> : <div className="vacio-cam" />}
        </div>
        {aviso ? <p className="aviso">{aviso}</p> : null}
        <div className="controles">
          <button
            type="button"
            aria-pressed={sonido}
            onClick={async () => {
              if (sonido) {
                silenciarAudio();
                setSonido(false);
              } else {
                setSonido(await activarAudio());
              }
            }}
          >
            {sonido ? "🔊 Sonido activado" : "🔇 Activar sonido"}
          </button>
          <button type="button" onClick={soltarObstaculo}>Simular obstáculo</button>
          <button type="button" className="fin" onClick={terminarSesion} disabled={carrera.detenida}>
            Terminar sesión
          </button>
        </div>
        <div className={performance.now() < carrera.flashHasta ? "impacto on" : "impacto"} />
      </div>
      <Tiempos filas={carrera.filas} />
    </>
  );
}

function Medidor({ valor }: { valor: number }) {
  const largo = 126;
  return (
    <svg className="gauge" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="6" />
      <circle
        cx="30"
        cy="30"
        r="20"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={largo}
        strokeDashoffset={largo * (1 - valor / 100)}
        transform="rotate(-90 30 30)"
      />
    </svg>
  );
}

function Mapa() {
  return (
    <div className="mapa">
      <p>MAPA</p>
      <div className="trazo" />
      {carrera.mapa.map((obs, i) => {
        const frente = (obs.s - carrera.s + 1000) % 1000;
        return (
          <i
            key={`${obs.s}-${i}`}
            className={obs.tipo}
            style={{
              top: `${8 + (1 - frente / 1000) * 78}%`,
              left: obs.carril === 0 ? "28%" : obs.carril === 2 ? "62%" : "46%",
            }}
          />
        );
      })}
      <b />
    </div>
  );
}

function Tiempos({ filas }: { filas: Fila[] }) {
  if (filas.length === 0) {
    return (
      <section className="tiempos">
        <h2>Mejores tiempos</h2>
        <p>Sin vueltas todavía</p>
      </section>
    );
  }
  return (
    <section className="tiempos">
      <h2>Mejores tiempos</h2>
      <table>
        <thead>
          <tr>
            <th>Tiempo</th>
            <th>Colisiones</th>
            <th>Alertas</th>
            <th>Velocidad</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.fecha_hora + String(fila.tiempo_vuelta)}>
              <td>{Number(fila.tiempo_vuelta).toFixed(1)} s</td>
              <td>{fila.colisiones}</td>
              <td>{fila.eventos_obstaculo}</td>
              <td>{fila.velocidad_promedio ?? "—"}</td>
              <td>{String(fila.fecha_hora).replace("T", " ").replace("Z", "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
