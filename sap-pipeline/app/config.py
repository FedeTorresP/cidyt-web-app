"""Configuración central del pipeline.

Todos los valores se cargan desde variables de entorno (.env) usando
pydantic-settings. Los nombres de colecciones Firestore son configurables
para que coincidan con el esquema que ya tiene definido el frontend.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings del pipeline, cargadas desde .env / entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Firebase -----------------------------------------------------------
    firebase_credentials_path: str = "./serviceAccountKey.json"
    firebase_project_id: str | None = None

    # --- Colecciones Firestore ---------------------------------------------
    col_interface: str = "interface_ipad"
    col_pacientes: str = "pacientes"
    col_seguimientos: str = "seguimientos"
    col_val_corporal: str = "val_corporal"
    col_estudios_paciente: str = "estudios_paciente"
    col_paquete_detalle: str = "paquete_detalle"
    # Deprecada: el pipeline ya no escribe estudios_realizar (se usa
    # estudios_paciente, el esquema canónico que consume la app).
    col_estudios_realizar: str = "estudios_realizar"
    col_empresas: str = "empresas"
    col_paquetes: str = "paquetes"
    col_paquete_det: str = "paquete_det"
    col_prestaciones: str = "prestaciones"
    col_paquete_prestacion: str = "paquete_prestacion"
    col_estudios: str = "estudios"

    # --- Valores por defecto del seguimiento (legacy) ----------------------
    default_entidad_id: int = 10
    default_turno: int = 1
    default_horario_id: int = 1
    default_medico_id: int = 0
    default_user_crea: str = "SAP"
    default_estatus_seguimiento: str = "EN_PROCESO"
    paquete_det_estudios: int = 20

    # --- General ------------------------------------------------------------
    timezone: str = "America/Mexico_City"
    app_env: str = "development"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings (singleton)."""
    return Settings()
