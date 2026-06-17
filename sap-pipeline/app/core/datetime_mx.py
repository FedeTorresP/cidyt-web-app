"""Helpers de fecha/hora en la zona horaria del negocio (America/Mexico_City).

Replica formatDateMX / nowMX del frontend para mantener consistencia.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import get_settings


def now_mx() -> datetime:
    """Datetime actual en la zona horaria configurada."""
    return datetime.now(ZoneInfo(get_settings().timezone))


def fecha_hoy() -> str:
    """Fecha actual como 'YYYY-MM-DD'."""
    return now_mx().strftime("%Y-%m-%d")


def hora_ahora() -> str:
    """Hora actual como 'HH:MM:SS'."""
    return now_mx().strftime("%H:%M:%S")


def timestamp_iso() -> str:
    """Timestamp ISO 8601 con zona horaria."""
    return now_mx().isoformat()
