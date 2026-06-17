"""Endpoint de ingesta de paquetes desde SAP."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.package import PackageBatch, PackageBatchResult
from app.services import package_service

router = APIRouter(prefix="/packages", tags=["packages"])


@router.post("", response_model=PackageBatchResult, summary="Ingesta de paquetes SAP")
def ingest_packages(payload: PackageBatch) -> PackageBatchResult:
    """Recibe un lote de paquetes (JSON) y los registra en Firestore.

    Reemplaza insertpackage.php + CreaPaquete.php.
    """
    return package_service.procesar_lote(payload)
