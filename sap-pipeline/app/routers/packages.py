"""Endpoint de ingesta de paquetes desde SAP."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.package import PackageBatchResult, PackageIngestRequest
from app.services import package_service

router = APIRouter(prefix="/packages", tags=["packages"])


@router.post("", response_model=PackageBatchResult, summary="Ingesta de paquetes SAP")
def ingest_packages(payload: PackageIngestRequest) -> PackageBatchResult:
    """Recibe paquetes desde SAP (JSON) y los registra en Firestore.

    Acepta el formato real de SAP (`{"message": {...}, "package": {...}}`) y el
    formato de lote propio (`{"packages": [ ... ]}`).

    Reemplaza insertpackage.php + CreaPaquete.php.
    """
    return package_service.procesar_solicitud(payload)
