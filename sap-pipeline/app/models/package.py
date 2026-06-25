"""Modelos del payload de paquetes que SAP envía como JSON.

Reemplaza el XML de insertpackage.php (<header> + <body><detail>).

Igual que en pacientes, SAP serializa el XML a JSON con la primera letra en
minúscula. Cada campo acepta vía `AliasChoices` la forma de SAP (`prestacion`),
la PascalCase del XML (`Prestacion`) y el nombre interno (`id_prestacion`).
"""

from __future__ import annotations

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.core.datetime_mx import normalize_fecha
from app.models.patient import SapMessage, SapOperation


class SapPrestacion(BaseModel):
    """Una prestación (estudio/servicio) dentro de un paquete."""

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, extra="ignore"
    )

    id_prestacion: str = Field(
        validation_alias=AliasChoices("id_prestacion", "prestacion", "Prestacion")
    )
    descripcion: str = Field(
        default="", validation_alias=AliasChoices("descripcion", "descPrest", "DescPrest")
    )
    posicion: int = Field(
        default=0, validation_alias=AliasChoices("posicion", "Posicion")
    )
    cantidad: int = Field(
        default=1, validation_alias=AliasChoices("cantidad", "Cantidad")
    )
    # SAP envía fechas como dd.mm.yyyy o yyyy/mm/dd; se normalizan a yyyy-mm-dd.
    validez_de: str | None = Field(
        default=None, validation_alias=AliasChoices("validez_de", "validezde", "Validezde")
    )
    validez_a: str | None = Field(
        default=None, validation_alias=AliasChoices("validez_a", "valideza", "Valideza")
    )

    @field_validator("validez_de", "validez_a")
    @classmethod
    def _normaliza_fecha(cls, v: str | None) -> str | None:
        """Convierte 'dd.mm.yyyy' / 'yyyy/mm/dd' -> 'yyyy-mm-dd'."""
        return normalize_fecha(v)


class SapPackage(BaseModel):
    """Un paquete proveniente de SAP (header + prestaciones)."""

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, extra="ignore"
    )

    ce_sanitario: str | None = Field(
        default=None, validation_alias=AliasChoices("ce_sanitario", "ceSanitario", "CeSanitario")
    )
    cat_prestaciones: str | None = Field(
        default=None,
        validation_alias=AliasChoices("cat_prestaciones", "catPrestaciones", "CatPrestaciones"),
    )
    paquete: str = Field(validation_alias=AliasChoices("paquete", "Paquete"))
    desc_paq: str = Field(
        default="", validation_alias=AliasChoices("desc_paq", "descPaq", "DescPaq")
    )
    activo: bool = Field(default=True, validation_alias=AliasChoices("activo", "Activo"))
    prestaciones: list[SapPrestacion] = Field(default_factory=list)

    @field_validator("paquete")
    @classmethod
    def _paquete_no_vacio(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Paquete es obligatorio y no puede estar vacío")
        return v.strip()

    @field_validator("activo", mode="before")
    @classmethod
    def _activo_flexible(cls, v: object) -> bool:
        # SAP puede mandar "1"/"0", "true"/"false", o booleano.
        if isinstance(v, str):
            return v.strip().lower() in {"1", "true", "si", "sí", "x"}
        return bool(v)


class PackageBatch(BaseModel):
    """Lote de paquetes (formato propio de N paquetes)."""

    packages: list[SapPackage] = Field(min_length=1)


class PackageIngestRequest(BaseModel):
    """Solicitud de ingesta de paquetes.

    Acepta el formato real de SAP (`{"message": {...}, "package": {...}}`) y el
    formato de lote propio (`{"packages": [ ... ]}`).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    message: SapMessage | None = None
    package: SapPackage | None = None
    packages: list[SapPackage] | None = None

    @model_validator(mode="after")
    def _al_menos_un_paquete(self) -> "PackageIngestRequest":
        if not self.package and not self.packages:
            raise ValueError(
                "Debe incluir 'package' (objeto) o 'packages' (lista) en el payload"
            )
        return self

    @property
    def operacion(self) -> SapOperation:
        return self.message.operacion if self.message else SapOperation.INSERT

    def lista_paquetes(self) -> list[SapPackage]:
        if self.packages:
            return list(self.packages)
        if self.package:
            return [self.package]
        return []


class PackageResult(BaseModel):
    """Resultado del procesamiento de un paquete individual."""

    paquete: str
    status: str  # "procesado" | "error"
    prestaciones: int = 0
    detail: str | None = None


class PackageBatchResult(BaseModel):
    """Resumen del procesamiento del lote de paquetes."""

    operacion: str | None = None
    procesados: int = 0
    errores: int = 0
    resultados: list[PackageResult] = Field(default_factory=list)
