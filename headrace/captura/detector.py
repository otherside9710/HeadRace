import logging
import time
from pathlib import Path

LOG = logging.getLogger("headrace")

_REINTENTO_S = 2.0
_ANCHO_DETECCION = 640
_ANCHO_VISTA = 320
_MODELO = Path(__file__).with_name("face_detection_yunet_2023mar.onnx")


class Captura:
    def __init__(self) -> None:
        self._cv2 = None
        self._cap = None
        self._detector = None
        self._aviso_emitido = False
        self._ultimo_intento = 0.0
        self._fallos = 0
        self._ultimo_rostro: float | None = None
        self._ultimo_offset = (0, 0)
        self._vista = None
        self._indice = None

    def leer(self) -> tuple[int, int, str]:
        if not self._asegurar():
            return 0, 0, "sin_camara"
        ok, frame = self._cap.read()
        if not ok or frame is None:
            self._fallos += 1
            if self._fallos >= 8:
                self._soltar()
            return 0, 0, "sin_camara"
        self._fallos = 0
        frame = self._cv2.flip(frame, 1)
        pequeno = _reducir(self._cv2, frame, _ANCHO_DETECCION)
        self._detector.setInputSize((pequeno.shape[1], pequeno.shape[0]))
        _, rostros = self._detector.detect(pequeno)
        ahora = time.monotonic()
        vista = _reducir(self._cv2, frame, _ANCHO_VISTA)
        if rostros is None or len(rostros) == 0:
            self._vista = vista
            if self._ultimo_rostro is None or ahora - self._ultimo_rostro >= 0.5:
                return 0, 0, "sin_rostro"
            return self._ultimo_offset[0], self._ultimo_offset[1], "con_rostro"
        fila = max(rostros, key=lambda rostro: float(rostro[2]) * float(rostro[3]))
        x, y, ancho, alto = float(fila[0]), float(fila[1]), float(fila[2]), float(fila[3])
        alto_frame, ancho_frame = pequeno.shape[:2]
        head_x = _offset(x + ancho / 2, ancho_frame)
        head_y = _offset(y + alto / 2, alto_frame)
        self._ultimo_rostro = ahora
        self._ultimo_offset = (head_x, head_y)
        escala = vista.shape[1] / ancho_frame
        cv = self._cv2
        cv.rectangle(
            vista,
            (int(x * escala), int(y * escala)),
            (int((x + ancho) * escala), int((y + alto) * escala)),
            (110, 232, 249),
            2,
        )
        self._vista = vista
        return head_x, head_y, "con_rostro"

    def vista_jpeg(self) -> bytes | None:
        if self._vista is None or self._cv2 is None:
            return None
        ok, buffer = self._cv2.imencode(
            ".jpg", self._vista, [int(self._cv2.IMWRITE_JPEG_QUALITY), 55]
        )
        if not ok:
            return None
        return buffer.tobytes()

    def cerrar(self) -> None:
        self._soltar()

    def _asegurar(self) -> bool:
        if self._cap is not None and self._detector is not None:
            return True
        ahora = time.monotonic()
        if ahora - self._ultimo_intento < _REINTENTO_S:
            return False
        self._ultimo_intento = ahora
        return self._abrir()

    def _abrir(self) -> bool:
        if self._cv2 is None:
            try:
                import cv2
            except ImportError:
                self._marcar("OpenCV no esta instalado")
                return False
            self._cv2 = cv2
        if self._detector is None:
            if not _MODELO.is_file():
                self._marcar("falta el modelo de deteccion de cara")
                return False
            self._detector = self._cv2.FaceDetectorYN.create(
                str(_MODELO), "", (320, 240), 0.7, 0.3, 5000
            )
        backend = self._cv2.CAP_AVFOUNDATION
        for indice in (0, 1):
            cap = self._cv2.VideoCapture(indice, backend)
            if not cap.isOpened():
                cap.release()
                continue
            cap.set(self._cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(self._cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(self._cv2.CAP_PROP_BUFFERSIZE, 1)
            ok, frame = cap.read()
            if ok and frame is not None:
                self._cap = cap
                self._indice = indice
                self._aviso_emitido = False
                LOG.info("camara abierta indice=%s", indice)
                return True
            cap.release()
        self._marcar("no se pudo abrir la camara")
        return False

    def _soltar(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._indice = None

    def _marcar(self, motivo: str) -> None:
        if not self._aviso_emitido:
            LOG.error("camara no disponible: %s", motivo)
            self._aviso_emitido = True


def _reducir(cv2, frame, ancho_objetivo: int):
    alto, ancho = frame.shape[:2]
    if ancho <= ancho_objetivo:
        return frame
    escala = ancho_objetivo / ancho
    return cv2.resize(frame, (ancho_objetivo, max(1, int(alto * escala))))


def _offset(centro: float, tamano: int) -> int:
    if tamano <= 0:
        return 0
    valor = round((centro - tamano / 2) / (tamano / 2) * 100)
    return int(min(100, max(-100, valor)))
