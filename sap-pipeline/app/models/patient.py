"""Modelos del payload de pacientes que SAP enviará como JSON.

Reemplaza el nodo XML <patient> de MT_i151_AdAmbCUP_CiDYT_SFTP.
Los campos conservan los nombres originales de SAP (PatNoCita, PatNombre1,
...) vía alias, pero también aceptan los nombres "limpios" gracias a
`populate_by_name`. Así SAP puede mandar cualquiera de las dos formas.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SapPatient(BaseModel):
    """Un paciente/cita proveniente de SAP."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    no_cita: str = Field(alias="PatNoCita")
    fecha_cita: str | None = Field(default=None, alias="PatFechaCita")
    episodio: str | None = Field(default=None, alias="PatEpisodio")
    num_hist: str | None = Field(default=None, alias="PatNumHist")
    nombre1: str = Field(alias="PatNombre1")
    nombre2: str | None = Field(default=None, alias="PatNombre2")
    ape_pat: str = Field(alias="PatApePat")
    ape_mat: str | None = Field(default=None, alias="PatApeMat")
    genero: str | None = Field(default=None, alias="PatGenero")
    fecha_nac: str | None = Field(default=None, alias="PatFechaNac")
    cte_id: str = Field(alias="PatCteId")
    desc_cte: str = Field(default="", alias="PatDescCte")
    paq_id: str = Field(alias="PatPaqId")
    desc_paq: str = Field(default="", alias="PatDesPaq")

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

    @property
    def nombre_completo(self) -> str:
        partes = [self.nombre1, self.nombre2, self.ape_pat, self.ape_mat]
        return " ".join(p for p in partes if p).strip()


class PatientBatch(BaseModel):
    """Lote de pacientes. SAP puede enviar 1 o N en una sola petición."""

    patients: list[SapPatient] = Field(min_length=1)


class PatientResult(BaseModel):
    """Resultado del procesamiento de un paciente individual."""

    no_cita: str
    status: str  # "procesado" | "omitido" | "error"
    paciente_id: str | None = None
    seguimiento_id: str | None = None
    detail: str | None = None


class PatientBatchResult(BaseModel):
    """Resumen del procesamiento del lote (equivale a SapProcessResult)."""

    procesados: int = 0
    omitidos: int = 0
    errores: int = 0
    resultados: list[PatientResult] = Field(default_factory=list)
