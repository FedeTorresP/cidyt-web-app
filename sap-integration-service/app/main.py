"""
Entrypoint del worker de integración SAP (polling OData).

Secuencia de arranque:
 1. Carga configuración desde el entorno.
 2. Configura logging a stdout (logs del contenedor).
 3. Inicializa Firebase Admin SDK.
 4. Entra en el bucle de polling: cada POLL_INTERVAL_MINUTES ejecuta un ciclo
    de ingesta (fetch OData → parse → upsert), hasta recibir SIGTERM/SIGINT.
"""

from __future__ import annotations

import logging
import signal
import sys
import threading

from .config import load_settings
from .firebase_client import init_firebase
from .processor import run_cycle

logger = logging.getLogger("sap_integration")

# Evento global que señaliza la petición de apagado.
_shutdown = threading.Event()


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )


def _install_signal_handlers() -> None:
    def _handle(signum, _frame):
        logger.info("Señal %s recibida. Solicitando apagado...", signum)
        _shutdown.set()

    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)


def main() -> int:
    settings = load_settings()
    _configure_logging(settings.log_level)
    _install_signal_handlers()

    logger.info("=== SAP Integration Worker (OData polling) iniciando ===")
    logger.info("Endpoint OData: %s", settings.odata_endpoint)
    logger.info("Intervalo de polling: %d s", settings.poll_interval_seconds)

    # Inicializa Firebase (falla rápido si la Service Account no está montada).
    try:
        db = init_firebase(settings)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo inicializar Firebase. Abortando arranque.")
        return 1

    logger.info("Worker activo. Ejecutando primer ciclo de inmediato...")

    # Bucle de polling: ejecuta un ciclo y espera el intervalo (interrumpible).
    while not _shutdown.is_set():
        run_cycle(db, settings)
        # Espera con corte temprano si llega una señal de apagado.
        _shutdown.wait(timeout=settings.poll_interval_seconds)

    logger.info("=== SAP Integration Worker detenido ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
