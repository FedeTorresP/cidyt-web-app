"""Endpoint de ingesta de pacientes desde SAP."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.patient import PatientBatchResult, PatientIngestRequest
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientBatchResult, summary="Ingesta de pacientes SAP")
def ingest_patients(payload: PatientIngestRequest) -> PatientBatchResult:
    """Recibe pacientes desde SAP (JSON) y los procesa en Firestore.

    Acepta el formato real de SAP (`{"message": {...}, "patient": {...}}`) y el
    formato de lote propio (`{"patients": [ ... ]}`). La operación
    (insert/update/delete) se deriva de `message.event`.

    Reemplaza CargaXml.php + CargaDatosPacInterface.php.
    """
    return patient_service.procesar_solicitud(payload)
