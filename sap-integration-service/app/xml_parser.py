"""
Parseo y mapeo de los registros de admisión provenientes de la API OData de SAP.

Este módulo es agnóstico al formato del payload: la API OData puede responder
en JSON (envelope v2 `{"d": {"results": [...]}}` o v4 `{"value": [...]}`) o en
XML plano (Atom/feed con entradas, o el mismo nodo
`MT_i151_AdAmbCUP_CiDYT_SFTP`). En ambos casos se extrae una lista de
"records" (dicts con los campos `Pat*`) y se mapea cada uno a los documentos
de Firestore `pacientes` y `seguimientos`.

Campos esperados por record (nombres de SAP):
    PatNoCita, PatFechaCita, PatEpisodio, PatNumHist, PatNombre1, PatApePat,
    PatApeMat, PatGenero, PatFechaNac, PatCteId, PatDescCte, PatPaqId, PatDesPaq
    (messageid opcional, a nivel de mensaje)

Mapeo a Firestore:
  - paciente.id      ← PatNumHist  (núm. historia clínica, estable entre citas)
  - seguimiento.id   ← PatNoCita   (identificador de la cita/admisión)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from lxml import etree

logger = logging.getLogger(__name__)

ROOT_NODE_LOCAL_NAME = "MT_i151_AdAmbCUP_CiDYT_SFTP"

# Campos que identifican un record de paciente dentro del payload.
PATIENT_FIELDS = frozenset(
    {
        "PatNoCita",
        "PatFechaCita",
        "PatEpisodio",
        "PatNumHist",
        "PatNombre1",
        "PatApePat",
        "PatApeMat",
        "PatGenero",
        "PatFechaNac",
        "PatCteId",
        "PatDescCte",
        "PatPaqId",
        "PatDesPaq",
    }
)


class ParseError(Exception):
    """Error de parseo, de estructura o de campos mínimos del payload."""


@dataclass
class ParsedAdmission:
    """Resultado estructurado del mapeo de un record de admisión."""

    paciente_id: str
    paciente: dict[str, Any]
    seguimiento: dict[str, Any]
    seguimiento_id: str
    meta: dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Utilidades comunes
# =============================================================================

def _clean(value: Any) -> str | None:
    """Convierte un valor a str recortado, o None si está vacío/ausente."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_date(raw: str | None) -> datetime | None:
    """
    Convierte una fecha del payload a datetime (UTC, naive→aware).
    SAP emite fechas en formato YYYY/MM/DD; se aceptan otros formatos comunes
    por robustez (incluido ISO 8601 de OData v4).
    """
    if not raw:
        return None
    raw = raw.strip()
    formats = (
        "%Y/%m/%d",            # formato clásico de SAP (PatFechaNac, PatFechaCita)
        "%Y-%m-%d",
        "%Y%m%d",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",  # ISO 8601 UTC (OData v4)
    )
    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    logger.warning("Formato de fecha no reconocido: %r", raw)
    return None


# =============================================================================
# Extracción de records desde el payload (JSON o XML)
# =============================================================================

def _localname(tag: str) -> str:
    return etree.QName(tag).localname if tag else tag


def extract_records_from_json(payload: Any) -> list[dict[str, Any]]:
    """
    Extrae la lista de records de paciente de una respuesta OData JSON.

    Soporta:
      - OData v2:  {"d": {"results": [ {...}, ... ]}}  ó  {"d": {...}}
      - OData v4:  {"value": [ {...}, ... ]}
      - Lista cruda: [ {...}, ... ]
      - Objeto único: {...}
    """
    candidates: list[Any]

    if isinstance(payload, list):
        candidates = payload
    elif isinstance(payload, dict):
        if "d" in payload and isinstance(payload["d"], dict):
            d = payload["d"]
            candidates = d.get("results", [d])
        elif "value" in payload and isinstance(payload["value"], list):
            candidates = payload["value"]
        else:
            candidates = [payload]
    else:
        raise ParseError(f"Payload JSON OData no reconocido: {type(payload).__name__}")

    records: list[dict[str, Any]] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        # Descarta metadatos de OData (__metadata, etc.) y deja solo campos Pat*.
        record = {k: v for k, v in item.items() if k in PATIENT_FIELDS}
        if record:
            records.append(record)
    return records


def extract_records_from_xml(payload: bytes | str) -> list[dict[str, Any]]:
    """
    Extrae records de paciente de un payload XML.

    Soporta tanto el nodo `MT_i151_AdAmbCUP_CiDYT_SFTP` (uno o varios <patient>)
    como feeds Atom de OData donde los campos vienen como elementos.
    """
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    try:
        parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
        root = etree.fromstring(payload, parser)
    except etree.XMLSyntaxError as exc:
        raise ParseError(f"XML malformado o ilegible: {exc}") from exc

    records: list[dict[str, Any]] = []

    # Estrategia: localizar todos los nodos <patient>; si no hay, intentar
    # construir un record desde cualquier subárbol que contenga campos Pat*.
    patient_nodes = [
        el for el in root.iter()
        if isinstance(el.tag, str) and _localname(el.tag) == "patient"
    ]

    if patient_nodes:
        for node in patient_nodes:
            record: dict[str, Any] = {}
            for child in node.iter():
                if not isinstance(child.tag, str):
                    continue
                name = _localname(child.tag)
                if name in PATIENT_FIELDS and child.text:
                    record[name] = child.text.strip()
            if record:
                records.append(record)
    else:
        # Fallback: recolectar campos Pat* dispersos en todo el árbol.
        record = {}
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            name = _localname(el.tag)
            if name in PATIENT_FIELDS and el.text:
                record[name] = el.text.strip()
        if record:
            records.append(record)

    return records


# =============================================================================
# Mapeo de un record → documentos de Firestore
# =============================================================================

def map_record(record: dict[str, Any], *, message_id: str | None = None) -> ParsedAdmission:
    """
    Mapea un record (dict de campos Pat*) a los documentos paciente/seguimiento.

    Lanza ParseError si faltan los campos mínimos obligatorios.
    """
    no_cita = _clean(record.get("PatNoCita"))
    fecha_cita_raw = _clean(record.get("PatFechaCita"))
    episodio = _clean(record.get("PatEpisodio"))
    num_hist = _clean(record.get("PatNumHist"))
    nombre1 = _clean(record.get("PatNombre1"))
    ape_paterno = _clean(record.get("PatApePat"))
    ape_materno = _clean(record.get("PatApeMat"))
    genero = _clean(record.get("PatGenero"))
    fecha_nac_raw = _clean(record.get("PatFechaNac"))
    cliente_id = _clean(record.get("PatCteId"))
    cliente_desc = _clean(record.get("PatDescCte"))
    paquete_id = _clean(record.get("PatPaqId"))
    paquete_desc = _clean(record.get("PatDesPaq"))

    paciente_id = num_hist
    seguimiento_id = no_cita

    # --- Validación de campos mínimos obligatorios ----------------------------
    if not paciente_id:
        raise ParseError("El record no contiene número de historia clínica (PatNumHist).")
    if not nombre1 or not ape_paterno:
        raise ParseError(
            "El record no contiene los campos mínimos del paciente "
            "(PatNombre1 y PatApePat)."
        )
    # Sin folio de cita derivamos uno determinista para mantener idempotencia.
    if not seguimiento_id:
        seguimiento_id = f"{paciente_id}-{(message_id or 'sincita')}"

    fecha_nacimiento = _parse_date(fecha_nac_raw)
    fecha_cita = _parse_date(fecha_cita_raw)

    # --- Documento paciente (colección `pacientes`) ---------------------------
    paciente: dict[str, Any] = {
        "id": paciente_id,
        "nombre1": nombre1,
        "apePaterno": ape_paterno,
        "activo": True,
    }
    if ape_materno:
        paciente["apeMaterno"] = ape_materno
    if genero:
        paciente["sexo"] = genero
    if num_hist:
        paciente["numHistoria"] = num_hist
    if fecha_nacimiento is not None:
        paciente["_fechaNacimiento"] = fecha_nacimiento

    # --- Documento seguimiento (colección `seguimientos`) ---------------------
    seguimiento: dict[str, Any] = {
        "id": seguimiento_id,
        "pacienteId": paciente_id,
        "estatusSeguimiento": "ADMITIDO",  # estado inicial al ingresar por SAP
        "activo": True,
    }
    if cliente_id:
        seguimiento["empresaId"] = cliente_id
    if cliente_desc:
        seguimiento["empresaNombre"] = cliente_desc
    if no_cita:
        seguimiento["noCita"] = no_cita
    if episodio:
        seguimiento["episodio"] = episodio
    if paquete_id:
        seguimiento["paqueteId"] = paquete_id
    if paquete_desc:
        seguimiento["paqueteDescripcion"] = paquete_desc
    if fecha_cita is not None:
        seguimiento["_fechaCita"] = fecha_cita

    return ParsedAdmission(
        paciente_id=paciente_id,
        paciente=paciente,
        seguimiento=seguimiento,
        seguimiento_id=seguimiento_id,
        meta={"message_id": message_id},
    )


def parse_payload(
    content: bytes | str,
    content_type: str,
) -> list[ParsedAdmission]:
    """
    Punto de entrada: recibe el body crudo del response OData y su Content-Type,
    elige el extractor adecuado (JSON/XML) y devuelve la lista de admisiones
    mapeadas. Los records inválidos se omiten con un warning (no abortan el lote).
    """
    ctype = (content_type or "").lower()

    if "json" in ctype:
        import json

        text = content.decode("utf-8") if isinstance(content, bytes) else content
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ParseError(f"JSON malformado en el response OData: {exc}") from exc
        records = extract_records_from_json(payload)
    elif "xml" in ctype:
        records = extract_records_from_xml(content)
    else:
        # Sin Content-Type claro: intentar JSON y caer a XML.
        text = content.decode("utf-8", "ignore") if isinstance(content, bytes) else content
        stripped = text.lstrip()
        if stripped.startswith("{") or stripped.startswith("["):
            import json

            records = extract_records_from_json(json.loads(text))
        else:
            records = extract_records_from_xml(content)

    admissions: list[ParsedAdmission] = []
    for record in records:
        try:
            admissions.append(map_record(record))
        except ParseError as exc:
            logger.warning("Record omitido por datos inválidos: %s", exc)
    return admissions
