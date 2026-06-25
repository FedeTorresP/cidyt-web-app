"""Cloud Function (gen2, Python) — Relay HTTPS SAP -> sap-pipeline On-Premise.

Esta función finaliza la integración del microservicio `sap-pipeline`.

Flujo
-----
1. La administradora confirma una cita/admisión en **SAP** (método ABAP
   SEND2PO2), que envía por HTTPS el payload completo
   (`controller` + `message` + `patient`) a esta función pública.
2. La función **autentica** al llamante (cabecera `X-API-Key`), valida el cuerpo
   y lo **reenvía tal cual** (passthrough) al servicio `sap-pipeline` disponible
   **On-Premise** vía `POST /patients`.
3. La conectividad privada hacia On-Premise se realiza a través del conector de
   Serverless VPC Access asociado a la **VPC compartida `core-red-compartida`**
   (egress `PRIVATE_RANGES_ONLY`).
4. `sap-pipeline` valida y escribe en Firestore; el web app muestra los datos.

La función devuelve a SAP el status y cuerpo que respondió el pipeline
(passthrough), de modo que SAP conoce el resultado real de la ingesta.

Toda la configuración no sensible (URL privada On-Premise, nombre completo del
conector VPC) se inyecta por variables de entorno (`functions/.env`); los
secretos (`SAP_INBOUND_API_KEY`, opcional `ON_PREM_AUTH_VALUE`) se gestionan con
Firebase Secret Manager (`firebase functions:secrets:set ...`).
"""

from __future__ import annotations

import hmac
import json
import logging
import os

import requests
from firebase_functions import https_fn, options

logger = logging.getLogger("sap-relay")
logger.setLevel(logging.INFO)

# --------------------------------------------------------------------------- #
# Configuración (deploy-time). Se cargan desde functions/.env(.<project>).
# --------------------------------------------------------------------------- #
REGION = os.environ.get("FUNCTION_REGION", "us-central1")

# Conector de Serverless VPC Access en la VPC compartida `core-red-compartida`.
# En una Shared VPC el conector vive en el HOST project, por lo que se debe
# referenciar el recurso COMPLETO:
#   projects/<HOST_PROJECT_ID>/locations/<REGION>/connectors/<NOMBRE_CONECTOR>
VPC_CONNECTOR = os.environ.get(
    "VPC_CONNECTOR",
    "projects/HOST_PROJECT_ID/locations/us-central1/connectors/core-red-compartida-conn",
)

# URL base privada del sap-pipeline On-Premise (alcanzable vía core-red-compartida).
ON_PREM_BASE_URL = os.environ.get("ON_PREM_BASE_URL", "http://ON_PREM_HOST:8000").rstrip("/")
ON_PREM_PATIENTS_PATH = os.environ.get("ON_PREM_PATIENTS_PATH", "/patients")
ON_PREM_TIMEOUT_SEC = int(os.environ.get("ON_PREM_TIMEOUT_SEC", "30"))

# Header de auth opcional para el endpoint On-Premise (API key / token).
# El NOMBRE del header es config; el VALOR debe venir como secret (ON_PREM_AUTH_VALUE).
ON_PREM_AUTH_HEADER = os.environ.get("ON_PREM_AUTH_HEADER", "")

# Nombre del header con el que SAP debe autenticarse contra esta función.
SAP_API_KEY_HEADER = os.environ.get("SAP_API_KEY_HEADER", "X-API-Key")

# Nombres de los secretos gestionados por Firebase Secret Manager.
_SECRET_SAP_INBOUND_API_KEY = "SAP_INBOUND_API_KEY"
_SECRET_ON_PREM_AUTH_VALUE = "ON_PREM_AUTH_VALUE"


def _json_response(payload: dict, status: int) -> https_fn.Response:
    """Construye una respuesta JSON consistente."""
    return https_fn.Response(
        json.dumps(payload, ensure_ascii=False),
        status=status,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )


def _is_authorized(req: https_fn.Request) -> bool:
    """Valida el secreto compartido enviado por SAP en la cabecera configurada.

    Usa comparación en tiempo constante para evitar fugas por timing. Si el
    secreto no está configurado en el entorno, se rechaza (fail-closed).
    """
    expected = os.environ.get(_SECRET_SAP_INBOUND_API_KEY, "")
    if not expected:
        logger.error(
            "SAP_INBOUND_API_KEY no está configurado; se rechaza la petición (fail-closed)."
        )
        return False

    provided = req.headers.get(SAP_API_KEY_HEADER, "")
    if not provided:
        return False

    return hmac.compare_digest(provided, expected)


@https_fn.on_request(
    region=REGION,
    timeout_sec=120,
    memory=options.MemoryOption.MB_256,
    max_instances=10,
    vpc_connector=VPC_CONNECTOR,
    vpc_connector_egress_settings=options.VpcEgressSetting.PRIVATE_RANGES_ONLY,
    secrets=[_SECRET_SAP_INBOUND_API_KEY, _SECRET_ON_PREM_AUTH_VALUE],
)
def relay_sap_to_onprem(req: https_fn.Request) -> https_fn.Response:
    """Recibe el payload de SAP y lo reenvía al sap-pipeline On-Premise."""
    if req.method != "POST":
        return _json_response(
            {"status": "error", "detail": "Método no permitido; usa POST."}, 405
        )

    if not _is_authorized(req):
        logger.warning("Petición no autorizada (cabecera %s inválida).", SAP_API_KEY_HEADER)
        return _json_response({"status": "error", "detail": "No autorizado."}, 401)

    # El cuerpo debe ser JSON (el payload SAP: controller + message + patient).
    try:
        payload = req.get_json(force=False, silent=False)
    except Exception:  # noqa: BLE001 — cualquier fallo de parseo => 400.
        payload = None

    if not isinstance(payload, dict):
        return _json_response(
            {"status": "error", "detail": "Cuerpo JSON inválido o ausente."}, 400
        )

    url = f"{ON_PREM_BASE_URL}{ON_PREM_PATIENTS_PATH}"
    headers = {"Content-Type": "application/json; charset=utf-8"}

    # Auth opcional hacia el On-Premise (nombre por env, valor por secret).
    on_prem_auth_value = os.environ.get(_SECRET_ON_PREM_AUTH_VALUE, "")
    if ON_PREM_AUTH_HEADER and on_prem_auth_value:
        headers[ON_PREM_AUTH_HEADER] = on_prem_auth_value

    try:
        response = requests.post(
            url, json=payload, headers=headers, timeout=ON_PREM_TIMEOUT_SEC
        )
    except requests.Timeout:
        logger.error("Timeout al reenviar a %s (%ss).", url, ON_PREM_TIMEOUT_SEC)
        return _json_response(
            {"status": "error", "detail": "Timeout hacia el servicio On-Premise."}, 504
        )
    except requests.RequestException as exc:
        logger.error("Error de conexión al reenviar a %s: %s", url, exc)
        return _json_response(
            {"status": "error", "detail": "No se pudo contactar el servicio On-Premise."},
            502,
        )

    logger.info("Payload reenviado a %s (HTTP %s).", url, response.status_code)

    # Passthrough: devolvemos a SAP el status y cuerpo reales del pipeline.
    content_type = response.headers.get("Content-Type", "application/json; charset=utf-8")
    return https_fn.Response(
        response.content,
        status=response.status_code,
        headers={"Content-Type": content_type},
    )
