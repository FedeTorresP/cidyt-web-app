"""Punto de entrada de la API FastAPI del pipeline SAP → Firestore.

Arranque local:
    uvicorn app.main:app --reload --port 8000

Docs interactivas: http://localhost:8000/docs
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

from app import __version__
from app.config import get_settings
from app.routers import packages, patients

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="SAP → Firestore Pipeline — IPadCIDyT",
    description=(
        "Ingesta de pacientes y paquetes desde SAP (JSON) hacia Firestore. "
        "Reemplaza los scripts PHP legacy (CargaXml, CargaDatosPacInterface, "
        "insertpackage, CreaPaquete)."
    ),
    version=__version__,
)

app.include_router(patients.router)
app.include_router(packages.router)


@app.get("/health", tags=["health"], summary="Healthcheck")
def health() -> dict:
    """Verifica que el servicio está arriba."""
    return {"status": "ok", "version": __version__, "env": settings.app_env}
