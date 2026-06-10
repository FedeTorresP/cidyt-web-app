"""
Configuración centralizada del worker.

Toda la configuración se lee de variables de entorno (o de un archivo `.env`
en desarrollo local). No se hardcodean endpoints, IDs ni credenciales.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Carga .env si existe (en producción las vars vienen del entorno de Docker).
load_dotenv()


def _get(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Variable de entorno requerida no definida: {name}")
    return value if value is not None else ""


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        logging.warning("Valor inválido para %s=%r; usando default %s", name, raw, default)
        return default


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        logging.warning("Valor inválido para %s=%r; usando default %s", name, raw, default)
        return default


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    """Configuración inmutable del servicio."""

    # --- OData / API SAP ------------------------------------------------------
    odata_endpoint: str
    odata_query_params: str
    odata_auth_type: str          # "none" | "basic" | "bearer"
    odata_username: str
    odata_password: str
    odata_bearer_token: str
    odata_accept: str             # "application/json" | "application/xml"
    request_timeout_seconds: float
    verify_ssl: bool

    # --- Polling --------------------------------------------------------------
    poll_interval_seconds: int

    # --- Firebase -------------------------------------------------------------
    firebase_project_id: str
    google_application_credentials: str

    # --- Auditoría ------------------------------------------------------------
    audit_actor: str

    # --- Logging --------------------------------------------------------------
    log_level: str


def load_settings() -> Settings:
    """Construye Settings desde el entorno, validando lo indispensable."""
    # El intervalo se configura en minutos (más natural para operación) y se
    # convierte a segundos internamente.
    poll_minutes = _get_float("POLL_INTERVAL_MINUTES", 5.0)
    poll_seconds = max(1, int(poll_minutes * 60))

    return Settings(
        odata_endpoint=_get("ODATA_ENDPOINT", required=True),
        odata_query_params=_get("ODATA_QUERY_PARAMS", ""),
        odata_auth_type=_get("ODATA_AUTH_TYPE", "none").strip().lower(),
        odata_username=_get("ODATA_USERNAME", ""),
        odata_password=_get("ODATA_PASSWORD", ""),
        odata_bearer_token=_get("ODATA_BEARER_TOKEN", ""),
        odata_accept=_get("ODATA_ACCEPT", "application/json").strip().lower(),
        request_timeout_seconds=_get_float("REQUEST_TIMEOUT_SECONDS", 30.0),
        verify_ssl=_get_bool("VERIFY_SSL", True),
        poll_interval_seconds=poll_seconds,
        firebase_project_id=_get("FIREBASE_PROJECT_ID", required=True),
        google_application_credentials=_get(
            "GOOGLE_APPLICATION_CREDENTIALS",
            "/app/sa.json",
        ),
        audit_actor=_get("AUDIT_ACTOR", "sap-integration"),
        log_level=_get("LOG_LEVEL", "INFO").upper(),
    )
