"""
Cliente HTTP del endpoint OData de SAP.

Realiza la petición GET al endpoint configurado y devuelve el cuerpo crudo
junto con su Content-Type, para que `xml_parser.parse_payload` decida cómo
interpretarlo (JSON o XML).

La seguridad de red la maneja el túnel de Google ya existente; aquí solo se
configura el endpoint y, opcionalmente, autenticación a nivel de aplicación
(Basic o Bearer) vía variables de entorno.
"""

from __future__ import annotations

import logging

import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class ODataFetchError(Exception):
    """Error al consumir el endpoint OData (red, timeout o status != 2xx)."""


def _build_auth(settings: Settings) -> httpx.Auth | None:
    if settings.odata_auth_type == "basic":
        if not settings.odata_username:
            raise ODataFetchError(
                "ODATA_AUTH_TYPE=basic requiere ODATA_USERNAME/ODATA_PASSWORD."
            )
        return httpx.BasicAuth(settings.odata_username, settings.odata_password)
    return None


def _build_headers(settings: Settings) -> dict[str, str]:
    headers = {"Accept": settings.odata_accept}
    if settings.odata_auth_type == "bearer":
        if not settings.odata_bearer_token:
            raise ODataFetchError(
                "ODATA_AUTH_TYPE=bearer requiere ODATA_BEARER_TOKEN."
            )
        headers["Authorization"] = f"Bearer {settings.odata_bearer_token}"
    return headers


def fetch_admissions(settings: Settings) -> tuple[bytes, str]:
    """
    Ejecuta el GET contra el endpoint OData.

    Devuelve (body_bytes, content_type). Lanza ODataFetchError ante cualquier
    fallo de red, timeout o respuesta con status de error.
    """
    url = settings.odata_endpoint
    params = settings.odata_query_params or None

    try:
        with httpx.Client(
            timeout=settings.request_timeout_seconds,
            verify=settings.verify_ssl,
            follow_redirects=True,
        ) as client:
            response = client.get(
                url,
                params=params,
                headers=_build_headers(settings),
                auth=_build_auth(settings),
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ODataFetchError(
            f"El endpoint OData respondió {exc.response.status_code}: "
            f"{exc.response.text[:500]}"
        ) from exc
    except httpx.RequestError as exc:
        raise ODataFetchError(f"Error de red al consumir OData: {exc}") from exc

    content_type = response.headers.get("Content-Type", settings.odata_accept)
    logger.info(
        "OData OK — status=%s, bytes=%d, content-type=%s",
        response.status_code,
        len(response.content),
        content_type,
    )
    return response.content, content_type
