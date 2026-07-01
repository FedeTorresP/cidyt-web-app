"""Servicio de pacientes — equivale a CargaXml + CargaDatosPacInterface.

La operación se deriva de `message.event` de SAP:
  - INSERT (Insertpatient): alta completa con dedup por No_Cita.
  - UPDATE (Updatepatient): actualiza datos del paciente/cita existente;
    si la cita no existe, se trata como alta (upsert).
  - DELETE (Deletepatient): baja lógica (activo=False) de la cita y sus
    documentos relacionados.

El esquema escrito es el canónico camelCase que consume la app (idéntico al
alta manual `crearPacienteFirestore`): SAP es la fuente de verdad de la
identidad/cita/paquete/empresa, pero NO sobrescribe los campos operativos que
captura el personal en la app (turno, peso/talla, estatus de estudios, etc.).

Flujo de alta por paciente:
  1. Dedup por No_Cita (doc id en la colección interface).
  2. Asegurar empresa (alias) y paquete; crearlos si no existen.
  3. Leer estudios incluidos del paquete desde `paquete_detalle`.
  4. Escribir en una sola operación batch:
       - paciente (camelCase: apePaterno, fechaNacimiento Timestamp, sexo...)
       - seguimiento (camelCase: pacienteId, fechaIngresoUtc Timestamp...)
       - val_corporal (seguimientoId, peso/talla 0.0)
       - estudios_paciente (uno por estudio de paquete_detalle)
       - interface_ipad (trazabilidad + dedup, Estatus_Evaluado=1)
"""

from __future__ import annotations

import logging

from google.cloud import firestore

from app.config import Settings, get_settings
from app.core.datetime_mx import (
    fecha_a_datetime,
    fecha_hoy,
    inicio_dia_mx,
    timestamp_iso,
)
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


def _estudios_de_paquete(db: firestore.Client, s: Settings, paq_id: str) -> list[dict]:
    """Estudios incluidos en un paquete, leídos de `paquete_detalle` (activo).

    Misma fuente que el alta manual del frontend: paquete_detalle filtrado por
    paqueteId y activo. Devuelve [{estudio_id, estatus_inicial}].
    """
    if not paq_id:
        return []
    col = db.collection(s.col_paquete_detalle)
    docs = (
        col.where("paqueteId", "==", paq_id)
        .where("activo", "==", True)
        .stream()
    )
    estudios = []
    for d in docs:
        data = d.to_dict() or {}
        estudios.append(
            {
                "estudio_id": data.get("estudioId"),
                "estatus_inicial": data.get("estatusInicial", 0),
            }
        )
    if not estudios:
        logger.warning(
            "Paquete sin estudios en '%s' (paqueteId=%s): grid de estudios vacío",
            s.col_paquete_detalle,
            paq_id,
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

        # 3. Estudios incluidos en el paquete (paquete_detalle).
        estudios = _estudios_de_paquete(db, s, pat.paq_id)

        # 4. Escritura atómica en batch.
        hoy = fecha_hoy()
        # El día en que aparece el paciente lo define la fecha de cita de SAP;
        # si no viene, se usa hoy como respaldo.
        fecha_ing = pat.fecha_cita or hoy
        fecha_ing_utc = fecha_a_datetime(pat.fecha_cita) or inicio_dia_mx()
        user = s.default_user_crea
        # La app solo entiende sexo 'M'/'F'; cualquier otro valor se descarta.
        genero_norm = (pat.genero or "").upper()
        sexo = genero_norm if genero_norm in {"M", "F"} else None
        ahora_ts = firestore.SERVER_TIMESTAMP

        batch = db.batch()

        # 4a. paciente — esquema canónico camelCase (campos de SAP)
        paciente_ref = db.collection(s.col_pacientes).document()
        batch.set(
            paciente_ref,
            normalize_deep({
                "nombre1": pat.nombre1,
                "nombre2": pat.nombre2,
                "apePaterno": pat.ape_pat,
                "apeMaterno": pat.ape_mat,
                "sexo": sexo,
                "fechaNacimiento": fecha_a_datetime(pat.fecha_nac),
                "historia": pat.num_hist,
                "activo": True,
                "createdBy": user,
                "updatedBy": user,
                "createdAt": ahora_ts,
                "updatedAt": ahora_ts,
            }),
        )

        # 4b. seguimiento — SAP siembra identidad/cita/paquete + defaults
        # operativos (que luego edita el personal en la app).
        seguimiento_ref = db.collection(s.col_seguimientos).document()
        batch.set(
            seguimiento_ref,
            {
                "pacienteId": paciente_ref.id,
                "empresaId": empresa_id or None,
                "paqueteId": pat.paq_id,
                "noCita": pat.no_cita,
                "turno": s.default_turno,
                "fechaIngreso": fecha_ing,
                "fechaIngresoUtc": fecha_ing_utc,
                "estatusSeguimiento": s.default_estatus_seguimiento,
                "desayuno": 0,
                "estatusValpac": 0,
                "padecimientoId": 0,
                "medicoInternistaId": None,
                "fechaEntrega": None,
                "horaEntrega": None,
                "fechaEnvio": None,
                "horaEnvio": None,
                "tarjetaEntRes": 0,
                "observaciones": "",
                "activo": True,
                "createdBy": user,
                "updatedBy": user,
                "createdAt": ahora_ts,
                "updatedAt": ahora_ts,
            },
        )

        # 4c. val_corporal — peso/talla 0 (los captura el personal)
        val_corporal_ref = db.collection(s.col_val_corporal).document()
        batch.set(
            val_corporal_ref,
            {
                "seguimientoId": seguimiento_ref.id,
                "peso": 0.0,
                "talla": 0.0,
                "activo": True,
            },
        )

        # 4d. estudios_paciente (uno por estudio de paquete_detalle)
        for est in estudios:
            ep_ref = db.collection(s.col_estudios_paciente).document()
            batch.set(
                ep_ref,
                {
                    "seguimientoId": seguimiento_ref.id,
                    "estudioId": str(est["estudio_id"]),
                    "estatusEstudioId": str(est["estatus_inicial"]),
                    "medicoId": None,
                    "letraMedico": None,
                    "observaciones": "",
                    "activo": True,
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
        seguimiento_id = data.get("seguimiento_id")
        user = s.default_user_crea
        ahora = timestamp_iso()
        ahora_ts = firestore.SERVER_TIMESTAMP
        genero_norm = (pat.genero or "").upper()
        sexo = genero_norm if genero_norm in {"M", "F"} else None

        # SAP puede cambiar empresa/paquete: se reaseguran.
        empresa_id = _resolve_empresa_opcional(db, s, pat)
        _ensure_paquete(db, s, pat.paq_id, pat.desc_paq)

        batch = db.batch()

        # Actualiza datos del paciente vinculado (solo campos de SAP; camelCase).
        if paciente_id:
            paciente_ref = db.collection(s.col_pacientes).document(paciente_id)
            batch.set(
                paciente_ref,
                normalize_deep({
                    "nombre1": pat.nombre1,
                    "nombre2": pat.nombre2,
                    "apePaterno": pat.ape_pat,
                    "apeMaterno": pat.ape_mat,
                    "sexo": sexo,
                    "fechaNacimiento": fecha_a_datetime(pat.fecha_nac),
                    "historia": pat.num_hist,
                    "updatedBy": user,
                    "updatedAt": ahora_ts,
                }),
                merge=True,
            )

        # Sincroniza SOLO los campos de SAP en el seguimiento (paquete/empresa);
        # nunca toca campos operativos capturados en la app ni re-siembra estudios.
        if seguimiento_id:
            seguimiento_ref = db.collection(s.col_seguimientos).document(seguimiento_id)
            seg_update = {
                "paqueteId": pat.paq_id,
                "empresaId": empresa_id or None,
                "updatedBy": user,
                "updatedAt": ahora_ts,
            }
            # La fecha de cita es campo de SAP: si viene, se sincroniza el día
            # en que el paciente aparece en la lista (sin tocar campos operativos).
            fecha_ing_utc = fecha_a_datetime(pat.fecha_cita)
            if fecha_ing_utc is not None:
                seg_update["fechaIngreso"] = pat.fecha_cita
                seg_update["fechaIngresoUtc"] = fecha_ing_utc
            batch.set(seguimiento_ref, seg_update, merge=True)

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
