"""Modelos del payload de pacientes que SAP envía como JSON.

Reemplaza el nodo XML <patient> de MT_i151_AdAmbCUP_CiDYT_SFTP.

SAP serializa el XML a JSON con la primera letra en minúscula
(`<PatNoCita>` -> `"patNoCita"`). Para ser robustos, cada campo acepta
mediante `AliasChoices` tanto la forma real de SAP (`patNoCita`), la forma
PascalCase del XML (`PatNoCita`) como el nombre "limpio" interno (`no_cita`).

El mensaje real de SAP llega envuelto así (un paciente por POST):

    {
      "message": { "type": "Import", "event": "Insertpatient", "messageid": "..." },
      "patient": { "patNoCita": "...", ... }
    }

También se acepta el formato de lote propio (`{"patients": [ ... ]}`).
"""

from __future__ import annotations

from enum import Enum

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.core.datetime_mx import normalize_fecha


class SapOperation(str, Enum):
    """Operación solicitada por SAP, derivada de `message.event`."""

    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"

    @classmethod
    def from_event(cls, event: str | None) -> "SapOperation":
        """Mapea el `event` de SAP a una operación.

        Ejemplos: 'Insertpatient' -> INSERT, 'Updatepatient' -> UPDATE,
        'Deletepatient' -> DELETE. Si no se reconoce (o viene vacío), se asume
        INSERT por compatibilidad con el comportamiento histórico.
        """
        if not event:
            return cls.INSERT
        e = event.strip().lower()
        if e.startswith("update") or e.startswith("modif"):
            return cls.UPDATE
        if e.startswith("delete") or e.startswith("remove") or e.startswith("borr"):
            return cls.DELETE
        return cls.INSERT


class SapMessage(BaseModel):
    """Cabecera `message` del payload de SAP (type/event/messageid)."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True, extra="ignore")

    type: str | None = Field(default=None, validation_alias=AliasChoices("type", "Type"))
    event: str | None = Field(default=None, validation_alias=AliasChoices("event", "Event"))
    message_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("messageid", "messageId", "MessageId", "message_id"),
    )

    @property
    def operacion(self) -> SapOperation:
        return SapOperation.from_event(self.event)


class SapPatient(BaseModel):
    """Un paciente/cita proveniente de SAP."""

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, extra="ignore"
    )

    no_cita: str = Field(validation_alias=AliasChoices("no_cita", "patNoCita", "PatNoCita"))
    fecha_cita: str | None = Field(
        default=None,
        validation_alias=AliasChoices("fecha_cita", "patFechaCita", "PatFechaCita"),
    )
    episodio: str | None = Field(
        default=None,
        validation_alias=AliasChoices("episodio", "patEpisodio", "PatEpisodio"),
    )
    num_hist: str | None = Field(
        default=None,
        validation_alias=AliasChoices("num_hist", "patNumHist", "PatNumHist"),
    )
    nombre1: str = Field(validation_alias=AliasChoices("nombre1", "patNombre1", "PatNombre1"))
    nombre2: str | None = Field(
        default=None,
        validation_alias=AliasChoices("nombre2", "patNombre2", "PatNombre2"),
    )
    ape_pat: str = Field(validation_alias=AliasChoices("ape_pat", "patApePat", "PatApePat"))
    ape_mat: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ape_mat", "patApeMat", "PatApeMat"),
    )
    genero: str | None = Field(
        default=None,
        validation_alias=AliasChoices("genero", "patGenero", "PatGenero"),
    )
    fecha_nac: str | None = Field(
        default=None,
        validation_alias=AliasChoices("fecha_nac", "patFechaNac", "PatFechaNac"),
    )
    cte_id: str = Field(
        default="", validation_alias=AliasChoices("cte_id", "patCteId", "PatCteId")
    )
    desc_cte: str = Field(
        default="", validation_alias=AliasChoices("desc_cte", "patDescCte", "PatDescCte")
    )
    paq_id: str = Field(validation_alias=AliasChoices("paq_id", "patPaqId", "PatPaqId"))
    desc_paq: str = Field(
        default="", validation_alias=AliasChoices("desc_paq", "patDesPaq", "PatDesPaq")
    )

    @field_validator("no_cita")
    @classmethod
    def _no_cita_no_vacia(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("PatNoCita es obligatorio y no puede estar vacío")
        return v.strip()

    @field_validator("genero")
    @classmethod
    def _genero_lower(cls, v: str | None) -> str | None:
        # El legacy aplica strtolower() al género ('M' -> 'm').
        return v.lower() if v else v

    @field_validator("fecha_cita", "fecha_nac")
    @classmethod
    def _normaliza_fecha(cls, v: str | None) -> str | None:
        """SAP envía 'yyyy/mm/dd'; se normaliza a 'yyyy-mm-dd'."""
        return normalize_fecha(v)

    @property
    def nombre_completo(self) -> str:
        partes = [self.nombre1, self.nombre2, self.ape_pat, self.ape_mat]
        return " ".join(p for p in partes if p).strip()


class PatientBatch(BaseModel):
    """Lote de pacientes (formato propio de N pacientes)."""

    patients: list[SapPatient] = Field(min_length=1)


class PatientIngestRequest(BaseModel):
    """Solicitud de ingesta de pacientes.

    Acepta los dos formatos:
      - Real de SAP:   {"message": {...}, "patient": {...}}  (1 paciente)
      - Lote propio:   {"patients": [ ... ]}                 (N pacientes)
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    message: SapMessage | None = None
    patient: SapPatient | None = None
    patients: list[SapPatient] | None = None

    @model_validator(mode="after")
    def _al_menos_un_paciente(self) -> "PatientIngestRequest":
        if not self.patient and not self.patients:
            raise ValueError(
                "Debe incluir 'patient' (objeto) o 'patients' (lista) en el payload"
            )
        return self

    @property
    def operacion(self) -> SapOperation:
        return self.message.operacion if self.message else SapOperation.INSERT

    def lista_pacientes(self) -> list[SapPatient]:
        if self.patients:
            return list(self.patients)
        if self.patient:
            return [self.patient]
        return []


class PatientResult(BaseModel):
    """Resultado del procesamiento de un paciente individual."""

    no_cita: str
    status: str  # "procesado" | "actualizado" | "eliminado" | "omitido" | "error"
    operacion: str | None = None
    paciente_id: str | None = None
    seguimiento_id: str | None = None
    detail: str | None = None


class PatientBatchResult(BaseModel):
    """Resumen del procesamiento del lote (equivale a SapProcessResult)."""

    operacion: str | None = None
    procesados: int = 0
    omitidos: int = 0
    errores: int = 0
    resultados: list[PatientResult] = Field(default_factory=list)
