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


def inicio_dia_mx() -> datetime:
    """Hoy a las 00:00:00 en la zona horaria del negocio (tz-aware).

    Firestore lo almacena como Timestamp. Equivale a `dayRangeMX(hoy).start`
    del frontend y se usa para `fechaIngresoUtc`.
    """
    return now_mx().replace(hour=0, minute=0, second=0, microsecond=0)


def fecha_a_datetime(value: str | None) -> datetime | None:
    """Convierte una fecha 'YYYY-MM-DD' a datetime tz-aware (medianoche MX).

    Firestore lo almacena como Timestamp. Se usa para `fechaNacimiento`.
    Devuelve None si el valor está vacío o no se puede parsear.
    """
    iso = normalize_fecha(value)
    if not iso:
        return None
    try:
        y, m, d = (int(p) for p in iso.split("-"))
        return datetime(y, m, d, tzinfo=ZoneInfo(get_settings().timezone))
    except (ValueError, TypeError):
        return None


def normalize_fecha(value: str | None) -> str | None:
    """Normaliza una fecha de SAP a 'YYYY-MM-DD'.

    SAP envía las fechas en varios formatos según el canal:
      - 'yyyy/mm/dd'  (JSON actual de SEND2PO2, p. ej. '2026/06/25')
      - 'dd.mm.yyyy'  (fechas de validez de paquetes)
      - 'yyyy-mm-dd'  (ya normalizada)

    Devuelve la fecha en ISO 'YYYY-MM-DD'. Si no reconoce el formato, devuelve
    el valor original recortado para no perder información.
    """
    if not value:
        return None
    v = value.strip()
    if not v:
        return None

    # dd.mm.yyyy -> yyyy-mm-dd
    if "." in v:
        partes = v.split(".")
        if len(partes) == 3 and len(partes[2]) == 4:
            d, m, y = partes
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"

    # yyyy/mm/dd o dd/mm/yyyy -> yyyy-mm-dd
    if "/" in v:
        partes = v.split("/")
        if len(partes) == 3:
            if len(partes[0]) == 4:  # yyyy/mm/dd
                y, m, d = partes
            else:  # dd/mm/yyyy
                d, m, y = partes
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"

    return v  # ya viene en otro formato (p. ej. yyyy-mm-dd); se deja tal cual
