"""Servicio de pacientes — equivale a CargaXml + CargaDatosPacInterface.

La operación se deriva de `message.event` de SAP:
  - INSERT (Insertpatient): alta completa con dedup por No_Cita.
  - UPDATE (Updatepatient): actualiza datos del paciente/cita existente;
    si la cita no existe, se trata como alta (upsert).
  - DELETE (Deletepatient): baja lógica (activo=False) de la cita y sus
    documentos relacionados.

Flujo de alta por paciente:
  1. Dedup por No_Cita (doc id en la colección interface).
  2. Asegurar empresa (alias) y paquete; crearlos si no existen.
  3. Leer catálogo de estudios con mostrar_interface=true y activo=true.
  4. Escribir en una sola operación batch:
       - interface_ipad (trazabilidad + dedup, Estatus_Evaluado=1)
       - paciente
       - seguimiento (valoracion_pac)
       - val_corporal (peso/talla 0.0)
       - estudios_realizar (uno por estudio del catálogo)
"""

from __future__ import annotations

import logging

from google.cloud import firestore

from app.config import Settings, get_settings
from app.core.datetime_mx import fecha_hoy, hora_ahora, timestamp_iso
from app.core.normalizer import normalize_deep
from app.firebase import get_db
from app.models.patient import (
    PatientBatchResult,
    PatientIngestRequest,
    PatientResult,
    SapOperation,
    SapPatient,
)

logger = logging.getLogger(__name__)


def _resolve_empresa_id(db: firestore.Client, s: Settings, alias: str, nombre: str) -> str:
    """Devuelve el doc id de la empresa por alias; la crea si no existe.

    Equivale a AgregaEmpresa() + el SELECT Empresa_Id del legacy.
    """
    col = db.collection(s.col_empresas)
    existing = list(col.where("alias_empresa", "==", alias).limit(1).stream())
    if existing:
        return existing[0].id

    doc = col.document()
    doc.set(
        {
            "alias_empresa": alias,
            "nombre": nombre or alias,
            "descripcion": nombre or alias,
            "orden_mostrar": 500,
            "activo": True,
            "fecha_crea": timestamp_iso(),
        }
    )
    logger.info("Empresa creada: %s — %s", alias, nombre)
    return doc.id


def _resolve_empresa_opcional(db: firestore.Client, s: Settings, pat: SapPatient) -> str:
    """Resuelve la empresa solo si SAP envió un cte_id no vacío.

    SAP puede mandar `patCteId=""` (paciente sin empresa/particular). En ese
    caso no creamos una empresa con alias vacío: devolvemos "".
    """
    alias = (pat.cte_id or "").strip()
    if not alias:
        logger.info("Paciente sin empresa (cte_id vacío) — No_Cita=%s", pat.no_cita)
        return ""
    return _resolve_empresa_id(db, s, alias, pat.desc_cte)


def _ensure_paquete(db: firestore.Client, s: Settings, paq_id: str, nombre: str) -> None:
    """Crea el paquete si no existe (doc id = paq_id). Equivale a AgregaPaquete()."""
    if not paq_id:
        return
    ref = db.collection(s.col_paquetes).document(paq_id)
    if not ref.get().exists:
        ref.set(
            {
                "paquete_id": paq_id,
                "nombre": nombre or paq_id,
                "activo": True,
                "fecha_crea": timestamp_iso(),
            }
        )
        logger.info("Paquete creado: %s — %s", paq_id, nombre)


def _catalogo_estudios(db: firestore.Client, s: Settings) -> list[dict]:
    """Estudios con mostrar_interface=true y activo=true.

    Equivale a: SELECT nombre, estudio_id FROM estudio
    WHERE Mostrar_Interface = 1 AND activo = 1.
    """
    col = db.collection(s.col_estudios)
    docs = (
        col.where("mostrar_interface", "==", True)
        .where("activo", "==", True)
        .stream()
    )
    estudios = []
    for d in docs:
        data = d.to_dict() or {}
        estudios.append(
            {
                "estudio_id": data.get("estudio_id", d.id),
                "nombre": data.get("nombre", ""),
            }
        )
    if not estudios:
        logger.warning(
            "Catálogo de estudios vacío (col '%s'): no se crearán estudios_realizar",
            s.col_estudios,
        )
    return estudios


def _insertar_paciente(db: firestore.Client, s: Settings, pat: SapPatient) -> PatientResult:
    """Alta de un único paciente. No lanza excepción: la captura y la reporta."""
    try:
        interface_ref = db.collection(s.col_interface).document(pat.no_cita)

        # 1. Dedup por No_Cita (doc id natural).
        if interface_ref.get().exists:
            logger.info("Cita ya existe (No_Cita=%s) — omitido", pat.no_cita)
            return PatientResult(
                no_cita=pat.no_cita, status="omitido", operacion=SapOperation.INSERT.value
            )

        # 2. Empresa (opcional) y paquete.
        empresa_id = _resolve_empresa_opcional(db, s, pat)
        _ensure_paquete(db, s, pat.paq_id, pat.desc_paq)

        # 3. Catálogo de estudios.
        estudios = _catalogo_estudios(db, s)

        # 4. Escritura atómica en batch.
        hoy = fecha_hoy()
        ahora = hora_ahora()
        user = s.default_user_crea

        batch = db.batch()

        # 4a. paciente (NFC para consistencia macOS/Linux)
        paciente_ref = db.collection(s.col_pacientes).document()
        batch.set(
            paciente_ref,
            normalize_deep({
                "nombre1": pat.nombre1,
                "nombre2": pat.nombre2,
                "apellido_paterno": pat.ape_pat,
                "apellido_materno": pat.ape_mat,
                "nombre_completo": pat.nombre_completo,
                "genero": pat.genero,
                "historia": pat.num_hist,
                "fecha_nac": pat.fecha_nac,
                "activo": True,
                "user_crea": user,
                "fecha_crea": hoy,
            }),
        )

        # 4b. seguimiento (valoracion_pac)
        seguimiento_ref = db.collection(s.col_seguimientos).document()
        batch.set(
            seguimiento_ref,
            {
                "entidad_id": s.default_entidad_id,
                "paciente_id": paciente_ref.id,
                "paquete_id": pat.paq_id,
                "empresa_id": empresa_id,
                "medico_id": s.default_medico_id,
                "no_cita": pat.no_cita,
                "fecha_ingreso": hoy,
                "hora_ingreso": ahora,
                "turno": s.default_turno,
                "horario_id": s.default_horario_id,
                "desayuno": 0,
                "estatus_valpac_id": 0,
                "activo": True,
                "user_crea": user,
                "fecha_crea": hoy,
            },
        )

        # 4c. val_corporal
        val_corporal_ref = db.collection(s.col_val_corporal).document()
        batch.set(
            val_corporal_ref,
            {
                "seguimiento_id": seguimiento_ref.id,
                "entidad_id": s.default_entidad_id,
                "paciente_id": paciente_ref.id,
                "peso": 0.0,
                "talla": 0.0,
                "activo": True,
                "user_crea": user,
                "fecha_crea": hoy,
            },
        )

        # 4d. estudios_realizar (uno por estudio del catálogo)
        for est in estudios:
            er_ref = db.collection(s.col_estudios_realizar).document()
            batch.set(
                er_ref,
                {
                    "seguimiento_id": seguimiento_ref.id,
                    "entidad_id": s.default_entidad_id,
                    "paciente_id": paciente_ref.id,
                    "estudio_id": est["estudio_id"],
                    "nombre": est["nombre"],
                    "estudio_tipo_id": 1,
                    "estatus_est_id": 0,
                    "activo": True,
                    "user_crea": user,
                    "fecha_crea": hoy,
                },
            )

        # 4e. interface_ipad (trazabilidad; ya procesado)
        batch.set(
            interface_ref,
            normalize_deep({
                "no_cita": pat.no_cita,
                "fecha_cita": pat.fecha_cita,
                "historia": pat.num_hist,
                "historia_tmp": pat.episodio,
                "nombre1": pat.nombre1,
                "nombre2": pat.nombre2,
                "ape_paterno": pat.ape_pat,
                "ape_materno": pat.ape_mat,
                "genero": pat.genero,
                "fecha_nac": pat.fecha_nac,
                "id_empresa": pat.cte_id,
                "desc_empresa": pat.desc_cte,
                "id_paquete": pat.paq_id,
                "paquete_rel": pat.paq_id,
                "desc_paquete": pat.desc_paq,
                "estatus_evaluado": 1,
                "activo": True,
                "paciente_id": paciente_ref.id,
                "seguimiento_id": seguimiento_ref.id,
                "fecha_crea": hoy,
                "user_crea": user,
            }),
        )

        batch.commit()

        logger.info(
            "Paciente procesado: No_Cita=%s paciente=%s seguimiento=%s estudios=%d",
            pat.no_cita,
            paciente_ref.id,
            seguimiento_ref.id,
            len(estudios),
        )
        return PatientResult(
            no_cita=pat.no_cita,
            status="procesado",
            operacion=SapOperation.INSERT.value,
            paciente_id=paciente_ref.id,
            seguimiento_id=seguimiento_ref.id,
        )

    except Exception as exc:  # noqa: BLE001 — se reporta por paciente
        logger.exception("Error insertando No_Cita=%s", pat.no_cita)
        return PatientResult(
            no_cita=pat.no_cita,
            status="error",
            operacion=SapOperation.INSERT.value,
            detail=str(exc),
        )


def _actualizar_paciente(db: firestore.Client, s: Settings, pat: SapPatient) -> PatientResult:
    """Actualiza una cita existente. Si no existe, hace alta (upsert)."""
    try:
        interface_ref = db.collection(s.col_interface).document(pat.no_cita)
        snap = interface_ref.get()
        if not snap.exists:
            logger.info("Update sin cita previa (No_Cita=%s) — se da de alta", pat.no_cita)
            return _insertar_paciente(db, s, pat)

        data = snap.to_dict() or {}
        paciente_id = data.get("paciente_id")
        user = s.default_user_crea
        ahora = timestamp_iso()

        batch = db.batch()

        # Actualiza datos del paciente vinculado (si lo hay).
        if paciente_id:
            paciente_ref = db.collection(s.col_pacientes).document(paciente_id)
            batch.set(
                paciente_ref,
                normalize_deep({
                    "nombre1": pat.nombre1,
                    "nombre2": pat.nombre2,
                    "apellido_paterno": pat.ape_pat,
                    "apellido_materno": pat.ape_mat,
                    "nombre_completo": pat.nombre_completo,
                    "genero": pat.genero,
                    "historia": pat.num_hist,
                    "fecha_nac": pat.fecha_nac,
                    "user_mod": user,
                    "fecha_mod": ahora,
                }),
                merge=True,
            )

        # Actualiza la trazabilidad en interface.
        batch.set(
            interface_ref,
            normalize_deep({
                "fecha_cita": pat.fecha_cita,
                "historia": pat.num_hist,
                "historia_tmp": pat.episodio,
                "nombre1": pat.nombre1,
                "nombre2": pat.nombre2,
                "ape_paterno": pat.ape_pat,
                "ape_materno": pat.ape_mat,
                "genero": pat.genero,
                "fecha_nac": pat.fecha_nac,
                "id_empresa": pat.cte_id,
                "desc_empresa": pat.desc_cte,
                "id_paquete": pat.paq_id,
                "paquete_rel": pat.paq_id,
                "desc_paquete": pat.desc_paq,
                "user_mod": user,
                "fecha_mod": ahora,
            }),
            merge=True,
        )

        batch.commit()
        logger.info("Paciente actualizado: No_Cita=%s paciente=%s", pat.no_cita, paciente_id)
        return PatientResult(
            no_cita=pat.no_cita,
            status="actualizado",
            operacion=SapOperation.UPDATE.value,
            paciente_id=paciente_id,
            seguimiento_id=data.get("seguimiento_id"),
        )

    except Exception as exc:  # noqa: BLE001
        logger.exception("Error actualizando No_Cita=%s", pat.no_cita)
        return PatientResult(
            no_cita=pat.no_cita,
            status="error",
            operacion=SapOperation.UPDATE.value,
            detail=str(exc),
        )


def _eliminar_paciente(db: firestore.Client, s: Settings, pat: SapPatient) -> PatientResult:
    """Baja lógica (activo=False) de la cita y sus documentos relacionados."""
    try:
        interface_ref = db.collection(s.col_interface).document(pat.no_cita)
        snap = interface_ref.get()
        if not snap.exists:
            logger.info("Delete sin cita previa (No_Cita=%s) — omitido", pat.no_cita)
            return PatientResult(
                no_cita=pat.no_cita, status="omitido", operacion=SapOperation.DELETE.value
            )

        data = snap.to_dict() or {}
        paciente_id = data.get("paciente_id")
        seguimiento_id = data.get("seguimiento_id")
        user = s.default_user_crea
        ahora = timestamp_iso()
        baja = {"activo": False, "user_mod": user, "fecha_mod": ahora}

        batch = db.batch()
        batch.set(interface_ref, baja, merge=True)
        if paciente_id:
            batch.set(db.collection(s.col_pacientes).document(paciente_id), baja, merge=True)
        if seguimiento_id:
            batch.set(
                db.collection(s.col_seguimientos).document(seguimiento_id), baja, merge=True
            )
        batch.commit()

        logger.info("Paciente eliminado (baja lógica): No_Cita=%s", pat.no_cita)
        return PatientResult(
            no_cita=pat.no_cita,
            status="eliminado",
            operacion=SapOperation.DELETE.value,
            paciente_id=paciente_id,
            seguimiento_id=seguimiento_id,
        )

    except Exception as exc:  # noqa: BLE001
        logger.exception("Error eliminando No_Cita=%s", pat.no_cita)
        return PatientResult(
            no_cita=pat.no_cita,
            status="error",
            operacion=SapOperation.DELETE.value,
            detail=str(exc),
        )


_DISPATCH = {
    SapOperation.INSERT: _insertar_paciente,
    SapOperation.UPDATE: _actualizar_paciente,
    SapOperation.DELETE: _eliminar_paciente,
}


def procesar_solicitud(req: PatientIngestRequest) -> PatientBatchResult:
    """Procesa la solicitud de SAP según la operación y devuelve el resumen."""
    s = get_settings()
    db = get_db()
    operacion = req.operacion
    handler = _DISPATCH[operacion]
    resultado = PatientBatchResult(operacion=operacion.value)

    for pat in req.lista_pacientes():
        r = handler(db, s, pat)
        resultado.resultados.append(r)
        if r.status == "error":
            resultado.errores += 1
        elif r.status == "omitido":
            resultado.omitidos += 1
        else:  # procesado | actualizado | eliminado
            resultado.procesados += 1

    logger.info(
        "Solicitud pacientes (%s) — procesados: %d, omitidos: %d, errores: %d",
        operacion.value,
        resultado.procesados,
        resultado.omitidos,
        resultado.errores,
    )
    return resultado
