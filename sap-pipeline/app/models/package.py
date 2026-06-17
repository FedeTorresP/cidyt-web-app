"""Modelos del payload de paquetes que SAP enviará como JSON.

Reemplaza el XML de insertpackage.php (<header> + <body><detail>).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SapPrestacion(BaseModel):
    """Una prestación (estudio/servicio) dentro de un paquete."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    id_prestacion: str = Field(alias="Prestacion")
    descripcion: str = Field(default="", alias="DescPrest")
    posicion: int = Field(default=0, alias="Posicion")
    cantidad: int = Field(default=1, alias="Cantidad")
    # SAP envía fechas como dd.mm.yyyy; se normalizan a yyyy-mm-dd.
    validez_de: str | None = Field(default=None, alias="Validezde")
    validez_a: str | None = Field(default=None, alias="Valideza")

    @field_validator("validez_de", "validez_a")
    @classmethod
    def _normaliza_fecha(cls, v: str | None) -> str | None:
        """Convierte 'dd.mm.yyyy' -> 'yyyy-mm-dd' (igual que el legacy)."""
        if not v:
            return None
        partes = v.split(".")
        if len(partes) == 3:
            d, m, y = partes
            return f"{y}-{m}-{d}"
        return v  # ya viene en otro formato; se deja tal cual


class SapPackage(BaseModel):
    """Un paquete proveniente de SAP (header + prestaciones)."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    ce_sanitario: str | None = Field(default=None, alias="CeSanitario")
    cat_prestaciones: str | None = Field(default=None, alias="CatPrestaciones")
    paquete: str = Field(alias="Paquete")
    desc_paq: str = Field(default="", alias="DescPaq")
    activo: bool = Field(default=True, alias="Activo")
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
    """Lote de paquetes. SAP puede enviar 1 o N."""

    packages: list[SapPackage] = Field(min_length=1)


class PackageResult(BaseModel):
    """Resultado del procesamiento de un paquete individual."""

    paquete: str
    status: str  # "procesado" | "error"
    prestaciones: int = 0
    detail: str | None = None


class PackageBatchResult(BaseModel):
    """Resumen del procesamiento del lote de paquetes."""

    procesados: int = 0
    errores: int = 0
    resultados: list[PackageResult] = Field(default_factory=list)
