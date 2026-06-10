"""
Orquestador de un ciclo de polling.

Encadena: fetch OData → parseo del payload → upsert en Firestore por cada
admisión. Centraliza el manejo de errores para que un fallo en un ciclo (o en
un record concreto) no tumbe el worker: se registra el stack trace y el
worker continúa con el siguiente ciclo.
"""

from __future__ import annotations

import logging
import traceback

from google.cloud.firestore import Client as FirestoreClient

from .config import Settings
from .firestore_writer import upsert_admission
from .poller import ODataFetchError, fetch_admissions
from .xml_parser import ParseError, parse_payload

logger = logging.getLogger(__name__)


def run_cycle(db: FirestoreClient, settings: Settings) -> None:
    """
    Ejecuta un ciclo completo de ingesta.

    No relanza excepciones: las maneja internamente registrando el stack trace,
    para que el bucle de polling siga vivo.
    """
    # 1) Obtener el payload del endpoint OData.
    try:
        content, content_type = fetch_admissions(settings)
    except ODataFetchError:
        logger.error("Fallo al consumir OData:\n%s", traceback.format_exc())
        return

    # 2) Parsear el payload (JSON o XML) a una lista de admisiones.
    try:
        admissions = parse_payload(content, content_type)
    except ParseError:
        logger.error("Fallo al parsear el payload OData:\n%s", traceback.format_exc())
        return

    if not admissions:
        logger.info("Ciclo sin admisiones nuevas para procesar.")
        return

    logger.info("Procesando %d admisión(es) del lote.", len(admissions))

    # 3) Upsert por cada admisión; un record fallido no aborta el lote.
    ok, failed = 0, 0
    for parsed in admissions:
        try:
            upsert_admission(db, parsed, settings)
            ok += 1
        except Exception:  # noqa: BLE001 — aislar el fallo por record
            failed += 1
            logger.error(
                "Fallo al hacer upsert (paciente=%s, seguimiento=%s):\n%s",
                parsed.paciente_id,
                parsed.seguimiento_id,
                traceback.format_exc(),
            )

    logger.info("Ciclo completado — upserts OK=%d, fallidos=%d.", ok, failed)
