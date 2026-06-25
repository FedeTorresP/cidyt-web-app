"""Servicio de paquetes — equivale a insertpackage.php + CreaPaquete.php.

Flujo por paquete (recibido como JSON desde SAP):
  1. Upsert del paquete (doc id = paquete).
  2. paquete_det: estudios 1..N (legacy: 1..20).
  3. Por cada prestación: upsert en prestaciones + upsert en paquete_prestacion.

Usa MERGE (set merge=True) para replicar el ON DUPLICATE KEY UPDATE del legacy.
"""

from __future__ import annotations

import logging

from google.cloud import firestore

from app.config import Settings, get_settings
from app.core.datetime_mx import timestamp_iso
from app.core.normalizer import normalize_deep
from app.firebase import get_db
from app.models.package import (
    PackageBatchResult,
    PackageIngestRequest,
    PackageResult,
    SapPackage,
)

logger = logging.getLogger(__name__)


def _upsert_paquete(db: firestore.Client, s: Settings, pkg: SapPackage) -> None:
    """Upsert del paquete (equivale al INSERT ... ON DUPLICATE KEY UPDATE)."""
    db.collection(s.col_paquetes).document(pkg.paquete).set(
        normalize_deep({
            "paquete_id": pkg.paquete,
            "nombre": pkg.desc_paq,
            "ce_sanitario": pkg.ce_sanitario,
            "cat_prestaciones": pkg.cat_prestaciones,
            "activo": pkg.activo,
            "fecha_modificacion": timestamp_iso(),
        }),
        merge=True,
    )


def _upsert_paquete_det(db: firestore.Client, s: Settings, paquete: str) -> None:
    """Crea paquete_det para estudios 1..N (legacy: for k in 1..20)."""
    batch = db.batch()
    for k in range(1, s.paquete_det_estudios + 1):
        doc_id = f"{paquete}__{k}"
        ref = db.collection(s.col_paquete_det).document(doc_id)
        batch.set(
            ref,
            {
                "paquete_id": paquete,
                "estudio_id": k,
                "fecha_modificacion": timestamp_iso(),
            },
            merge=True,
        )
    batch.commit()


def _upsert_prestaciones(db: firestore.Client, s: Settings, pkg: SapPackage) -> int:
    """Upsert de prestaciones + relación paquete_prestacion.

    Devuelve el número de prestaciones procesadas.
    """
    batch = db.batch()
    count = 0
    for p in pkg.prestaciones:
        # prestacion (catálogo)
        prest_ref = db.collection(s.col_prestaciones).document(p.id_prestacion)
        batch.set(
            prest_ref,
            normalize_deep({
                "id_prestacion": p.id_prestacion,
                "descripcion": p.descripcion,
                "posicion": p.posicion,
                "validez_de": p.validez_de,
                "validez_a": p.validez_a,
                "activa": True,
                "fecha_modificacion": timestamp_iso(),
            }),
            merge=True,
        )

        # paquete_prestacion (relación)
        rel_id = f"{pkg.paquete}__{p.id_prestacion}"
        rel_ref = db.collection(s.col_paquete_prestacion).document(rel_id)
        batch.set(
            rel_ref,
            {
                "paquete_id": pkg.paquete,
                "id_prestacion": p.id_prestacion,
                "cantidad": p.cantidad,
                "activo": True,
                "fecha_modificacion": timestamp_iso(),
            },
            merge=True,
        )
        count += 1

    batch.commit()
    return count


def _procesar_paquete(db: firestore.Client, s: Settings, pkg: SapPackage) -> PackageResult:
    """Procesa un único paquete. Captura errores y los reporta."""
    try:
        _upsert_paquete(db, s, pkg)
        _upsert_paquete_det(db, s, pkg.paquete)
        n = _upsert_prestaciones(db, s, pkg)
        logger.info("Paquete procesado: %s (%d prestaciones)", pkg.paquete, n)
        return PackageResult(paquete=pkg.paquete, status="procesado", prestaciones=n)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error procesando paquete=%s", pkg.paquete)
        return PackageResult(paquete=pkg.paquete, status="error", detail=str(exc))


def procesar_solicitud(req: PackageIngestRequest) -> PackageBatchResult:
    """Procesa la solicitud de paquetes de SAP y devuelve el resumen."""
    s = get_settings()
    db = get_db()
    operacion = req.operacion
    resultado = PackageBatchResult(operacion=operacion.value)

    for pkg in req.lista_paquetes():
        r = _procesar_paquete(db, s, pkg)
        resultado.resultados.append(r)
        if r.status == "procesado":
            resultado.procesados += 1
        else:
            resultado.errores += 1

    logger.info(
        "Solicitud paquetes (%s) — procesados: %d, errores: %d",
        operacion.value,
        resultado.procesados,
        resultado.errores,
    )
    return resultado
