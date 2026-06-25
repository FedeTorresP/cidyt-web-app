"""
API de pruebas para recepción de mensajes JSON desde SAP ECC (método SEND2PO2).

Objetivo: recibir el POST enviado por el cliente HTTP de ABAP, guardarlo en disco
y responder rápido. Pensada SOLO para pruebas locales, no para producción.
"""

import json
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, request, jsonify

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "received_messages"
STORAGE_DIR.mkdir(exist_ok=True)

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "api.log"

_log_format = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

# Log a consola
_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_log_format)

# Log a archivo con rotación (5 archivos de 1 MB) para tener persistencia
_file_handler = RotatingFileHandler(
    LOG_FILE, maxBytes=1_000_000, backupCount=5, encoding="utf-8"
)
_file_handler.setFormatter(_log_format)

logger = logging.getLogger("send2po2-test-api")
logger.setLevel(logging.INFO)
logger.addHandler(_console_handler)
logger.addHandler(_file_handler)

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def _save_message(raw_body: bytes, headers: dict) -> Path:
    """Guarda el cuerpo recibido en un archivo con marca de tiempo.

    Si el cuerpo es JSON válido se guarda formateado (.json); en caso
    contrario se guarda tal cual se recibió (.txt) para no perder nada.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

    try:
        parsed = json.loads(raw_body.decode("utf-8"))
        file_path = STORAGE_DIR / f"msg_{timestamp}.json"
        file_path.write_text(
            json.dumps(parsed, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except (ValueError, UnicodeDecodeError):
        file_path = STORAGE_DIR / f"msg_{timestamp}.txt"
        file_path.write_bytes(raw_body)

    return file_path


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.route("/", defaults={"path": ""}, methods=["POST"])
@app.route("/<path:path>", methods=["POST"])
def receive(path):
    """Recibe cualquier POST, lo guarda y confirma con 200."""
    raw_body = request.get_data() or b""
    headers = dict(request.headers)

    file_path = _save_message(raw_body, headers)

    logger.info(
        "Mensaje recibido en /%s (%d bytes) -> %s",
        path,
        len(raw_body),
        file_path.name,
    )
    logger.info("Content-Type: %s", headers.get("Content-Type", "(sin definir)"))
    logger.info("Cuerpo:\n%s", raw_body.decode("utf-8", errors="replace"))

    return jsonify(status="ok", stored_as=file_path.name), 200


@app.route("/health", methods=["GET"])
def health():
    """Verificación rápida de que la API está arriba."""
    return jsonify(status="up"), 200


if __name__ == "__main__":
    # host 0.0.0.0 para que sea accesible desde otros equipos de la red local
    # (p.ej. el servidor SAP). Puerto 8000 por defecto.
    logger.info("Guardando mensajes en: %s", STORAGE_DIR)
    logger.info("Log persistente en: %s", LOG_FILE)
    app.run(host="0.0.0.0", port=8000, debug=True)
