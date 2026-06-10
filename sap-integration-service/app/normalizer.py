"""
Normalización Unicode NFC.

Regla de negocio innegociable: TODOS los strings extraídos del XML deben
guardarse en forma Unicode NFC para garantizar consistencia de renderizado
entre macOS (que tiende a producir NFD) y Linux.

Estas utilidades recorren recursivamente estructuras anidadas (dict/list)
y normalizan cualquier `str` que encuentren.
"""

from __future__ import annotations

import unicodedata
from typing import Any


def normalize_text(value: str) -> str:
    """Normaliza un string a forma NFC, recortando espacios sobrantes."""
    # NFC compone los caracteres (p.ej. 'e' + acento → 'é' precompuesto).
    return unicodedata.normalize("NFC", value).strip()


def normalize_deep(value: Any) -> Any:
    """
    Normaliza recursivamente cualquier `str` dentro de dicts, listas o tuplas.

    Los valores no-string (int, float, bool, None, Timestamps, Sentinels de
    Firestore, etc.) se devuelven intactos.
    """
    if isinstance(value, str):
        return normalize_text(value)
    if isinstance(value, dict):
        return {key: normalize_deep(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalize_deep(item) for item in value]
    return value
