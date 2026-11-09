import { useEffect, useState } from "react";
import { activarAudio, actualizarMotor, silenciarAudio } from "../game/audio";
import {
  carrera,
  activarEscudo,
  cargarHistorial,
  conectar,
  desactivarEscudo,
  DURACION_ESCUDO_MS,
  ESQUIVAS_PARA_ESCUDO,
  iniciarCarrera,
  LIMITE_CHOQUES,
  momento,
  reiniciarCarrera,
  terminarSesion,
  type MejorCarrera,
} from "../game/carrera";
import "./hud.css";

export function Hud() {
  const [, setTick] = useState(0);
  const [sonido, setSonido] = useState(false);
  const [mostrarTop10, setMostrarTop10] = useState(false);
  useEffect(() => {
    conectar();
    void cargarHistorial();
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      actualizarMotor(carrera.carSpeed, carrera.iniciada && carrera.recibido && !carrera.detenida);
    }, 120);
    return () => {
      window.clearInterval(id);
      desactivarEscudo();
      actualizarMotor(0, false);
    };
  }, []);
  useEffect(() => {
    if (!mostrarTop10) return;
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMostrarTop10(false);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [mostrarTop10]);
  const fase = momento();
  const cargaEscudo = carrera.esquivasConsecutivas;
  const escudoListo = cargaEscudo >= ESQUIVAS_PARA_ESCUDO;
  const segundosEscudo = carrera.escudoActivo
    ? Math.max(0, Math.ceil((carrera.escudoHasta - performance.now()) / 1000))
    : 0;
  const llamasActivas = carrera.llamasHasta > performance.now();
  const vel = carrera.recibido && !carrera.detenida ? carrera.carSpeed : 0;
  const aviso = carrera.detenida
    ? ""
    : carrera.alert
      ? "Proximidad <400 mm · velocidad ajustada"
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
            <span>VUELTAS</span>
            <strong>{carrera.vueltasCarrera}</strong>
          </div>
        <div className="vidrio">
          <span>CHOQUES</span>
          <strong className={carrera.colisionesCarrera > 0 ? "malo" : ""}>{carrera.colisionesCarrera}</strong>
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
        {aviso || (carrera.errorGuardado && !carrera.detenida) ? (
          <div className={`aviso${carrera.derrotada ? " derrota" : ""}`}>
            {aviso ? <p>{aviso}</p> : null}
            {carrera.errorGuardado && !carrera.detenida ? <p className="error-guardado">{carrera.errorGuardado}</p> : null}
          </div>
        ) : null}
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
            {sonido ? "🔊 Desactivar sonido" : "🔇 Activar sonido"}
          </button>
          <span
            className={`estado-control${carrera.modoControl === "esp32" ? " control-esp32" : " control-simulado"}`}
            role="status"
            aria-live="polite"
            title={carrera.modoControl === "esp32"
              ? "El PID y la lógica difusa están ejecutándose en el firmware del ESP32"
              : "El ESP32 está desconectado; el backend ejecuta el respaldo simulado en Python"}
          >
            <i aria-hidden="true" />
            {carrera.modoControl === "esp32" ? "PID + lógica difusa · ESP32" : "Control simulado · ESP32 desconectado"}
          </span>
          <span className={`estado-sensor${carrera.sensorConectado ? " conectado" : ""}${llamasActivas ? " llamas-activas" : ""}`} role="status" aria-live="polite">
            <i aria-hidden="true" />
            {carrera.escudoActivo && carrera.sensorZona === "llamas"
              ? "Escudo activo · llamas bloqueadas"
              : llamasActivas
                ? "🔥 Llamas activas"
                : carrera.sensorManoDetectada
                  ? `Zona ${carrera.sensorZona} · ${carrera.sensorDistanciaMm ?? "—"} mm`
              : carrera.sensorConectado
                ? `VL53L0X conectado · ${carrera.sensorDistanciaMm ?? "—"} mm`
                : "VL53L0X sin conexión"}
          </span>
          <button
            type="button"
            className={`escudo${carrera.escudoActivo ? " activo" : escudoListo ? " listo" : ""}`}
            aria-pressed={carrera.escudoActivo}
            aria-label={carrera.escudoActivo
              ? `Escudo activo: ${segundosEscudo} segundos restantes`
              : escudoListo
                ? `Escudo cargado: pulsa el botón o pasa la mano frente al sensor para activarlo durante ${DURACION_ESCUDO_MS / 1000} segundos`
                : `Escudo cargando: esquiva ${ESQUIVAS_PARA_ESCUDO - cargaEscudo} obstáculos más`}
            disabled={carrera.detenida || carrera.escudoActivo || !escudoListo}
            onClick={activarEscudo}
          >
            <span aria-hidden="true">◈</span>
            {carrera.escudoActivo
              ? `Escudo activo · ${segundosEscudo}s`
              : escudoListo
                ? carrera.sensorConectado ? "Pasa la mano" : "Activar escudo"
                : `Esquiva ${cargaEscudo}/${ESQUIVAS_PARA_ESCUDO}`}
          </button>
          <button type="button" className="fin" onClick={terminarSesion} disabled={carrera.detenida}>
            Terminar sesión
          </button>
        </div>
        <div className={performance.now() < carrera.flashHasta ? "impacto on" : "impacto"} />
      </div>
      {!carrera.iniciada && !carrera.detenida ? (
        <div className="inicio-carrera">
          <section className="inicio-panel" aria-labelledby="titulo-inicio-carrera">
            <span className="inicio-etiqueta">HEADRACE · SISTEMAS DE CONTROL</span>
            <h1 id="titulo-inicio-carrera">¿Listo para correr?</h1>
            <p>Mira al frente para calibrar el centro. El motor y los efectos se activan al iniciar.</p>
            <button
              type="button"
              className="inicio-boton"
              onClick={async () => {
                const reproduccionAudio = activarAudio();
                iniciarCarrera();
                setTick((n) => n + 1);
                const audioActivo = await reproduccionAudio;
                setSonido(audioActivo);
              }}
            >
              ▶&nbsp; Iniciar carrera
            </button>
          </section>
        </div>
      ) : null}
      {carrera.detenida ? (
        <div className="fin-carrera-capa">
          <section
            className="fin-carrera-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-fin-carrera"
          >
            <span className="fin-carrera-etiqueta">HEADRACE · RESULTADO</span>
            <h2 id="titulo-fin-carrera">{carrera.derrotada ? "Carrera finalizada" : "Sesión terminada"}</h2>
            <p>
              {carrera.derrotada
                ? `Llegaste al límite de ${LIMITE_CHOQUES} choques.`
                : "Tu progreso quedó guardado. Cuando quieras, puedes volver a la pista."}
            </p>
            <div className="fin-carrera-resumen">
              <div><span>TRAMO</span><strong>{carrera.segundos.toFixed(1)} s</strong></div>
              <div><span>CHOQUES</span><strong>{carrera.colisionesCarrera}</strong></div>
              <div><span>VUELTAS</span><strong>{carrera.vueltasCarrera}</strong></div>
            </div>
            {carrera.errorGuardado ? <p className="error-guardado">{carrera.errorGuardado}</p> : null}
            <div className="fin-carrera-acciones">
              <button
                type="button"
                className="reiniciar"
                onClick={() => {
                  reiniciarCarrera();
                  setTick((n) => n + 1);
                }}
              >
                ↻&nbsp; Reiniciar carrera
              </button>
              <button type="button" onClick={() => setMostrarTop10(true)}>Ver TOP 10</button>
            </div>
          </section>
        </div>
      ) : null}
      {mostrarTop10 ? (
        <div className="modal-top10-capa" onClick={() => setMostrarTop10(false)}>
          <section
            className="modal-top10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-top10"
            onClick={(evento) => evento.stopPropagation()}
          >
            <header>
              <h2 id="titulo-top10">TOP 10 carreras</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setMostrarTop10(false)}>×</button>
            </header>
            <TablaCarreras filas={carrera.mejoresCarreras} />
          </section>
        </div>
      ) : null}
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
      {carrera.mapa.filter((obs) => obs.destruidoAt === undefined).map((obs, i) => {
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

function TablaCarreras({ filas }: { filas: MejorCarrera[] }) {
  if (filas.length === 0) return <p>Sin vueltas registradas todavía</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tramo</th>
          <th>Vueltas</th>
          <th>Choques</th>
        </tr>
      </thead>
      <tbody>
        {filas.slice(0, 10).map((fila) => (
          <tr key={fila.carrera_id}>
            <td>{String(fila.fecha_hora).replace("T", " ").replace("Z", "")}</td>
            <td>{Number(fila.tramo).toFixed(1)} s</td>
            <td>{fila.vueltas}</td>
            <td>{fila.colisiones}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
