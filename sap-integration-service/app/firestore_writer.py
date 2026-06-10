"""
Escritura (upsert) en Firestore de las colecciones vinculadas
`pacientes` y `seguimientos`.

- Usa server-side Timestamps (SERVER_TIMESTAMP) para campos de auditoría.
- Normaliza a NFC todos los strings justo antes de persistir.
- Escribe ambos documentos en un WriteBatch para que la operación sea atómica:
  o se commitean los dos, o ninguno.
- El upsert se hace con merge=True para no pisar campos previos (p.ej. datos
  capturados manualmente en la SPA) ni regenerar createdAt en reprocesos.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from google.cloud import firestore
from google.cloud.firestore import Client as FirestoreClient

from .config import Settings
from .normalizer import normalize_deep
from .xml_parser import ParsedAdmission

logger = logging.getLogger(__name__)

PACIENTES_COLLECTION = "pacientes"
SEGUIMIENTOS_COLLECTION = "seguimientos"


def _build_paciente_doc(
    parsed: ParsedAdmission,
    settings: Settings,
    paciente_exists: bool,
) -> dict[str, Any]:
    """Arma el documento de paciente con strings NFC y Timestamps de servidor."""
    doc: dict[str, Any] = normalize_deep(dict(parsed.paciente))

    # Convierte la fecha de nacimiento (datetime) en valor nativo de Firestore.
    fecha_nac = doc.pop("_fechaNacimiento", None)
    if isinstance(fecha_nac, datetime):
        doc["fechaNacimiento"] = fecha_nac

    # Auditoría: createdAt solo en alta; updatedAt siempre.
    doc["updatedBy"] = settings.audit_actor
    doc["updatedAt"] = firestore.SERVER_TIMESTAMP
    if not paciente_exists:
        doc["createdBy"] = settings.audit_actor
        doc["createdAt"] = firestore.SERVER_TIMESTAMP

    return doc


def _build_seguimiento_doc(
    parsed: ParsedAdmission,
    settings: Settings,
    seguimiento_exists: bool,
) -> dict[str, Any]:
    """Arma el documento de seguimiento con strings NFC y Timestamps de servidor."""
    doc: dict[str, Any] = normalize_deep(dict(parsed.seguimiento))

    # Convierte la fecha de cita (datetime) en valor nativo de Firestore.
    fecha_cita = doc.pop("_fechaCita", None)
    if isinstance(fecha_cita, datetime):
        doc["fechaCita"] = fecha_cita

    doc["updatedBy"] = settings.audit_actor
    doc["updatedAt"] = firestore.SERVER_TIMESTAMP
    if not seguimiento_exists:
        # fechaIngresoUtc y createdAt se fijan en el momento de la ingesta.
        doc["fechaIngresoUtc"] = firestore.SERVER_TIMESTAMP
        doc["createdBy"] = settings.audit_actor
        doc["createdAt"] = firestore.SERVER_TIMESTAMP

    return doc


def upsert_admission(
    db: FirestoreClient,
    parsed: ParsedAdmission,
    settings: Settings,
) -> None:
    """
    Realiza el upsert atómico de paciente + seguimiento.

    Lanza una excepción (propagada al caller) si la escritura falla, de modo
    que el ciclo de vida del archivo lo envíe a la carpeta de Errores.
    """
    paciente_ref = db.collection(PACIENTES_COLLECTION).document(parsed.paciente_id)
    seguimiento_ref = (
        db.collection(SEGUIMIENTOS_COLLECTION).document(parsed.seguimiento_id)
    )

    # Detecta existencia previa para no regenerar createdAt en reprocesos.
    paciente_exists = paciente_ref.get().exists
    seguimiento_exists = seguimiento_ref.get().exists

    paciente_doc = _build_paciente_doc(parsed, settings, paciente_exists)
    seguimiento_doc = _build_seguimiento_doc(parsed, settings, seguimiento_exists)

    # WriteBatch → atomicidad: ambos documentos se commitean juntos.
    batch = db.batch()
    batch.set(paciente_ref, paciente_doc, merge=True)
    batch.set(seguimiento_ref, seguimiento_doc, merge=True)
    batch.commit()

    logger.info(
        "Upsert OK — paciente=%s (%s), seguimiento=%s (%s)",
        parsed.paciente_id,
        "actualizado" if paciente_exists else "creado",
        parsed.seguimiento_id,
        "actualizado" if seguimiento_exists else "creado",
    )
