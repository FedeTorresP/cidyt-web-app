"""Endpoint de ingesta de pacientes desde SAP."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.patient import PatientBatch, PatientBatchResult
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientBatchResult, summary="Ingesta de pacientes SAP")
def ingest_patients(payload: PatientBatch) -> PatientBatchResult:
    """Recibe un lote de pacientes (JSON) y los registra en Firestore.

    Reemplaza CargaXml.php + CargaDatosPacInterface.php.
    """
    return patient_service.procesar_lote(payload)
